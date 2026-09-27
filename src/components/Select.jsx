import { Children, isValidElement, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from '../utils/helpers';

/** Kumpulkan opsi dari elemen <option>/<optgroup> (API mirip <select> bawaan). */
function collectOptions(children, out = []) {
  Children.forEach(children, (child) => {
    if (!isValidElement(child)) return;
    if (child.type === 'option') {
      out.push({
        value: child.props.value ?? '',
        label: child.props.children,
        disabled: Boolean(child.props.disabled),
      });
    } else if (child.type === 'optgroup') {
      collectOptions(child.props.children, out);
    }
  });
  return out;
}

/** Daftar selalu turun ke bawah; tingginya dibatasi agar tetap muat layar. */
const MENU_MAX_HEIGHT = 256;
const MENU_MIN_HEIGHT = 140;

/**
 * Dropdown custom dengan animasi buka/tutup dan panah yang berputar.
 *
 * Sengaja dibuat kompatibel dengan `<select>` bawaan: menerima `value`,
 * `onChange` (dipanggil dengan `{ target: { value } }`), `children` berupa
 * `<option>`, `id`, `className`, dan `disabled` — sehingga penggantian di
 * seluruh halaman hanya perlu mengubah nama tag.
 */
export default function Select({
  value,
  onChange,
  children,
  id,
  className,
  placeholder = 'Pilih…',
  disabled = false,
  dark = false,
  ariaLabel,
}) {
  const [open, setOpen] = useState(false);
  const [menuMaxHeight, setMenuMaxHeight] = useState(MENU_MAX_HEIGHT);
  const ref = useRef(null);

  const options = useMemo(() => collectOptions(children), [children]);
  const selected = options.find((option) => String(option.value) === String(value ?? '')) || null;

  /** Tinggi maksimum daftar = sisa ruang di bawah tombol (dibatasi 256px). */
  const measureMenuHeight = () => {
    if (!ref.current) return MENU_MAX_HEIGHT;
    const rect = ref.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom - 16;
    return Math.min(MENU_MAX_HEIGHT, Math.max(MENU_MIN_HEIGHT, spaceBelow));
  };

  useEffect(() => {
    if (!open) return undefined;
    const onDocClick = (event) => {
      if (ref.current && !ref.current.contains(event.target)) setOpen(false);
    };
    const onKey = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };
    // Hitung ulang saat halaman di-scroll / jendela diubah ukurannya.
    const onReposition = () => setMenuMaxHeight(measureMenuHeight());
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', onReposition);
    window.addEventListener('scroll', onReposition, true);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onReposition);
      window.removeEventListener('scroll', onReposition, true);
    };
  }, [open]);

  const selectOption = (option) => {
    if (option.disabled) return;
    onChange?.({ target: { value: option.value } });
    setOpen(false);
  };

  // Daftar selalu terbuka ke bawah. Kalau ruang di bawah sempit (mis. baris
  // filter berada di bagian bawah layar), tingginya dipotong dan sisa opsi
  // dapat di-scroll — bukan dibalik ke atas.
  const toggleOpen = () => {
    const next = !open;
    if (next) setMenuMaxHeight(measureMenuHeight());
    setOpen(next);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        id={id}
        disabled={disabled}
        onClick={toggleOpen}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={cn('flex items-center justify-between gap-2 text-left', className)}
      >
        <span className={cn('truncate', !selected && 'opacity-60')}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown
          size={16}
          className={cn(
            'shrink-0 opacity-60 transition-transform duration-200 ease-out',
            open && 'rotate-180',
          )}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.ul
            role="listbox"
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
            style={{ maxHeight: menuMaxHeight }}
            className={cn(
              'absolute top-full z-50 mt-1.5 w-full overflow-auto rounded-xl border p-1 shadow-dropdown',
              dark
                ? 'border-white/10 bg-slate-900 text-slate-100'
                : 'border-slate-200 bg-white text-slate-700',
            )}
          >
            {options.map((option, index) => {
              const isSelected = selected && String(option.value) === String(selected.value);
              return (
                <li key={`${option.value}-${index}`}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    disabled={option.disabled}
                    onClick={() => selectOption(option)}
                    className={cn(
                      'flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition-colors',
                      option.disabled && 'cursor-not-allowed opacity-40',
                      dark ? 'hover:bg-white/10' : 'hover:bg-slate-100',
                      isSelected &&
                        (dark ? 'bg-primary-600/20 text-white' : 'bg-primary-50 text-primary-700'),
                    )}
                  >
                    <span className="truncate">{option.label}</span>
                    {isSelected && <Check size={15} className="shrink-0" />}
                  </button>
                </li>
              );
            })}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}
