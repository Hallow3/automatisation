import React from 'react';
import { Link } from 'react-router-dom';
import { BuildingIcon, MapPinIcon, SparklesIcon, FileTextIcon, EyeOffIcon } from 'lucide-react';
import type { Opportunity } from '../../types';
import { Badge, Chip, ScoreBadge, StatusBadge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { cn } from '../../utils/cn';

export function OpportunityCard({
  opportunity,
  className



}: {opportunity: Opportunity;className?: string;}) {
  return (
    <article
      className={cn(
        'group flex h-full flex-col rounded-xl border border-line bg-surface p-4 shadow-card',
        'transition-colors duration-150 ease-out hover:border-line-strong',
        className
      )}>
      
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
            <StatusBadge status={opportunity.status} />
            <Badge>{opportunity.source}</Badge>
          </div>
          <h3 className="truncate text-[15px] font-semibold tracking-[-0.01em] text-ink">
            <Link
              to={`/opportunites/${opportunity.id}`}
              className="rounded transition-colors duration-150 ease-out hover:text-brand-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600">
              
              {opportunity.title}
            </Link>
          </h3>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-muted">
            <span className="inline-flex items-center gap-1.5">
              <BuildingIcon className="h-3.5 w-3.5 text-muted-soft" />
              {opportunity.company}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <MapPinIcon className="h-3.5 w-3.5 text-muted-soft" />
              {opportunity.city}
            </span>
          </p>
        </div>
        <ScoreBadge score={opportunity.score} />
      </div>

      <p className="mt-3 line-clamp-2 border-l-2 border-brand-200 pl-2.5 text-[13px] leading-relaxed text-ink-soft">
        <SparklesIcon className="mr-1 inline h-3.5 w-3.5 -translate-y-px text-brand-600" />
        {opportunity.explanation}
      </p>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {opportunity.skills.slice(0, 4).map((skill) =>
        <Chip key={skill}>{skill}</Chip>
        )}
      </div>

      <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-4">
        <span className="inline-flex items-center gap-1.5 text-xs text-muted">
          <FileTextIcon className="h-3.5 w-3.5 text-muted-soft" />
          {opportunity.hasLetter ? 'Lettre disponible' : 'Lettre à générer'}
        </span>
        <div className="flex items-center gap-1.5">
          <Button variant="ghost" size="sm" icon={EyeOffIcon} aria-label="Ignorer cette opportunité">
            Ignorer
          </Button>
          <Link
            to={`/opportunites/${opportunity.id}`}
            className="hidden h-8 items-center rounded-lg border border-line-strong bg-white px-2.5 text-[13px] font-medium text-ink-soft transition-colors duration-150 ease-out hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 sm:inline-flex">
            
            Voir le détail
          </Link>
          <Button variant="primary" size="sm">
            Préparer
          </Button>
        </div>
      </div>
    </article>);

}