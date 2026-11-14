import type { ReactNode } from 'react';

export interface Column<T> {
  key: string;
  header: string;
  cell: (row: T) => ReactNode;
}

/**
 * A plain, fully keyboard- and screen-reader-navigable data table. On narrow screens it
 * scrolls sideways inside its own box so the page never does.
 */
export function Table<T>({
  caption,
  columns,
  rows,
  rowKey,
}: {
  caption: string;
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
}) {
  return (
    <div
      className="overflow-x-auto rounded-lg border border-border"
      role="region"
      aria-label={caption}
      tabIndex={0}
    >
      <table className="w-full border-collapse bg-surface-raised text-left text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="bg-surface-sunken">
            {columns.map((column) => (
              <th key={column.key} scope="col" className="px-3 py-3 font-bold">
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={rowKey(row)} className="border-t border-border align-top">
              {columns.map((column) => (
                <td key={column.key} className="px-3 py-3">
                  {column.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
