import { useState } from 'react';
import { KeyRound, Loader2, ShieldCheck } from 'lucide-react';
import Modal from './Modal';
import FormField from './FormField';
import { useAuth } from '../context/AuthContext';
import { changePassword } from '../services/authService';
import { toast } from '../lib/toast';

/**
 * Popup yang muncul setelah login: mengingatkan pengguna untuk mengganti
 * password bawaan. Pengguna bebas memilih "Ganti Sekarang" atau "Nanti Saja".
 */
export default function ChangePasswordPrompt() {
  const { passwordPromptOpen, dismissPasswordPrompt, session, refreshSession } = useAuth();
  const [step, setStep] = useState('intro');
  const [form, setForm] = useState({ current: '', next: '', confirm: '' });
  const [saving, setSaving] = useState(false);

  const close = () => {
    setStep('intro');
    setForm({ current: '', next: '', confirm: '' });
    dismissPasswordPrompt();
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (form.next !== form.confirm) {
      toast.error('Konfirmasi password baru tidak cocok.');
      return;
    }
    if (form.next.length < 6) {
      toast.error('Password baru minimal 6 karakter.');
      return;
    }

    setSaving(true);
    const result = await changePassword(session?.user_id, form.current, form.next);
    setSaving(false);

    if (!result.ok) {
      toast.error(result.error || 'Gagal mengubah password.');
      return;
    }
    refreshSession();
    toast.success('Password berhasil diperbarui.');
    close();
  };

  return (
    <Modal
      open={passwordPromptOpen}
      onClose={close}
      title={step === 'intro' ? 'Ganti Password Baru' : 'Buat Password Baru'}
      description={
        step === 'intro'
          ? 'Password akun Anda masih password bawaan sistem.'
          : 'Gunakan password yang kuat dan mudah Anda ingat.'
      }
      size="sm"
    >
      {step === 'intro' ? (
        <div className="space-y-5">
          <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
            <ShieldCheck size={18} className="mt-0.5 shrink-0 text-amber-600" />
            <p className="text-sm text-amber-800">
              Demi keamanan data siswa, disarankan mengganti password bawaan
              <span className="font-semibold"> default123</span> dengan password pribadi Anda.
            </p>
          </div>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" onClick={close} className="btn-secondary">
              Nanti Saja
            </button>
            <button type="button" onClick={() => setStep('form')} className="btn-primary">
              <KeyRound size={16} />
              Ganti Sekarang
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <FormField label="Password Saat Ini" htmlFor="cp-current" required>
            <input
              id="cp-current"
              type="password"
              autoComplete="current-password"
              value={form.current}
              onChange={(e) => setForm((f) => ({ ...f, current: e.target.value }))}
              className="input"
            />
          </FormField>
          <FormField label="Password Baru" htmlFor="cp-next" required hint="Minimal 6 karakter">
            <input
              id="cp-next"
              type="password"
              autoComplete="new-password"
              value={form.next}
              onChange={(e) => setForm((f) => ({ ...f, next: e.target.value }))}
              className="input"
            />
          </FormField>
          <FormField label="Konfirmasi Password" htmlFor="cp-confirm" required>
            <input
              id="cp-confirm"
              type="password"
              autoComplete="new-password"
              value={form.confirm}
              onChange={(e) => setForm((f) => ({ ...f, confirm: e.target.value }))}
              className="input"
            />
          </FormField>

          <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
            <button type="button" onClick={close} className="btn-secondary">
              Nanti Saja
            </button>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? <Loader2 size={16} className="animate-spin" /> : <KeyRound size={16} />}
              {saving ? 'Menyimpan…' : 'Simpan Password'}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
