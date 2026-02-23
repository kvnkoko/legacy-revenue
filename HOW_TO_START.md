# How to start things up

The **"Failed to fetch"** / **ERR_NAME_NOT_RESOLVED** error means the app is still using **placeholder** Supabase settings. The app can’t reach a real server until you use your real project URL and key.

Do these in order:

---

## 1. Start the app (frontend)

From the **`legacy-revenue-portal`** folder (or from **`legacy revenue`** with `npm run dev`):

```bash
cd legacy-revenue-portal
npm run dev
```

Open **http://localhost:3000**. The page will load, but **sign up / sign in will fail** until step 3 is done.

---

## 2. Create and set up Supabase (backend)

1. Go to **https://supabase.com** → sign in → **New project**.
2. Name it, set a database password, wait until it’s **Ready**.
3. In **SQL Editor**, run in order:
   - **`supabase/migrations/001_schema.sql`** (copy entire file → paste → Run)
   - **`supabase/migrations/002_rls_audit.sql`** (copy entire file → paste → Run)
   - **`supabase/seed.sql`** (copy entire file → paste → Run)
4. In **Authentication** → **Providers** → turn **Email** on (and optionally turn off “Confirm email” for testing).

---

## 3. Connect the app to your Supabase project

1. In Supabase, open **Project Settings** (gear) → **API**.
2. Copy:
   - **Project URL** (e.g. `https://abcdefgh.supabase.co`)
   - **anon public** key (long string under Project API keys).
3. In this project, open **`.env.local`** (inside **`legacy-revenue-portal`**).
4. Replace the placeholders:
   - `NEXT_PUBLIC_SUPABASE_URL=` → paste your **Project URL**.
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY=` → paste your **anon public** key.
5. **Save** the file.

---

## 4. Restart the app

Stop the dev server (Ctrl+C in the terminal), then run again:

```bash
npm run dev
```

Refresh **http://localhost:3000** and try **Sign up** again. It should work once the real URL and key are in `.env.local`.

---

**Quick checklist**

- [ ] Supabase project created and Ready  
- [ ] All 3 SQL files run in Supabase (001, 002, seed)  
- [ ] Email auth enabled  
- [ ] `.env.local` has your **real** Project URL and anon key (no `your-project.supabase.co`)  
- [ ] Dev server restarted after editing `.env.local`  
