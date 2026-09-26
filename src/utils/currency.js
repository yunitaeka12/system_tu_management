/**
 * Helper format angka & mata uang Indonesia.
 */

/** Format nominal menjadi "Rp 3.120.000". */
export function formatCurrency(value, { withSymbol = true } = {}) {
  const num = Number(value) || 0;
  const formatted = new Intl.NumberFormat('id-ID', {
    maximumFractionDigits: 0,
  }).format(Math.round(num));
  return withSymbol ? `Rp ${formatted}` : formatted;
}

/** Format angka ribuan menjadi "1.252". */
export function formatNumber(value) {
  const num = Number(value) || 0;
  return new Intl.NumberFormat('id-ID').format(num);
}

/** Format persentase menjadi "82,4%". */
export function formatPercent(value, digits = 1) {
  const num = Number(value) || 0;
  return `${num.toFixed(digits).replace('.', ',')}%`;
}

/** Ambil angka murni dari input bertipe "Rp 260.000" atau "260000". */
export function parseCurrencyInput(value) {
  if (value === null || value === undefined || value === '') return 0;
  const digits = String(value).replace(/[^0-9]/g, '');
  return digits ? Number(digits) : 0;
}

/** Format value untuk input yang menampilkan "260.000". */
export function formatCurrencyInput(value) {
  const num = parseCurrencyInput(value);
  if (!num) return '';
  return new Intl.NumberFormat('id-ID').format(num);
}

/** Ringkas nominal: 1.500.000 → "1,5 jt" (untuk chart / label sempit). */
export function compactCurrency(value) {
  const num = Number(value) || 0;
  if (num >= 1_000_000_000) return `${(num / 1_000_000_000).toFixed(1).replace('.', ',')} M`;
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1).replace('.', ',')} jt`;
  if (num >= 1_000) return `${Math.round(num / 1_000)} rb`;
  return String(num);
}
