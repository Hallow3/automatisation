import React from 'react';
import { cn } from '../../utils/cn';

export interface TabItem {
  id: string;
  label: string;
  count?: number;
}

export function Tabs({
  items,
  value,
  onChange,
  className





}: {items: TabItem[];value: string;onChange: (id: string) => void;className?: string;}) {
  return (
    <div role="tablist" className={cn('flex items-center gap-1 border-b border-line', className)}>
      {items.map((item) => {
        const active = item.id === value;
        return (
          <button
            key={item.id}
            role="tab"
            type="button"
            aria-selected={active}
            onClick={() => onChange(item.id)}
            className={cn(
              'relative -mb-px flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2 text-[13px] font-medium',
              'transition-colors duration-150 ease-out focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600',
              active ?
              'border-brand-600 text-ink' :
              'border-transparent text-muted hover:border-line-strong hover:text-ink-soft'
            )}>
            
            {item.label}
            {typeof item.count === 'number' ?
            <span
              className={cn(
                'rounded px-1 py-px text-2xs font-semibold tabular-nums',
                active ? 'bg-brand-50 text-brand-700' : 'bg-slate-100 text-muted'
              )}>
              
                {item.count}
              </span> :
            null}
          </button>);

      })}
    </div>);

}

export function SegmentedControl<T extends string>({
  items,
  value,
  onChange,
  ariaLabel





}: {items: Array<{id: T;label: string;icon?: React.ComponentType<{className?: string;}>;}>;value: T;onChange: (id: T) => void;ariaLabel: string;}) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className="inline-flex items-center gap-0.5 rounded-lg border border-line-strong bg-white p-0.5">
      
      {items.map((item) => {
        const active = item.id === value;
        const Icon = item.icon;
        return (
          <button
            key={item.id}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(item.id)}
            className={cn(
              'inline-flex h-7 items-center gap-1.5 rounded px-2.5 text-[13px] font-medium',
              'transition-colors duration-150 ease-out focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-600',
              active ? 'bg-slate-100 text-ink' : 'text-muted hover:text-ink'
            )}>
            
            {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
            {item.label}
          </button>);

      })}
    </div>);

}