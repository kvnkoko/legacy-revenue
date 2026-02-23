'use client';

import { useCurrency } from '@/contexts/CurrencyContext';

export function FormattedCurrency({
  value,
  className,
}: {
  value: number | null | undefined;
  className?: string;
}) {
  const { formatCurrency } = useCurrency();
  return <span className={className}>{formatCurrency(value)}</span>;
}
