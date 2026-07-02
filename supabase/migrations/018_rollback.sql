-- =============================================================================
-- 018_rollback.sql — Restore admin/staff roles from rbac_migration_backup
-- =============================================================================
-- Restores every profile's pre-018 role and permissions, and reinstates the
-- 005-era RBAC functions and constraints. Run only with the pre-Phase-4 app
-- build (or the transitional build that accepts 'staff').
-- =============================================================================

BEGIN;

-- 1. Restore the 005-era functions FIRST so the guard trigger accepts 'staff'.
CREATE OR REPLACE FUNCTION public.rbac_staff_default_permissions()
RETURNS JSONB LANGUAGE sql IMMUTABLE AS $$
  SELECT '{
    "can_enter_data": false, "can_edit_data": false, "can_delete_data": false,
    "can_import_excel": false, "can_export_data": true,
    "can_view_analytics": true, "can_view_streams": true,
    "can_view_audit_log": false, "can_manage_users": false,
    "can_manage_settings": false,
    "can_view_mpt_detail": true, "can_view_sznb": true,
    "can_view_international": true, "can_view_telecom": true, "can_view_flow": true
  }'::jsonb;
$$;

CREATE OR REPLACE FUNCTION public.rbac_admin_permissions()
RETURNS JSONB LANGUAGE sql IMMUTABLE AS $$
  SELECT '{
    "can_enter_data": true, "can_edit_data": true, "can_delete_data": true,
    "can_import_excel": true, "can_export_data": true,
    "can_view_analytics": true, "can_view_streams": true,
    "can_view_audit_log": true, "can_manage_users": true,
    "can_manage_settings": true,
    "can_view_mpt_detail": true, "can_view_sznb": true,
    "can_view_international": true, "can_view_telecom": true, "can_view_flow": true
  }'::jsonb;
$$;

CREATE OR REPLACE FUNCTION public.rbac_effective_permissions(profile_role TEXT, profile_permissions JSONB)
RETURNS JSONB LANGUAGE sql STABLE AS $$
  SELECT CASE
    WHEN profile_role = 'admin' THEN public.rbac_admin_permissions()
    ELSE public.rbac_staff_default_permissions() || COALESCE(profile_permissions, '{}'::jsonb)
  END;
$$;

CREATE OR REPLACE FUNCTION public.rbac_apply_profile_guards()
RETURNS TRIGGER AS $$
DECLARE
  admin_count INTEGER;
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.role = 'admin' THEN
      SELECT COUNT(*) INTO admin_count FROM public.user_profiles WHERE role = 'admin' AND id <> OLD.id;
      IF admin_count = 0 THEN RAISE EXCEPTION 'Cannot delete the last admin user'; END IF;
    END IF;
    RETURN OLD;
  END IF;
  IF NEW.role = 'admin' THEN
    NEW.permissions = public.rbac_admin_permissions();
  ELSE
    NEW.permissions = public.rbac_effective_permissions('staff', NEW.permissions);
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.role = 'admin' AND NEW.role <> 'admin' THEN
    SELECT COUNT(*) INTO admin_count FROM public.user_profiles WHERE role = 'admin' AND id <> OLD.id;
    IF admin_count = 0 THEN RAISE EXCEPTION 'Cannot demote the last admin user'; END IF;
  END IF;
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  has_admin BOOLEAN;
  next_role TEXT;
BEGIN
  SELECT EXISTS(SELECT 1 FROM public.user_profiles WHERE role = 'admin') INTO has_admin;
  next_role := CASE WHEN has_admin THEN 'staff' ELSE 'admin' END;
  INSERT INTO public.user_profiles (id, email, full_name, display_name, role, permissions, status, invited_at)
  VALUES (
    NEW.id, NEW.email,
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'full_name', ''), NEW.email),
    NULLIF(NEW.raw_user_meta_data->>'username', ''),
    next_role,
    CASE WHEN next_role = 'admin' THEN public.rbac_admin_permissions() ELSE public.rbac_staff_default_permissions() END,
    CASE WHEN next_role = 'admin' THEN 'active' ELSE 'pending' END,
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Restore roles/permissions from the snapshot.
ALTER TABLE public.user_profiles DROP CONSTRAINT IF EXISTS user_profiles_role_check;

UPDATE public.user_profiles p
SET role = b.old_role,
    permissions = COALESCE(b.old_permissions, b.old_effective)
FROM public.rbac_migration_backup b
WHERE p.id = b.user_id;

-- Users created AFTER 018 (roles editor/data/viewer with no backup row) → staff.
UPDATE public.user_profiles
SET role = 'staff'
WHERE role NOT IN ('admin', 'staff')
  AND id NOT IN (SELECT user_id FROM public.rbac_migration_backup);

ALTER TABLE public.user_profiles
  ADD CONSTRAINT user_profiles_role_check CHECK (role IN ('admin', 'staff'));

ALTER TABLE public.invited_emails DROP CONSTRAINT IF EXISTS invited_emails_role_check;
UPDATE public.invited_emails SET role = 'staff' WHERE role NOT IN ('admin', 'staff');
ALTER TABLE public.invited_emails
  ADD CONSTRAINT invited_emails_role_check CHECK (role IN ('admin', 'staff'));

-- ============ VERIFICATION ==================================================
DO $$
DECLARE
  n INT;
BEGIN
  SELECT COUNT(*) INTO n FROM public.user_profiles WHERE role NOT IN ('admin', 'staff');
  IF n <> 0 THEN
    RAISE EXCEPTION '018_rollback verification failed: % profiles with non-legacy role', n;
  END IF;
  SELECT COUNT(*) INTO n FROM public.user_profiles WHERE role = 'admin';
  IF n < 1 THEN
    RAISE EXCEPTION '018_rollback verification failed: no admin remains';
  END IF;
  RAISE NOTICE '018_rollback OK: roles restored from rbac_migration_backup.';
END $$;

COMMIT;
