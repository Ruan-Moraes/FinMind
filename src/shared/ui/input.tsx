import * as React from 'react';
import { SearchableSelect } from '@/shared/ui/searchable-select';

export interface FieldProps {
  label: string;
  htmlFor?: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
  className?: string;
}

/**
 * FormField padronizado que garante alinhamento perfeito da base dos inputs
 * mesmo quando usado em grids de múltiplas colunas.
 */
export function FormField({
  label,
  htmlFor,
  hint,
  error,
  children,
  className = '',
}: FieldProps) {
  return (
    <div className={`flex flex-col justify-between space-y-2 min-w-0 ${className}`}>
      <div className="flex items-baseline justify-between gap-2 min-w-0">
        <label
          htmlFor={htmlFor}
          className="block text-[13px] font-medium leading-5 text-slate-700 dark:text-zinc-300 whitespace-nowrap truncate"
        >
          {label}
        </label>
        {hint && (
          <span className="text-[11px] font-medium text-slate-400 dark:text-zinc-500 whitespace-nowrap shrink-0">
            {hint}
          </span>
        )}
      </div>
      <div>
        {children}
        {error && <p className="text-xs font-medium text-rose-500 mt-1.5">{error}</p>}
      </div>
    </div>
  );
}

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  tabular?: boolean;
  prefixText?: string;
  suffixText?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className = '', tabular = false, prefixText, suffixText, ...props }, ref) => {
    if (prefixText || suffixText) {
      return (
        <div className="relative flex items-center">
          {prefixText && (
            <span className="pointer-events-none absolute left-3.5 text-xs font-semibold text-slate-400 dark:text-zinc-500 select-none">
              {prefixText}
            </span>
          )}
          <input
            ref={ref}
            className={`h-11 w-full rounded-xl border border-slate-200/90 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-950/90 text-sm text-slate-900 dark:text-zinc-100 placeholder:text-slate-400 dark:placeholder:text-zinc-500 hover:border-slate-300 dark:hover:border-zinc-700 focus:bg-white dark:focus:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-indigo-500/25 focus:border-indigo-500 transition-all shadow-sm ${
              prefixText ? 'pl-10' : 'px-3.5'
            } ${suffixText ? 'pr-12' : 'px-3.5'} ${
              tabular ? 'tabular-nums font-medium' : ''
            } ${className}`}
            {...props}
          />
          {suffixText && (
            <span className="pointer-events-none absolute right-3.5 text-xs font-medium text-slate-400 dark:text-zinc-500 select-none">
              {suffixText}
            </span>
          )}
        </div>
      );
    }

    return (
      <input
        ref={ref}
        className={`h-11 w-full rounded-xl border border-slate-200/90 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-950/90 px-3.5 text-sm text-slate-900 dark:text-zinc-100 placeholder:text-slate-400 dark:placeholder:text-zinc-500 hover:border-slate-300 dark:hover:border-zinc-700 focus:bg-white dark:focus:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-indigo-500/25 focus:border-indigo-500 transition-all shadow-sm ${
          tabular ? 'tabular-nums font-medium' : ''
        } ${className}`}
        {...props}
      />
    );
  }
);
Input.displayName = 'Input';

export type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement>;

export const Select = SearchableSelect;

export interface SwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label?: string;
}

export function Switch({ checked, onCheckedChange, label }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onCheckedChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
        checked ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-zinc-800'
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
          checked ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  );
}
