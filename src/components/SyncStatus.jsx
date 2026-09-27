import { useEffect, useState } from 'react';
import { CloudOff, CloudUpload, Cloud, RefreshCw } from 'lucide-react';
import { getSyncState, subscribeSync } from '../lib/supabase';
import { pushAll } from '../lib/db';
import { toast } from '../lib/toast';
import { cn } from '../utils/helpers';

const CONFIG = {
  local: {
    icon: CloudOff,
    label: 'Mode lokal',
    className: 'text-slate-500 bg-slate-100',
    title: 'Supabase belum dikonfigurasi — data disimpan di browser ini.',
  },
  idle: {
    icon: Cloud,
    label: 'Siap',
    className: 'text-slate-500 bg-slate-100',
    title: 'Siap menyimpan ke Supabase.',
  },
  syncing: {
    icon: CloudUpload,
    label: 'Menyimpan…',
    className: 'text-amber-700 bg-amber-50',
    title: 'Sedang mengirim perubahan ke Supabase.',
  },
  synced: {
    icon: Cloud,
    label: 'Tersimpan',
    className: 'text-school-700 bg-school-50',
    title: 'Seluruh perubahan sudah tersimpan di Supabase.',
  },
  error: {
    icon: CloudOff,
    label: 'Gagal simpan',
    className: 'text-red-700 bg-red-50',
    title: 'Gagal menyimpan ke Supabase. Klik untuk mencoba lagi.',
  },
};

export default function SyncStatus({ className }) {
  const [state, setState] = useState(() => getSyncState());

  useEffect(() => subscribeSync(setState), []);

  const config = CONFIG[state.status] ?? CONFIG.idle;
  const Icon = config.icon;

  /** Saat gagal: coba kirim ulang, dan tampilkan pesan error bila masih gagal. */
  const handleClick = async () => {
    if (state.status !== 'error') return;
    const result = await pushAll({ manual: true });
    const next = getSyncState();
    if (!result.ok || next.status === 'error') {
      toast.error(next.lastError || 'Gagal menyimpan ke Supabase.', 'Sinkronisasi gagal');
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      title={state.lastError ? `${config.title}\n${state.lastError}` : config.title}
      className={cn(
        'hidden items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition sm:inline-flex',
        config.className,
        state.status !== 'error' && 'cursor-default',
        className,
      )}
    >
      <Icon size={14} className={cn(state.status === 'syncing' && 'animate-pulse')} />
      {config.label}
      {state.status === 'error' && <RefreshCw size={12} />}
    </button>
  );
}
