import React from 'react';
import { cn } from '../../utils/cn';

type Variant = 'primary' | 'secondary' | 'ghost' | 'destructive';
type Size = 'sm' | 'md';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  icon?: React.ComponentType<{className?: string;}>;
  iconRight?: React.ComponentType<{className?: string;}>;
}

const variants: Record<Variant, string> = {
  primary:
  'bg-brand-600 text-white border border-brand-600 hover:bg-brand-700 hover:border-brand-700 focus-visible:outline-brand-600',
  secondary:
  'bg-white text-ink-soft border border-line-strong hover:bg-slate-50 focus-visible:outline-brand-600',
  ghost:
  'bg-transparent text-muted border border-transparent hover:bg-slate-100 hover:text-ink focus-visible:outline-brand-600',
  destructive:
  'bg-white text-red-600 border border-red-200 hover:bg-red-50 focus-visible:outline-red-600'
};

const sizes: Record<Size, string> = {
  sm: 'h-8 px-2.5 text-[13px] gap-1.5',
  md: 'h-9 px-3.5 text-sm gap-2'
};

export function Button({
  variant = 'secondary',
  size = 'md',
  icon: Icon,
  iconRight: IconRight,
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      type="button"
      className={cn(
        'inline-flex items-center justify-center whitespace-nowrap rounded-lg font-medium',
        'transition-colors duration-150 ease-out focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2',
        'disabled:cursor-not-allowed disabled:opacity-50',
        variants[variant],
        sizes[size],
        className
      )}
      {...props}>
      
      {Icon ? <Icon className="h-4 w-4 shrink-0" /> : null}
      {children}
      {IconRight ? <IconRight className="h-4 w-4 shrink-0" /> : null}
    </button>);

}