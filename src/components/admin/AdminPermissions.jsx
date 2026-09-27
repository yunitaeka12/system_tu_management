import { useMemo, useState } from 'react';
import { Info, RotateCcw, ShieldCheck, UserCog } from 'lucide-react';
import Select from '../Select';
import { useData } from '../../context/DataContext';
import {
  ALL_PERMISSIONS,
  DEFAULT_PERMISSIONS,
  ROLE_KEYS,
  ROLE_LABELS,
  getRolePermissions,
  listUsers,
  resetRolePermissions,
  setRolePermission,
  setUserPermissionOverride,
} from '../../services/authService';
import { confirmDialog, toast } from '../../lib/toast';
import { cn } from '../../utils/helpers';

const GROUPS = [...new Set(ALL_PERMISSIONS.map((item) => item.group))];

const OVERRIDE_STATES = [
  { value: 'inherit', label: 'Ikut Role' },
  { value: 'allow', label: 'Izinkan' },
  { value: 'deny', label: 'Tolak' },
];

export default function AdminPermissions() {
  const { version } = useData();
  const users = useMemo(() => listUsers(), [version]);

  const [role, setRole] = useState('tu');
  const [selectedUserId, setSelectedUserId] = useState('');

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const rolePermissions = useMemo(() => getRolePermissions(role), [role, version]);
  const selectedUser = users.find((user) => user.id === selectedUserId) || null;

  const toggle = (permission, enabled) => {
    const result = setRolePermission(role, permission, enabled);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(
      `${enabled ? 'Akses diberikan' : 'Akses dicabut'}: ${role} → ${permission}`,
      'Hak akses diperbarui',
    );
  };

  const handleReset = async () => {
    const confirmed = await confirmDialog({
      title: 'Kembalikan hak akses ke bawaan?',
      text: 'Seluruh perubahan matriks hak akses per role akan dihapus.',
      confirmText: 'Ya, kembalikan',
    });
    if (!confirmed) return;
    resetRolePermissions();
    toast.success('Hak akses dikembalikan ke pengaturan bawaan.');
  };

  const handleOverride = (permission, state) => {
    const value = state === 'inherit' ? null : state === 'allow';
    setUserPermissionOverride(selectedUserId, permission, value);
    toast.success('Hak akses khusus pengguna diperbarui.');
  };

  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
      {/* Matriks per role */}
      <div className="dark-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="flex items-center gap-2 text-sm font-semibold text-white">
              <ShieldCheck size={16} className="text-primary-300" />
              Hak Akses per Role
            </h3>
            <p className="mt-0.5 text-xs text-slate-400">
              Atur apa saja yang boleh dilakukan setiap role.
            </p>
          </div>
          <button type="button" onClick={handleReset} className="dark-btn-ghost dark-btn-sm">
            <RotateCcw size={14} />
            Bawaan
          </button>
        </div>

        <div className="mt-4 flex flex-wrap gap-1.5">
          {ROLE_KEYS.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setRole(key)}
              className={cn(
                'rounded-lg px-3 py-1.5 text-xs font-semibold transition',
                role === key
                  ? 'bg-primary-600 text-white'
                  : 'bg-white/[0.05] text-slate-300 hover:bg-white/10',
              )}
            >
              {ROLE_LABELS[key]}
            </button>
          ))}
        </div>

        {role === 'administrator' ? (
          <p className="mt-4 flex items-start gap-2 rounded-xl border border-primary-400/30 bg-primary-500/10 px-3.5 py-3 text-xs text-primary-100">
            <Info size={14} className="mt-0.5 shrink-0" />
            Administrator selalu memiliki akses penuh agar sistem tidak bisa terkunci sendiri.
          </p>
        ) : (
          <div className="mt-4 space-y-4">
            {GROUPS.map((group) => (
              <div key={group}>
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  {group}
                </p>
                <div className="space-y-1.5">
                  {ALL_PERMISSIONS.filter((item) => item.group === group).map((item) => {
                    const checked = rolePermissions.includes(item.key);
                    return (
                      <label
                        key={item.key}
                        className="flex cursor-pointer items-center gap-3 rounded-xl border border-white/5 bg-white/[0.02] px-3.5 py-2.5 transition hover:bg-white/[0.05]"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => toggle(item.key, e.target.checked)}
                          className="h-4 w-4 rounded border-white/20 bg-slate-800 accent-primary-500"
                        />
                        <span className="text-sm text-slate-200">{item.label}</span>
                        <span className="ml-auto font-mono text-[10px] text-slate-500">
                          {item.key}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}

            {DEFAULT_PERMISSIONS[role] && (
              <p className="text-[11px] text-slate-500">
                Bawaan role ini: {DEFAULT_PERMISSIONS[role].join(', ')}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Override per pengguna */}
      <div className="dark-card p-5">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-white">
          <UserCog size={16} className="text-primary-300" />
          Hak Akses Khusus Pengguna
        </h3>
        <p className="mt-0.5 text-xs text-slate-400">
          Pengecualian untuk satu pengguna tertentu, menimpa aturan role-nya.
        </p>

        <div className="mt-4">
          <label htmlFor="override-user" className="dark-label">
            Pilih Pengguna
          </label>
          <Select
            dark
            id="override-user"
            value={selectedUserId}
            onChange={(e) => setSelectedUserId(e.target.value)}
            className="dark-input"
          >
            <option value="">Pilih pengguna…</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.name} — {ROLE_LABELS[user.role] ?? user.role}
              </option>
            ))}
          </Select>
        </div>

        {!selectedUser ? (
          <p className="mt-4 rounded-xl border border-white/10 bg-white/[0.02] px-3.5 py-6 text-center text-xs text-slate-400">
            Pilih pengguna untuk mengatur pengecualian hak akses.
          </p>
        ) : (
          <div className="mt-4 space-y-1.5">
            {ALL_PERMISSIONS.map((item) => {
              const overrides = selectedUser.permission_overrides || {};
              const state =
                typeof overrides[item.key] === 'boolean'
                  ? overrides[item.key]
                    ? 'allow'
                    : 'deny'
                  : 'inherit';
              return (
                <div
                  key={item.key}
                  className="flex flex-wrap items-center gap-3 rounded-xl border border-white/5 bg-white/[0.02] px-3.5 py-2.5"
                >
                  <span className="min-w-0 flex-1 text-sm text-slate-200">{item.label}</span>
                  <div className="flex gap-1">
                    {OVERRIDE_STATES.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => handleOverride(item.key, option.value)}
                        className={cn(
                          'rounded-lg px-2.5 py-1 text-[11px] font-semibold transition',
                          state === option.value
                            ? option.value === 'deny'
                              ? 'bg-red-500/80 text-white'
                              : option.value === 'allow'
                                ? 'bg-school-500/80 text-white'
                                : 'bg-white/15 text-white'
                            : 'bg-white/[0.04] text-slate-400 hover:bg-white/10',
                        )}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
