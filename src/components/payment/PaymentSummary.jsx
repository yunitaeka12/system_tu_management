import { motion } from 'framer-motion';
import { CircleDollarSign, Receipt, TrendingDown, Wallet } from 'lucide-react';
import PaymentStatusBadge from '../PaymentStatusBadge';
import { formatCurrency, formatPercent } from '../../utils/currency';
import { cn } from '../../utils/helpers';

const CARDS = [
  { key: 'annualFee', label: 'Total Tagihan', icon: Receipt, tone: 'primary' },
  { key: 'totalPaid', label: 'Sudah Dibayar', icon: CircleDollarSign, tone: 'green' },
  { key: 'remaining', label: 'Sisa Tagihan', icon: TrendingDown, tone: 'red' },
];

const TONES = {
  primary: 'bg-primary-50 text-primary-600',
  green: 'bg-school-50 text-school-600',
  red: 'bg-red-50 text-red-600',
};

export default function PaymentSummary({ summary, monthlyFee, className }) {
  return (
    <div className={cn('grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4', className)}>
      {CARDS.map((card, index) => {
        const Icon = card.icon;
        return (
          <motion.div
            key={card.key}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.24, delay: index * 0.05 }}
            className="card p-5"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                  {card.label}
                </p>
                <p className="mt-2 truncate text-xl font-bold tracking-tight text-slate-900">
                  {formatCurrency(summary[card.key])}
                </p>
                {card.key === 'annualFee' && monthlyFee ? (
                  <p className="mt-1 text-xs text-slate-500">
                    Bulanan {formatCurrency(monthlyFee)}
                  </p>
                ) : null}
                {card.key === 'totalPaid' && summary.totalPaid > 0 ? (
                  <p className="mt-1 text-xs text-slate-500">
                    {formatPercent(summary.progress, 0)} dari tagihan
                  </p>
                ) : null}
                {card.key === 'remaining' && summary.remaining === 0 ? (
                  <p className="mt-1 text-xs text-school-600">Tidak ada sisa tagihan</p>
                ) : null}
              </div>
              <div className={cn('grid h-10 w-10 shrink-0 place-items-center rounded-xl', TONES[card.tone])}>
                <Icon size={19} />
              </div>
            </div>
          </motion.div>
        );
      })}

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.24, delay: 0.15 }}
        className="card p-5"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Status</p>
            <div className="mt-2">
              <PaymentStatusBadge status={summary.status} />
            </div>
            <p className="mt-2 text-xs text-slate-500">
              {summary.paidMonths.length} dari 12 bulan terbayar
            </p>
          </div>
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-600">
            <Wallet size={19} />
          </div>
        </div>
      </motion.div>
    </div>
  );
}
