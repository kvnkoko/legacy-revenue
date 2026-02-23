-- RBAC foundation: extend user_profiles, defaults, signup trigger, and safety guards.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'user_profiles' AND column_name = 'user_id'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'user_profiles' AND column_name = 'id'
  ) THEN
    ALTER TABLE public.user_profiles RENAME COLUMN user_id TO id;
  END IF;
END $$;

ALTER TABLE public.user_profiles
  ALTER COLUMN id SET NOT NULL;

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS display_name TEXT,
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'staff',
  ADD COLUMN IF NOT EXISTS permissions JSONB,
  ADD COLUMN IF NOT EXISTS job_title TEXT,
  ADD COLUMN IF NOT EXISTS department TEXT,
  ADD COLUMN IF NOT EXISTS avatar_url TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS invited_by UUID,
  ADD COLUMN IF NOT EXISTS invited_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS onboarded_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS notes TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'user_profiles'
      AND constraint_name = 'user_profiles_role_check'
  ) THEN
    ALTER TABLE public.user_profiles
      ADD CONSTRAINT user_profiles_role_check CHECK (role IN ('admin', 'staff'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'user_profiles'
      AND constraint_name = 'user_profiles_status_check'
  ) THEN
    ALTER TABLE public.user_profiles
      ADD CONSTRAINT user_profiles_status_check CHECK (status IN ('active', 'suspended', 'pending'));
  END IF;
END $$;

ALTER TABLE public.user_profiles
  DROP CONSTRAINT IF EXISTS user_profiles_invited_by_fkey;
ALTER TABLE public.user_profiles
  ADD CONSTRAINT user_profiles_invited_by_fkey
  FOREIGN KEY (invited_by) REFERENCES public.user_profiles(id);

CREATE OR REPLACE FUNCTION public.rbac_staff_default_permissions()
RETURNS JSONB
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT '{
    "can_enter_data": false,
    "can_edit_data": false,
    "can_delete_data": false,
    "can_import_excel": false,
    "can_export_data": true,
    "can_view_analytics": true,
    "can_view_streams": true,
    "can_view_audit_log": false,
    "can_manage_users": false,
    "can_manage_settings": false,
    "can_view_mpt_detail": true,
    "can_view_sznb": true,
    "can_view_international": true,
    "can_view_telecom": true,
    "can_view_flow": true
  }'::jsonb;
$$;

CREATE OR REPLACE FUNCTION public.rbac_admin_permissions()
RETURNS JSONB
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT '{
    "can_enter_data": true,
    "can_edit_data": true,
    "can_delete_data": true,
    "can_import_excel": true,
    "can_export_data": true,
    "can_view_analytics": true,
    "can_view_streams": true,
    "can_view_audit_log": true,
    "can_manage_users": true,
    "can_manage_settings": true,
    "can_view_mpt_detail": true,
    "can_view_sznb": true,
    "can_view_international": true,
    "can_view_telecom": true,
    "can_view_flow": true
  }'::jsonb;
$$;

CREATE OR REPLACE FUNCTION public.rbac_effective_permissions(profile_role TEXT, profile_permissions JSONB)
RETURNS JSONB
LANGUAGE sql
STABLE
AS $$
  SELECT CASE
    WHEN profile_role = 'admin' THEN public.rbac_admin_permissions()
    ELSE public.rbac_staff_default_permissions() || COALESCE(profile_permissions, '{}'::jsonb)
  END;
$$;

UPDATE public.user_profiles p
SET email = u.email
FROM auth.users u
WHERE p.id = u.id
  AND (p.email IS NULL OR p.email = '');

ALTER TABLE public.user_profiles
  ALTER COLUMN permissions SET DEFAULT public.rbac_staff_default_permissions();

UPDATE public.user_profiles
SET permissions = public.rbac_staff_default_permissions()
WHERE permissions IS NULL;

UPDATE public.user_profiles
SET permissions = public.rbac_effective_permissions(role, permissions);

ALTER TABLE public.user_profiles
  ALTER COLUMN permissions SET NOT NULL;

ALTER TABLE public.user_profiles
  ALTER COLUMN email SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'user_profiles_email_unique_idx'
  ) THEN
    CREATE UNIQUE INDEX user_profiles_email_unique_idx ON public.user_profiles(email);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.rbac_apply_profile_guards()
RETURNS TRIGGER AS $$
DECLARE
  admin_count INTEGER;
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.role = 'admin' THEN
      SELECT COUNT(*) INTO admin_count
      FROM public.user_profiles
      WHERE role = 'admin' AND id <> OLD.id;
      IF admin_count = 0 THEN
        RAISE EXCEPTION 'Cannot delete the last admin user';
      END IF;
    END IF;
    RETURN OLD;
  END IF;

  IF NEW.role = 'admin' THEN
    NEW.permissions = public.rbac_admin_permissions();
  ELSE
    NEW.permissions = public.rbac_effective_permissions('staff', NEW.permissions);
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.role = 'admin' AND NEW.role <> 'admin' THEN
    SELECT COUNT(*) INTO admin_count
    FROM public.user_profiles
    WHERE role = 'admin' AND id <> OLD.id;
    IF admin_count = 0 THEN
      RAISE EXCEPTION 'Cannot demote the last admin user';
    END IF;
  END IF;

  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS enforce_rbac_profile_guards ON public.user_profiles;
CREATE TRIGGER enforce_rbac_profile_guards
BEFORE INSERT OR UPDATE OR DELETE ON public.user_profiles
FOR EACH ROW
EXECUTE FUNCTION public.rbac_apply_profile_guards();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  has_admin BOOLEAN;
  next_role TEXT;
BEGIN
  SELECT EXISTS(SELECT 1 FROM public.user_profiles WHERE role = 'admin') INTO has_admin;
  next_role := CASE WHEN has_admin THEN 'staff' ELSE 'admin' END;

  INSERT INTO public.user_profiles (
    id,
    email,
    full_name,
    display_name,
    role,
    permissions,
    status,
    invited_at
  ) VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'full_name', ''), NEW.email),
    NULLIF(NEW.raw_user_meta_data->>'username', ''),
    next_role,
    CASE WHEN next_role = 'admin' THEN public.rbac_admin_permissions() ELSE public.rbac_staff_default_permissions() END,
    CASE WHEN next_role = 'admin' THEN 'active' ELSE 'pending' END,
    NOW()
  )
  ON CONFLICT (id) DO UPDATE
  SET email = EXCLUDED.email;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created_profile ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user();

UPDATE public.user_profiles
SET role = 'admin',
    status = 'active',
    permissions = public.rbac_admin_permissions()
WHERE id IN (
  SELECT id FROM auth.users ORDER BY created_at ASC LIMIT 1
)
AND NOT EXISTS (
  SELECT 1 FROM public.user_profiles WHERE role = 'admin'
);

CREATE OR REPLACE FUNCTION public.auth_user_is_admin(uid UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS(
    SELECT 1
    FROM public.user_profiles
    WHERE id = uid
      AND role = 'admin'
      AND status = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION public.auth_user_can(permission_key TEXT, uid UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_profiles p
    WHERE p.id = uid
      AND p.status = 'active'
      AND (
        p.role = 'admin'
        OR COALESCE((public.rbac_effective_permissions(p.role, p.permissions)->>permission_key)::BOOLEAN, FALSE)
      )
  );
$$;
