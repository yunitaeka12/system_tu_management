import { Component } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

/**
 * Pengaman render: bila terjadi error saat merender halaman, UI tidak
 * "beku" / blank — pengguna tetap melihat pesan dan bisa memuat ulang
 * tanpa harus refresh manual tanpa penjelasan.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('[app] Terjadi error saat merender halaman:', error, info);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleReset = () => {
    this.setState({ error: null });
  };

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-5">
        <div className="card w-full max-w-md p-6 text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-red-50 text-red-600">
            <AlertTriangle size={26} />
          </div>
          <h1 className="mt-4 text-lg font-bold text-slate-900">Halaman gagal ditampilkan</h1>
          <p className="mt-1.5 text-sm text-slate-500">
            Terjadi kesalahan tak terduga. Muat ulang halaman untuk melanjutkan — data yang
            tersimpan tidak terpengaruh.
          </p>
          <pre className="mt-4 max-h-32 overflow-auto rounded-xl border border-slate-200 bg-slate-50 p-3 text-left text-[11px] leading-relaxed text-slate-500">
            {String(this.state.error?.message || this.state.error)}
          </pre>
          <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-center">
            <button type="button" onClick={this.handleReset} className="btn-secondary">
              Coba lagi
            </button>
            <button type="button" onClick={this.handleReload} className="btn-primary">
              <RefreshCw size={16} />
              Muat ulang
            </button>
          </div>
        </div>
      </div>
    );
  }
}
