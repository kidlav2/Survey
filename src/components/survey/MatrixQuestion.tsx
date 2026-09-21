import React from 'react';
import { remainingMatrixRows, selectedColumnIndex } from '../../lib/matrixQuestion';

type Props = {
  questionId: string;
  stem: string;
  rows: string[];
  columns: string[];
  value: unknown;
  remainingLabel: string;
  allRatedLabel: string;
  onSelect: (rowIndex: number, columnIndex: number) => void;
};

export default function MatrixQuestion({
  questionId,
  stem,
  rows,
  columns,
  value,
  remainingLabel,
  allRatedLabel,
  onSelect,
}: Props) {
  const remaining = remainingMatrixRows(value, rows, columns);
  const grid =
    columns.length <= 4
      ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'
      : 'grid-cols-1 sm:grid-cols-2';
  const visible = rows
    .map((row, rowIndex) => ({ row, rowIndex }))
    .filter(({ row }) => String(row || '').trim());

  return (
    <div className="mt-8">
      <p className="sr-only">{stem}</p>
      <ol className="space-y-4">
        {visible.map(({ row, rowIndex }, displayIndex) => {
          const selected = selectedColumnIndex(value, rowIndex, columns);
          return (
            <li key={`${questionId}-row-${rowIndex}`}>
              <div className="border border-line bg-canvas px-4 py-4">
                <fieldset
                  data-matrix-row={rowIndex}
                  data-answered={selected == null ? undefined : 'true'}
                  className="min-w-0 scroll-mt-24"
                >
                  <legend className="float-none mb-3 w-full max-w-[65ch] p-0 text-base font-medium leading-normal text-pretty text-ink">
                    <span className="mr-2 font-sans text-xs font-bold tabular-nums text-ink-subtle">
                      {displayIndex + 1}
                    </span>
                    {row}
                  </legend>
                  <div className={`grid gap-2 ${grid}`}>
                    {columns.map((column, columnIndex) => {
                      const isOn = selected === columnIndex;
                      const inputId = `${questionId}-r${rowIndex}-c${columnIndex}`;
                      return (
                        <label
                          key={inputId}
                          htmlFor={inputId}
                          className={`flex min-h-12 cursor-pointer items-center gap-3 border px-3 py-2 text-base leading-normal transition-colors duration-150 ${
                            isOn
                              ? 'border-navy bg-accent-soft font-semibold text-ink'
                              : 'border-line bg-surface text-ink hover:border-line-strong'
                          }`}
                        >
                          <input
                            id={inputId}
                            type="radio"
                            name={`${questionId}-row-${rowIndex}`}
                            className="size-4 shrink-0 accent-[#31486f]"
                            checked={isOn}
                            onChange={() => onSelect(rowIndex, columnIndex)}
                            value={columnIndex}
                          />
                          <span className="min-w-0">{column}</span>
                        </label>
                      );
                    })}
                  </div>
                </fieldset>
              </div>
            </li>
          );
        })}
      </ol>
      <p className="mt-4 text-sm leading-normal text-ink-muted" aria-live="polite">
        {remaining === 0 ? allRatedLabel : remainingLabel}
      </p>
    </div>
  );
}
