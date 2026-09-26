import { AlertCircle } from 'lucide-react';
import { cn } from '../utils/helpers';

export default function FormField({
  label,
  htmlFor,
  error,
  hint,
  required = false,
  children,
  className,
}) {
  return (
    <div className={cn('min-w-0', className)}>
      {label && (
        <label htmlFor={htmlFor} className="label">
          {label}
          {required && <span className="ml-0.5 text-red-500">*</span>}
        </label>
      )}
      {children}
      {error ? (
        <p className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-red-600">
          <AlertCircle size={13} />
          {error}
        </p>
      ) : (
        hint && <p className="mt-1.5 text-xs text-slate-400">{hint}</p>
      )}
    </div>
  );
}
