import { ChevronLeft, ChevronRight } from 'lucide-react';
import Select from './Select';
import { cn } from '../utils/helpers';
import { formatNumber } from '../utils/currency';

const PAGE_SIZES = [10, 25, 50, 100];

function pageWindow(page, totalPages) {
  const pages = new Set([1, totalPages, page, page - 1, page + 1]);
  return [...pages].filter((p) => p >= 1 && p <= totalPages).sort((a, b) => a - b);
}

export default function Pagination({
  page,
  totalPages,
  total,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizes = PAGE_SIZES,
  className,
}) {
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);
  const pages = pageWindow(page, totalPages);

  return (
    <div
      className={cn(
        'flex flex-col gap-3 border-t border-slate-200 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between',
        className,
      )}
    >
      <div className="flex items-center gap-3 text-xs text-slate-500">
        <span>
          Menampilkan <strong className="font-semibold text-slate-700">{formatNumber(start)}</strong>–
          <strong className="font-semibold text-slate-700">{formatNumber(end)}</strong> dari{' '}
          <strong className="font-semibold text-slate-700">{formatNumber(total)}</strong> data
        </span>
        {onPageSizeChange && (
          <Select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs text-slate-600 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20"
            ariaLabel="Jumlah baris per halaman"
          >
            {pageSizes.map((size) => (
              <option key={size} value={size}>
                {size} / halaman
              </option>
            ))}
          </Select>
        )}
      </div>

      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="grid h-8 w-8 place-items-center rounded-lg border border-slate-300 bg-white text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="Halaman sebelumnya"
        >
          <ChevronLeft size={16} />
        </button>

        {pages.map((p, index) => {
          const previous = pages[index - 1];
          const showGap = previous && p - previous > 1;
          return (
            <span key={p} className="flex items-center gap-1">
              {showGap && <span className="px-1 text-xs text-slate-400">…</span>}
              <button
                type="button"
                onClick={() => onPageChange(p)}
                className={cn(
                  'grid h-8 min-w-8 place-items-center rounded-lg border px-2 text-xs font-semibold transition',
                  p === page
                    ? 'border-primary-600 bg-primary-600 text-white'
                    : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50',
                )}
              >
                {p}
              </button>
            </span>
          );
        })}

        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className="grid h-8 w-8 place-items-center rounded-lg border border-slate-300 bg-white text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="Halaman berikutnya"
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}
