import React from 'react';
import { Trash2 } from 'lucide-react';

type Props = {
  rows: string[];
  columns: string[];
  columnsLabel: string;
  rowsLabel: string;
  columnsHint: string;
  rowsHint: string;
  addColumn: string;
  addRow: string;
  columnPlaceholder: string;
  rowPlaceholder: string;
  onColumnsChange: (next: string[]) => void;
  onRowsChange: (next: string[]) => void;
};

function EditableList({
  items,
  min,
  label,
  hint,
  addLabel,
  placeholder,
  onChange,
}: {
  items: string[];
  min: number;
  label: string;
  hint: string;
  addLabel: string;
  placeholder: string;
  onChange: (next: string[]) => void;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700">{label}</label>
      <p className="mt-1 text-xs leading-relaxed text-gray-500">{hint}</p>
      <div className="mt-2 space-y-2">
        {items.map((item, index) => (
          <div key={index} className="flex items-center gap-2">
            <input
              type="text"
              value={item}
              onChange={(e) => {
                const next = [...items];
                next[index] = e.target.value;
                onChange(next);
              }}
              className="min-h-11 flex-1 border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder={`${placeholder} ${index + 1}`}
              aria-label={`${label} ${index + 1}`}
            />
            <button
              type="button"
              onClick={() => onChange(items.filter((_, i) => i !== index))}
              disabled={items.length <= min}
              className="inline-flex min-h-11 min-w-11 items-center justify-center text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
              aria-label={`Remove ${label} ${index + 1}`}
            >
              <Trash2 className="size-4" aria-hidden="true" />
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => onChange([...items, ''])}
          className="min-h-11 text-sm font-medium text-indigo-600 hover:text-indigo-700"
        >
          + {addLabel}
        </button>
      </div>
    </div>
  );
}

export default function MatrixEditor({
  rows,
  columns,
  columnsLabel,
  rowsLabel,
  columnsHint,
  rowsHint,
  addColumn,
  addRow,
  columnPlaceholder,
  rowPlaceholder,
  onColumnsChange,
  onRowsChange,
}: Props) {
  return (
    <div className="space-y-5">
      <EditableList
        items={columns}
        min={2}
        label={columnsLabel}
        hint={columnsHint}
        addLabel={addColumn}
        placeholder={columnPlaceholder}
        onChange={onColumnsChange}
      />
      <EditableList
        items={rows}
        min={1}
        label={rowsLabel}
        hint={rowsHint}
        addLabel={addRow}
        placeholder={rowPlaceholder}
        onChange={onRowsChange}
      />
    </div>
  );
}
