-- =============================================================================
-- 018_roles.sql — Role model: admin/staff → admin / editor / data / viewer
-- =============================================================================
-- Adds the can_configure_streams permission (Editors manage stream config).
--
-- ACCESS-PARITY GUARANTEE: every existing user keeps their exact effective
-- permissions on all 15 pre-existing keys — the migration snapshots effective
-- permissions BEFORE any change and the verification block aborts if any user's
-- access changed. The only new grant is can_configure_streams for admins and
-- editors (the intended feature rollout).
--
-- Role mapping for existing 'staff' users (by old EFFECTIVE permissions):
--   can_edit_data OR can_delete_data OR can_manage_settings → editor
--   else can_enter_data OR can_import_excel                 → data
--   else                                                    → viewer
--
-- DEPLOY ORDER: deploy the Phase 4 app build first (it accepts both old and
-- new role strings), then run this. Rollback: 018_rollback.sql.
-- Idempotent. Transactional. Self-verifying.
-- =============================================================================

BEGIN;

-- ============ 1. Snapshot (rollback + parity baseline) ======================
CREATE TABLE IF NOT EXISTS public.rbac_migration_backup (
  user_id UUID PRIMARY KEY,
  old_role TEXT NOT NULL,
  old_permissions JSONB,
  old_effective JSONB NOT NULL,
  migrated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.rbac_migration_backup ENABLE ROW LEVEL SECURITY;
-- No policies: service role / SQL editor only.

INSERT INTO public.rbac_migration_backup (user_id, old_role, old_permissions, old_effective)
SELECT id, role, permissions, public.rbac_effective_permissions(role, permissions)
FROM public.user_profiles
ON CONFLICT (user_id) DO NOTHING;  -- keep the FIRST snapshot on re-run

-- ============ 2. Replace RBAC functions (BEFORE any role update, so the =====
-- ============    guard trigger understands the new roles) ==================

CREATE OR REPLACE FUNCTION public.rbac_role_default_permissions(r TEXT)
RETURNS JSONB
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE r
    WHEN 'admin' THEN '{
      "can_enter_data": true, "can_edit_data": true, "can_delete_data": true,
      "can_import_excel": true, "can_export_data": true,
      "can_view_analytics": true, "can_view_streams": true,
      "can_view_audit_log": true, "can_manage_users": true,
      "can_manage_settings": true, "can_configure_streams": true,
      "can_view_mpt_detail": true, "can_view_sznb": true,
      "can_view_international": true, "can_view_telecom": true, "can_view_flow": true
    }'::jsonb
    WHEN 'editor' THEN '{
      "can_enter_data": true, "can_edit_data": true, "can_delete_data": true,
      "can_import_excel": true, "can_export_data": true,
      "can_view_analytics": true, "can_view_streams": true,
      "can_view_audit_log": true, "can_manage_users": false,
      "can_manage_settings": false, "can_configure_streams": true,
      "can_view_mpt_detail": true, "can_view_sznb": true,
      "can_view_international": true, "can_view_telecom": true, "can_view_flow": true
    }'::jsonb
    WHEN 'data' THEN '{
      "can_enter_data": true, "can_edit_data": false, "can_delete_data": false,
      "can_import_excel": true, "can_export_data": true,
      "can_view_analytics": true, "can_view_streams": true,
      "can_view_audit_log": false, "can_manage_users": false,
      "can_manage_settings": false, "can_configure_streams": false,
      "can_view_mpt_detail": true, "can_view_sznb": true,
      "can_view_international": true, "can_view_telecom": true, "can_view_flow": true
    }'::jsonb
    ELSE '{
      "can_enter_data": false, "can_edit_data": false, "can_delete_data": false,
      "can_import_excel": false, "can_export_data": true,
      "can_view_analytics": true, "can_view_streams": true,
      "can_view_audit_log": false, "can_manage_users": false,
      "can_manage_settings": false, "can_configure_streams": false,
      "can_view_mpt_detail": true, "can_view_sznb": true,
      "can_view_international": true, "can_view_telecom": true, "can_view_flow": true
    }'::jsonb  -- viewer (and legacy 'staff' during the transition window)
  END;
$$;

-- Keep old function names working (013 policies, app fallbacks).
CREATE OR REPLACE FUNCTION public.rbac_admin_permissions()
RETURNS JSONB LANGUAGE sql IMMUTABLE AS $$
  SELECT public.rbac_role_default_permissions('admin');
$$;

CREATE OR REPLACE FUNCTION public.rbac_staff_default_permissions()
RETURNS JSONB LANGUAGE sql IMMUTABLE AS $$
  SELECT public.rbac_role_default_permissions('viewer');
$$;

-- Same signature as before: RLS policies (auth_user_can) keep working.
CREATE OR REPLACE FUNCTION public.rbac_effective_permissions(profile_role TEXT, profile_permissions JSONB)
RETURNS JSONB
LANGUAGE sql
STABLE
AS $$
  SELECT CASE
    WHEN profile_role = 'admin' THEN public.rbac_role_default_permissions('admin')
    ELSE public.rbac_role_default_permissions(profile_role) || COALESCE(profile_permissions, '{}'::jsonb)
  END;
$$;

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

  NEW.permissions = public.rbac_effective_permissions(NEW.role, NEW.permissions);

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

-- New signups: first user = admin/active, everyone else = viewer/pending.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  has_admin BOOLEAN;
  next_role TEXT;
BEGIN
  SELECT EXISTS(SELECT 1 FROM public.user_profiles WHERE role = 'admin') INTO has_admin;
  next_role := CASE WHEN has_admin THEN 'viewer' ELSE 'admin' END;

  INSERT INTO public.user_profiles (
    id, email, full_name, display_name, role, permissions, status, invited_at
  ) VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'full_name', ''), NEW.email),
    NULLIF(NEW.raw_user_meta_data->>'username', ''),
    next_role,
    public.rbac_role_default_permissions(next_role),
    CASE WHEN next_role = 'admin' THEN 'active' ELSE 'pending' END,
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============ 3. Role mapping (parity-preserving) ===========================
ALTER TABLE public.user_profiles DROP CONSTRAINT IF EXISTS user_profiles_role_check;

-- Setting permissions to the old EFFECTIVE map keeps every old key exactly as
-- it was (the guard trigger merges role defaults || provided map, and the
-- provided map is complete for the 15 old keys). can_configure_streams is not
-- in the old map, so it comes from the new role defaults.
UPDATE public.user_profiles p
SET role = CASE
      WHEN b.old_role = 'admin' THEN 'admin'
      WHEN COALESCE((b.old_effective->>'can_edit_data')::boolean, FALSE)
        OR COALESCE((b.old_effective->>'can_delete_data')::boolean, FALSE)
        OR COALESCE((b.old_effective->>'can_manage_settings')::boolean, FALSE) THEN 'editor'
      WHEN COALESCE((b.old_effective->>'can_enter_data')::boolean, FALSE)
        OR COALESCE((b.old_effective->>'can_import_excel')::boolean, FALSE) THEN 'data'
      ELSE 'viewer'
    END,
    permissions = b.old_effective
FROM public.rbac_migration_backup b
WHERE p.id = b.user_id;

ALTER TABLE public.user_profiles
  ADD CONSTRAINT user_profiles_role_check CHECK (role IN ('admin', 'editor', 'data', 'viewer'));

-- Pending invites: map legacy 'staff' invites to viewer semantics but keep
-- their explicit permissions JSONB (applied at signup).
ALTER TABLE public.invited_emails DROP CONSTRAINT IF EXISTS invited_emails_role_check;
UPDATE public.invited_emails SET role = 'viewer' WHERE role = 'staff';
ALTER TABLE public.invited_emails
  ADD CONSTRAINT invited_emails_role_check CHECK (role IN ('admin', 'editor', 'data', 'viewer'));

-- Admin Settings default-permissions blob learns the new key.
UPDATE public.app_settings
SET value = jsonb_set(value, '{default_permissions,can_configure_streams}', 'false'::jsonb)
WHERE key = 'permissions' AND value ? 'default_permissions';

-- ============ VERIFICATION (RAISE = rollback) ===============================
DO $$
DECLARE
  old_keys TEXT[] := ARRAY[
    'can_enter_data','can_edit_data','can_delete_data','can_import_excel',
    'can_export_data','can_view_analytics','can_view_streams','can_view_audit_log',
    'can_manage_users','can_manage_settings','can_view_mpt_detail','can_view_sznb',
    'can_view_international','can_view_telecom','can_view_flow'
  ];
  r RECORD;
  k TEXT;
  old_v BOOLEAN;
  new_v BOOLEAN;
  n INT;
  admins_before INT;
  admins_after INT;
  dist TEXT;
BEGIN
  -- All roles valid
  SELECT COUNT(*) INTO n FROM public.user_profiles
  WHERE role NOT IN ('admin', 'editor', 'data', 'viewer');
  IF n <> 0 THEN
    RAISE EXCEPTION '018 verification failed: % profiles with invalid role', n;
  END IF;

  -- Admin count unchanged, and >= 1 whenever any profiles exist.
  -- (On a completely fresh database with zero users — e.g. a rehearsal project
  -- migrated before anyone signs up — there is legitimately no admin yet; the
  -- first signup becomes admin via handle_new_user.)
  SELECT COUNT(*) INTO admins_before FROM public.rbac_migration_backup WHERE old_role = 'admin';
  SELECT COUNT(*) INTO admins_after FROM public.user_profiles WHERE role = 'admin';
  IF admins_after <> admins_before
     OR (admins_after < 1 AND EXISTS (SELECT 1 FROM public.user_profiles)) THEN
    RAISE EXCEPTION '018 verification failed: admin count changed (% -> %)', admins_before, admins_after;
  END IF;

  -- Per-user, per-key effective-access parity on all 15 pre-existing keys
  FOR r IN
    SELECT b.user_id, b.old_effective,
           public.rbac_effective_permissions(p.role, p.permissions) AS new_effective,
           p.email
    FROM public.rbac_migration_backup b
    JOIN public.user_profiles p ON p.id = b.user_id
  LOOP
    FOREACH k IN ARRAY old_keys LOOP
      old_v := COALESCE((r.old_effective->>k)::boolean, FALSE);
      new_v := COALESCE((r.new_effective->>k)::boolean, FALSE);
      IF old_v IS DISTINCT FROM new_v THEN
        RAISE EXCEPTION '018 verification failed: user % key % changed % -> %', r.email, k, old_v, new_v;
      END IF;
    END LOOP;
  END LOOP;

  SELECT string_agg(role || '=' || cnt, ', ') INTO dist
  FROM (SELECT role, COUNT(*) AS cnt FROM public.user_profiles GROUP BY role ORDER BY role) t;
  RAISE NOTICE '018 OK: roles migrated with effective-access parity. Distribution: %', dist;
END $$;

COMMIT;
