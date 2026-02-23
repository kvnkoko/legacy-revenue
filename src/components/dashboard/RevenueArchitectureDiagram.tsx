'use client';

import Link from 'next/link';
import { useCurrency } from '@/contexts/CurrencyContext';

type NodeValue = Record<string, number>;

export function RevenueArchitectureDiagram({ values }: { values: NodeValue }) {
  const { formatCurrency } = useCurrency();
  const node = (label: string, value: number, href: string) => (
    <Link href={href} className="rounded-lg border border-border bg-elevated px-3 py-2 text-caption text-primary hover:border-teal/60">
      <div>{label}</div>
      <div className="text-teal">{formatCurrency(value)}</div>
    </Link>
  );

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h2 className="mb-4 text-body font-semibold text-primary">Revenue Architecture</h2>
      <div className="grid gap-3">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
          {node('◈ MPT Distributors', values.mpt, '/streams')}
          {node('◈ Atom', values.atom, '/streams')}
          {node('✎ Ooredoo', values.ooredoo, '/streams')}
          {node('✎ Direct Streams', values.direct, '/streams')}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-2">
          {node('⟵ Ringtune', values.ringtune, '/streams')}
          {node('⟵ EAUC', values.eauc, '/streams')}
          {node('⟵ Combo', values.combo, '/streams')}
        </div>
        <div className="grid grid-cols-1">
          {node('Σ Revenue Total', values.total, '/dashboard')}
        </div>
      </div>
    </div>
  );
}
