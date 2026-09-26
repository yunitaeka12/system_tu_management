import { cn } from '../utils/helpers';

export function Skeleton({ className }) {
  return <div className={cn('skeleton', className)} />;
}

/** Skeleton baris tabel. */
export function TableSkeleton({ rows = 6, columns = 6 }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <tr key={rowIndex} className="border-b border-slate-100 last:border-0">
          {Array.from({ length: columns }).map((__, colIndex) => (
            <td key={colIndex} className="px-4 py-4">
              <Skeleton
                className={cn(
                  'h-4',
                  colIndex === 0 ? 'w-8' : colIndex === 1 ? 'w-20' : colIndex === 2 ? 'w-36' : 'w-16',
                )}
              />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

/** Skeleton kartu statistik. */
export function CardSkeleton({ count = 4 }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card p-5">
          <div className="flex items-start justify-between">
            <div className="space-y-3">
              <Skeleton className="h-3.5 w-24" />
              <Skeleton className="h-7 w-32" />
            </div>
            <Skeleton className="h-11 w-11 rounded-xl" />
          </div>
        </div>
      ))}
    </>
  );
}

export default Skeleton;
