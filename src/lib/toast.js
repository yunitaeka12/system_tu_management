/**
 * Notifikasi toast & dialog konfirmasi (SweetAlert2) dengan gaya yang selaras
 * dengan design system aplikasi. Tidak memakai alert() bawaan browser.
 *
 * Toast dibuat ringkas (tanpa ikon besar) supaya terasa profesional dan tidak
 * menutupi area kerja TU.
 */
import Swal from 'sweetalert2';

const Toast = Swal.mixin({
  toast: true,
  position: 'top-end',
  showConfirmButton: false,
  showCloseButton: false,
  timer: 2800,
  timerProgressBar: true,
  width: 'auto',
  padding: 0,
  didOpen: (element) => {
    element.addEventListener('mouseenter', Swal.stopTimer);
    element.addEventListener('mouseleave', Swal.resumeTimer);
  },
});

const COLORS = {
  success: '#16a34a',
  error: '#dc2626',
  warning: '#d97706',
  info: '#2563eb',
};

function fire(type, message, title) {
  return Toast.fire({
    // Tanpa ikon besar — aksen warna cukup lewat border kiri (lihat index.css).
    title: title || message,
    text: title ? message : undefined,
    customClass: {
      popup: `app-toast app-toast--${type}`,
    },
  });
}

export const TOAST_COLORS = COLORS;

export const toast = {
  success: (message, title) => fire('success', message, title),
  error: (message, title) => fire('error', message, title),
  warning: (message, title) => fire('warning', message, title),
  info: (message, title) => fire('info', message, title),
};

/** Dialog konfirmasi. Mengembalikan Promise<boolean>. */
export async function confirmDialog({
  title = 'Yakin ingin melanjutkan?',
  text = 'Tindakan ini tidak dapat dibatalkan.',
  confirmText = 'Ya, lanjutkan',
  cancelText = 'Batalkan',
  icon = 'warning',
} = {}) {
  const result = await Swal.fire({
    title,
    text,
    icon,
    showCancelButton: true,
    confirmButtonText: confirmText,
    cancelButtonText: cancelText,
    confirmButtonColor: COLORS[icon] || '#2563eb',
    cancelButtonColor: '#64748b',
    reverseButtons: true,
    focusCancel: true,
  });
  return result.isConfirmed;
}

/** Dialog konfirmasi dengan 3 pilihan (untuk konflik import). */
export async function choiceDialog({
  title,
  html,
  choices = [],
  cancelText = 'Batalkan',
} = {}) {
  const result = await Swal.fire({
    title,
    html,
    showCancelButton: true,
    showDenyButton: choices.length > 1,
    confirmButtonText: choices[0]?.text || 'Lanjutkan',
    denyButtonText: choices[1]?.text || '',
    cancelButtonText: cancelText,
    confirmButtonColor: '#2563eb',
    denyButtonColor: '#d97706',
    cancelButtonColor: '#64748b',
    reverseButtons: true,
  });
  if (result.isConfirmed) return choices[0]?.value ?? true;
  if (result.isDenied) return choices[1]?.value ?? false;
  return null;
}

export default toast;
