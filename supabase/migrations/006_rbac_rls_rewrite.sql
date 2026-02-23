-- RBAC RLS rewrite: remove permissive authenticated policies and enforce role+permissions.

DO $$
DECLARE
  target_table TEXT;
  policy_record RECORD;
  tables TEXT[] := ARRAY[
    'revenue_summary',
    'ringtune',
    'mpt',
    'atom',
    'eauc',
    'combo',
    'local',
    'sznb',
    'flow_subscription',
    'international',
    'youtube',
    'spotify',
    'tiktok',
    'audit_log',
    'user_profiles'
  ];
BEGIN
  FOREACH target_table IN ARRAY tables LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', target_table);
    FOR policy_record IN
      SELECT policyname
      FROM pg_policies
      WHERE schemaname = 'public' AND tablename = target_table
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', policy_record.policyname, target_table);
    END LOOP;
  END LOOP;
END $$;

-- Profile read/write policies.
CREATE POLICY "rbac_user_profiles_select"
ON public.user_profiles
FOR SELECT
TO authenticated
USING (id = auth.uid() OR public.auth_user_is_admin(auth.uid()));

CREATE POLICY "rbac_user_profiles_insert_self_or_admin"
ON public.user_profiles
FOR INSERT
TO authenticated
WITH CHECK (
  id = auth.uid()
  OR public.auth_user_is_admin(auth.uid())
);

CREATE POLICY "rbac_user_profiles_update_self_or_admin"
ON public.user_profiles
FOR UPDATE
TO authenticated
USING (
  id = auth.uid()
  OR public.auth_user_is_admin(auth.uid())
)
WITH CHECK (
  id = auth.uid()
  OR public.auth_user_is_admin(auth.uid())
);

CREATE POLICY "rbac_user_profiles_delete_admin_only"
ON public.user_profiles
FOR DELETE
TO authenticated
USING (public.auth_user_is_admin(auth.uid()));

-- Audit log access.
CREATE POLICY "rbac_audit_select"
ON public.audit_log
FOR SELECT
TO authenticated
USING (
  public.auth_user_is_admin(auth.uid())
  OR public.auth_user_can('can_view_audit_log', auth.uid())
);

CREATE POLICY "rbac_audit_insert"
ON public.audit_log
FOR INSERT
TO authenticated
WITH CHECK (
  user_id IS NULL OR user_id = auth.uid() OR public.auth_user_is_admin(auth.uid())
);

-- Revenue summary.
CREATE POLICY "rbac_summary_read"
ON public.revenue_summary
FOR SELECT
TO authenticated
USING (
  public.auth_user_is_admin(auth.uid())
  OR public.auth_user_can('can_view_streams', auth.uid())
  OR public.auth_user_can('can_view_analytics', auth.uid())
);

CREATE POLICY "rbac_summary_insert"
ON public.revenue_summary
FOR INSERT
TO authenticated
WITH CHECK (
  public.auth_user_is_admin(auth.uid())
  OR public.auth_user_can('can_enter_data', auth.uid())
  OR public.auth_user_can('can_import_excel', auth.uid())
);

CREATE POLICY "rbac_summary_update"
ON public.revenue_summary
FOR UPDATE
TO authenticated
USING (
  public.auth_user_is_admin(auth.uid())
  OR public.auth_user_can('can_edit_data', auth.uid())
  OR public.auth_user_can('can_import_excel', auth.uid())
)
WITH CHECK (
  public.auth_user_is_admin(auth.uid())
  OR public.auth_user_can('can_edit_data', auth.uid())
  OR public.auth_user_can('can_import_excel', auth.uid())
);

CREATE POLICY "rbac_summary_delete"
ON public.revenue_summary
FOR DELETE
TO authenticated
USING (
  public.auth_user_is_admin(auth.uid()) OR public.auth_user_can('can_delete_data', auth.uid())
);

-- Telecom cluster (ringtune/mpt/atom/eauc/combo/local).
CREATE POLICY "rbac_ringtune_read"
ON public.ringtune
FOR SELECT
TO authenticated
USING (public.auth_user_is_admin(auth.uid()) OR public.auth_user_can('can_view_telecom', auth.uid()));

CREATE POLICY "rbac_mpt_read"
ON public.mpt
FOR SELECT
TO authenticated
USING (
  public.auth_user_is_admin(auth.uid())
  OR public.auth_user_can('can_view_telecom', auth.uid())
  OR public.auth_user_can('can_view_mpt_detail', auth.uid())
);

CREATE POLICY "rbac_atom_read"
ON public.atom
FOR SELECT
TO authenticated
USING (public.auth_user_is_admin(auth.uid()) OR public.auth_user_can('can_view_telecom', auth.uid()));

CREATE POLICY "rbac_eauc_read"
ON public.eauc
FOR SELECT
TO authenticated
USING (public.auth_user_is_admin(auth.uid()) OR public.auth_user_can('can_view_telecom', auth.uid()));

CREATE POLICY "rbac_combo_read"
ON public.combo
FOR SELECT
TO authenticated
USING (public.auth_user_is_admin(auth.uid()) OR public.auth_user_can('can_view_telecom', auth.uid()));

CREATE POLICY "rbac_local_read"
ON public.local
FOR SELECT
TO authenticated
USING (public.auth_user_is_admin(auth.uid()) OR public.auth_user_can('can_view_telecom', auth.uid()));

-- Stream-specific visibility.
CREATE POLICY "rbac_sznb_read"
ON public.sznb
FOR SELECT
TO authenticated
USING (public.auth_user_is_admin(auth.uid()) OR public.auth_user_can('can_view_sznb', auth.uid()));

CREATE POLICY "rbac_flow_read"
ON public.flow_subscription
FOR SELECT
TO authenticated
USING (public.auth_user_is_admin(auth.uid()) OR public.auth_user_can('can_view_flow', auth.uid()));

CREATE POLICY "rbac_international_read"
ON public.international
FOR SELECT
TO authenticated
USING (public.auth_user_is_admin(auth.uid()) OR public.auth_user_can('can_view_international', auth.uid()));

CREATE POLICY "rbac_youtube_read"
ON public.youtube
FOR SELECT
TO authenticated
USING (public.auth_user_is_admin(auth.uid()) OR public.auth_user_can('can_view_international', auth.uid()));

CREATE POLICY "rbac_spotify_read"
ON public.spotify
FOR SELECT
TO authenticated
USING (public.auth_user_is_admin(auth.uid()) OR public.auth_user_can('can_view_international', auth.uid()));

CREATE POLICY "rbac_tiktok_read"
ON public.tiktok
FOR SELECT
TO authenticated
USING (public.auth_user_is_admin(auth.uid()) OR public.auth_user_can('can_view_international', auth.uid()));

-- Shared write rules for data tables.
DO $$
DECLARE
  tbl TEXT;
  write_tables TEXT[] := ARRAY[
    'ringtune','mpt','atom','eauc','combo','local','sznb','flow_subscription','international','youtube','spotify','tiktok'
  ];
BEGIN
  FOREACH tbl IN ARRAY write_tables LOOP
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (public.auth_user_is_admin(auth.uid()) OR public.auth_user_can(''can_enter_data'', auth.uid()) OR public.auth_user_can(''can_import_excel'', auth.uid()))',
      'rbac_' || tbl || '_insert',
      tbl
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (public.auth_user_is_admin(auth.uid()) OR public.auth_user_can(''can_edit_data'', auth.uid()) OR public.auth_user_can(''can_import_excel'', auth.uid())) WITH CHECK (public.auth_user_is_admin(auth.uid()) OR public.auth_user_can(''can_edit_data'', auth.uid()) OR public.auth_user_can(''can_import_excel'', auth.uid()))',
      'rbac_' || tbl || '_update',
      tbl
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING (public.auth_user_is_admin(auth.uid()) OR public.auth_user_can(''can_delete_data'', auth.uid()))',
      'rbac_' || tbl || '_delete',
      tbl
    );
  END LOOP;
END $$;
