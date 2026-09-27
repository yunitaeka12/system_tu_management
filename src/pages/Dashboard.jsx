import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  ArrowRight,
  BookOpen,
  CircleDollarSign,
  CreditCard,
  FileSpreadsheet,
  TrendingUp,
  UserMinus,
  Users,
  Wallet,
} from 'lucide-react';
import PageHeader from '../components/PageHeader';
import StatCard from '../components/StatCard';
import PaymentStatusBadge from '../components/PaymentStatusBadge';
import EmptyState from '../components/EmptyState';
import { CardSkeleton, Skeleton } from '../components/Skeleton';
import {
  useClassInsight,
  useDashboardMetrics,
  usePaymentChart,
  useRecentPayments,
  useTopOutstanding,
} from '../hooks/usePayments';
import { formatCurrency, formatNumber, formatPercent, compactCurrency } from '../utils/currency';
import { formatDate, initials, timeAgo } from '../utils/helpers';
import { PAYMENT_STATUS, PAYMENT_STATUS_LABEL } from '../utils/paymentCalculator';

const STATUS_COLORS = {
  [PAYMENT_STATUS.LUNAS]: '#16a34a',
  [PAYMENT_STATUS.SEBAGIAN]: '#d97706',
  [PAYMENT_STATUS.BELUM]: '#94a3b8',
};

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 shadow-dropdown">
      <p className="text-xs font-semibold text-slate-700">{label}</p>
      {payload.map((entry) => (
        <p key={entry.dataKey} className="mt-1 text-xs text-slate-500">
          <span className="font-semibold text-slate-800">{formatCurrency(entry.value)}</span>
          {entry.payload.count !== undefined && (
            <span className="ml-1.5 text-slate-400">({entry.payload.count} transaksi)</span>
          )}
        </p>
      ))}
    </div>
  );
}

function MonthlyChart({ data }) {
  const hasData = data.some((item) => item.total > 0);

  return (
    <div className="card card-pad">
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-800">Statistik Pembayaran</h2>
          <p className="mt-0.5 text-xs text-slate-500">Total penerimaan per bulan (Januari–Desember)</p>
        </div>
        <span className="stat-chip">
          <TrendingUp size={13} />
          {formatCurrency(data.reduce((sum, item) => sum + item.total, 0))}
        </span>
      </div>

      {!hasData ? (
        <EmptyState
          icon={CircleDollarSign}
          title="Belum Ada Pembayaran"
          description="Grafik akan muncul setelah transaksi pembayaran pertama dicatat."
          className="py-10"
        />
      ) : (
        <div className="h-[280px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis
                dataKey="short"
                tick={{ fontSize: 11, fill: '#64748b' }}
                axisLine={{ stroke: '#e2e8f0' }}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: '#64748b' }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(value) => compactCurrency(value)}
              />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(37, 99, 235, 0.05)' }} />
              <Bar dataKey="total" fill="#2563eb" radius={[6, 6, 0, 0]} maxBarSize={38} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

function StatusChart({ metrics }) {
  const data = [
    { name: PAYMENT_STATUS_LABEL[PAYMENT_STATUS.LUNAS], value: metrics.lunas, key: PAYMENT_STATUS.LUNAS },
    { name: PAYMENT_STATUS_LABEL[PAYMENT_STATUS.SEBAGIAN], value: metrics.sebagian, key: PAYMENT_STATUS.SEBAGIAN },
    { name: PAYMENT_STATUS_LABEL[PAYMENT_STATUS.BELUM], value: metrics.belum, key: PAYMENT_STATUS.BELUM },
  ].filter((item) => item.value > 0);

  return (
    <div className="card card-pad">
      <h2 className="text-sm font-semibold text-slate-800">Payment Status</h2>
      <p className="mt-0.5 text-xs text-slate-500">Distribusi status pembayaran siswa</p>

      {data.length === 0 ? (
        <EmptyState icon={Users} title="Belum Ada Data Siswa" className="py-10" />
      ) : (
        <>
          <div className="mt-2 h-[190px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={52}
                  outerRadius={76}
                  paddingAngle={3}
                  strokeWidth={0}
                >
                  {data.map((entry) => (
                    <Cell key={entry.key} fill={STATUS_COLORS[entry.key]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value, name) => [`${value} siswa`, name]}
                  contentStyle={{
                    borderRadius: 12,
                    border: '1px solid #e2e8f0',
                    fontSize: 12,
                    boxShadow: '0 8px 24px -6px rgb(15 23 42 / 0.14)',
                  }}
                />
                <Legend
                  verticalAlign="bottom"
                  height={28}
                  iconType="circle"
                  iconSize={8}
                  formatter={(value) => <span className="text-xs text-slate-600">{value}</span>}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-3 grid grid-cols-3 gap-2 border-t border-slate-100 pt-3">
            {[
              { key: PAYMENT_STATUS.LUNAS, value: metrics.lunas },
              { key: PAYMENT_STATUS.SEBAGIAN, value: metrics.sebagian },
              { key: PAYMENT_STATUS.BELUM, value: metrics.belum },
            ].map((item) => (
              <div key={item.key} className="text-center">
                <p className="text-lg font-bold text-slate-800">{formatNumber(item.value)}</p>
                <p className="mt-0.5 text-[11px] text-slate-500">
                  {PAYMENT_STATUS_LABEL[item.key]}
                </p>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function CollectionRate({ metrics }) {
  return (
    <div className="card card-pad">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-800">Payment Collection Rate</h2>
          <p className="mt-0.5 text-xs text-slate-500">(total pembayaran ÷ total tagihan) × 100%</p>
        </div>
        <span className="stat-chip">
          {metrics.activeYear?.nama_tahun_ajaran ?? 'Tahun ini'}
        </span>
      </div>

      <div className="mt-4 flex items-end gap-3">
        <p className="text-3xl font-bold tracking-tight text-slate-900">
          {formatPercent(metrics.collectionRate)}
        </p>
        <span className="mb-1.5 text-xs text-slate-500">
          {formatCurrency(metrics.totalPaid)} dari {formatCurrency(metrics.totalBilling)}
        </span>
      </div>

      <div className="mt-4 h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(metrics.collectionRate, 100)}%` }}
          transition={{ duration: 0.7, ease: 'easeOut' }}
          className="h-full rounded-full bg-primary-600"
        />
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 border-t border-slate-100 pt-4 sm:grid-cols-4">
        {[
          { label: 'Tagihan', value: metrics.totalBilling },
          { label: 'Dibayar', value: metrics.totalPaid },
          { label: 'Piutang', value: metrics.totalPiutang },
          { label: 'Transaksi', value: metrics.totalTransactions, raw: true },
        ].map((item) => (
          <div key={item.label}>
            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
              {item.label}
            </p>
            <p className="mt-1 truncate text-sm font-semibold text-slate-800">
              {item.raw ? formatNumber(item.value) : formatCurrency(item.value)}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function RecentPayments({ payments }) {
  return (
    <div className="card">
      <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
        <div>
          <h2 className="text-sm font-semibold text-slate-800">Recent Payments</h2>
          <p className="mt-0.5 text-xs text-slate-500">Aktivitas pembayaran terbaru</p>
        </div>
        <Link to="/pembayaran" className="text-xs font-semibold text-primary-600 hover:text-primary-700">
          Lihat semua
        </Link>
      </div>

      {payments.length === 0 ? (
        <EmptyState
          icon={CreditCard}
          title="Belum Ada Data Pembayaran"
          description="Belum ada transaksi pembayaran yang tercatat."
          className="py-10"
          action={
            <Link to="/pembayaran" className="btn-primary btn-sm">
              Catat Pembayaran
            </Link>
          }
        />
      ) : (
        <ul className="divide-y divide-slate-100">
          {payments.map((payment, index) => (
            <motion.li
              key={payment.id}
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.2, delay: index * 0.04 }}
              className="flex items-center gap-3 px-5 py-3.5 transition hover:bg-slate-50/70"
            >
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary-50 text-xs font-bold text-primary-700">
                {initials(payment.student_name)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-800">
                  {payment.student_name}
                </p>
                <p className="text-xs text-slate-500">
                  {payment.bulan} • Kelas {payment.kelas}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold text-slate-800">
                  {formatCurrency(payment.nominal_bayar)}
                </p>
                <p className="text-[11px] text-slate-400">{timeAgo(payment.created_at)}</p>
              </div>
            </motion.li>
          ))}
        </ul>
      )}
    </div>
  );
}

function TopOutstanding({ students }) {
  return (
    <div className="card">
      <div className="border-b border-slate-200 px-5 py-4">
        <h2 className="text-sm font-semibold text-slate-800">Piutang Terbesar</h2>
        <p className="mt-0.5 text-xs text-slate-500">Siswa yang perlu ditindaklanjuti</p>
      </div>

      {students.length === 0 ? (
        <EmptyState
          icon={Wallet}
          title="Tidak Ada Piutang"
          description="Semua siswa dengan tagihan sudah lunas."
          className="py-10"
        />
      ) : (
        <ul className="divide-y divide-slate-100">
          {students.map((student) => (
            <li key={student.id}>
              <Link
                to={`/pembayaran/${student.id}`}
                className="flex items-center gap-3 px-5 py-3.5 transition hover:bg-slate-50/70"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-800">
                    {student.nama_lengkap}
                  </p>
                  <p className="text-xs text-slate-500">
                    {student.no_induk} • Kelas {student.kelas}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-red-600">
                    {formatCurrency(student.remaining)}
                  </p>
                  <p className="text-[11px] text-slate-400">
                    dibayar {formatCurrency(student.totalPaid)}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ClassInsight({ rows }) {
  return (
    <div className="card">
      <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
        <div>
          <h2 className="text-sm font-semibold text-slate-800">Insight Pembayaran per Kelas</h2>
          <p className="mt-0.5 text-xs text-slate-500">Kelas dengan piutang terbesar</p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px]">
          <thead className="border-b border-slate-200 bg-slate-50/70">
            <tr>
              <th className="table-head">Kelas</th>
              <th className="table-head text-center">Siswa</th>
              <th className="table-head text-right">Tagihan</th>
              <th className="table-head text-right">Dibayar</th>
              <th className="table-head text-right">Piutang</th>
              <th className="table-head">Serapan</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.kelas} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/70">
                <td className="table-cell font-semibold text-slate-800">{row.kelas}</td>
                <td className="table-cell text-center">{formatNumber(row.students)}</td>
                <td className="table-cell text-right">{formatCurrency(row.totalBilling)}</td>
                <td className="table-cell text-right text-school-700">
                  {formatCurrency(row.totalPaid)}
                </td>
                <td className="table-cell text-right font-medium text-red-600">
                  {formatCurrency(row.remaining)}
                </td>
                <td className="table-cell">
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-20 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-primary-500"
                        style={{ width: `${Math.min(row.rate, 100)}%` }}
                      />
                    </div>
                    <span className="text-xs text-slate-500">{formatPercent(row.rate, 0)}</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {rows.length === 0 && <EmptyState icon={Users} title="Belum Ada Data" />}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const metrics = useDashboardMetrics();
  const chart = usePaymentChart();
  const recent = useRecentPayments(6);
  const outstanding = useTopOutstanding(5);
  const classInsight = useClassInsight(6);

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle="Ringkasan Buku Induk dan pembayaran siswa SDIT As-Salam."
      />

      {/* Summary cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {metrics.totalStudents === 0 && metrics.mutasi === 0 ? (
          <CardSkeleton count={3} />
        ) : (
          <>
            <StatCard
              icon={Users}
              tone="primary"
              label="Total Siswa"
              value={formatNumber(metrics.totalStudents)}
              hint={`${formatNumber(metrics.lunas)} lunas • ${formatNumber(metrics.belum)} belum bayar`}
              delay={0}
            />
            <StatCard
              icon={CircleDollarSign}
              tone="green"
              label="Total Pembayaran"
              value={formatCurrency(metrics.totalPaid)}
              hint={`${formatNumber(metrics.totalTransactions)} transaksi tercatat`}
              delay={0.05}
            />
            <StatCard
              icon={UserMinus}
              tone="amber"
              label="Siswa Mutasi"
              value={formatNumber(metrics.mutasi)}
              hint="Tidak dihitung dalam tagihan sekolah"
              delay={0.1}
            />
          </>
        )}
      </div>

      {/* Charts */}
      <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <MonthlyChart data={chart} />
        </div>
        <StatusChart metrics={metrics} />
      </div>

      {/* Collection rate */}
      <div className="mt-5">
        <CollectionRate metrics={metrics} />
      </div>

      {/* Activity */}
      <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-2">
        <RecentPayments payments={recent} />
        <TopOutstanding students={outstanding} />
      </div>

      <div className="mt-5">
        <ClassInsight rows={classInsight} />
      </div>

      {metrics.totalStudents === 0 && (
        <div className="mt-5 card card-pad">
          <div className="space-y-3">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-4 w-64" />
          </div>
        </div>
      )}

      {/* Quick links */}
      <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[
          { to: '/buku-induk', icon: BookOpen, title: 'Buku Induk', text: 'Cari & kelola data siswa' },
          { to: '/pembayaran', icon: CreditCard, title: 'Pembayaran', text: 'Catat pembayaran bulanan' },
          { to: '/buku-induk/import', icon: FileSpreadsheet, title: 'Import Excel', text: 'Unggah data Buku Induk' },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              className="card group flex items-center gap-4 p-4 transition-colors hover:border-slate-300"
            >
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-primary-50 text-primary-600">
                <Icon size={18} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-800">{item.title}</p>
                <p className="truncate text-xs text-slate-500">{item.text}</p>
              </div>
              <ArrowRight
                size={17}
                className="text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-primary-500"
              />
            </Link>
          );
        })}
      </div>
    </div>
  );
}
