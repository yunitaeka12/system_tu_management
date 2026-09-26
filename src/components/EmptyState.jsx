import { Inbox } from 'lucide-react';
import { cn } from '../utils/helpers';

export default function EmptyState({
  icon: Icon = Inbox,
  title = 'Belum Ada Data',
  description,
  action,
  className,
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center px-6 py-14 text-center', className)}>
      <div className="grid h-14 w-14 place-items-center rounded-2xl bg-slate-100 text-slate-400">
        <Icon size={26} strokeWidth={1.9} />
      </div>
      <h3 className="mt-4 text-base font-semibold text-slate-800">{title}</h3>
      {description && <p className="mt-1.5 max-w-sm text-sm text-slate-500">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
