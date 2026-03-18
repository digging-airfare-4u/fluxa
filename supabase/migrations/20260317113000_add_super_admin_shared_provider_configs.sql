-- Add super admin capability and convert BYOK provider configs to shared admin-managed configs.

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS is_super_admin BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_user_profiles_is_super_admin
  ON public.user_profiles(is_super_admin);

ALTER TABLE public.user_provider_configs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own provider configs" ON public.user_provider_configs;
DROP POLICY IF EXISTS "Users can create own provider configs" ON public.user_provider_configs;
DROP POLICY IF EXISTS "Users can update own provider configs" ON public.user_provider_configs;
DROP POLICY IF EXISTS "Users can delete own provider configs" ON public.user_provider_configs;
DROP POLICY IF EXISTS "Authenticated users can view enabled shared provider configs" ON public.user_provider_configs;
DROP POLICY IF EXISTS "Super admins can view own provider configs" ON public.user_provider_configs;
DROP POLICY IF EXISTS "Super admins can create own provider configs" ON public.user_provider_configs;
DROP POLICY IF EXISTS "Super admins can update own provider configs" ON public.user_provider_configs;
DROP POLICY IF EXISTS "Super admins can delete own provider configs" ON public.user_provider_configs;

CREATE POLICY "Authenticated users can view enabled shared provider configs"
  ON public.user_provider_configs FOR SELECT
  USING (
    is_enabled = TRUE
    AND EXISTS (
      SELECT 1
      FROM public.user_profiles up
      WHERE up.id = public.user_provider_configs.user_id
        AND up.is_super_admin = TRUE
    )
  );

CREATE POLICY "Super admins can view own provider configs"
  ON public.user_provider_configs FOR SELECT
  USING (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.user_profiles up
      WHERE up.id = auth.uid()
        AND up.is_super_admin = TRUE
    )
  );

CREATE POLICY "Super admins can create own provider configs"
  ON public.user_provider_configs FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.user_profiles up
      WHERE up.id = auth.uid()
        AND up.is_super_admin = TRUE
    )
  );

CREATE POLICY "Super admins can update own provider configs"
  ON public.user_provider_configs FOR UPDATE
  USING (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.user_profiles up
      WHERE up.id = auth.uid()
        AND up.is_super_admin = TRUE
    )
  )
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.user_profiles up
      WHERE up.id = auth.uid()
        AND up.is_super_admin = TRUE
    )
  );

CREATE POLICY "Super admins can delete own provider configs"
  ON public.user_provider_configs FOR DELETE
  USING (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.user_profiles up
      WHERE up.id = auth.uid()
        AND up.is_super_admin = TRUE
    )
  );
