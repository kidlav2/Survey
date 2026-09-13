import React, { useState } from 'react';
import { X, Download } from 'lucide-react';
import Button from '../chrome/Button';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'CSV' | 'JSON';
  onExport: (options: { includeResponses: boolean; includeContacts: boolean; dateRange: string }) => void | Promise<void>;
}

export default function ExportModal({ isOpen, onClose, type, onExport }: ExportModalProps) {
  const [busy, setBusy] = useState(false);
  const [exportOptions, setExportOptions] = useState({
    includeResponses: true,
    includeContacts: false,
    dateRange: 'all',
  });

  if (!isOpen) return null;

  const handleExport = async () => {
    setBusy(true);
    try {
      await onExport(exportOptions);
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(28, 22, 16, 0.45)' }}>
      <div role="dialog" aria-modal="true" aria-labelledby="export-title" className="w-full max-w-md border border-line bg-surface">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h3 id="export-title" className="font-serif text-lg font-semibold text-navy">
            Export {type}
          </h3>
          <button type="button" onClick={onClose} className="min-h-11 min-w-11" aria-label="Close" disabled={busy}>
            <X className="mx-auto size-5" />
          </button>
        </div>

        <div className="space-y-5 px-5 py-5">
          <fieldset className="space-y-3">
            <legend className="mb-2 text-sm font-bold text-ink">Include</legend>
            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                checked={exportOptions.includeResponses}
                onChange={(e) => setExportOptions({ ...exportOptions, includeResponses: e.target.checked })}
                className="mt-1 size-4 accent-navy"
                disabled={busy}
              />
              <span>
                <span className="block text-sm font-medium">Survey responses</span>
                <span className="text-xs text-ink-muted">One column per question, with readable answers</span>
              </span>
            </label>
            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                checked={exportOptions.includeContacts}
                onChange={(e) => setExportOptions({ ...exportOptions, includeContacts: e.target.checked })}
                className="mt-1 size-4 accent-navy"
                disabled={busy}
              />
              <span>
                <span className="block text-sm font-medium">Contact emails</span>
                <span className="text-xs text-ink-muted">Only people who opted in</span>
              </span>
            </label>
          </fieldset>

          <div>
            <label htmlFor="export-range" className="mb-2 block text-sm font-bold text-ink">
              Date range
            </label>
            <select
              id="export-range"
              value={exportOptions.dateRange}
              onChange={(e) => setExportOptions({ ...exportOptions, dateRange: e.target.value })}
              className="min-h-12 w-full border border-line-strong bg-surface px-3 text-sm"
              disabled={busy}
            >
              <option value="all">All time</option>
              <option value="today">Today</option>
              <option value="week">Last 7 days</option>
              <option value="month">Last 30 days</option>
            </select>
          </div>
        </div>

        <div className="flex justify-end gap-3 border-t border-line px-5 py-4">
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={() => void handleExport()} disabled={busy || (!exportOptions.includeResponses && !exportOptions.includeContacts)}>
            <Download className="size-4" />
            {busy ? 'Exporting…' : `Download ${type}`}
          </Button>
        </div>
      </div>
    </div>
  );
}
