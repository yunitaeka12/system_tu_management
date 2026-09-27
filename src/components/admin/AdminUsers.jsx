import { useMemo, useState } from 'react';
import {
  KeyRound,
  LockOpen,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  UserCheck,
  UserX,
} from 'lucide-react';
import Modal from '../Modal';
import Select from '../Select';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import {
  DEFAULT_PASSWORD,
  ROLE_KEYS,
  ROLE_LABELS,
  createUser,
  deleteUser,
  listUsersWithStatus,
  resetUserPassword,
  setUserActive,
  updateUser,
} from '../../services/authService';
import { confirmDialog, toast } from '../../lib/toast';
import { isSupabaseAuthEnabled } from '../../lib/supabase';
import { formatDate } from '../../utils/helpers';
import { cn } from '../../utils/helpers';

const ROLE_TONES = {
  administrator: 'bg-primary-500/15 text-primary-200 ring-1 ring-primary-400/30',
  tu: 'bg-school-500/15 text-school-200 ring-1 ring-school-400/30',
  kepala_sekolah: 'bg-amber-500/15 text-amber-200 ring-1 ring-amber-400/30',
  bendahara: 'bg-violet-500/15 text-violet-200 ring-1 ring-violet-400/30',
};

const emptyForm = { name: '', email: '', role: 'tu', password: DEFAULT_PASSWORD };

function StatusPill({ user }) {
  if (!user.isActive) {
    return <span className="dark-chip bg-slate-500/15 text-slate-300">Nonaktif</span>;
  }
  if (user.loginAttempt?.locked) {
    return <span className="dark-chip bg-red-500/15 text-red-200">Terkunci</span>;
  }
  return <span className="dark-chip bg-school-500/15 text-school-200">Aktif</span>;
}

export default function AdminUsers() {
  const { version } = useData();
  const { session } = useAuth();
  const users = useMemo(() => listUsersWithStatus(), [version]);

  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [formModal, setFormModal] = useState(null); // { mode: 'add' | 'edit', user? }
  const [form, setForm] = useState(emptyForm);
  const [passwordModal, setPasswordModal] = useState(null); // user
  const [newPassword, setNewPassword] = useState(DEFAULT_PASSWORD);
  const [saving, setSaving] = useState(false);

  const filtered = users.filter((user) => {
    if (roleFilter && user.role !== roleFilter) return false;
    const keyword = search.trim().toLowerCase();
    if (!keyword) return true;
    return (
      user.name.toLowerCase().includes(keyword) || user.email.toLowerCase().includes(keyword)
    );
  });

  const openAdd = () => {
    setForm(emptyForm);
    setFormModal({ mode: 'add' });
  };

  const openEdit = (user) => {
    setForm({ name: user.name, email: user.email, role: user.role, password: '' });
    setFormModal({ mode: 'edit', user });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    const result =
      formModal.mode === 'edit'
        ? updateUser(formModal.user.id, form)
        : await createUser(form);
    setSaving(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    if (result.warning) {
      toast.warning(result.warning);
    } else {
      toast.success(
        formModal.mode === 'edit' ? 'Data pengguna diperbarui.' : `Pengguna ${form.name} ditambahkan.`,
      );
    }
    setFormModal(null);
  };

  const handleDelete = async (user) => {
    const confirmed = await confirmDialog({
      title: `Hapus pengguna ${user.name}?`,
      text: `${user.email} tidak akan bisa login lagi. Tindakan ini tidak dapat dibatalkan.`,
      confirmText: 'Ya, hapus',
    });
    if (!confirmed) return;
    const result = deleteUser(user.id, session?.user_id);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success('Pengguna berhasil dihapus.');
  };

  const handleToggleActive = async (user) => {
    const activating = !user.isActive;
    const confirmed = await confirmDialog({
      title: activating ? `Aktifkan ${user.name}?` : `Nonaktifkan ${user.name}?`,
      text: activating
        ? 'Pengguna ini akan bisa login kembali.'
        : 'Pengguna ini tidak akan bisa login sampai diaktifkan lagi.',
      confirmText: activating ? 'Ya, aktifkan' : 'Ya, nonaktifkan',
    });
    if (!confirmed) return;
    const result = setUserActive(user.id, activating);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(activating ? 'Pengguna diaktifkan.' : 'Pengguna dinonaktifkan.');
  };

  const handleUnlock = (user) => {
    // Membuka akses = reset password ke bawaan + hapus penghitung salah password.
    setNewPassword(DEFAULT_PASSWORD);
    setPasswordModal(user);
  };

  const handleResetPassword = async (event) => {
    event.preventDefault();
    setSaving(true);
    const result = await resetUserPassword(passwordModal.id, newPassword);
    setSaving(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    if (result.warning) toast.warning(result.warning);
    else toast.success(`Password ${passwordModal.name} direset. Akses login terbuka kembali.`);
    setPasswordModal(null);
  };

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative lg:max-w-sm lg:flex-1">
          <Search
            size={16}
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500"
          />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nama atau email pengguna…"
            className="dark-input pl-10"
          />
        </div>

        <Select
          dark
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="dark-input lg:max-w-[200px]"
        >
          <option value="">Semua Role</option>
          {ROLE_KEYS.map((role) => (
            <option key={role} value={role}>
              {ROLE_LABELS[role]}
            </option>
          ))}
        </Select>

        <div className="lg:ml-auto">
          <button type="button" onClick={openAdd} className="dark-btn-primary w-full lg:w-auto">
            <Plus size={16} />
            Tambah Pengguna
          </button>
        </div>
      </div>

      {/* Tabel pengguna */}
      <div className="dark-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px]">
            <thead className="border-b border-white/10 bg-white/[0.03]">
              <tr>
                <th className="dark-table-head">Pengguna</th>
                <th className="dark-table-head">Role</th>
                <th className="dark-table-head">Status</th>
                <th className="dark-table-head">Login Terakhir</th>
                <th className="dark-table-head text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((user) => (
                <tr
                  key={user.id}
                  className="border-b border-white/5 transition-colors last:border-0 hover:bg-white/[0.03]"
                >
                  <td className="dark-table-cell">
                    <p className="font-semibold text-white">{user.name}</p>
                    <p className="text-xs text-slate-400">{user.email}</p>
                  </td>
                  <td className="dark-table-cell">
                    <span className={cn('dark-chip', ROLE_TONES[user.role])}>
                      <ShieldCheck size={12} />
                      {ROLE_LABELS[user.role] ?? user.role}
                    </span>
                  </td>
                  <td className="dark-table-cell">
                    <StatusPill user={user} />
                    {user.loginAttempt?.locked && (
                      <p className="mt-1 text-[11px] text-red-300">
                        {user.loginAttempt.attempts}x salah password
                      </p>
                    )}
                  </td>
                  <td className="dark-table-cell text-slate-400">
                    {user.last_login_at ? formatDate(user.last_login_at, { withTime: true }) : '-'}
                  </td>
                  <td className="dark-table-cell">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => openEdit(user)}
                        className="rounded-lg p-2 text-slate-400 transition hover:bg-white/10 hover:text-white"
                        title="Ubah data pengguna"
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleUnlock(user)}
                        className="rounded-lg p-2 text-slate-400 transition hover:bg-amber-500/15 hover:text-amber-200"
                        title={
                          user.loginAttempt?.locked
                            ? 'Buka kunci & reset password'
                            : 'Reset password'
                        }
                      >
                        {user.loginAttempt?.locked ? <LockOpen size={15} /> : <KeyRound size={15} />}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleToggleActive(user)}
                        className="rounded-lg p-2 text-slate-400 transition hover:bg-white/10 hover:text-white"
                        title={user.isActive ? 'Nonaktifkan pengguna' : 'Aktifkan pengguna'}
                      >
                        {user.isActive ? <UserX size={15} /> : <UserCheck size={15} />}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(user)}
                        className="rounded-lg p-2 text-slate-400 transition hover:bg-red-500/15 hover:text-red-200"
                        title="Hapus pengguna"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <p className="px-5 py-10 text-center text-sm text-slate-400">
              Tidak ada pengguna yang cocok dengan pencarian.
            </p>
          )}
        </div>
      </div>

      {/* Modal tambah / ubah pengguna */}
      <Modal
        open={Boolean(formModal)}
        onClose={() => setFormModal(null)}
        dark
        title={formModal?.mode === 'edit' ? 'Ubah Pengguna' : 'Tambah Pengguna'}
        description="Akun baru wajib mengganti password saat pertama kali login."
        size="sm"
      >
        {formModal && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="admin-name" className="dark-label">
                Nama Lengkap <span className="text-red-400">*</span>
              </label>
              <input
                id="admin-name"
                type="text"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className="dark-input"
                placeholder="Nama pengguna"
                required
              />
            </div>
            <div>
              <label htmlFor="admin-email" className="dark-label">
                Email <span className="text-red-400">*</span>
              </label>
              <input
                id="admin-email"
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                className="dark-input"
                placeholder="nama@assalam.sch.id"
                required
              />
            </div>
            <div>
              <label htmlFor="admin-role" className="dark-label">
                Role / Hak Akses
              </label>
              <Select
                dark
                id="admin-role"
                value={form.role}
                onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
                className="dark-input"
              >
                {ROLE_KEYS.map((role) => (
                  <option key={role} value={role}>
                    {ROLE_LABELS[role]}
                  </option>
                ))}
              </Select>
            </div>
            {formModal.mode === 'add' && (
              <div>
                <label htmlFor="admin-password" className="dark-label">
                  Password Awal
                </label>
                <input
                  id="admin-password"
                  type="text"
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  className="dark-input font-mono"
                />
                <p className="mt-1.5 text-xs text-slate-500">
                  {isSupabaseAuthEnabled ? (
                    <>
                      Login memakai Supabase Auth — kolom ini tidak dipakai. Buat akun login di
                      Supabase → Authentication → Users dengan email di atas.
                    </>
                  ) : (
                    <>
                      Default{' '}
                      <span className="font-semibold text-slate-400">{DEFAULT_PASSWORD}</span> —
                      pengguna akan diminta menggantinya saat login.
                    </>
                  )}
                </p>
              </div>
            )}

            <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
              <button type="button" onClick={() => setFormModal(null)} className="dark-btn-ghost">
                Batalkan
              </button>
              <button type="submit" disabled={saving} className="dark-btn-primary">
                {formModal.mode === 'edit' ? 'Simpan Perubahan' : 'Tambah Pengguna'}
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* Modal reset password */}
      <Modal
        open={Boolean(passwordModal)}
        onClose={() => setPasswordModal(null)}
        dark
        title={isSupabaseAuthEnabled ? 'Buka Akses Login' : 'Reset Password'}
        description={passwordModal ? `Akses login untuk ${passwordModal.email}` : ''}
        size="sm"
      >
        {passwordModal && (
          <form onSubmit={handleResetPassword} className="space-y-4">
            {isSupabaseAuthEnabled ? (
              <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3.5 py-3 text-xs leading-relaxed text-amber-200">
                Penghitung salah password di browser ini akan dihapus. Password login sendiri diatur
                di Supabase → Authentication → Users (ubah atau kirim ulang undangan dari sana).
              </p>
            ) : (
              <div>
                <label htmlFor="reset-password" className="dark-label">
                  Password Baru
                </label>
                <input
                  id="reset-password"
                  type="text"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="dark-input font-mono"
                />
                <p className="mt-1.5 text-xs text-slate-500">
                  Penghitung salah password juga dihapus sehingga akun dapat login kembali.
                </p>
              </div>
            )}
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button type="button" onClick={() => setPasswordModal(null)} className="dark-btn-ghost">
                Batalkan
              </button>
              <button type="submit" disabled={saving} className="dark-btn-primary">
                <KeyRound size={15} />
                {isSupabaseAuthEnabled ? 'Buka Akses' : 'Reset Password'}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
