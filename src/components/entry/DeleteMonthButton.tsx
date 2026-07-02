'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { deleteMonth } from '@/app/(dashboard)/entry/actions';

export function DeleteMonthButton({ month }: { month: string }) {
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  const onDelete = async () => {
    const label = new Date(month).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    const ok = window.confirm(
      `Delete ALL revenue data for ${label}?\n\nEvery removed value is recorded in the audit log, but the month will disappear from dashboards and analytics.`
    );
    if (!ok) return;
    setBusy(true);
    try {
      const result = await deleteMonth(month);
      toast.success(`${label}: ${result.deleted} values deleted (audited).`);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to delete month.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={onDelete}
      disabled={busy}
      className="rounded border border-red-500/40 px-2 py-1 text-caption text-red-400 hover:bg-red-500/10 disabled:opacity-50"
    >
      {busy ? 'Deleting…' : 'Delete'}
    </button>
  );
}
