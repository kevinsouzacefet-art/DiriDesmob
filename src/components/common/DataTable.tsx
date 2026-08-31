import React from 'react'
import { EmptyState } from './FeedbackStates'

export interface Column<T> {
  header: string
  accessor?: keyof T | ((row: T) => React.ReactNode)
  className?: string
  align?: 'left' | 'center' | 'right'
}

interface DataTableProps<T> {
  columns: Column<T>[]
  data: T[]
  keyExtractor: (row: T) => string
  isLoading?: boolean
  emptyTitle?: string
  emptyDescription?: string
  emptyActionLabel?: string
  onEmptyAction?: () => void
  onRowClick?: (row: T) => void
}

export function DataTable<T>({
  columns,
  data,
  keyExtractor,
  isLoading,
  emptyTitle,
  emptyDescription,
  emptyActionLabel,
  onEmptyAction,
  onRowClick,
}: DataTableProps<T>) {
  if (isLoading) {
    return (
      <div className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden">
        <div className="p-8 text-center text-xs text-zinc-500 dark:text-zinc-400">
          Carregando registros...
        </div>
      </div>
    )
  }

  if (data.length === 0) {
    return (
      <EmptyState
        title={emptyTitle}
        description={emptyDescription}
        actionLabel={emptyActionLabel}
        onAction={onEmptyAction}
      />
    )
  }

  return (
    <div className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden shadow-xs">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-zinc-50 dark:bg-zinc-800/60 border-b border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400 font-semibold uppercase tracking-wider text-[10px]">
              {columns.map((col, idx) => (
                <th
                  key={idx}
                  className={`py-2.5 px-3.5 ${
                    col.align === 'right'
                      ? 'text-right'
                      : col.align === 'center'
                      ? 'text-center'
                      : 'text-left'
                  } ${col.className || ''}`}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/80 text-zinc-700 dark:text-zinc-200 font-normal">
            {data.map(row => (
              <tr
                key={keyExtractor(row)}
                onClick={() => onRowClick && onRowClick(row)}
                className={`transition-colors ${
                  onRowClick
                    ? 'cursor-pointer hover:bg-blue-50/40 dark:hover:bg-blue-950/20'
                    : 'hover:bg-zinc-50/70 dark:hover:bg-zinc-800/40'
                }`}
              >
                {columns.map((col, idx) => {
                  let cellContent: React.ReactNode = null
                  if (typeof col.accessor === 'function') {
                    cellContent = col.accessor(row)
                  } else if (col.accessor) {
                    cellContent = String(row[col.accessor] ?? '-')
                  }

                  return (
                    <td
                      key={idx}
                      className={`py-2.5 px-3.5 whitespace-nowrap ${
                        col.align === 'right'
                          ? 'text-right'
                          : col.align === 'center'
                          ? 'text-center'
                          : 'text-left'
                      } ${col.className || ''}`}
                    >
                      {cellContent}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="px-3.5 py-2 bg-zinc-50 dark:bg-zinc-800/40 border-t border-zinc-200 dark:border-zinc-800 text-[11px] text-zinc-500 dark:text-zinc-400 flex items-center justify-between">
        <span>Exibindo {data.length} {data.length === 1 ? 'registro' : 'registros'}</span>
      </div>
    </div>
  )
}
