# Migration Runbook — Config-Driven Streams Refactor

This portal holds **live production revenue data**. Every database change in this
refactor follows the same discipline:

1. **Backup first** — restore point + CSV exports (see below).
2. **Rehearse first** — every script runs on the rehearsal project before production.
3. **Scripts are transactional and self-verifying** — each migration is wrapped in
   `BEGIN … COMMIT` and ends with a `DO $$ … $$` block that `RAISE EXCEPTION`s on any
   verification failure, which rolls back the entire script automatically.
4. **Never touch `audit_log`** — it is append-only, forever. No script updates or
   deletes audit rows.

---

## 1. Script index

Run in the Supabase **SQL Editor**, one script at a time, in this order. Do not
proceed past a script until its verification output (the `NOTICE` messages at the
bottom of the results panel) looks correct.

| Order | Script | Phase | What it does | Safe to re-run? |
|---|---|---|---|---|
| A | `supabase/scripts/000_drift_audit.sql` | 0 | Read-only report: stored derived values vs recomputation from base tables. **Empty result = no drift.** | Yes (read-only) |
| B | `supabase/migrations/013_config_schema.sql` | 1 | Creates `revenue_streams`, `stream_fields`, `field_links`, `revenue_entries`, audit triggers, RLS | Yes |
| C | `supabase/migrations/014_seed_stream_config.sql` | 1 | Seeds the 16 streams / 36 fields / lineage links matching today's tables | Yes |
| D | `supabase/migrations/015_backfill_and_views.sql` | 1 | Creates views, backfills `revenue_entries` from legacy tables, full reconciliation | Yes |
| E | `supabase/migrations/016_forward_sync_triggers.sql` | 1 | Legacy tables → `revenue_entries` live sync (old app keeps working) | Yes |
| — | *(deploy Phase 2 app — read cutover; no DB change)* | 2 | | |
| — | *(deploy Phase 3 app — write cutover; see §5 choreography)* | 3 | | |
| F | `supabase/migrations/017_freeze_legacy_tables.sql` | 3 | Removes write access + triggers from legacy tables (read stays) | Yes |
| — | *(deploy Phase 4 app)* | 4 | | |
| G | `supabase/migrations/018_roles.sql` | 4 | admin/staff → admin/editor/data/viewer, effective access preserved | Yes |

> **018 ordering note:** run 018 only after at least one user exists (production
> always qualifies). On a brand-new empty project its safety check used to
> abort — fixed to tolerate zero-user databases, but signing up the first
> admin before running 018 remains the cleanest order on fresh installs.
>
> **Paste-ready bundles** for the SQL Editor live in
> `supabase/rehearsal-helpers/` (production_step1…step5 + rehearsal fix).

Rollback scripts (pre-written, rehearse them too): `016_rollback.sql`,
`017_rollback.sql`, `018_rollback.sql` in `supabase/migrations/`.

---

## 2. Backup procedure (before EVERY production migration day)

1. **Supabase backup / restore point**
   - Dashboard → **Database** → **Backups**. Confirm a recent daily backup exists.
   - On a paid plan with PITR: note the current timestamp as your restore point.
   - On the free plan: daily backups only — do migrations early in the day and
     rely on the CSV exports below as the fine-grained fallback.

2. **CSV exports** — in the SQL Editor, run each of these and use **Download CSV**
   on the result. Store the files somewhere safe (dated folder).

   ```sql
   SELECT * FROM revenue_summary ORDER BY month;
   SELECT * FROM ringtune ORDER BY month;
   SELECT * FROM mpt ORDER BY month;
   SELECT * FROM atom ORDER BY month;
   SELECT * FROM eauc ORDER BY month;
   SELECT * FROM combo ORDER BY month;
   SELECT * FROM local ORDER BY month;
   SELECT * FROM sznb ORDER BY month;
   SELECT * FROM flow_subscription ORDER BY month;
   SELECT * FROM international ORDER BY month;
   SELECT * FROM youtube ORDER BY month;
   SELECT * FROM spotify ORDER BY month;
   SELECT * FROM tiktok ORDER BY month;
   SELECT * FROM audit_log ORDER BY sqlid;
   SELECT * FROM user_profiles;
   SELECT * FROM invited_emails;
   SELECT * FROM app_settings;
   ```

3. Record in this file's log (§7): date, who ran it, backup location.

---

## 3. Rehearsal project setup (one-time, ~30 minutes)

Create a free second Supabase project that mirrors production so every script can
be rehearsed end-to-end.

1. Create a new project at supabase.com (e.g. `legacy-revenue-rehearsal`). Free tier is fine.
2. In its SQL Editor, run the existing migrations **in order**:
   `001_schema.sql` → `002_rls_audit.sql` → `003_lineage_triggers.sql` →
   `004_user_profiles.sql` → `005_rbac_profiles_and_policies.sql` →
   `006_rbac_rls_rewrite.sql` → `007_rbac_audit_enrichment.sql` →
   `008_invited_emails.sql` → `009_remove_kokokevin.sql` → `010_app_settings.sql` →
   `011_user_currency_preferences.sql` → `012_admin_settings_seed.sql`.
3. Load production data. Easiest path: for each CSV from §2, use the Table Editor's
   **Insert → Import data from CSV**, or generate `INSERT` statements. Import base
   tables **with lineage triggers disabled** so derived tables keep their exact
   production values (drift and all — the rehearsal must reproduce production
   faithfully, including its imperfections):

   ```sql
   -- before importing:
   ALTER TABLE mpt DISABLE TRIGGER USER;
   ALTER TABLE atom DISABLE TRIGGER USER;
   ALTER TABLE ringtune DISABLE TRIGGER USER;
   ALTER TABLE eauc DISABLE TRIGGER USER;
   ALTER TABLE combo DISABLE TRIGGER USER;
   ALTER TABLE local DISABLE TRIGGER USER;
   ALTER TABLE sznb DISABLE TRIGGER USER;
   ALTER TABLE flow_subscription DISABLE TRIGGER USER;
   ALTER TABLE international DISABLE TRIGGER USER;
   ALTER TABLE youtube DISABLE TRIGGER USER;
   ALTER TABLE spotify DISABLE TRIGGER USER;
   ALTER TABLE tiktok DISABLE TRIGGER USER;
   ALTER TABLE revenue_summary DISABLE TRIGGER USER;
   -- import all CSVs, then:
   ALTER TABLE mpt ENABLE TRIGGER USER;    -- …repeat for every table above
   ```

4. Sanity-check: `000_drift_audit.sql` on rehearsal should return the **same rows**
   as on production. If it doesn't, the rehearsal copy isn't faithful — fix before
   rehearsing migrations.
5. Optionally point a local `.env.local` at the rehearsal project and run
   `npm run dev` to test the app against rehearsed migrations.

---

## 4. Drift triage (Phase 0, before running 015)

Run `000_drift_audit.sql` on **production**. For every returned row, choose one:

- **(a) Fix the base data** (preferred): correct the underlying base-table value
  through the app's normal entry/import flow so the change is audited, then re-run
  the audit until the row disappears.
- **(b) Accept the recomputed value**: sign off that the recomputation from base
  facts is the correct number going forward, and add the month to the
  `allowed_drift_months` list at the top of `015_backfill_and_views.sql`'s
  verification block.

Record every decision in the log (§7). `015` will **abort** on any drifted month
that is not in the allowlist.

Special case: non-zero `flow_music_zone` / `flow_data_pack` rows are not drift —
they are real values with no base table. `015` migrates them into the new
`flow_music_zone` / `flow_data_pack` entry streams automatically.

---

## 5. Phase 3 cutover choreography (write-path switch)

The only step with an ordering dependency between an app deploy and a migration.
Total window: ~15–30 minutes. Pick a quiet time and tell the team not to enter
data during it.

| Step | Action | If it fails |
|---|---|---|
| 1 | Announce entry/import freeze to the team | — |
| 2 | Backup per §2 | Stop |
| 3 | Deploy the Phase 3 app build (writes now go to `revenue_entries`) | Redeploy previous build; old write path still works because 017 hasn't run |
| 4 | Smoke test: enter a test month via the wizard, then delete it; import the team's real Excel file and check counts/warnings | Same as step 3 |
| 5 | Run `017_freeze_legacy_tables.sql` | Run `017_rollback.sql`, then step 3's rollback if needed |
| 6 | Verify: try `INSERT INTO mpt(month) VALUES ('2099-01-01')` as an authenticated user → must be rejected | Investigate before lifting freeze |
| 7 | Lift the freeze, announce the new entry flow | — |

Note for the team in the announcement: the Excel template is unchanged, but the
derived sheets (`Ringtune`, `EAUC`, `Combo`, `Local`, `International`, `Revenue`)
are now **verify-only** — the importer checks them against computed totals and
warns on mismatch instead of writing them. Base sheets (`MPT`, `Atom`, `SZNB`,
`Flow Subscription`, `YouTube`, `Spotify`, `Tiktok`) remain authoritative.

---

## 6. Go / no-go checklist (every production migration)

- [ ] Rehearsal project ran this exact script cleanly (verification NOTICEs OK)
- [ ] Backup + CSV exports taken today (§2)
- [ ] Drift audit status known; allowlist up to date (015 only)
- [ ] Quiet window; team informed if the script affects writes
- [ ] Rollback script for this step open in a second tab, already rehearsed
- [ ] After running: verification NOTICE output copied into the log (§7)

## 7. Migration log

| Date | Script | Environment | Operator | Result / notes |
|---|---|---|---|---|
| | | | | |

---

## 8. Admin profile pre-check (Phase 0 app fix)

The app previously contained a fallback that granted full admin to any
authenticated user whose email was `admin@legacy.com` or whose auth metadata said
`role: admin` — **even with no `user_profiles` row**. That fallback is removed in
Phase 0. Before deploying the fix, confirm every real admin has a proper profile
row:

```sql
SELECT u.id, u.email, p.role, p.status
FROM auth.users u
LEFT JOIN public.user_profiles p ON p.id = u.id
ORDER BY u.created_at;
```

Every intended admin must show `role = 'admin', status = 'active'`. If someone is
missing a profile row, create it via User Management (or promote via SQL) **before**
deploying the Phase 0 app build.

## 9. Legacy table decommission (deferred — do not run now)

After the new system has been live and reconciled for a comfortable period
(suggested: 3+ months), the frozen legacy tables can be archived and dropped
(`supabase/scripts/099_decommission_legacy.sql`, to be written at that time:
CSV-export every frozen table, then `DROP` the 13 revenue tables and the legacy
lineage/sync functions). `audit_log` is never dropped or modified; historic audit
rows keep referencing the old table names and the Audit page keeps rendering them.
