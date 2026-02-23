-- One-time cleanup: remove kokokevin@gmail.com from auth and related tables.
-- audit_log references auth.users, so we null out user_id first, then delete user.
DO $$
DECLARE
  uid UUID;
BEGIN
  SELECT id INTO uid FROM auth.users WHERE email = 'kokokevin@gmail.com';
  IF uid IS NOT NULL THEN
    UPDATE public.audit_log SET user_id = NULL WHERE user_id = uid;
    DELETE FROM public.user_profiles WHERE id = uid;
    DELETE FROM public.invited_emails WHERE email = 'kokokevin@gmail.com';
    DELETE FROM auth.users WHERE id = uid;
    RAISE NOTICE 'Removed user kokokevin@gmail.com';
  ELSE
    RAISE NOTICE 'User kokokevin@gmail.com not found (already removed or never existed)';
  END IF;
END $$;
