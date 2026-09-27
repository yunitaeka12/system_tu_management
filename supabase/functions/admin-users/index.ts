/**
 * Edge Function: admin-users
 *
 * Membuat / menghapus / mengubah password akun login Supabase Auth atas nama
 * Administrator TU. Hanya dijalankan di sisi server karena memakai
 * SUPABASE_SERVICE_ROLE_KEY (rahasia — tidak boleh ada di bundle browser).
 *
 * Deploy:
 *   supabase functions deploy admin-users
 *
 * Env var SUPABASE_URL & SUPABASE_SERVICE_ROLE_KEY otomatis disediakan Supabase
 * untuk setiap Edge Function, jadi tidak perlu diatur manual.
 *
 * Aksi (body JSON):
 *   { action: 'create',          email, password }
 *   { action: 'delete',          email, auth_user_id? }
 *   { action: 'update_password', email, password, auth_user_id? }
 *   { action: 'status' }                    → cek kesiapan layanan (Admin Panel)
 */
import { createClient } from 'npm:@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });

const normalizeEmail = (value) => String(value ?? '').trim().toLowerCase();

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ ok: false, error: 'Metode tidak didukung.' }, 405);

  const url = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceKey) {
    return json({ ok: false, error: 'Konfigurasi server belum lengkap.' }, 500);
  }

  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // 1) Pastikan pemanggil login dan benar-benar Administrator.
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
  if (!token) return json({ ok: false, error: 'Sesi tidak ditemukan. Silakan login ulang.' }, 401);

  const { data: authData, error: authError } = await admin.auth.getUser(token);
  if (authError || !authData?.user) {
    return json({ ok: false, error: 'Sesi tidak valid atau sudah kadaluarsa.' }, 401);
  }

  const callerEmail = normalizeEmail(authData.user.email);
  const { data: rows, error: rowsError } = await admin
    .from('users')
    .select('id, email, role, is_active, auth_user_id');
  if (rowsError) {
    return json({ ok: false, error: `Gagal membaca daftar pengguna: ${rowsError.message}` }, 500);
  }

  const caller = (rows ?? []).find(
    (row) =>
      row.auth_user_id === authData.user.id ||
      normalizeEmail(row.email) === callerEmail,
  );
  if (!caller || caller.role !== 'administrator' || caller.is_active === false) {
    return json({ ok: false, error: 'Hanya Administrator yang boleh melakukan aksi ini.' }, 403);
  }

  let payload = {};
  try {
    payload = await req.json();
  } catch {
    /* body kosong */
  }

  const action = String(payload?.action ?? '');
  const email = normalizeEmail(payload?.email);
  const password = String(payload?.password ?? '');

  /** Cari akun Auth lewat email (Admin API tidak punya pencarian langsung). */
  const findAuthUserByEmail = async (target) => {
    const wanted = normalizeEmail(target);
    for (let page = 1; page <= 20; page += 1) {
      // eslint-disable-next-line no-await-in-loop
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
      if (error) throw error;
      const list = data?.users ?? [];
      const found = list.find((user) => normalizeEmail(user.email) === wanted);
      if (found) return found;
      if (list.length < 200) return null;
    }
    return null;
  };

  const resolveAuthUserId = async (authUserId) => {
    const direct = String(authUserId ?? '').trim();
    if (direct && direct !== 'null') return direct;
    const found = await findAuthUserByEmail(email);
    return found?.id ?? '';
  };

  if (action === 'status') {
    // Dipakai Admin Panel untuk menandai apakah akun login otomatis sudah aktif.
    return json({ ok: true, ready: true });
  }

  if (action === 'create') {
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return json({ ok: false, error: 'Format email tidak valid.' }, 400);
    }
    if (password.length < 6) {
      return json({ ok: false, error: 'Password minimal 6 karakter.' }, 400);
    }

    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (error) {
      const exists = /already|registered|exists/i.test(error.message);
      if (!exists) {
        return json({ ok: false, error: `Gagal membuat akun login: ${error.message}` }, 400);
      }
      // Akun sudah ada (mis. sisa pembuatan manual) → selaraskan passwordnya
      // lalu tautkan ke baris pengguna, bukan gagal total.
      const existing = await findAuthUserByEmail(email);
      if (!existing) {
        return json(
          { ok: false, error: `Akun login Supabase dengan email ${email} sudah ada.` },
          400,
        );
      }
      const { error: updateError } = await admin.auth.admin.updateUserById(existing.id, {
        password,
        email_confirm: true,
      });
      if (updateError) {
        return json(
          {
            ok: false,
            error: `Akun login sudah ada, tetapi gagal menyetel password: ${updateError.message}`,
          },
          400,
        );
      }
      return json({ ok: true, auth_user_id: existing.id, existing: true });
    }
    return json({ ok: true, auth_user_id: data?.user?.id ?? null });
  }

  if (action === 'delete') {
    const authUserId = await resolveAuthUserId(payload?.auth_user_id);
    if (!authUserId) {
      return json({ ok: true, skipped: true, reason: 'Akun Supabase tidak ditemukan.' });
    }
    const { error } = await admin.auth.admin.deleteUser(authUserId);
    if (error) return json({ ok: false, error: `Gagal menghapus akun login: ${error.message}` }, 400);
    return json({ ok: true });
  }

  if (action === 'update_password') {
    if (password.length < 6) {
      return json({ ok: false, error: 'Password minimal 6 karakter.' }, 400);
    }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return json({ ok: false, error: 'Format email tidak valid.' }, 400);
    }
    const authUserId = await resolveAuthUserId(payload?.auth_user_id);
    if (!authUserId) {
      // Baris pengguna ini belum punya akun login (mis. dibuat sebelum fungsi
      // ini di-deploy, atau akunnya terhapus manual). Buat sekarang agar
      // pengguna bisa langsung masuk dengan password baru — tombol “Reset
      // Password” di Admin Panel sekaligus merapikan akun yang tertinggal.
      const { data: created, error: createError } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      if (createError) {
        return json(
          { ok: false, error: `Gagal membuat akun login untuk ${email}: ${createError.message}` },
          400,
        );
      }
      return json({ ok: true, auth_user_id: created?.user?.id ?? null, created: true });
    }
    const { error } = await admin.auth.admin.updateUserById(authUserId, {
      password,
      email_confirm: true,
    });
    if (error) return json({ ok: false, error: `Gagal mengubah password: ${error.message}` }, 400);
    return json({ ok: true });
  }

  return json({ ok: false, error: `Aksi tidak dikenal: ${action || '(kosong)'}` }, 400);
});
