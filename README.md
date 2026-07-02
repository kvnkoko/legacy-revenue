# Legacy Revenue Finance Portal

Internal revenue finance portal for **Legacy** music distribution. Dark-themed dashboard with Supabase backend, audit logging, Excel import, and analytics.

## Tech Stack

- **Frontend:** Next.js 14 (App Router), TypeScript, Tailwind CSS
- **Backend/DB:** Supabase (PostgreSQL, RLS on all tables)
- **Auth:** Supabase Auth (email/password)
- **Charts:** Recharts
- **Excel:** SheetJS (xlsx)
- **Storage:** Supabase Storage (import audit)

## Environment Variables

Create `.env.local` in the project root:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

- `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are required for the app.
- `SUPABASE_SERVICE_ROLE_KEY` is optional (e.g. for server-side admin or migrations).

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Supabase project

1. Create a project at [supabase.com](https://supabase.com).
2. In **SQL Editor**, run in order:
   - `supabase/migrations/001_schema.sql` – creates all revenue tables and `audit_log`.
   - `supabase/migrations/002_rls_audit.sql` – baseline RLS + audit triggers.
   - `supabase/migrations/003_lineage_triggers.sql` – parent-child data sync triggers.
   - `supabase/migrations/004_user_profiles.sql` – initial profile table.
   - `supabase/migrations/005_rbac_profiles_and_policies.sql` – RBAC profile/permission foundations.
   - `supabase/migrations/006_rbac_rls_rewrite.sql` – permission-aware RLS policies across tables.
   - `supabase/migrations/007_rbac_audit_enrichment.sql` – audit identity enrichment columns.
3. Run `supabase/seed.sql` to load historical data (Jan–Sep 2025).
4. In **Authentication > Providers**, enable Email and optionally disable “Confirm email” for local dev.
5. Create a **Storage** bucket named `imports` and set it to **Private** (no public access). Add an RLS policy so authenticated users can upload:  
   - Policy name: `Authenticated upload`  
   - Allowed operation: `INSERT`  
   - Target: `authenticated`  
   - With check: `true`  
   (Optionally add SELECT for same bucket if you want users to list their own files.)

### 3. Run the app

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Sign up or sign in; you’ll be redirected to the dashboard.

---

## ELI5: What you need to do (super simple version)

**1. Make a Supabase “house” for your data**
- Go to [supabase.com](https://supabase.com) and sign in.
- Click **New project**. Pick a name and a password (save it). Wait until it says “Ready”.

**2. Build the “rooms” (tables) in that house**
- In Supabase, open **SQL Editor**.
- Copy everything from `supabase/migrations/001_schema.sql`, paste in the editor, run it.
- Then copy everything from `supabase/migrations/002_rls_audit.sql`, paste, run it.
- Then run `003_lineage_triggers.sql`, `004_user_profiles.sql`, `005_rbac_profiles_and_policies.sql`, `006_rbac_rls_rewrite.sql`, `007_rbac_audit_enrichment.sql` in order.
- Then copy everything from `supabase/seed.sql`, paste, run it.  
  → Now your database has all the tables and Jan–Sep 2025 data.

**3. Turn on “login with email”**
- In Supabase go to **Authentication** → **Providers**.
- Make sure **Email** is on. For local testing you can turn off “Confirm email” so you don’t need to check inbox.

**4. Tell the app where your Supabase house is**
- In Supabase go to **Project Settings** (gear) → **API**.
- Copy **Project URL** and **anon public** key.
- Open the file **`.env.local`** in this project (it’s already there).
- Replace `https://your-project.supabase.co` with your **Project URL**.
- Replace `your-anon-key` with your **anon public** key.
- Save the file.

**5. Run the app**
- In the project folder run: **`npm run dev`**.
- Open [http://localhost:3000](http://localhost:3000), click **Sign up**, create an account, then you’re in.

## Database Schema (overview)

**Config-driven model (migrations 013+):**

- **revenue_streams** – Stream definitions (entry / derived / summary), colors, ordering, category dimensions, summary membership. Editors manage these from `/admin/streams`.
- **stream_fields** – The fields of each entry stream (one number per month each), with optional category grid positions and legacy/import metadata.
- **field_links** – Lineage: which entry fields count toward which derived-stream buckets (e.g. MPT ringtune fields → Ringtune/MPT bucket).
- **revenue_entries** – The single fact table (month × field × amount). Base facts only.
- **Views** – `v_derived_bucket_totals`, `v_stream_month_totals`, `v_revenue_summary_compat` compute all derived numbers; nothing derived is ever stored.
- **audit_log** – Append-only log written by SECURITY DEFINER triggers on every data and config table, enriched with actor identity and stream/field labels. Never updated or deleted.
- **Legacy tables** (`revenue_summary`, `ringtune`, `mpt`, …) – Frozen read-only after migration 017; kept as historical reference until decommission (runbook §9).

All tables have RLS enabled; access is role- and permission-driven (admin / editor / data / viewer + per-user permission overrides in JSONB).

**Migrations & operations:** see `docs/migration-runbook.md` for the backup / rehearsal / verification workflow. Migrations `013–018` are transactional and self-verifying (they abort and roll back on any reconciliation mismatch). `supabase/scripts/000_drift_audit.sql` is the read-only pre-migration integrity check.

## Pages

| Route         | Description |
|--------------|-------------|
| `/dashboard` | KPIs, revenue trend chart, stream donut, recent activity |
| `/streams`   | Tabs: Ringtune, MPT, EAUC, Combo, SZNB, Flow, YouTube, Spotify, TikTok (table + chart) |
| `/entry`     | Multi-step wizard to add/update a month’s data |
| `/import`    | Drag-and-drop Excel upload, parse, preview, upsert, store file in `imports` bucket |
| `/analytics` | KPIs, trend, stream share pie, international bar chart, CSV export |
| `/audit`     | Paginated audit log (filter by action/role/user) |
| `/admin/streams` | Stream Management: create/configure streams, fields, categories and lineage (Editor/Admin) |
| `/admin/users` | User management: invites, roles, per-user permission overrides |
| `/settings`  | Profile, display currency and rate overrides |

## Currency

All amounts are **Myanmar Kyat (MMK)** and displayed with comma separators (e.g. 197,323,395).

## Security

- All routes except `/`, `/login`, `/signup` require authentication (middleware).
- Roles: **Admin** (everything), **Editor** (configure streams + full data editing), **Data** (entry + import only), **Viewer** (read-only + export); per-user overrides supported.
- Middleware + server actions + PostgreSQL RLS enforce RBAC and permissions.
- API/data access uses Supabase client with anon key; RLS remains the final authority.
- Do not expose `SUPABASE_SERVICE_ROLE_KEY` client-side.
- Input validation and sanitization on forms and imported data; numeric inputs limited to 2 decimal places in validation logic.
- Duplicate month: if the selected month already exists, the data entry flow updates it (with confirmation message).

## Seed Data

`supabase/seed.sql` inserts Jan–Sep 2025 for all tables using the figures from your spec. Run it once after applying the schema.

## Rate limiting

The spec asks for a max of 30 data-entry requests per minute per user. This can be added in front of the data-entry server action (e.g. in-memory or Redis counter keyed by user id). Not implemented in this baseline.

## License

Internal use only.
