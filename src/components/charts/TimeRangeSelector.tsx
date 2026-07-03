'use client';

export type TimeRangeKey = '3M' | '6M' | '12M' | 'YTD' | 'ALL' | 'CUSTOM';

export function TimeRangeSelector({
  value,
  onChange,
}: {
  value: TimeRangeKey;
  onChange: (next: TimeRangeKey) => void;
}) {
  const options: TimeRangeKey[] = ['3M', '6M', '12M', 'YTD', 'ALL', 'CUSTOM'];
  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {options.map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => onChange(option)}
          className={`shrink-0 whitespace-nowrap rounded-md border px-2.5 py-1 text-caption transition-colors ${
            value === option
              ? 'border-gold bg-gold/10 text-gold'
              : 'border-border bg-elevated text-secondary hover:text-primary'
          }`}
        >
          {option === 'ALL' ? 'All Time' : option}
        </button>
      ))}
    </div>
  );
}
