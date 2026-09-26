import { CheckCircle2, CircleDashed, CircleDollarSign } from 'lucide-react';
import { PAYMENT_STATUS, PAYMENT_STATUS_LABEL } from '../utils/paymentCalculator';
import { cn } from '../utils/helpers';

const CONFIG = {
  [PAYMENT_STATUS.LUNAS]: {
    className: 'bg-school-50 text-school-700 ring-1 ring-school-200',
    Icon: CheckCircle2,
    short: 'Lunas',
  },
  [PAYMENT_STATUS.SEBAGIAN]: {
    className: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
    Icon: CircleDollarSign,
    short: 'Sebagian',
  },
  [PAYMENT_STATUS.BELUM]: {
    className: 'bg-slate-100 text-slate-600 ring-1 ring-slate-200',
    Icon: CircleDashed,
    short: 'Belum Bayar',
  },
};

export default function PaymentStatusBadge({ status, compact = false, className }) {
  const config = CONFIG[status] ?? CONFIG[PAYMENT_STATUS.BELUM];
  const { Icon } = config;
  const label = compact ? config.short : PAYMENT_STATUS_LABEL[status] ?? 'Belum Bayar';

  return (
    <span className={cn('badge', config.className, className)}>
      <Icon size={13} strokeWidth={2.4} />
      {label}
    </span>
  );
}
