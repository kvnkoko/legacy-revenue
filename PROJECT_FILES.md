# All project files (what you have here)

Everything below lives in **`legacy-revenue-portal/`**. You need all of it to run the app.  
*(You can ignore `.next` and `node_modules` — those are generated.)*

---

## Root (config + env)

| File | What it’s for |
|------|----------------|
| `package.json` | Dependencies and scripts (`npm run dev`, etc.) |
| `package-lock.json` | Locked dependency versions |
| `tsconfig.json` | TypeScript config |
| `next.config.mjs` | Next.js config |
| `tailwind.config.ts` | Tailwind CSS theme/colors |
| `postcss.config.mjs` | PostCSS for Tailwind |
| `.eslintrc.json` | Linting rules |
| `.gitignore` | Files Git should ignore |
| **`.env.local`** | **Your Supabase URL + anon key (paste real values here)** |
| `.env.example` | Example env vars (reference only) |
| `README.md` | Setup and ELI5 instructions |

---

## Supabase (database)

| File | What it’s for |
|------|----------------|
| `supabase/migrations/001_schema.sql` | Creates all tables (revenue_summary, ringtune, mpt, …) |
| `supabase/migrations/002_rls_audit.sql` | RLS policies + audit triggers |
| `supabase/migrations/003_lineage_triggers.sql` | Parent-child sync triggers + revenue rollups |
| `supabase/migrations/004_user_profiles.sql` | Initial user profile table + signup profile trigger |
| `supabase/migrations/005_rbac_profiles_and_policies.sql` | RBAC profile schema, defaults, guards, auth helpers |
| `supabase/migrations/006_rbac_rls_rewrite.sql` | Permission-aware RLS policies for all key tables |
| `supabase/migrations/007_rbac_audit_enrichment.sql` | Adds user_name/user_role/user_email to audit |
| `supabase/seed.sql` | Jan–Sep 2025 seed data |

Run these in the Supabase SQL Editor in order: 001 → 002 → 003 → 004 → 005 → 006 → 007 → seed.

---

## App entry + layout

| File | What it’s for |
|------|----------------|
| `src/app/layout.tsx` | Root layout (font, Toaster, dark theme) |
| `src/app/page.tsx` | Home page (sign in / sign up links) |
| `src/app/globals.css` | Global styles and CSS variables |
| `src/app/favicon.ico` | Tab icon |
| `src/app/fonts/GeistVF.woff` | Font file |
| `src/app/fonts/GeistMonoVF.woff` | Mono font file |
| `src/middleware.ts` | Auth redirect (send logged-out users to login) |

---

## Auth (login / signup)

| File | What it’s for |
|------|----------------|
| `src/app/(auth)/layout.tsx` | Auth pages layout (if any) |
| `src/app/(auth)/login/page.tsx` | Login page |
| `src/app/(auth)/signup/page.tsx` | Sign up page |

---

## Dashboard (main app)

| File | What it’s for |
|------|----------------|
| `src/app/(dashboard)/layout.tsx` | Dashboard layout (sidebar + header) |
| `src/app/(dashboard)/dashboard/page.tsx` | Overview dashboard (KPIs, charts, activity) |
| `src/app/(dashboard)/dashboard/DashboardCharts.tsx` | Dashboard charts |
| `src/app/(dashboard)/dashboard/RecentActivity.tsx` | Recent activity (dashboard) |
| `src/app/(dashboard)/streams/StreamsView.tsx` | Revenue streams view |
| `src/app/(dashboard)/entry/page.tsx` | Data entry page |
| `src/app/(dashboard)/entry/actions.ts` | Server action: save monthly data |
| `src/app/(dashboard)/entry/EntryWizard.tsx` | Entry wizard UI |
| `src/app/(dashboard)/import/page.tsx` | Import Excel page |
| `src/app/(dashboard)/import/actions.ts` | Server action: parse + import Excel |
| `src/app/(dashboard)/analytics/page.tsx` | Analytics page |
| `src/app/(dashboard)/analytics/AnalyticsDashboard.tsx` | Analytics dashboard UI |
| `src/app/(dashboard)/audit/page.tsx` | Audit log page |
| `src/app/(dashboard)/audit/AuditTable.tsx` | Audit table (under app) |
| `src/app/(dashboard)/settings/page.tsx` | Settings page |

---

## Shared components

| File | What it’s for |
|------|----------------|
| `src/components/Sidebar.tsx` | Left nav (Overview, Streams, Entry, …) |
| `src/components/Header.tsx` | Top bar (user, sign out) |
| `src/components/dashboard/RevenueTrendChart.tsx` | Revenue trend chart |
| `src/components/dashboard/StreamDonutChart.tsx` | Stream donut chart |
| `src/components/dashboard/RecentActivity.tsx` | Recent activity (component) |
| `src/components/streams/StreamTabs.tsx` | Tabs for streams |
| `src/components/streams/StreamContent.tsx` | Stream table content |
| `src/components/entry/DataEntryWizard.tsx` | Multi-step data entry form |
| `src/components/import/ImportExcelClient.tsx` | Excel upload + preview + import |
| `src/components/analytics/AnalyticsCharts.tsx` | Analytics charts |
| `src/components/audit/AuditTable.tsx` | Audit log table (component) |
| `src/components/settings/SettingsForm.tsx` | Settings form |

---

## Lib (Supabase + utils)

| File | What it’s for |
|------|----------------|
| `src/lib/supabase/client.ts` | Browser Supabase client |
| `src/lib/supabase/server.ts` | Server Supabase client |
| `src/lib/supabase/admin.ts` | Service-role Supabase client for admin operations |
| `src/lib/supabase/middleware.ts` | Session refresh in middleware |
| `src/lib/utils.ts` | formatMMK, formatPercent, cn, STREAM_COLORS |
| `src/lib/permission-presets.ts` | Shared role permission presets |
| `src/lib/authz/*` | RBAC authz types/utils/server helpers/rate-limit |
| `src/lib/db/revenue.ts` | DB helpers (if used) |
| `src/types/database.ts` | Types for DB rows |

---

## Summary

- **Root:** config + **`.env.local`** (the one you edit with real Supabase values).
- **Supabase:** 3 SQL files to run in the Supabase SQL Editor.
- **`src/app`:** routes and page components.
- **`src/components`:** reusable UI (sidebar, charts, wizards, tables).
- **`src/lib`:** Supabase clients and shared utils.

After you set **`.env.local`** and run the SQL in Supabase, **`npm run dev`** is all you need to run the app.
