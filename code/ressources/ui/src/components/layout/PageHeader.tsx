import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRightIcon } from 'lucide-react';

export interface Crumb {
  label: string;
  to?: string;
}

export function PageHeader({
  title,
  description,
  breadcrumbs,
  actions,
  meta






}: {title: string;description?: string;breadcrumbs?: Crumb[];actions?: React.ReactNode;meta?: React.ReactNode;}) {
  return (
    <header className="mb-5">
      {breadcrumbs && breadcrumbs.length > 0 ?
      <nav aria-label="Fil d’Ariane" className="mb-2">
          <ol className="flex flex-wrap items-center gap-1 text-[13px] text-muted">
            {breadcrumbs.map((crumb, index) =>
          <li key={crumb.label} className="flex items-center gap-1">
                {index > 0 ? <ChevronRightIcon className="h-3.5 w-3.5 text-muted-soft" /> : null}
                {crumb.to ?
            <Link
              to={crumb.to}
              className="rounded transition-colors duration-150 ease-out hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600">
              
                    {crumb.label}
                  </Link> :

            <span className="text-ink-soft">{crumb.label}</span>
            }
              </li>
          )}
          </ol>
        </nav> :
      null}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-[-0.02em] text-ink">{title}</h1>
          {description ? <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-muted">{description}</p> : null}
          {meta ? <div className="mt-2">{meta}</div> : null}
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </header>);

}