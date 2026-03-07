-- Inspiration Discovery: schema (additive, idempotent)

BEGIN;

-- Categories
CREATE TABLE IF NOT EXISTS publication_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  icon TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO publication_categories (name, slug, icon, sort_order, is_active)
VALUES
  ('海报设计', 'poster-design', '🖼️', 1, true),
  ('社交媒体', 'social-media', '📱', 2, true),
  ('电商营销', 'ecommerce', '🛍️', 3, true),
  ('品牌物料', 'branding', '🎯', 4, true),
  ('节日贺卡', 'holiday-card', '🎉', 5, true),
  ('邀请函', 'invitation', '✉️', 6, true),
  ('插画创意', 'illustration', '🎨', 7, true),
  ('其他', 'other', '✨', 99, true)
ON CONFLICT (slug) DO UPDATE
SET
  name = EXCLUDED.name,
  icon = EXCLUDED.icon,
  sort_order = EXCLUDED.sort_order,
  is_active = EXCLUDED.is_active;

-- Extend membership profile with social/publication fields
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS display_name TEXT;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS bio TEXT;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS follower_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS following_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS publication_count INTEGER NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'user_profiles_bio_max_len'
      AND conrelid = 'user_profiles'::regclass
  ) THEN
    ALTER TABLE user_profiles
      ADD CONSTRAINT user_profiles_bio_max_len CHECK (bio IS NULL OR length(bio) <= 200);
  END IF;
END;
$$;

-- Publications
CREATE TABLE IF NOT EXISTS publications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  title VARCHAR(50) NOT NULL,
  description TEXT,
  cover_image_url TEXT NOT NULL,
  category_id UUID NOT NULL REFERENCES publication_categories(id),
  tags TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  status TEXT NOT NULL DEFAULT 'published',
  view_count INTEGER NOT NULL DEFAULT 0,
  like_count INTEGER NOT NULL DEFAULT 0,
  comment_count INTEGER NOT NULL DEFAULT 0,
  bookmark_count INTEGER NOT NULL DEFAULT 0,
  published_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'publications_status_check'
      AND conrelid = 'publications'::regclass
  ) THEN
    ALTER TABLE publications
      ADD CONSTRAINT publications_status_check CHECK (status IN ('published', 'hidden', 'removed'));
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_publications_user_id ON publications(user_id);
CREATE INDEX IF NOT EXISTS idx_publications_category_id ON publications(category_id);
CREATE INDEX IF NOT EXISTS idx_publications_status_published_at ON publications(status, published_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_publications_updated_at ON publications(updated_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_publications_conversation_unique ON publications(conversation_id);

DROP TRIGGER IF EXISTS update_publications_updated_at ON publications;
CREATE TRIGGER update_publications_updated_at
  BEFORE UPDATE ON publications
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Snapshot
CREATE TABLE IF NOT EXISTS publication_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  publication_id UUID NOT NULL UNIQUE REFERENCES publications(id) ON DELETE CASCADE,
  messages_snapshot JSONB NOT NULL DEFAULT '[]'::jsonb,
  ops_snapshot JSONB NOT NULL DEFAULT '[]'::jsonb,
  canvas_state_snapshot JSONB,
  canvas_width INTEGER,
  canvas_height INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Social interactions
CREATE TABLE IF NOT EXISTS publication_likes (
  publication_id UUID NOT NULL REFERENCES publications(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (publication_id, user_id)
);

CREATE TABLE IF NOT EXISTS publication_bookmarks (
  publication_id UUID NOT NULL REFERENCES publications(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (publication_id, user_id)
);

CREATE TABLE IF NOT EXISTS publication_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  publication_id UUID NOT NULL REFERENCES publications(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  parent_id UUID REFERENCES publication_comments(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'publication_comments_content_max_len'
      AND conrelid = 'publication_comments'::regclass
  ) THEN
    ALTER TABLE publication_comments
      ADD CONSTRAINT publication_comments_content_max_len CHECK (length(content) BETWEEN 1 AND 500);
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS update_publication_comments_updated_at ON publication_comments;
CREATE TRIGGER update_publication_comments_updated_at
  BEFORE UPDATE ON publication_comments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE IF NOT EXISTS user_follows (
  follower_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  following_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (follower_id, following_id),
  CONSTRAINT user_follows_not_self CHECK (follower_id <> following_id)
);

-- View dedup helper for view count
CREATE TABLE IF NOT EXISTS publication_views (
  publication_id UUID NOT NULL REFERENCES publications(id) ON DELETE CASCADE,
  viewer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  last_viewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (publication_id, viewer_id)
);

-- Counters: likes
CREATE OR REPLACE FUNCTION handle_publication_like_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE publications
      SET like_count = like_count + 1
      WHERE id = NEW.publication_id;
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    UPDATE publications
      SET like_count = GREATEST(like_count - 1, 0)
      WHERE id = OLD.publication_id;
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_publication_likes_count ON publication_likes;
CREATE TRIGGER trg_publication_likes_count
  AFTER INSERT OR DELETE ON publication_likes
  FOR EACH ROW
  EXECUTE FUNCTION handle_publication_like_count();

-- Counters: bookmarks
CREATE OR REPLACE FUNCTION handle_publication_bookmark_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE publications
      SET bookmark_count = bookmark_count + 1
      WHERE id = NEW.publication_id;
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    UPDATE publications
      SET bookmark_count = GREATEST(bookmark_count - 1, 0)
      WHERE id = OLD.publication_id;
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_publication_bookmarks_count ON publication_bookmarks;
CREATE TRIGGER trg_publication_bookmarks_count
  AFTER INSERT OR DELETE ON publication_bookmarks
  FOR EACH ROW
  EXECUTE FUNCTION handle_publication_bookmark_count();

-- Counters: comments
CREATE OR REPLACE FUNCTION handle_publication_comment_count()
RETURNS TRIGGER AS $$
DECLARE
  v_delta INTEGER;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_delta := 1;
    UPDATE publications
      SET comment_count = comment_count + v_delta
      WHERE id = NEW.publication_id;
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    v_delta := 1;
    UPDATE publications
      SET comment_count = GREATEST(comment_count - v_delta, 0)
      WHERE id = OLD.publication_id;
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_publication_comments_count ON publication_comments;
CREATE TRIGGER trg_publication_comments_count
  AFTER INSERT OR DELETE ON publication_comments
  FOR EACH ROW
  EXECUTE FUNCTION handle_publication_comment_count();

-- Counters: follow
CREATE OR REPLACE FUNCTION handle_user_follow_counts()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE user_profiles SET following_count = following_count + 1 WHERE id = NEW.follower_id;
    UPDATE user_profiles SET follower_count = follower_count + 1 WHERE id = NEW.following_id;
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    UPDATE user_profiles SET following_count = GREATEST(following_count - 1, 0) WHERE id = OLD.follower_id;
    UPDATE user_profiles SET follower_count = GREATEST(follower_count - 1, 0) WHERE id = OLD.following_id;
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_user_follows_count ON user_follows;
CREATE TRIGGER trg_user_follows_count
  AFTER INSERT OR DELETE ON user_follows
  FOR EACH ROW
  EXECUTE FUNCTION handle_user_follow_counts();

-- Counters: publication_count (published only)
CREATE OR REPLACE FUNCTION handle_user_publication_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status = 'published' THEN
      UPDATE user_profiles SET publication_count = publication_count + 1 WHERE id = NEW.user_id;
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    IF OLD.status = 'published' THEN
      UPDATE user_profiles SET publication_count = GREATEST(publication_count - 1, 0) WHERE id = OLD.user_id;
    END IF;
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF OLD.status <> 'published' AND NEW.status = 'published' THEN
      UPDATE user_profiles SET publication_count = publication_count + 1 WHERE id = NEW.user_id;
    ELSIF OLD.status = 'published' AND NEW.status <> 'published' THEN
      UPDATE user_profiles SET publication_count = GREATEST(publication_count - 1, 0) WHERE id = NEW.user_id;
    END IF;
    RETURN NEW;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_publications_user_count ON publications;
CREATE TRIGGER trg_publications_user_count
  AFTER INSERT OR UPDATE OR DELETE ON publications
  FOR EACH ROW
  EXECUTE FUNCTION handle_user_publication_count();

-- Public view for non-sensitive profile fields
CREATE OR REPLACE VIEW public_profiles AS
SELECT
  id,
  display_name,
  avatar_url,
  bio,
  follower_count,
  following_count,
  publication_count
FROM user_profiles;

COMMIT;
