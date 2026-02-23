-- Seed additional app_settings keys for Admin Settings panels.
-- Run after 010_app_settings.sql. Uses ON CONFLICT to avoid overwriting existing values.

INSERT INTO public.app_settings (key, value)
VALUES (
  'permissions',
  '{"default_permissions":{"can_enter_data":false,"can_edit_data":false,"can_delete_data":false,"can_import_excel":false,"can_export_data":true,"can_view_analytics":true,"can_view_streams":true,"can_view_audit_log":false,"can_manage_users":false,"can_manage_settings":false,"can_view_mpt_detail":true,"can_view_sznb":true,"can_view_international":true,"can_view_telecom":true,"can_view_flow":true}}'::jsonb
)
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.app_settings (key, value)
VALUES (
  'session',
  '{"session_idle_minutes":60,"audit_retention_days":365}'::jsonb
)
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.app_settings (key, value)
VALUES (
  'data-entry',
  '{"duplicate_month_behavior":"confirm"}'::jsonb
)
ON CONFLICT (key) DO NOTHING;
