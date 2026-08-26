import React from 'react';
import { cn } from '../../utils/cn';
import type { ApplicationStatus, OpportunityStatus } from '../../types';

type Tone = 'neutral' | 'brand' | 'success' | 'warning' | 'danger';

const tones: Record<Tone, string> = {
  neutral: 'bg-slate-100 text-slate-700 border-slate-200',
  brand: 'bg-brand-50 text-brand-700 border-brand-200',
  success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  warning: 'bg-amber-50 text-amber-800 border-amber-200',
  danger: 'bg-red-50 text-red-700 border-red-200'
};

export function Badge({
  tone = 'neutral',
  className,
  children




}: {tone?: Tone;className?: string;children: React.ReactNode;}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-2xs font-medium',
        tones[tone],
        className
      )}>
      
      {children}
    </span>);

}

export function Chip({
  children,
  className,
  active = false




}: {children: React.ReactNode;className?: string;active?: boolean;}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium',
        active ? 'border-brand-200 bg-brand-50 text-brand-700' : 'border-line bg-slate-50 text-ink-soft',
        className
      )}>
      
      {children}
    </span>);

}

const statusMap: Record<OpportunityStatus | ApplicationStatus, {label: string;tone: Tone;}> = {
  nouveau: { label: 'Nouveau', tone: 'brand' },
  qualifiee: { label: 'Qualifiée', tone: 'brand' },
  prete: { label: 'Prête', tone: 'warning' },
  envoyee: { label: 'Envoyée', tone: 'success' },
  reponse: { label: 'Réponse reçue', tone: 'success' },
  entretien: { label: 'Entretien', tone: 'success' },
  cloturee: { label: 'Clôturée', tone: 'neutral' },
  ignoree: { label: 'Ignorée', tone: 'neutral' },
  brouillon: { label: 'Brouillon', tone: 'neutral' }
};

export function StatusBadge({ status }: {status: OpportunityStatus | ApplicationStatus;}) {
  const entry = statusMap[status];
  return (
    <Badge tone={entry.tone}>
      <span
        className={cn(
          'h-1.5 w-1.5 rounded-full',
          entry.tone === 'brand' && 'bg-brand-600',
          entry.tone === 'success' && 'bg-emerald-600',
          entry.tone === 'warning' && 'bg-amber-500',
          entry.tone === 'neutral' && 'bg-slate-400',
          entry.tone === 'danger' && 'bg-red-600'
        )} />
      
      {entry.label}
    </Badge>);

}

export function scoreLabel(score: number): string {
  if (score >= 85) return 'Très bon match';
  if (score >= 75) return 'Bon match';
  if (score >= 65) return 'Match moyen';
  return 'Match faible';
}

export function ScoreBadge({
  score,
  size = 'sm',
  withLabel = false




}: {score: number;size?: 'sm' | 'lg';withLabel?: boolean;}) {
  const tone =
  score >= 85 ?
  'border-emerald-200 bg-emerald-50 text-emerald-700' :
  score >= 75 ?
  'border-brand-200 bg-brand-50 text-brand-700' :
  score >= 65 ?
  'border-amber-200 bg-amber-50 text-amber-800' :
  'border-slate-200 bg-slate-100 text-slate-600';

  if (size === 'lg') {
    return (
      <div className={cn('flex items-baseline gap-2 rounded-lg border px-3 py-2', tone)}>
        <span className="text-xl font-semibold tabular-nums tracking-[-0.02em]">{score}%</span>
        <span className="text-xs font-medium">{scoreLabel(score)}</span>
      </div>);

  }

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md border px-1.5 py-0.5 text-xs font-semibold tabular-nums',
        tone
      )}>
      
      {score}%
      {withLabel ? <span className="font-medium">· {scoreLabel(score)}</span> : null}
    </span>);

}