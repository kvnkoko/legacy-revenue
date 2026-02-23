'use client';

import { cn } from '@/lib/utils';

export function Dialog({
  open,
  onClose,
  title,
  children,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
        aria-label="Close dialog"
      />
      <div className={cn('relative z-[91] w-full max-w-lg rounded-xl border border-border bg-card p-5', className)}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-body font-semibold text-primary">{title}</h3>
          <button type="button" onClick={onClose} className="rounded px-2 py-1 text-caption text-secondary hover:bg-elevated">
            Close
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Drawer({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[90]">
      <button type="button" className="absolute inset-0 bg-black/45" onClick={onClose} aria-label="Close drawer" />
      <aside className="absolute right-0 top-0 h-full w-full max-w-2xl border-l border-border bg-card p-5 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-body font-semibold text-primary">{title}</h3>
          <button type="button" onClick={onClose} className="rounded px-2 py-1 text-caption text-secondary hover:bg-elevated">
            Close
          </button>
        </div>
        <div className="h-[calc(100%-3rem)] overflow-y-auto pr-1">{children}</div>
      </aside>
    </div>
  );
}
