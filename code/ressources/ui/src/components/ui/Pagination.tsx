import React from 'react';
import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';
import { cn } from '../../utils/cn';

export function Pagination({
  page,
  pageCount,
  total,
  onChange





}: {page: number;pageCount: number;total: number;onChange: (page: number) => void;}) {
  const pages = Array.from({ length: pageCount }, (_, index) => index + 1);
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3">
      <p className="text-[13px] text-muted">
        Page <span className="font-medium text-ink-soft">{page}</span> sur {pageCount} · {total} résultats
      </p>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onChange(Math.max(1, page - 1))}
          disabled={page === 1}
          aria-label="Page précédente"
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-line-strong bg-white text-muted transition-colors duration-150 ease-out hover:bg-slate-50 hover:text-ink disabled:opacity-40">
          
          <ChevronLeftIcon className="h-4 w-4" />
        </button>
        {pages.map((item) =>
        <button
          key={item}
          type="button"
          onClick={() => onChange(item)}
          aria-current={item === page ? 'page' : undefined}
          className={cn(
            'inline-flex h-8 min-w-8 items-center justify-center rounded-lg border px-2 text-[13px] font-medium tabular-nums transition-colors duration-150 ease-out',
            item === page ?
            'border-brand-600 bg-brand-600 text-white' :
            'border-line-strong bg-white text-ink-soft hover:bg-slate-50'
          )}>
          
            {item}
          </button>
        )}
        <button
          type="button"
          onClick={() => onChange(Math.min(pageCount, page + 1))}
          disabled={page === pageCount}
          aria-label="Page suivante"
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-line-strong bg-white text-muted transition-colors duration-150 ease-out hover:bg-slate-50 hover:text-ink disabled:opacity-40">
          
          <ChevronRightIcon className="h-4 w-4" />
        </button>
      </div>
    </div>);

}