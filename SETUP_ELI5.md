# Set everything up before `npm run dev` (ELI5)

Do these steps **in order**. When you're done, you run `npm run dev` and open the app.

---

## Step 1: Install the app’s building blocks

Open a terminal in this project folder and run:

```bash
npm install
```

**Why:** The app needs a bunch of code packages. This downloads them. Do it once.

---

## Step 2: Create a Supabase project (your data’s home on the internet)

1. Go to **https://supabase.com** and sign in (or create an account).
2. Click **“New project”**.
3. Choose a **name** (e.g. “legacy-revenue”) and a **database password** (save it somewhere).
4. Click **Create** and wait until it says the project is **Ready**.

**Why:** The app stores all revenue data and user accounts in Supabase. No project = no data, no login.

---

## Step 3: Create the tables and put in the sample data

1. In your Supabase project, click **“SQL Editor”** in the left menu.
2. **First file:**  
   - Open the file **`supabase/migrations/001_schema.sql`** in this project (in your code editor or Finder).  
   - Select all the text (Ctrl+A / Cmd+A), copy it.  
   - In Supabase SQL Editor, paste and click **Run**.  
   - You should see “Success” or no errors.
3. **Second file:**  
   - Open **`supabase/migrations/002_rls_audit.sql`**, copy everything, paste in the SQL Editor, click **Run**.
4. **Third file:**  
   - Open **`supabase/seed.sql`**, copy everything, paste in the SQL Editor, click **Run**.

**Why:** The first file builds the “rooms” (tables). The second turns on security and logging. The third fills in the Jan–Sep 2025 numbers so you have something to look at.

---

## Step 4: Turn on “sign in with email”

1. In Supabase, click **“Authentication”** in the left menu.
2. Click **“Providers”**.
3. Find **Email** and make sure it’s **enabled**.
4. (Optional, for easier testing:) Turn **off** “Confirm email” so you don’t have to check your inbox to sign in.

**Why:** The app lets people sign in with email + password. This step turns that on.

---

## Step 5: Copy your project’s address and key into the app

1. In Supabase, click the **gear icon** (Project Settings) at the bottom of the left menu.
2. Click **“API”** in the settings menu.
3. You’ll see:
   - **Project URL** (looks like `https://xxxxx.supabase.co`)
   - **Project API keys** → **anon** **public** (a long string)
4. In **this** project, open the file **`.env.local`** (in the main folder, same level as `package.json`).
5. In `.env.local`:
   - Find the line with `NEXT_PUBLIC_SUPABASE_URL=...`  
     Replace the URL there with your **Project URL** (paste it, no spaces).
   - Find the line with `NEXT_PUBLIC_SUPABASE_ANON_KEY=...`  
     Replace `your-anon-key` with your **anon public** key (paste it, no spaces).
6. **Save** the file.

**Why:** The app needs to know *which* Supabase project to talk to. The URL and key are like the address and key to your data’s home.

---

## You’re done

Now you can run:

```bash
npm run dev
```

Then open **http://localhost:3000** in your browser, click **Sign up**, create an account, and you’re in.

---

**Quick checklist**

- [ ] `npm install` ran with no errors  
- [ ] Supabase project created and “Ready”  
- [ ] All 3 SQL files run in Supabase (001_schema, 002_rls_audit, seed)  
- [ ] Email provider enabled in Authentication → Providers  
- [ ] `.env.local` has your real Project URL and anon key, and you saved the file  

After that → `npm run dev` and open the app.
