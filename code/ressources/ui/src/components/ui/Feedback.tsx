import React from 'react';
import { AlertTriangleIcon, CheckCircle2Icon, InfoIcon, XIcon } from 'lucide-react';
import { cn } from '../../utils/cn';
import { Button } from './Button';

export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  secondaryLabel,
  className








}: {icon: React.ComponentType<{className?: string;}>;title: string;description: string;actionLabel?: string;onAction?: () => void;secondaryLabel?: string;className?: string;}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-xl border border-dashed border-line-strong bg-surface px-6 py-10 text-center',
        className
      )}>
      
      <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-line bg-slate-50">
        <Icon className="h-5 w-5 text-muted" />
      </span>
      <h3 className="mt-3 text-sm font-semibold text-ink">{title}</h3>
      <p className="mt-1 max-w-sm text-[13px] leading-relaxed text-muted">{description}</p>
      {actionLabel ?
      <div className="mt-4 flex items-center gap-2">
          <Button variant="primary" size="sm" onClick={onAction}>
            {actionLabel}
          </Button>
          {secondaryLabel ?
        <Button variant="ghost" size="sm">
              {secondaryLabel}
            </Button> :
        null}
        </div> :
      null}
    </div>);

}

export function Skeleton({ className }: {className?: string;}) {
  return <div className={cn('animate-pulse rounded bg-slate-200/70', className)} />;
}

export function SkeletonCard() {
  return (
    <div className="rounded-xl border border-line bg-surface p-4 shadow-card">
      <div className="flex items-start justify-between gap-4">
        <div className="w-full space-y-2">
          <Skeleton className="h-3.5 w-2/5" />
          <Skeleton className="h-3 w-1/4" />
        </div>
        <Skeleton className="h-6 w-12 rounded-md" />
      </div>
      <div className="mt-4 space-y-2">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-4/5" />
      </div>
      <div className="mt-4 flex gap-2">
        <Skeleton className="h-6 w-16 rounded-md" />
        <Skeleton className="h-6 w-20 rounded-md" />
        <Skeleton className="h-6 w-14 rounded-md" />
      </div>
    </div>);

}

export function SkeletonRow() {
  return (
    <div className="flex items-center gap-4 border-b border-line px-4 py-3 last:border-b-0">
      <Skeleton className="h-3.5 w-1/4" />
      <Skeleton className="h-3.5 w-1/6" />
      <Skeleton className="ml-auto h-6 w-12 rounded-md" />
      <Skeleton className="h-6 w-20 rounded-md" />
    </div>);

}

type AlertTone = 'info' | 'success' | 'warning' | 'danger';

const alertTones: Record<AlertTone, {wrap: string;icon: React.ComponentType<{className?: string;}>;iconColor: string;}> = {
  info: { wrap: 'border-brand-200 bg-brand-50', icon: InfoIcon, iconColor: 'text-brand-600' },
  success: { wrap: 'border-emerald-200 bg-emerald-50', icon: CheckCircle2Icon, iconColor: 'text-emerald-600' },
  warning: { wrap: 'border-amber-200 bg-amber-50', icon: AlertTriangleIcon, iconColor: 'text-amber-600' },
  danger: { wrap: 'border-red-200 bg-red-50', icon: AlertTriangleIcon, iconColor: 'text-red-600' }
};

export function AlertBanner({
  tone = 'info',
  title,
  description,
  action,
  onDismiss






}: {tone?: AlertTone;title: string;description?: string;action?: React.ReactNode;onDismiss?: () => void;}) {
  const config = alertTones[tone];
  const Icon = config.icon;
  return (
    <div className={cn('flex items-start gap-3 rounded-lg border px-3.5 py-3', config.wrap)}>
      <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', config.iconColor)} />
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-semibold text-ink">{title}</p>
        {description ? <p className="mt-0.5 text-[13px] leading-relaxed text-ink-soft">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
      {onDismiss ?
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Fermer"
        className="shrink-0 rounded p-0.5 text-muted transition-colors duration-150 ease-out hover:bg-white/60 hover:text-ink">
        
          <XIcon className="h-4 w-4" />
        </button> :
      null}
    </div>);

}