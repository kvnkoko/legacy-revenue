/**
 * Currency definitions and rate fetching.
 * Data stored in MMK; we convert to display currency using rate (MMK per 1 unit of display currency).
 */

export const CURRENCIES = [
  { code: 'MMK', name: 'Myanmar Kyat', symbol: 'K', locale: 'my-MM' },
  { code: 'USD', name: 'US Dollar', symbol: '$', locale: 'en-US' },
  { code: 'THB', name: 'Thai Baht', symbol: '฿', locale: 'th-TH' },
  { code: 'SGD', name: 'Singapore Dollar', symbol: 'S$', locale: 'en-SG' },
  { code: 'EUR', name: 'Euro', symbol: '€', locale: 'de-DE' },
  { code: 'GBP', name: 'British Pound', symbol: '£', locale: 'en-GB' },
  { code: 'JPY', name: 'Japanese Yen', symbol: '¥', locale: 'ja-JP' },
  { code: 'INR', name: 'Indian Rupee', symbol: '₹', locale: 'en-IN' },
  { code: 'CNY', name: 'Chinese Yuan', symbol: '¥', locale: 'zh-CN' },
] as const;

export type CurrencyCode = (typeof CURRENCIES)[number]['code'];

// Rate = MMK per 1 unit of display currency. E.g. 1 USD = 2100 MMK → rate = 2100
// value_display = value_MMK / rate
export const DEFAULT_RATES: Record<CurrencyCode, number> = {
  MMK: 1,
  USD: 2100,
  THB: 60,
  SGD: 1550,
  EUR: 2300,
  GBP: 2650,
  JPY: 14,
  INR: 25,
  CNY: 290,
};

const FRANKFURTER_API = 'https://api.frankfurter.app/v1/latest';

export async function fetchRatesFromMMK(): Promise<Partial<Record<CurrencyCode, number>>> {
  // Frankfurter: from=USD gives rates as "X per 1 USD". We need "MMK per 1 [currency]".
  // Fetch USD base, get MMK and others. rate[THB] = mmkPerUsd / thbPerUsd = MMK per 1 THB.
  const codes = CURRENCIES.map((c) => c.code).filter((c) => c !== 'USD').join(',');
  const url = `${FRANKFURTER_API}?from=USD&to=MMK,${codes}`;
  const res = await fetch(url);
  if (!res.ok) return {};
  const data = (await res.json()) as { rates?: Record<string, number> };
  if (!data.rates) return {};
  const mmkPerUsd = data.rates.MMK;
  if (!mmkPerUsd || mmkPerUsd <= 0) return {};
  const out: Partial<Record<CurrencyCode, number>> = { MMK: 1, USD: mmkPerUsd };
  for (const [code, unitsPerUsd] of Object.entries(data.rates)) {
    if (code === 'MMK' || code === 'USD') continue;
    if (unitsPerUsd && unitsPerUsd > 0) {
      (out as Record<string, number>)[code] = mmkPerUsd / unitsPerUsd; // MMK per 1 [code]
    }
  }
  return out;
}

export function getEffectiveRate(
  code: CurrencyCode,
  fetchedRates: Partial<Record<CurrencyCode, number>>,
  overrides: Partial<Record<CurrencyCode, number>>
): number {
  const override = overrides[code];
  if (override != null && override > 0) return override;
  const fetched = fetchedRates[code];
  if (fetched != null && fetched > 0) return fetched;
  return DEFAULT_RATES[code] ?? 1;
}

export function formatCurrencyValue(
  valueMMK: number | null | undefined,
  currencyCode: CurrencyCode,
  rate: number
): string {
  if (valueMMK == null || Number.isNaN(valueMMK)) return '—';
  const cur = CURRENCIES.find((c) => c.code === currencyCode);
  if (!cur) return valueMMK.toLocaleString();
  const displayValue = rate <= 0 ? valueMMK : valueMMK / rate;
  return new Intl.NumberFormat(cur.locale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
    style: 'currency',
    currency: currencyCode,
  }).format(displayValue);
}
