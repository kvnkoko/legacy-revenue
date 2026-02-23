-- App settings key-value store for organization defaults and policies.
-- Server actions use createAdminClient (service role) to read/write; RLS restricts anon/authenticated.

CREATE TABLE IF NOT EXISTS public.app_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- No additional policies: anon/authenticated cannot access. Server actions use service role (bypasses RLS).

INSERT INTO public.app_settings (key, value)
VALUES (
  'organization',
  '{"display_currency":"MMK","currency_overrides":{},"company_name":"Legacy","timezone":"Asia/Yangon"}'::jsonb
)
ON CONFLICT (key) DO NOTHING;
