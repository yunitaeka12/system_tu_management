import { GraduationCap } from 'lucide-react';
import { cn } from '../utils/helpers';

export default function Logo({ className, size = 'md', iconOnly = false, onDark = false }) {
  const sizes = {
    sm: { box: 'h-8 w-8', icon: 16, title: 'text-xs', sub: 'text-[10px]' },
    md: { box: 'h-10 w-10', icon: 20, title: 'text-sm', sub: 'text-[11px]' },
    lg: { box: 'h-12 w-12', icon: 24, title: 'text-base', sub: 'text-xs' },
  };
  const s = sizes[size] ?? sizes.md;

  return (
    <div className={cn('flex items-center gap-3', className)}>
      <div
        className={cn(
          'grid shrink-0 place-items-center rounded-lg text-white',
          'bg-primary-600',
          s.box,
        )}
      >
        <GraduationCap size={s.icon} strokeWidth={2.2} />
      </div>
      {!iconOnly && (
        <div className="min-w-0 leading-tight">
          <p
            className={cn(
              'truncate font-bold tracking-tight',
              onDark ? 'text-white' : 'text-slate-900',
              s.title,
            )}
          >
            SDIT As-Salam
          </p>
          <p
            className={cn(
              'truncate font-medium',
              onDark ? 'text-school-300' : 'text-school-600',
              s.sub,
            )}
          >
            Islamic Green School
          </p>
        </div>
      )}
    </div>
  );
}
