-- Membership Points System - Phase 1
-- This file defines the database schema for the membership points feature
-- Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 2.3, 6.1, 6.2, 6.3

-- ============================================================================
-- Table 1: user_profiles
-- User membership information including points balance and membership level
-- Requirements: 1.1, 1.2, 1.6
-- ============================================================================
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  membership_level TEXT NOT NULL DEFAULT 'free' CHECK (membership_level IN ('free', 'pro', 'team')),
  points INTEGER NOT NULL DEFAULT 0 CHECK (points >= 0),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for membership level queries
CREATE INDEX idx_user_profiles_membership_level ON user_profiles(membership_level);

-- Trigger for updated_at timestamp
CREATE TRIGGER update_user_profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_profiles
CREATE POLICY "Users can view own profile"
  ON user_profiles FOR SELECT
  USING (id = auth.uid());

CREATE POLICY "Users can create own profile"
  ON user_profiles FOR INSERT
  WITH CHECK (id = auth.uid());

CREATE POLICY "Users can update own profile"
  ON user_profiles FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE POLICY "Users can delete own profile"
  ON user_profiles FOR DELETE
  USING (id = auth.uid());

-- Enable Realtime for user_profiles
ALTER PUBLICATION supabase_realtime ADD TABLE user_profiles;

-- ============================================================================
-- Table 2: point_transactions
-- Records all point balance changes for audit and history
-- Requirements: 1.3, 1.6
-- ============================================================================
CREATE TABLE point_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('earn', 'spend', 'adjust')),
  amount INTEGER NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('registration', 'generate_ops', 'generate_image', 'export', 'admin', 'daily_login', 'purchase')),
  reference_id UUID,
  model_name TEXT,
  balance_after INTEGER NOT NULL CHECK (balance_after >= 0),
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for efficient queries
CREATE INDEX idx_point_transactions_user_id ON point_transactions(user_id);
CREATE INDEX idx_point_transactions_created_at ON point_transactions(created_at DESC);
CREATE INDEX idx_point_transactions_type ON point_transactions(type);
CREATE INDEX idx_point_transactions_user_created ON point_transactions(user_id, created_at DESC);

-- Enable RLS
ALTER TABLE point_transactions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for point_transactions
CREATE POLICY "Users can view own transactions"
  ON point_transactions FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can create own transactions"
  ON point_transactions FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- No UPDATE or DELETE policies - transactions are immutable

-- ============================================================================
-- Table 3: membership_configs
-- Configuration for each membership level
-- Requirements: 1.4
-- ============================================================================
CREATE TABLE membership_configs (
  level TEXT PRIMARY KEY CHECK (level IN ('free', 'pro', 'team')),
  display_name TEXT NOT NULL,
  initial_points INTEGER NOT NULL DEFAULT 100,
  perks JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- Table 4: system_settings
-- Global system configuration including feature toggles
-- ============================================================================
CREATE TABLE IF NOT EXISTS system_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger for updated_at timestamp
CREATE TRIGGER update_system_settings_updated_at
  BEFORE UPDATE ON system_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies for system_settings (public read)
CREATE POLICY "Anyone can read system settings"
  ON system_settings FOR SELECT
  USING (true);

-- Seed Data: Payment toggle (default enabled)
INSERT INTO system_settings (key, value, description) VALUES
  ('payment_enabled', '{"enabled": true}'::jsonb, '充值入口开关，设为 false 关闭充值功能')
ON CONFLICT (key) DO NOTHING;

-- Trigger for updated_at timestamp
CREATE TRIGGER update_membership_configs_updated_at
  BEFORE UPDATE ON membership_configs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE membership_configs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for membership_configs (public read)
CREATE POLICY "Anyone can read membership configs"
  ON membership_configs FOR SELECT
  USING (true);

-- Seed Data
INSERT INTO membership_configs (level, display_name, initial_points, perks) VALUES
  ('free', '免费版', 100, '{"no_watermark": false, "priority_queue": false}'::jsonb),
  ('pro', '专业版', 500, '{"no_watermark": true, "priority_queue": false}'::jsonb),
  ('team', '团队版', 2000, '{"no_watermark": true, "priority_queue": true}'::jsonb)
ON CONFLICT (level) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  initial_points = EXCLUDED.initial_points,
  perks = EXCLUDED.perks;

-- ============================================================================
-- Extend ai_models table with points_cost
-- Requirements: 2.3
-- ============================================================================
ALTER TABLE ai_models ADD COLUMN IF NOT EXISTS points_cost INTEGER NOT NULL DEFAULT 10;

-- Update ai_models with points_cost values
UPDATE ai_models SET points_cost = 10 WHERE name = 'gpt-4o-mini';
UPDATE ai_models SET points_cost = 20 WHERE name = 'gpt-4o';
UPDATE ai_models SET points_cost = 25 WHERE name = 'gpt-4-turbo';
UPDATE ai_models SET points_cost = 8 WHERE name = 'claude-3-haiku';
UPDATE ai_models SET points_cost = 15 WHERE name = 'claude-3-sonnet';
UPDATE ai_models SET points_cost = 30 WHERE name = 'doubao-seedream-4-5-251128';

-- ============================================================================
-- Function: handle_new_user
-- Creates user profile and grants initial points on registration
-- Requirements: 1.5, 6.1, 6.2, 6.3
-- ============================================================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_initial_points INTEGER;
  v_membership_level TEXT := 'free';
BEGIN
  -- Check if profile already exists (idempotency)
  IF EXISTS (SELECT 1 FROM public.user_profiles WHERE id = NEW.id) THEN
    RETURN NEW;
  END IF;

  -- Get initial points from membership config
  SELECT initial_points INTO v_initial_points
  FROM public.membership_configs
  WHERE level = v_membership_level;

  -- Default to 100 if config not found
  IF v_initial_points IS NULL THEN
    v_initial_points := 100;
  END IF;

  -- Create user profile
  INSERT INTO public.user_profiles (id, membership_level, points)
  VALUES (NEW.id, v_membership_level, v_initial_points);

  -- Create transaction record for initial points
  INSERT INTO public.point_transactions (user_id, type, amount, source, balance_after, metadata)
  VALUES (
    NEW.id,
    'earn',
    v_initial_points,
    'registration',
    v_initial_points,
    jsonb_build_object('reason', 'Welcome bonus for new user registration')
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;

-- Trigger: on_auth_user_created
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();
