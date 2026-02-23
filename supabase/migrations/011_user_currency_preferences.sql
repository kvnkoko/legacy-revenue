-- Per-user currency display preferences. Each user can choose their own display currency and optional rate overrides.
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS display_currency TEXT DEFAULT 'MMK',
  ADD COLUMN IF NOT EXISTS currency_overrides JSONB DEFAULT '{}';
