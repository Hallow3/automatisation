import React from 'react';
import { ChevronDownIcon, SearchIcon } from 'lucide-react';
import { cn } from '../../utils/cn';

const baseControl =
'w-full rounded-lg border border-line-strong bg-white text-sm text-ink placeholder:text-muted-soft ' +
'transition-colors duration-150 ease-out focus:border-brand-500 focus:outline focus:outline-2 focus:outline-offset-0 focus:outline-brand-100';

export function Label({ htmlFor, children }: {htmlFor?: string;children: React.ReactNode;}) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block text-[13px] font-medium text-ink-soft">
      {children}
    </label>);

}

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
}

export function Input({ label, hint, id, className, ...props }: InputProps) {
  const inputId = id ?? props.name;
  return (
    <div className="w-full">
      {label ? <Label htmlFor={inputId}>{label}</Label> : null}
      <input id={inputId} className={cn(baseControl, 'h-9 px-3', className)} {...props} />
      {hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
    </div>);

}

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  hint?: string;
}

export function Textarea({ label, hint, id, className, ...props }: TextareaProps) {
  const inputId = id ?? props.name;
  return (
    <div className="w-full">
      {label ? <Label htmlFor={inputId}>{label}</Label> : null}
      <textarea id={inputId} className={cn(baseControl, 'px-3 py-2 leading-relaxed', className)} {...props} />
      {hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
    </div>);

}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: Array<{value: string;label: string;}>;
}

export function Select({ label, options, id, className, ...props }: SelectProps) {
  const inputId = id ?? props.name;
  return (
    <div className="w-full">
      {label ? <Label htmlFor={inputId}>{label}</Label> : null}
      <div className="relative">
        <select
          id={inputId}
          className={cn(baseControl, 'h-9 appearance-none pl-3 pr-8', className)}
          {...props}>
          
          {options.map((option) =>
          <option key={option.value} value={option.value}>
              {option.label}
            </option>
          )}
        </select>
        <ChevronDownIcon className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
      </div>
    </div>);

}

interface SearchInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  wrapperClassName?: string;
}

export function SearchInput({ wrapperClassName, className, ...props }: SearchInputProps) {
  return (
    <div className={cn('relative', wrapperClassName)}>
      <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
      <input type="search" className={cn(baseControl, 'h-9 pl-9 pr-3', className)} {...props} />
    </div>);

}

export function Toggle({
  checked,
  onChange,
  label,
  description





}: {checked: boolean;onChange: (value: boolean) => void;label: string;description?: string;}) {
  return (
    <div className="flex items-start justify-between gap-6 py-3">
      <div className="min-w-0">
        <p className="text-sm font-medium text-ink">{label}</p>
        {description ? <p className="mt-0.5 text-[13px] text-muted">{description}</p> : null}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative mt-0.5 h-5 w-9 shrink-0 rounded-full border transition-colors duration-150 ease-out',
          'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600',
          checked ? 'border-brand-600 bg-brand-600' : 'border-line-strong bg-slate-200'
        )}>
        
        <span
          className={cn(
            'absolute top-0.5 h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform duration-150 ease-out',
            checked ? 'translate-x-[18px]' : 'translate-x-0.5'
          )} />
        
      </button>
    </div>);

}