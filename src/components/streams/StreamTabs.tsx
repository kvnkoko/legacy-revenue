'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

type StreamTab = 'ringtune' | 'mpt' | 'eauc' | 'combo' | 'sznb' | 'flow_subscription' | 'youtube' | 'spotify' | 'tiktok';

const TABS: { id: StreamTab; label: string }[] = [
  { id: 'ringtune', label: 'Ringtune' },
  { id: 'mpt', label: 'MPT' },
  { id: 'eauc', label: 'EAUC' },
  { id: 'combo', label: 'Combo' },
  { id: 'sznb', label: 'SZNB' },
  { id: 'flow_subscription', label: 'Flow Subscription' },
  { id: 'youtube', label: 'YouTube' },
  { id: 'spotify', label: 'Spotify' },
  { id: 'tiktok', label: 'TikTok' },
];

export function StreamTabs({ current }: { current: StreamTab }) {
  usePathname(); // keep for future use

  return (
    <div className="flex flex-wrap gap-1 border-b border-border pb-2">
      {TABS.map((tab) => {
        const href = tab.id === 'ringtune' ? '/streams' : `/streams/${tab.id}`;
        const isActive = current === tab.id;
        return (
          <Link
            key={tab.id}
            href={href}
            className={cn(
              'px-4 py-2 rounded-t-lg text-sm font-medium transition',
              isActive
                ? 'bg-teal/15 text-teal border-b-2 border-teal -mb-0.5'
                : 'text-secondary hover:bg-elevated hover:text-primary'
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
