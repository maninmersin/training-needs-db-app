import React, { useEffect, useMemo, useState } from 'react';
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable
} from '@tanstack/react-table';
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Inbox } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from './button';
import { Checkbox } from './form';
import { EmptyState, Skeleton } from './display';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './select-tabs';

const selectionColumn = {
  id: '_select',
  enableSorting: false,
  size: 36,
  header: ({ table }) => (
    <Checkbox
      aria-label="Select all"
      checked={table.getIsAllPageRowsSelected() ? true : table.getIsSomePageRowsSelected() ? 'indeterminate' : false}
      onCheckedChange={(value) => table.toggleAllPageRowsSelected(value === true)}
    />
  ),
  cell: ({ row }) => (
    <Checkbox aria-label="Select row" checked={row.getIsSelected()} onCheckedChange={(value) => row.toggleSelected(value === true)} />
  )
};

const alignClass = (meta) => (meta?.align === 'right' ? 'text-right' : meta?.align === 'center' ? 'text-center' : 'text-left');

/**
 * Dense, sortable table with optional search, row selection and paging.
 * Columns are @tanstack/react-table column defs; `meta: { align: 'right' }` aligns numbers.
 */
export function DataTable({
  columns,
  data,
  getRowId,
  caption,
  selectable = false,
  onSelectionChange,
  globalFilter = '',
  pageSize = 25,
  pageSizes = [25, 50, 100],
  initialSorting = [],
  loading = false,
  emptyState,
  onRowClick,
  className
}) {
  const [sorting, setSorting] = useState(initialSorting);
  const [rowSelection, setRowSelection] = useState({});
  const allColumns = useMemo(() => (selectable ? [selectionColumn, ...columns] : columns), [selectable, columns]);

  const table = useReactTable({
    data,
    columns: allColumns,
    getRowId,
    state: { sorting, rowSelection, globalFilter },
    onSortingChange: setSorting,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize } }
  });

  useEffect(() => {
    if (onSelectionChange) onSelectionChange(table.getSelectedRowModel().rows.map((row) => row.original));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rowSelection]);

  const rows = table.getRowModel().rows;
  const total = table.getFilteredRowModel().rows.length;
  const { pageIndex, pageSize: size } = table.getState().pagination;
  const first = total === 0 ? 0 : pageIndex * size + 1;
  const last = Math.min(total, (pageIndex + 1) * size);

  return (
    <div className={cn('overflow-hidden rounded-lg border border-border bg-card', className)}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-max border-collapse text-sm">
          {caption && <caption className="sr-only">{caption}</caption>}
          <thead className="bg-secondary text-xs font-semibold text-muted-foreground">
            {table.getHeaderGroups().map((group) => (
              <tr key={group.id}>
                {group.headers.map((header) => {
                  const canSort = header.column.getCanSort();
                  const sorted = header.column.getIsSorted();
                  return (
                    <th
                      key={header.id}
                      scope="col"
                      aria-sort={sorted === 'asc' ? 'ascending' : sorted === 'desc' ? 'descending' : undefined}
                      className={cn('h-8 border-b border-border px-3 font-semibold', alignClass(header.column.columnDef.meta), header.id === '_select' && 'w-9')}
                    >
                      {header.isPlaceholder ? null : canSort ? (
                        <button
                          type="button"
                          onClick={header.column.getToggleSortingHandler()}
                          className="inline-flex items-center gap-1 rounded hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {sorted === 'asc' && <ArrowUp className="size-3.5 text-foreground" aria-hidden="true" />}
                          {sorted === 'desc' && <ArrowDown className="size-3.5 text-foreground" aria-hidden="true" />}
                        </button>
                      ) : (
                        flexRender(header.column.columnDef.header, header.getContext())
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i}>
                    <td colSpan={allColumns.length} className="h-8 border-b border-border px-3">
                      <Skeleton className="h-4 w-full" />
                    </td>
                  </tr>
                ))
              : rows.map((row) => (
                  <tr
                    key={row.id}
                    data-state={row.getIsSelected() ? 'selected' : undefined}
                    onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                    className={cn('border-b border-border last:border-b-0 hover:bg-accent data-[state=selected]:bg-selected', onRowClick && 'cursor-pointer')}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td
                        key={cell.id}
                        className={cn('h-8 max-w-80 truncate px-3', alignClass(cell.column.columnDef.meta), cell.column.columnDef.meta?.className)}
                        onClick={cell.column.id === '_select' ? (event) => event.stopPropagation() : undefined}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))}
          </tbody>
        </table>
      </div>

      {!loading && total === 0 && (emptyState || <EmptyState icon={Inbox} title="Nothing to show" description="No rows match." />)}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-card px-3 py-2 text-xs text-muted-foreground">
        <span className="tabular-nums">{total === 0 ? 'No rows' : `Showing ${first}-${last} of ${total}`}</span>
        <div className="flex items-center gap-3">
          <span>Rows per page</span>
          <Select value={String(size)} onValueChange={(value) => table.setPageSize(Number(value))}>
            <SelectTrigger aria-label="Rows per page" className="h-7 w-16">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {pageSizes.map((option) => (
                <SelectItem key={option} value={String(option)}>{option}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="tabular-nums">Page {total === 0 ? 0 : pageIndex + 1} of {table.getPageCount()}</span>
          <Button variant="secondary" size="icon-sm" aria-label="Previous page" disabled={!table.getCanPreviousPage()} onClick={() => table.previousPage()}>
            <ChevronLeft />
          </Button>
          <Button variant="secondary" size="icon-sm" aria-label="Next page" disabled={!table.getCanNextPage()} onClick={() => table.nextPage()}>
            <ChevronRight />
          </Button>
        </div>
      </div>
    </div>
  );
}
