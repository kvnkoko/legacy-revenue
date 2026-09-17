/**
 * Write verification.
 *
 * Supabase/PostgREST does NOT report an error when an UPDATE or DELETE matches
 * zero rows — a statement blocked by row-level security, or one whose filter
 * matched nothing, comes back with `error === null`. Code shaped like
 *
 *     const { error } = await supabase.from(t).update(v).eq('id', id);
 *     if (error) throw new Error(error.message);
 *
 * therefore reports success for a write that never happened. In this app that
 * also produced a false audit trail, because the caller then logged an UPDATE
 * action to audit_log regardless.
 *
 * A BEFORE trigger can also rewrite a value while still reporting one row
 * changed, so counting affected rows is not sufficient either. These helpers
 * verify the values that are actually stored after the write.
 */

function canonical(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonical).join(',')}]`;
  if (v && typeof v === 'object') {
    return `{${Object.keys(v as Record<string, unknown>)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonical((v as Record<string, unknown>)[k])}`)
      .join(',')}}`;
  }
  return JSON.stringify(v);
}

/** Loose equality that treats jsonb columns (objects/arrays) sensibly. */
function sameValue(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a == null || b == null) return a == null && b == null;
  if (typeof a === 'object' || typeof b === 'object') {
    // Postgres jsonb does not preserve key order, so compare canonically.
    try {
      return canonical(a) === canonical(b);
    } catch {
      return false;
    }
  }
  // Postgres numeric(18,2) comes back through PostgREST as a STRING, so the
  // amount 100 is returned as "100.00". Compare those numerically or a
  // correctly-saved figure would be reported as not saved.
  const na = typeof a === 'number' ? a : Number(a);
  const nb = typeof b === 'number' ? b : Number(b);
  const bothNumeric =
    Number.isFinite(na) &&
    Number.isFinite(nb) &&
    String(a).trim() !== '' &&
    String(b).trim() !== '' &&
    typeof a !== 'boolean' &&
    typeof b !== 'boolean';
  if (bothNumeric) {
    // Tolerance below one hundredth: these columns store 2 decimal places.
    return Math.abs(na - nb) < 0.005;
  }
  return String(a) === String(b);
}

/**
 * Throws unless `row` exists and every key in `expected` matches what is
 * actually stored. `what` is used in the message shown to the person.
 */
export function assertSaved<T extends Record<string, unknown>>(
  row: T | null | undefined,
  expected: Partial<T>,
  what: string
): void {
  if (!row) {
    throw new Error(
      `${what} was not saved. The database did not accept the change, so nothing was ` +
        'written. This can happen if the record no longer exists or your account does ' +
        'not have permission. Please reload and try again.'
    );
  }
  const wrong: string[] = [];
  for (const key of Object.keys(expected) as Array<keyof T>) {
    if (!sameValue(row[key], expected[key])) wrong.push(String(key));
  }
  if (wrong.length) {
    throw new Error(
      `${what} was not saved correctly. The database still shows a different value for: ` +
        `${wrong.join(', ')}. Nothing has been recorded as changed. Please reload and try again.`
    );
  }
}

/** Throws when an update/delete matched no rows at all. */
export function assertRowsAffected(
  rows: unknown[] | null | undefined,
  what: string
): void {
  if (!rows || rows.length === 0) {
    throw new Error(
      `${what} was not saved. The database reported that no record was changed, so the ` +
        'change has been discarded. Please reload and try again.'
    );
  }
}
