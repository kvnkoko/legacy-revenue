'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  fetchRatesFromMMK,
  formatCurrencyValue,
  getEffectiveRate,
  type CurrencyCode,
} from '@/lib/currency';

type CurrencyOverrides = Partial<Record<CurrencyCode, number>>;

type CurrencyContextValue = {
  displayCurrency: CurrencyCode;
  rateOverrides: CurrencyOverrides;
  rate: number;
  formatCurrency: (valueMMK: number | null | undefined) => string;
  setDisplayCurrency: (code: CurrencyCode) => void;
  setRateOverride: (code: CurrencyCode, rate: number | null) => void;
  isLoading: boolean;
  lastFetched: Date | null;
  refetchRates: () => Promise<void>;
};

const CurrencyContext = createContext<CurrencyContextValue | null>(null);

export function CurrencyProvider({
  children,
  initialCurrency = 'MMK',
  initialOverrides = {},
  storedRates = {},
}: {
  children: React.ReactNode;
  initialCurrency?: CurrencyCode;
  initialOverrides?: CurrencyOverrides;
  storedRates?: Partial<Record<CurrencyCode, number>>;
}) {
  const [displayCurrency, setDisplayCurrencyState] = useState<CurrencyCode>(initialCurrency);
  const [rateOverrides, setRateOverridesState] = useState<CurrencyOverrides>(initialOverrides);

  useEffect(() => {
    setDisplayCurrencyState(initialCurrency);
    setRateOverridesState(initialOverrides);
  }, [initialCurrency, initialOverrides]);
  const [fetchedRates, setFetchedRates] = useState<Partial<Record<CurrencyCode, number>>>(storedRates);
  const [isLoading, setIsLoading] = useState(false);
  const [lastFetched, setLastFetched] = useState<Date | null>(null);

  const refetchRates = useCallback(async () => {
    setIsLoading(true);
    try {
      const rates = await fetchRatesFromMMK();
      setFetchedRates(rates);
      setLastFetched(new Date());
    } catch {
      // Fallback to defaults
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refetchRates();
  }, [refetchRates]);

  const rate = useMemo(
    () => getEffectiveRate(displayCurrency, fetchedRates, rateOverrides),
    [displayCurrency, fetchedRates, rateOverrides]
  );

  const formatCurrency = useCallback(
    (valueMMK: number | null | undefined) =>
      formatCurrencyValue(valueMMK, displayCurrency, rate),
    [displayCurrency, rate]
  );

  const setDisplayCurrency = useCallback((code: CurrencyCode) => {
    setDisplayCurrencyState(code);
  }, []);

  const setRateOverride = useCallback((code: CurrencyCode, value: number | null) => {
    setRateOverridesState((prev) => {
      const next = { ...prev };
      if (value == null) delete next[code];
      else next[code] = value;
      return next;
    });
  }, []);

  const value: CurrencyContextValue = useMemo(
    () => ({
      displayCurrency,
      rateOverrides,
      rate,
      formatCurrency,
      setDisplayCurrency,
      setRateOverride,
      isLoading,
      lastFetched,
      refetchRates,
    }),
    [
      displayCurrency,
      rateOverrides,
      rate,
      formatCurrency,
      setDisplayCurrency,
      setRateOverride,
      isLoading,
      lastFetched,
      refetchRates,
    ]
  );

  return (
    <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>
  );
}

export function useCurrency() {
  const ctx = useContext(CurrencyContext);
  if (!ctx) {
    // Fallback when used outside provider - format as MMK
    return {
      displayCurrency: 'MMK' as CurrencyCode,
      rateOverrides: {} as CurrencyOverrides,
      rate: 1,
      formatCurrency: (v: number | null | undefined) =>
        v == null || Number.isNaN(v) ? '—' : new Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(v) + ' K',
      setDisplayCurrency: () => {},
      setRateOverride: () => {},
      isLoading: false,
      lastFetched: null,
      refetchRates: async () => {},
    };
  }
  return ctx;
}
