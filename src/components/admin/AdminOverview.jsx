import { useMemo } from 'react';
import { Activity, Award, BookOpen, CreditCard, ShieldCheck, Users, Wallet } from 'lucide-react';
import { useData } from '../../context/DataContext';
import { useDashboardMetrics } from '../../hooks/usePayments';
import { useEkskulStats } from '../../hooks/useEkskul';
import { useStudentStats } from '../../hooks/useStudents';
import { getUserStats, ROLE_KEYS, ROLE_LABELS } from '../../services/authService';
import { formatCurrency, formatNumber } from '../../utils/currency';
import { cn } from '../../utils/helpers';

function StatTile({ icon: Icon, label, value, hint, tone = 'primary' }) {
  const tones = {
    primary: 'text-primary-300',
    green: 'text-school-300',
    amber: 'text-amber-300',
    violet: 'text-violet-300',
  };
  return (
    <div className="dark-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            {label}
          </p>
          <p className="mt-1.5 truncate text-xl font-bold tracking-tight text-white">{value}</p>
          {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
        </div>
        <span
          className={cn(
            'grid h-9 w-9 shrink-0 place-items-center rounded-md bg-white/5 ring-1 ring-white/10',
            tones[tone],
          )}
        >
          <Icon size={17} />
        </span>
      </div>
    </div>
  );
}

export default function AdminOverview() {
  const { version } = useData();
  const metrics = useDashboardMetrics();
  const studentStats = useStudentStats();
  const ekskulStats = useEkskulStats();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const userStats = useMemo(() => getUserStats(), [version]);

  const byKelas = Object.entries(studentStats.byKelas || {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          icon={Users}
          label="Pengguna Sistem"
          value={formatNumber(userStats.total)}
          hint={`${formatNumber(userStats.aktif)} aktif • ${formatNumber(userStats.nonaktif)} nonaktif`}
          tone="primary"
        />
        <StatTile
          icon={BookOpen}
          label="Data Siswa"
          value={formatNumber(studentStats.total)}
          hint={`${formatNumber(studentStats.totalKelas)} kelas aktif`}
          tone="violet"
        />
        <StatTile
          icon={CreditCard}
          label="Total Pembayaran SPP"
          value={formatCurrency(metrics.totalPaid)}
          hint={`${formatNumber(metrics.totalTransactions)} transaksi`}
          tone="green"
        />
        <StatTile
          icon={Wallet}
          label="Piutang SPP"
          value={formatCurrency(metrics.totalPiutang)}
          hint={`Collection rate ${metrics.collectionRate.toFixed(1).replace('.', ',')}%`}
          tone="amber"
        />
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        {/* Pengguna per role */}
        <div className="dark-card p-5">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-white">
            <ShieldCheck size={16} className="text-primary-300" />
            Pengguna per Role
          </h3>
          <div className="mt-4 space-y-2">
            {ROLE_KEYS.map((role) => {
              const count = userStats.perRole[role] || 0;
              const percent = userStats.total ? (count / userStats.total) * 100 : 0;
              return (
                <div key={role}>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-300">{ROLE_LABELS[role]}</span>
                    <span className="font-semibold text-white">{formatNumber(count)}</span>
                  </div>
                  <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-primary-600"
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Ekskul */}
        <div className="dark-card p-5">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-white">
            <Award size={16} className="text-primary-300" />
            Ekskul
          </h3>
          <div className="mt-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-wide text-slate-400">Peserta</span>
              <span className="text-sm font-bold text-white">
                {formatNumber(ekskulStats.participants)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-wide text-slate-400">Pendaftaran</span>
              <span className="text-sm font-bold text-white">
                {formatNumber(ekskulStats.enrollments)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-wide text-slate-400">
                Pembayaran ekskul
              </span>
              <span className="text-sm font-bold text-school-200">
                {formatCurrency(ekskulStats.totalPaid)}
              </span>
            </div>

            {ekskulStats.popular.length > 0 && (
              <div className="border-t border-white/10 pt-3">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  Terpopuler
                </p>
                <ul className="mt-1.5 space-y-1 text-xs text-slate-300">
                  {ekskulStats.popular.map((item) => (
                    <li key={item.nama} className="flex items-center justify-between">
                      <span className="truncate">{item.nama}</span>
                      <span className="font-semibold text-white">{formatNumber(item.jumlah)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>

        {/* Kelas terbesar */}
        <div className="dark-card p-5">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-white">
            <Activity size={16} className="text-primary-300" />
            Kelas Terbesar
          </h3>
          <div className="mt-4 space-y-2">
            {byKelas.map(([kelas, jumlah]) => (
              <div key={kelas} className="flex items-center justify-between text-xs">
                <span className="dark-chip">Kelas {kelas}</span>
                <span className="font-semibold text-white">{formatNumber(jumlah)} siswa</span>
              </div>
            ))}
            {byKelas.length === 0 && (
              <p className="text-xs text-slate-400">Belum ada data siswa.</p>
            )}
          </div>
        </div>
      </div>

      <div className="dark-card p-5">
        <h3 className="text-sm font-semibold text-white">Status Buku Induk</h3>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: 'Laki-laki', value: studentStats.lakiLaki },
            { label: 'Perempuan', value: studentStats.perempuan },
            { label: 'Lunas', value: metrics.lunas },
            { label: 'Belum Bayar', value: metrics.belum },
          ].map((item) => (
            <div key={item.label} className="rounded-xl border border-white/5 bg-white/[0.02] p-3.5">
              <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                {item.label}
              </p>
              <p className="mt-1 text-lg font-bold text-white">{formatNumber(item.value)}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
