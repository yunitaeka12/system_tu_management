import { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { cn } from '../utils/helpers';

const SIZES = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
};

export default function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
  closeOnBackdrop = true,
  dark = false,
}) {
  // Kunci scroll body + dukungan tombol Escape.
  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', onKeyDown);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={closeOnBackdrop ? onClose : undefined}
            className="absolute inset-0 bg-slate-900/50"
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className={cn(
              'relative z-10 flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-2xl shadow-dropdown sm:rounded-2xl',
              dark ? 'bg-slate-950 ring-1 ring-white/10' : 'bg-white',
              SIZES[size] ?? SIZES.md,
            )}
          >
            <div
              className={cn(
                'flex items-start gap-4 border-b px-5 py-4',
                dark ? 'border-white/10' : 'border-slate-200',
              )}
            >
              <div className="min-w-0 flex-1">
                <h2 className={cn('text-base font-semibold', dark ? 'text-white' : 'text-slate-900')}>
                  {title}
                </h2>
                {description && (
                  <p className={cn('mt-0.5 text-sm', dark ? 'text-slate-400' : 'text-slate-500')}>
                    {description}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={onClose}
                className={cn(
                  'rounded-lg p-1.5 transition',
                  dark
                    ? 'text-slate-400 hover:bg-white/10 hover:text-white'
                    : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600',
                )}
                aria-label="Tutup"
              >
                <X size={18} />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">{children}</div>

            {footer && (
              <div
                className={cn(
                  'flex flex-col-reverse gap-2 border-t px-5 py-4 sm:flex-row sm:justify-end',
                  dark ? 'border-white/10 bg-white/[0.03]' : 'border-slate-200 bg-slate-50/70',
                )}
              >
                {footer}
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
