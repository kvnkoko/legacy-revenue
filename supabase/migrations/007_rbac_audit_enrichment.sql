-- Audit enrichment: include user identity snapshot columns.

ALTER TABLE public.audit_log
  ADD COLUMN IF NOT EXISTS user_name TEXT,
  ADD COLUMN IF NOT EXISTS user_role TEXT,
  ADD COLUMN IF NOT EXISTS user_email TEXT;

CREATE INDEX IF NOT EXISTS idx_audit_log_user_id_created_at
ON public.audit_log(user_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.audit_trigger_fn()
RETURNS TRIGGER AS $$
DECLARE
  old_json JSONB;
  new_json JSONB;
  row_id_val TEXT;
  actor_id UUID;
  actor_name TEXT;
  actor_role TEXT;
  actor_email TEXT;
BEGIN
  actor_id := auth.uid();
  IF actor_id IS NOT NULL THEN
    SELECT
      COALESCE(NULLIF(p.full_name, ''), p.display_name, u.email),
      p.role,
      COALESCE(p.email, u.email)
    INTO actor_name, actor_role, actor_email
    FROM auth.users u
    LEFT JOIN public.user_profiles p ON p.id = u.id
    WHERE u.id = actor_id;
  END IF;

  IF TG_OP = 'DELETE' THEN
    old_json := to_jsonb(OLD);
    row_id_val := COALESCE((OLD).sqlid::TEXT, NULL);
    INSERT INTO public.audit_log (user_id, user_name, user_role, user_email, action, table_name, row_id, old_value, new_value)
    VALUES (actor_id, actor_name, actor_role, actor_email, 'DELETE', TG_TABLE_NAME, row_id_val, old_json, NULL);
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    old_json := to_jsonb(OLD);
    new_json := to_jsonb(NEW);
    row_id_val := COALESCE((NEW).sqlid::TEXT, NULL);
    INSERT INTO public.audit_log (user_id, user_name, user_role, user_email, action, table_name, row_id, old_value, new_value)
    VALUES (actor_id, actor_name, actor_role, actor_email, 'UPDATE', TG_TABLE_NAME, row_id_val, old_json, new_json);
    RETURN NEW;
  ELSIF TG_OP = 'INSERT' THEN
    new_json := to_jsonb(NEW);
    row_id_val := COALESCE((NEW).sqlid::TEXT, NULL);
    INSERT INTO public.audit_log (user_id, user_name, user_role, user_email, action, table_name, row_id, old_value, new_value)
    VALUES (actor_id, actor_name, actor_role, actor_email, 'INSERT', TG_TABLE_NAME, row_id_val, NULL, new_json);
    RETURN NEW;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
