'use client';

import { Dialog } from '@/components/ui/dialog/Dialog';

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  confirmVariant = 'danger',
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  confirmVariant?: 'danger' | 'primary';
}) {
  return (
    <Dialog open={open} onClose={onClose} title={title}>
      <p className="text-body text-secondary">{message}</p>
      <div className="mt-4 flex justify-end gap-2">
        <button type="button" onClick={onClose} className="rounded-lg border border-border px-3 py-2 text-body text-primary">
          Cancel
        </button>
        <button
          type="button"
          onClick={() => {
            onConfirm();
            onClose();
          }}
          className={
            confirmVariant === 'danger'
              ? 'rounded-lg border border-red-400/60 bg-red-500/10 px-3 py-2 text-body font-medium text-red-200'
              : 'rounded-lg bg-teal px-3 py-2 text-body font-medium text-background'
          }
        >
          {confirmText}
        </button>
      </div>
    </Dialog>
  );
}
