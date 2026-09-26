import { Loader2, Search, X } from 'lucide-react';
import { cn } from '../utils/helpers';

export default function SearchInput({
  value,
  onChange,
  placeholder = 'Cari…',
  loading = false,
  className,
  autoFocus = false,
}) {
  return (
    <div className={cn('relative', className)}>
      <Search
        size={17}
        className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
      />
      <input
        type="search"
        value={value}
        autoFocus={autoFocus}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="input pl-10 pr-10"
      />
      {loading && (
        <Loader2
          size={16}
          className="absolute right-3.5 top-1/2 -translate-y-1/2 animate-spin text-primary-500"
        />
      )}
      {!loading && value && (
        <button
          type="button"
          onClick={() => onChange('')}
          className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-0.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          aria-label="Bersihkan pencarian"
        >
          <X size={15} />
        </button>
      )}
    </div>
  );
}
