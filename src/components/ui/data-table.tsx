"use client";

import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import { useState } from "react";

export function DataTable<T>({
  data,
  columns,
  onRowClick,
}: {
  data: T[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  columns: ColumnDef<T, any>[];
  onRowClick?: (row: T) => void;
}) {
  const [sorting, setSorting] = useState<SortingState>([]);

  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-100">
      <table className="w-full min-w-[640px] text-left text-xs">
        <thead className="bg-slate-50 text-slate-500">
          {table.getHeaderGroups().map((hg) => (
            <tr key={hg.id}>
              {hg.headers.map((h) => (
                <th key={h.id} className="px-4 py-2 font-medium">
                  {h.isPlaceholder ? null : (
                    <button
                      type="button"
                      className={h.column.getCanSort() ? "cursor-pointer select-none" : ""}
                      onClick={h.column.getToggleSortingHandler()}
                    >
                      {flexRender(h.column.columnDef.header, h.getContext())}
                      {{ asc: " ↑", desc: " ↓" }[h.column.getIsSorted() as string] ?? null}
                    </button>
                  )}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <tr
              key={row.id}
              className={`border-t border-slate-50 ${onRowClick ? "cursor-pointer hover:bg-violet-50/30" : ""}`}
              onClick={() => onRowClick?.(row.original)}
            >
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id} className="px-4 py-2.5 text-slate-700">
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {data.length === 0 && (
        <p className="p-6 text-center text-sm text-slate-400">No data yet.</p>
      )}
    </div>
  );
}
