import { ArrowDown, ArrowUp, ArrowUpDown, Inbox } from 'lucide-react';
import { motion } from 'framer-motion';
import { TableSkeleton } from './Skeleton';
import EmptyState from './EmptyState';
import { cn } from '../utils/helpers';

function SortIcon({ active, direction }) {
  if (!active) return <ArrowUpDown size={13} className="text-slate-300 group-hover:text-slate-400" />;
  return direction === 'asc' ? (
    <ArrowUp size={13} className="text-primary-600" />
  ) : (
    <ArrowDown size={13} className="text-primary-600" />
  );
}

/**
 * Tabel data generik.
 *
 * - Desktop/tablet : tabel dengan scroll horizontal.
 * - Mobile         : kartu (bila `mobileRender` diberikan).
 */
export default function DataTable({
  columns,
  rows,
  loading = false,
  order,
  onSort,
  rowKey = (row) => row.id,
  emptyState,
  mobileRender,
  onRowClick,
  skeletonRows = 6,
}) {
  const hasRows = rows && rows.length > 0;

  return (
    <div>
      {/* Mobile card layout */}
      {mobileRender && (
        <div className="divide-y divide-slate-100 md:hidden">
          {loading && (
            <div className="space-y-3 p-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="card p-4">
                  <div className="skeleton h-4 w-32" />
                  <div className="mt-3 skeleton h-3 w-24" />
                </div>
              ))}
            </div>
          )}
          {!loading && !hasRows && (emptyState || <EmptyState icon={Inbox} title="Belum Ada Data" />)}
          {!loading &&
            hasRows &&
            rows.map((row, index) => (
              <motion.div
                key={rowKey(row)}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.18, delay: Math.min(index * 0.02, 0.2) }}
              >
                {mobileRender(row)}
              </motion.div>
            ))}
        </div>
      )}

      {/* Desktop table */}
      <div className={cn('overflow-x-auto', mobileRender && 'hidden md:block')}>
        <table className="w-full min-w-[720px] border-collapse">
          <thead className="border-b border-slate-200 bg-slate-50">
            <tr>
              {columns.map((column) => {
                const isSortable = Boolean(column.sortable && onSort);
                const isActive = order?.field === column.key;
                return (
                  <th
                    key={column.key}
                    scope="col"
                    className={cn(
                      'table-head',
                      column.align === 'right' && 'text-right',
                      column.align === 'center' && 'text-center',
                      column.className,
                    )}
                  >
                    {isSortable ? (
                      <button
                        type="button"
                        onClick={() =>
                          onSort(
                            column.key,
                            isActive && order.direction === 'asc' ? 'desc' : 'asc',
                          )
                        }
                        className={cn(
                          'group inline-flex items-center gap-1.5 transition hover:text-slate-700',
                          isActive && 'text-primary-600',
                        )}
                      >
                        {column.header}
                        <SortIcon active={isActive} direction={order?.direction} />
                      </button>
                    ) : (
                      column.header
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {loading && <TableSkeleton rows={skeletonRows} columns={columns.length} />}

            {!loading &&
              rows.map((row, index) => (
                <motion.tr
                  key={rowKey(row)}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.18, delay: Math.min(index * 0.015, 0.2) }}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={cn(
                    'border-b border-slate-100 transition-colors last:border-0',
                    onRowClick ? 'cursor-pointer hover:bg-slate-50' : 'hover:bg-slate-50/70',
                  )}
                >
                  {columns.map((column) => (
                    <td
                      key={column.key}
                      className={cn(
                        'table-cell',
                        column.align === 'right' && 'text-right',
                        column.align === 'center' && 'text-center',
                        column.cellClassName,
                      )}
                    >
                      {column.render ? column.render(row) : row[column.key]}
                    </td>
                  ))}
                </motion.tr>
              ))}
          </tbody>
        </table>

        {!loading && !hasRows && (
          <div>{emptyState || <EmptyState icon={Inbox} title="Belum Ada Data" />}</div>
        )}
      </div>
    </div>
  );
}
