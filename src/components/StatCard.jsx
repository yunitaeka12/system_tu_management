import { motion } from 'framer-motion';
import { cn } from '../utils/helpers';

const TONES = {
  primary: { icon: 'bg-primary-50 text-primary-600', ring: 'ring-primary-100' },
  green: { icon: 'bg-school-50 text-school-600', ring: 'ring-school-100' },
  amber: { icon: 'bg-amber-50 text-amber-600', ring: 'ring-amber-100' },
  red: { icon: 'bg-red-50 text-red-600', ring: 'ring-red-100' },
  slate: { icon: 'bg-slate-100 text-slate-600', ring: 'ring-slate-100' },
};

export default function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  tone = 'primary',
  delay = 0,
  onClick,
}) {
  const t = TONES[tone] ?? TONES.primary;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay, ease: 'easeOut' }}
      onClick={onClick}
      className={cn(
        'card group relative p-4 transition-colors',
        onClick && 'cursor-pointer hover:border-slate-300',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
          <p className="mt-1.5 truncate text-xl font-bold tracking-tight text-slate-900">{value}</p>
          {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
        </div>
        {Icon && (
          <div className={cn('grid h-9 w-9 shrink-0 place-items-center rounded-md ring-1', t.icon, t.ring)}>
            <Icon size={17} strokeWidth={2.2} />
          </div>
        )}
      </div>
    </motion.div>
  );
}
