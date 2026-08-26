import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CheckIcon } from 'lucide-react';
import { PageHeader } from '../components/layout/PageHeader';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { CvThumbnail } from '../components/cv/CvThumbnail';
import { cvTemplates } from '../data/cvs';
import { cn } from '../utils/cn';

export function CvTemplates() {
  const [selected, setSelected] = useState(cvTemplates[0].id);
  const navigate = useNavigate();
  const current = cvTemplates.find((item) => item.id === selected) ?? cvTemplates[0];

  return (
    <div>
      <PageHeader
        breadcrumbs={[{ label: 'Mes CV', to: '/cv' }, { label: 'Modèle' }]}
        title="Choisir un modèle"
        description="Le modèle définit la mise en page. Le contenu reste identique et pourra être changé à tout moment." />
      

      <fieldset>
        <legend className="sr-only">Modèles de CV disponibles</legend>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {cvTemplates.map((template) => {
            const active = template.id === selected;
            return (
              <label
                key={template.id}
                className={cn(
                  'group relative flex cursor-pointer flex-col rounded-xl border bg-surface p-3 shadow-card',
                  'transition-colors duration-150 ease-out',
                  active ? 'border-brand-600 ring-1 ring-brand-600' : 'border-line hover:border-line-strong'
                )}>
                
                <input
                  type="radio"
                  name="template"
                  value={template.id}
                  checked={active}
                  onChange={() => setSelected(template.id)}
                  className="sr-only" />
                
                <div className="rounded-lg bg-slate-50/70 p-3">
                  <CvThumbnail layout={template.layout} accent={template.accent} />
                </div>
                <div className="mt-3 flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h2 className="text-[14px] font-semibold tracking-[-0.01em] text-ink">{template.name}</h2>
                    <p className="mt-0.5 text-xs text-muted">{template.pages} pages</p>
                  </div>
                  {active ?
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-600">
                      <CheckIcon className="h-3 w-3 text-white" />
                    </span> :

                  <span className="h-5 w-5 shrink-0 rounded-full border border-line-strong" />
                  }
                </div>
                <p className="mt-2 text-[13px] leading-relaxed text-muted">{template.description}</p>
              </label>);

          })}
        </div>
      </fieldset>

      <div className="sticky bottom-0 mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface px-4 py-3 shadow-raised">
        <div className="flex items-center gap-2">
          <Badge tone="brand">Sélection</Badge>
          <p className="text-[13px] text-ink-soft">
            <span className="font-semibold text-ink">{current.name}</span> · {current.pages} pages
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/cv"
            className="inline-flex h-9 items-center rounded-lg border border-line-strong bg-white px-3.5 text-sm font-medium text-ink-soft transition-colors duration-150 ease-out hover:bg-slate-50">
            
            Annuler
          </Link>
          <Button variant="primary" onClick={() => navigate('/cv/entretien')}>
            Continuer
          </Button>
        </div>
      </div>
    </div>);

}