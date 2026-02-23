# Deploy Legacy Revenue Portal to the web (ELI5)

This guide gets your app on a real URL like `https://your-app.vercel.app` so your team can use it from anywhere.

---

## What you need before starting

1. **Your code** in a GitHub account (so Vercel can pull it).
2. **A Supabase project** (you already have this — that’s where your data and users live).
3. **About 10 minutes.**

---

## Step 1: Put your project on GitHub

If the project isn’t on GitHub yet:

1. Go to [github.com](https://github.com) and sign in (or create an account).
2. Click the **+** (top right) → **New repository**.
3. Name it something like `legacy-revenue-portal`.
4. Leave “Add a README” unchecked if your folder already has code.
5. Click **Create repository**.

Then on your computer, in the folder that contains your app (the one with `package.json`):

```bash
cd legacy-revenue-portal
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/legacy-revenue-portal.git
git push -u origin main
```

Replace `YOUR_USERNAME` with your GitHub username. If the repo URL is different, use the one GitHub shows.

---

## Step 2: Sign up for Vercel and connect GitHub

1. Go to [vercel.com](https://vercel.com).
2. Click **Sign Up** and choose **Continue with GitHub**.
3. Approve Vercel so it can see your repositories.
4. After login, click **Add New…** → **Project**.
5. You should see your repo (e.g. `legacy-revenue-portal`). Click **Import** next to it.

---

## Step 3: Tell Vercel where your app lives

- If your repo **only** contains the Next.js app (no parent folder), you can leave **Root Directory** empty and click **Continue**.
- If your repo has a parent folder and the app is inside **legacy-revenue-portal**, click **Edit** next to “Root Directory”, choose the folder **legacy-revenue-portal**, then **Continue**.

---

## Step 4: Add your secret keys (environment variables)

Your app needs three values from Supabase. Vercel will ask for them before the first deploy.

1. In the “Configure Project” screen, find **Environment Variables**.
2. Add these **one by one** (name exactly as below, value from your `.env.local` or Supabase):

| Name | Where to get it |
|------|------------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API → **Project URL** |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Project Settings → API → **anon public** key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API → **service_role** key (keep this secret!) |

- For each variable, paste the value and leave **Production**, **Preview**, and **Development** checked (or at least **Production**).
3. Click **Deploy**.

Vercel will build and deploy. Wait until you see **Congratulations** and a link like `https://legacy-revenue-portal-xxx.vercel.app`.

---

## Step 5: Tell Supabase your app’s URL (so login works)

Supabase only allows login from URLs you approve.

1. Open [Supabase Dashboard](https://supabase.com/dashboard) → your project.
2. Go to **Authentication** → **URL Configuration**.
3. Under **Redirect URLs**, add:
   - `https://your-actual-app.vercel.app/**`
   - If you use a custom domain later, add that too, e.g. `https://revenue.yourcompany.com/**`
4. Under **Site URL**, set it to your main app URL, e.g. `https://your-actual-app.vercel.app`.
5. Save.

Now when someone signs in on your Vercel URL, Supabase will accept it.

---

## Step 6: Share the link with your team

- Your app is live at the URL Vercel gave you (e.g. `https://legacy-revenue-portal-xxx.vercel.app`).
- Share that link with employees. They can:
  - Go to the URL.
  - Sign up only if they’ve been **invited** (invite-only flow).
  - Or sign in if they already have an account.

You (the admin) invite users from **Admin Settings → User Management** in the app.

---

## Optional: Use a nicer URL (custom domain)

1. In Vercel, open your project → **Settings** → **Domains**.
2. Add a domain (e.g. `revenue.yourcompany.com`).
3. Follow Vercel’s instructions to add the DNS records at your domain provider.
4. After it’s verified, add the same domain in Supabase **Redirect URLs** and **Site URL** (as in Step 5).

---

## Quick checklist

- [ ] Code is on GitHub.
- [ ] Vercel project is created and connected to that repo.
- [ ] Root Directory is set to the app folder if needed.
- [ ] All three env vars are set in Vercel.
- [ ] Supabase Redirect URLs and Site URL include your Vercel URL.
- [ ] You’ve opened the Vercel URL and tested sign-in (and invite if you use it).

If you hit a problem, the most common fixes are: wrong or missing env vars, or Supabase URL configuration not including your Vercel URL.
