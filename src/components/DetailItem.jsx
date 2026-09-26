import { cn } from '../utils/helpers';

export default function DetailItem({ label, value, className, mono = false }) {
  const isEmpty = value === null || value === undefined || value === '' || value === '-';
  return (
    <div className={cn('min-w-0', className)}>
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</dt>
      <dd
        className={cn(
          'mt-1 break-words text-sm font-medium text-slate-800',
          mono && 'font-mono tracking-tight',
          isEmpty && 'text-slate-400',
        )}
      >
        {isEmpty ? '—' : value}
      </dd>
    </div>
  );
}

export function DetailGrid({ children, columns = 3, className }) {
  return (
    <dl
      className={cn(
        'grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2',
        columns === 3 && 'lg:grid-cols-3',
        columns === 2 && 'lg:grid-cols-2',
        columns === 4 && 'lg:grid-cols-4',
        className,
      )}
    >
      {children}
    </dl>
  );
}
