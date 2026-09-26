import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, BookUser, Home, IdCard, Info, Loader2, Ruler, Save, UserSquare2, Users } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import FormField from '../components/FormField';
import EmptyState from '../components/EmptyState';
import { useStudent } from '../hooks/useStudents';
import { createStudent, updateStudent } from '../services/studentService';
import { getFilterOptions } from '../services/studentService';
import { toast } from '../lib/toast';
import { validateStudentForm } from '../utils/validation';
import { formatCurrency } from '../utils/currency';
import { getAnnualFee, getMonthlyFee } from '../utils/paymentCalculator';
import { cn } from '../utils/helpers';

const emptyForm = {
  no_urut: '',
  rombel: '',
  kelas: '',
  no_induk: '',
  nisn: '',
  nama_lengkap: '',
  nama_panggilan: '',
  no_kk: '',
  nik: '',
  no_regis_akta: '',
  jenis_kelamin: '',
  agama: 'Islam',
  kewarganegaraan: 'Indonesia',
  tempat_tanggal_lahir: '',
  anak_ke: '',
  jumlah_saudara: '',
  bahasa_sehari_hari: '',
  alamat: '',
  nomor_hp: '',
  tinggal_bersama: '',
  jarak_tempat_tinggal: '',
  waktu_tempuh: '',
  pendidikan_sebelumnya: '',
  tinggi_badan: '',
  berat_badan: '',
  lingkar_kepala: '',
  keterangan: '',
  father: { nama: '', tahun_lahir: '', nik: '', agama: '', pendidikan: '', penghasilan: '', pekerjaan: '' },
  mother: { nama: '', tahun_lahir: '', nik: '', agama: '', pendidikan: '', penghasilan: '', pekerjaan: '' },
  guardian: { nama: '', tahun_lahir: '', agama: '', pendidikan: '', pekerjaan: '', alamat: '', hubungan_keluarga: '' },
  address: {
    jalan: '',
    nama_dusun: '',
    rt_rw: '',
    kelurahan: '',
    kecamatan: '',
    kota_kabupaten: '',
    provinsi: '',
    nomor_hp: '',
  },
};

function toFormValue(value) {
  return value === null || value === undefined ? '' : String(value);
}

function studentToForm(student) {
  return {
    ...emptyForm,
    ...Object.fromEntries(
      Object.keys(emptyForm)
        .filter((key) => typeof emptyForm[key] !== 'object')
        .map((key) => [key, toFormValue(student[key])]),
    ),
    father: { ...emptyForm.father, ...student.father },
    mother: { ...emptyForm.mother, ...student.mother },
    guardian: { ...emptyForm.guardian, ...student.guardian },
    address: { ...emptyForm.address, ...student.address },
  };
}

function Section({ icon: Icon, title, description, children }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22 }}
      className="card overflow-hidden"
    >
      <div className="flex items-center gap-3 border-b border-slate-200 bg-slate-50/70 px-5 py-3.5">
        <div className="grid h-9 w-9 place-items-center rounded-lg bg-white text-primary-600 ring-1 ring-slate-200">
          <Icon size={17} />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-slate-800">{title}</h2>
          {description && <p className="text-xs text-slate-500">{description}</p>}
        </div>
      </div>
      <div className="grid grid-cols-1 gap-x-5 gap-y-4 p-5 sm:grid-cols-2 lg:grid-cols-3">
        {children}
      </div>
    </motion.section>
  );
}

/** Input teks dengan error binding singkat. */
function TextField({ form, setField, name, label, required, type = 'text', hint, placeholder, className }) {
  const error = form.__errors?.[name];
  return (
    <FormField label={label} htmlFor={name} required={required} error={error} hint={hint} className={className}>
      <input
        id={name}
        type={type}
        value={form[name] ?? ''}
        placeholder={placeholder}
        onChange={(e) => setField(name, e.target.value)}
        className={cn('input', error && 'input-error')}
      />
    </FormField>
  );
}

/** Input untuk field bersarang (father.nama, address.jalan, dst). */
function NestedField({ form, setNested, path, label, type = 'text', placeholder, className }) {
  const [group, key] = path.split('.');
  const error = form.__errors?.[path];
  return (
    <FormField label={label} htmlFor={path} error={error} className={className}>
      <input
        id={path}
        type={type}
        value={form[group]?.[key] ?? ''}
        placeholder={placeholder}
        onChange={(e) => setNested(group, key, e.target.value)}
        className={cn('input', error && 'input-error')}
      />
    </FormField>
  );
}

export default function StudentForm({ mode = 'create' }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const existing = useStudent(mode === 'edit' ? id : null);
  const options = useMemo(() => getFilterOptions(), []);

  const [form, setForm] = useState(() =>
    mode === 'edit' && existing ? studentToForm(existing) : emptyForm,
  );
  const [saving, setSaving] = useState(false);

  // Saat data siswa selesai dimuat pada mode edit.
  const [hydrated, setHydrated] = useState(mode === 'create');
  if (mode === 'edit' && existing && !hydrated) {
    setForm(studentToForm(existing));
    setHydrated(true);
  }

  const setField = (name, value) => setForm((f) => ({ ...f, [name]: value }));
  const setNested = (group, key, value) =>
    setForm((f) => ({ ...f, [group]: { ...f[group], [key]: value } }));

  const previewAnnualFee = getAnnualFee(form.no_induk);
  const previewMonthlyFee = getMonthlyFee(form.no_induk);

  const handleSubmit = (event) => {
    event.preventDefault();

    const errors = validateStudentForm(form);
    if (Object.keys(errors).length > 0) {
      setForm((f) => ({ ...f, __errors: errors }));
      toast.warning('Periksa kembali data yang ditandai merah.');
      const firstError = Object.keys(errors)[0];
      document.getElementById(firstError)?.focus();
      return;
    }

    setSaving(true);
    const payload = { ...form };
    Object.keys(payload).forEach((key) => {
      if (key.startsWith('__')) delete payload[key];
    });

    const result =
      mode === 'edit' ? updateStudent(id, payload) : createStudent(payload);

    setSaving(false);

    if (!result.ok) {
      toast.error(result.error || 'Gagal menyimpan data siswa.');
      return;
    }

    toast.success(
      mode === 'edit' ? 'Data siswa berhasil diperbarui.' : 'Data siswa berhasil disimpan.',
    );
    navigate(`/buku-induk/${result.student.id}`, { replace: true });
  };

  if (mode === 'edit' && !existing && hydrated) {
    return (
      <div className="card">
        <EmptyState
          icon={Users}
          title="Data Siswa Tidak Ditemukan"
          description="Siswa mungkin sudah dihapus atau tautan tidak valid."
          action={
            <Link to="/buku-induk" className="btn-primary btn-sm">
              <ArrowLeft size={15} />
              Kembali ke Buku Induk
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <PageHeader
        title={mode === 'edit' ? 'Edit Data Siswa' : 'Tambah Siswa Baru'}
        subtitle="Isi data sesuai Buku Induk. Field bertanda * wajib diisi."
        actions={
          <>
            <Link to="/buku-induk" className="btn-secondary btn-sm">
              <ArrowLeft size={15} />
              Batal
            </Link>
            <button type="submit" disabled={saving} className="btn-primary btn-sm">
              {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
              {saving ? 'Menyimpan…' : 'Simpan Data'}
            </button>
          </>
        }
      />

      {/* Info tagihan otomatis */}
      <div className="mb-5 flex flex-col gap-3 rounded-2xl border border-primary-100 bg-primary-50/60 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <Info size={17} className="mt-0.5 shrink-0 text-primary-600" />
          <div>
            <p className="text-sm font-semibold text-primary-900">Tagihan dihitung otomatis</p>
            <p className="text-xs text-primary-700/80">
              Nominal mengikuti tahun angkatan (2 digit awal No Induk): 21/22/23 → Rp 260.000/bulan,
              24/25/26 → Rp 270.000/bulan. Total tahunan = bulanan × 12.
            </p>
          </div>
        </div>
        <div className="flex gap-4 sm:shrink-0">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wide text-primary-600/80">
              Tagihan Tahunan
            </p>
            <p className="text-sm font-bold text-primary-900">{formatCurrency(previewAnnualFee)}</p>
          </div>
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wide text-primary-600/80">
              Bulanan
            </p>
            <p className="text-sm font-bold text-primary-900">{formatCurrency(previewMonthlyFee)}</p>
          </div>
        </div>
      </div>

      <div className="space-y-5">
        <Section icon={IdCard} title="Data Utama Siswa" description="Identitas pokok peserta didik">
          <TextField form={form} setField={setField} name="no_induk" label="No Induk" required placeholder="26271001" />
          <TextField form={form} setField={setField} name="nisn" label="NISN" hint="8-12 digit angka" placeholder="3199491203" />
          <TextField form={form} setField={setField} name="nama_lengkap" label="Nama Lengkap" required placeholder="NAMA LENGKAP SISWA" />
          <TextField form={form} setField={setField} name="nama_panggilan" label="Nama Panggilan" />
          <FormField label="Kelas" htmlFor="kelas" required error={form.__errors?.kelas}>
            <select
              id="kelas"
              value={form.kelas}
              onChange={(e) => setField('kelas', e.target.value)}
              className={cn('input', form.__errors?.kelas && 'input-error')}
            >
              <option value="">Pilih Kelas</option>
              {options.kelas.map((item) => (
                <option key={item} value={item}>
                  Kelas {item}
                </option>
              ))}
            </select>
          </FormField>
          <TextField form={form} setField={setField} name="rombel" label="Rombel" />
          <FormField label="Jenis Kelamin" htmlFor="jenis_kelamin">
            <select
              id="jenis_kelamin"
              value={form.jenis_kelamin}
              onChange={(e) => setField('jenis_kelamin', e.target.value)}
              className="input"
            >
              <option value="">Pilih</option>
              <option value="Laki-laki">Laki-laki</option>
              <option value="Perempuan">Perempuan</option>
            </select>
          </FormField>
          <TextField form={form} setField={setField} name="agama" label="Agama" />
          <TextField form={form} setField={setField} name="kewarganegaraan" label="Kewarganegaraan" />
          <TextField form={form} setField={setField} name="tempat_tanggal_lahir" label="Tempat / Tanggal Lahir" placeholder="BEKASI 14 FEBRUARI 2019" className="sm:col-span-2" />
          <TextField form={form} setField={setField} name="nik" label="NIK" hint="16 digit" />
          <TextField form={form} setField={setField} name="no_kk" label="No KK" hint="16 digit" />
          <TextField form={form} setField={setField} name="no_regis_akta" label="No Regis Akta" />
          <TextField form={form} setField={setField} name="anak_ke" label="Anak Ke" type="number" />
          <TextField form={form} setField={setField} name="jumlah_saudara" label="Jumlah Saudara" type="number" />
          <TextField form={form} setField={setField} name="bahasa_sehari_hari" label="Bahasa Sehari-hari" />
          <TextField form={form} setField={setField} name="nomor_hp" label="Nomor Telp/HP" />
          <TextField form={form} setField={setField} name="tinggal_bersama" label="Tinggal Bersama" />
          <TextField form={form} setField={setField} name="jarak_tempat_tinggal" label="Jarak ke Sekolah" />
          <TextField form={form} setField={setField} name="waktu_tempuh" label="Waktu Tempuh" />
          <TextField form={form} setField={setField} name="pendidikan_sebelumnya" label="Pendidikan Sebelumnya" className="sm:col-span-2" />
          <TextField form={form} setField={setField} name="alamat" label="Alamat" className="sm:col-span-2 lg:col-span-3" />
        </Section>

        <Section icon={UserSquare2} title="Data Ayah" description="Data ayah kandung sesuai KK/KTP">
          <NestedField form={form} setNested={setNested} path="father.nama" label="Nama" />
          <NestedField form={form} setNested={setNested} path="father.tahun_lahir" label="Tahun Lahir" />
          <NestedField form={form} setNested={setNested} path="father.nik" label="NIK" />
          <NestedField form={form} setNested={setNested} path="father.agama" label="Agama" />
          <NestedField form={form} setNested={setNested} path="father.pendidikan" label="Pendidikan" />
          <NestedField form={form} setNested={setNested} path="father.pekerjaan" label="Pekerjaan" />
          <NestedField form={form} setNested={setNested} path="father.penghasilan" label="Penghasilan" className="sm:col-span-2" />
        </Section>

        <Section icon={UserSquare2} title="Data Ibu" description="Data ibu kandung sesuai KK/KTP">
          <NestedField form={form} setNested={setNested} path="mother.nama" label="Nama" />
          <NestedField form={form} setNested={setNested} path="mother.tahun_lahir" label="Tahun Lahir" />
          <NestedField form={form} setNested={setNested} path="mother.nik" label="NIK" />
          <NestedField form={form} setNested={setNested} path="mother.agama" label="Agama" />
          <NestedField form={form} setNested={setNested} path="mother.pendidikan" label="Pendidikan" />
          <NestedField form={form} setNested={setNested} path="mother.pekerjaan" label="Pekerjaan" />
          <NestedField form={form} setNested={setNested} path="mother.penghasilan" label="Penghasilan" className="sm:col-span-2" />
        </Section>

        <Section
          icon={Home}
          title="Alamat Orang Tua Sesuai KK/KTP"
          description="Bila belum mengubah domisili, perlu surat keterangan pindah domisili"
        >
          <NestedField form={form} setNested={setNested} path="address.jalan" label="Jalan" className="sm:col-span-2" />
          <NestedField form={form} setNested={setNested} path="address.nama_dusun" label="Nama Dusun" />
          <NestedField form={form} setNested={setNested} path="address.rt_rw" label="RT/RW" />
          <NestedField form={form} setNested={setNested} path="address.kelurahan" label="Kelurahan/Desa" />
          <NestedField form={form} setNested={setNested} path="address.kecamatan" label="Kecamatan" />
          <NestedField form={form} setNested={setNested} path="address.kota_kabupaten" label="Kota/Kabupaten" />
          <NestedField form={form} setNested={setNested} path="address.provinsi" label="Provinsi" />
          <NestedField form={form} setNested={setNested} path="address.nomor_hp" label="Nomor Telp/HP" />
        </Section>

        <Section icon={BookUser} title="Data Wali Peserta Didik" description="Diisi bila siswa tinggal bersama wali">
          <NestedField form={form} setNested={setNested} path="guardian.nama" label="Nama" />
          <NestedField form={form} setNested={setNested} path="guardian.tahun_lahir" label="Tahun Lahir" />
          <NestedField form={form} setNested={setNested} path="guardian.agama" label="Agama" />
          <NestedField form={form} setNested={setNested} path="guardian.pendidikan" label="Pendidikan" />
          <NestedField form={form} setNested={setNested} path="guardian.pekerjaan" label="Pekerjaan" />
          <NestedField form={form} setNested={setNested} path="guardian.hubungan_keluarga" label="Hubungan dengan Keluarga" />
          <NestedField form={form} setNested={setNested} path="guardian.alamat" label="Alamat" className="sm:col-span-2" />
        </Section>

        <Section icon={Ruler} title="Data Fisik Peserta Didik" description="Opsional, dapat diperbarui berkala">
          <TextField form={form} setField={setField} name="tinggi_badan" label="Tinggi Badan (cm)" type="number" />
          <TextField form={form} setField={setField} name="berat_badan" label="Berat Badan (kg)" type="number" />
          <TextField form={form} setField={setField} name="lingkar_kepala" label="Lingkar Kepala (cm)" type="number" />
          <TextField form={form} setField={setField} name="keterangan" label="Keterangan" />
        </Section>
      </div>

      <div className="sticky bottom-0 mt-5 flex flex-col-reverse gap-2 border-t border-slate-200 bg-slate-50/90 py-4 backdrop-blur sm:flex-row sm:justify-end">
        <Link to="/buku-induk" className="btn-secondary">
          Batal
        </Link>
        <button type="submit" disabled={saving} className="btn-primary">
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          {saving ? 'Menyimpan…' : mode === 'edit' ? 'Perbarui Data' : 'Simpan Siswa'}
        </button>
      </div>
    </form>
  );
}
