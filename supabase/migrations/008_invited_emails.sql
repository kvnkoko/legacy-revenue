-- Invite-only sign-up: store invited emails before user creation.
-- Admin "invites" = insert here. User signs up = we check this, create auth user, then create profile.

CREATE TABLE IF NOT EXISTS public.invited_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT 'staff' CHECK (role IN ('admin', 'staff')),
  permissions JSONB,
  job_title TEXT,
  department TEXT,
  invited_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  invited_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  used_at TIMESTAMPTZ,
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_invited_emails_email ON public.invited_emails(email);
CREATE INDEX IF NOT EXISTS idx_invited_emails_used_at ON public.invited_emails(used_at) WHERE used_at IS NULL;

ALTER TABLE public.invited_emails ENABLE ROW LEVEL SECURITY;

-- No additional policies: anon/authenticated cannot access. Server actions use service role (bypasses RLS).
