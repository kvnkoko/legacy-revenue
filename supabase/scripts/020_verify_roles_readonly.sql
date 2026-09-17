-- ============================================================================
-- 020_verify_roles_readonly.sql
--
-- READ-ONLY. Contains no INSERT, UPDATE, DELETE, ALTER, CREATE or DROP.
-- Safe to run on production at any time. Nothing is changed.
--
-- Written as ONE query on purpose: the Supabase SQL Editor only displays the
-- result of the LAST statement, so a script of several SELECTs silently throws
-- away all but the final answer. Everything below comes back in one table.
--
-- Read the 'status' column first. OK = nothing to do. CHECK = look at 'detail'.
-- ============================================================================

WITH
-- Does anyone still sit on a pre-018 role value? Those people are treated as
-- read-only viewers no matter what you picked in Staff Management.
role_counts AS (
  SELECT
    role,
    status AS acct_status,
    count(*) AS people,
    (role NOT IN ('admin', 'editor', 'data', 'viewer')) AS unknown_role
  FROM public.user_profiles
  GROUP BY role, status
),
-- Overrides that switch OFF something the person's role grants. These are the
-- rows that make a role "look broken" to the person using it.
contradictions AS (
  SELECT p.email, p.role, o.key AS permission_switched_off
  FROM public.user_profiles p,
       jsonb_each(COALESCE(p.permissions, '{}'::jsonb)) AS o(key, value)
  WHERE o.value = 'false'::jsonb
    AND public.rbac_role_default_permissions(p.role) -> o.key = 'true'::jsonb
),
-- Someone who can sign in but has no profile row gets no access at all.
orphans AS (
  SELECT u.email
  FROM auth.users u
  LEFT JOIN public.user_profiles p ON p.id = u.id
  WHERE p.id IS NULL
),
admins AS (
  SELECT count(*) AS n
  FROM public.user_profiles
  WHERE role = 'admin' AND status = 'active'
)

-- A. One row per role, so you can see the whole team at a glance.
SELECT
  1 AS sort_order,
  'Roles in use' AS check_name,
  CASE WHEN bool_or(unknown_role) THEN 'CHECK' ELSE 'OK' END AS status,
  string_agg(role || ' / ' || acct_status || ': ' || people || ' people',
             '  |  ' ORDER BY role, acct_status) AS detail
FROM role_counts

UNION ALL
-- B. Unknown roles called out explicitly.
SELECT
  2,
  'Roles the app does not understand',
  CASE WHEN count(*) = 0 THEN 'OK' ELSE 'CHECK' END,
  CASE WHEN count(*) = 0
    THEN 'Every role is one of admin / editor / data / viewer.'
    ELSE 'These roles are not recognised and behave as read-only viewer: '
         || string_agg(DISTINCT role, ', ')
  END
FROM role_counts
WHERE unknown_role

UNION ALL
-- C. Overrides fighting the role.
SELECT
  3,
  'Per-person settings blocking their own role',
  CASE WHEN count(*) = 0 THEN 'OK' ELSE 'CHECK' END,
  CASE WHEN count(*) = 0
    THEN 'No one has a setting that cancels out their role.'
    ELSE string_agg(email || ' (' || role || ') is blocked from ' || permission_switched_off, '  |  ')
  END
FROM contradictions

UNION ALL
-- D. Active admins. Fewer than 2 is a real operational risk.
SELECT
  4,
  'Active admins',
  CASE WHEN (SELECT n FROM admins) = 0 THEN 'CHECK'
       WHEN (SELECT n FROM admins) = 1 THEN 'CHECK'
       ELSE 'OK' END,
  CASE WHEN (SELECT n FROM admins) = 0
    THEN 'No active admin exists. Nobody can manage users or settings.'
  WHEN (SELECT n FROM admins) = 1
    THEN 'Only 1 active admin. If that person loses access or leaves, nobody '
         || 'can manage users, settings or roles. Consider a second admin.'
    ELSE (SELECT n FROM admins)::text || ' active admins.'
  END

UNION ALL
-- E. Sign-in accounts with no profile row.
SELECT
  5,
  'Accounts with no profile row',
  CASE WHEN count(*) = 0 THEN 'OK' ELSE 'CHECK' END,
  CASE WHEN count(*) = 0
    THEN 'Every sign-in account has a profile.'
    ELSE 'These can sign in but will see nothing: ' || string_agg(email, ', ')
  END
FROM orphans

ORDER BY sort_order;
