import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { DownloadIcon, InboxIcon, LayoutGridIcon, ListIcon } from 'lucide-react';
import { PageHeader } from '../components/layout/PageHeader';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { SearchInput, Select } from '../components/ui/Field';
import { SegmentedControl } from '../components/ui/Tabs';
import { Badge, ScoreBadge, StatusBadge } from '../components/ui/Badge';
import { EmptyState } from '../components/ui/Feedback';
import { applications } from '../data/applications';
import type { ApplicationStatus } from '../types';
import { useScreenInit } from '../useScreenInit.js';

type View = 'tableau' | 'pipeline';

const columns: Array<{id: ApplicationStatus;label: string;}> = [
{ id: 'brouillon', label: 'Brouillon' },
{ id: 'qualifiee', label: 'Qualifiée' },
{ id: 'prete', label: 'Prête' },
{ id: 'envoyee', label: 'Envoyée' },
{ id: 'reponse', label: 'Réponse reçue' },
{ id: 'entretien', label: 'Entretien' },
{ id: 'cloturee', label: 'Clôturée' }];


export function Applications({ defaultView = 'tableau' }: {defaultView?: View;}) {
  const screenInit = useScreenInit();
  const [view, setView] = useState<View>(screenInit.view as View ?? defaultView);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('tous');
  const [source, setSource] = useState('toutes');
  const [period, setPeriod] = useState('30');

  const results = useMemo(
    () =>
    applications.filter((item) => {
      if (query && !`${item.title} ${item.company}`.toLowerCase().includes(query.toLowerCase())) return false;
      if (status !== 'tous' && item.status !== status) return false;
      if (source !== 'toutes' && item.source !== source) return false;
      return true;
    }),
    [query, status, source]
  );

  const resetFilters = () => {
    setQuery('');
    setStatus('tous');
    setSource('toutes');
    setPeriod('30');
  };

  return (
    <div>
      <PageHeader
        title="Candidatures"
        description="Le suivi de vos dossiers, de la préparation automatique jusqu’à la réponse de l’entreprise."
        actions={
        <>
            <Button icon={DownloadIcon}>Exporter</Button>
            <SegmentedControl
            ariaLabel="Type d’affichage"
            value={view}
            onChange={setView}
            items={[
            { id: 'tableau', label: 'Tableau', icon: ListIcon },
            { id: 'pipeline', label: 'Pipeline', icon: LayoutGridIcon }]
            } />
          
          </>
        } />
      

      <Card padded={false} className="overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 border-b border-line bg-slate-50/60 px-3 py-2.5">
          <SearchInput
            placeholder="Poste ou entreprise…"
            aria-label="Rechercher une candidature"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            wrapperClassName="w-full sm:w-64" />
          
          <Select
            aria-label="Statut"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className="sm:w-44"
            options={[{ value: 'tous', label: 'Statut : tous' }, ...columns.map((c) => ({ value: c.id, label: c.label }))]} />
          
          <Select
            aria-label="Source"
            value={source}
            onChange={(event) => setSource(event.target.value)}
            className="sm:w-48"
            options={[
            { value: 'toutes', label: 'Source : toutes' },
            { value: 'LinkedIn', label: 'LinkedIn' },
            { value: 'Indeed', label: 'Indeed' },
            { value: 'Welcome to the Jungle', label: 'Welcome to the Jungle' },
            { value: 'APEC', label: 'APEC' },
            { value: 'Site entreprise', label: 'Site entreprise' }]
            } />
          
          <Select
            aria-label="Période"
            value={period}
            onChange={(event) => setPeriod(event.target.value)}
            className="sm:w-44"
            options={[
            { value: '30', label: '30 derniers jours' },
            { value: '7', label: '7 derniers jours' },
            { value: 'all', label: 'Depuis le début' }]
            } />
          
          <Button variant="ghost" size="sm" className="ml-auto" onClick={resetFilters}>
            Réinitialiser
          </Button>
        </div>

        {results.length === 0 ?
        <div className="p-3">
            <EmptyState
            icon={InboxIcon}
            title="Aucune candidature ne correspond"
            description="Modifiez les filtres ou préparez une nouvelle candidature depuis vos opportunités qualifiées."
            actionLabel="Voir les opportunités" />
          
          </div> :
        view === 'tableau' ?
        <div className="overflow-x-auto">
            <table className="w-full min-w-[1000px] border-collapse text-left">
              <thead>
                <tr className="border-b border-line bg-slate-50/60 text-2xs uppercase tracking-wide text-muted">
                  <th scope="col" className="px-4 py-2.5 font-semibold">Poste</th>
                  <th scope="col" className="px-4 py-2.5 font-semibold">Préparée</th>
                  <th scope="col" className="px-4 py-2.5 font-semibold">Envoyée</th>
                  <th scope="col" className="px-4 py-2.5 font-semibold">CV</th>
                  <th scope="col" className="px-4 py-2.5 font-semibold">Lettre</th>
                  <th scope="col" className="px-4 py-2.5 font-semibold">Canal</th>
                  <th scope="col" className="px-4 py-2.5 font-semibold">Score</th>
                  <th scope="col" className="px-4 py-2.5 font-semibold">Statut</th>
                  <th scope="col" className="px-4 py-2.5 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {results.map((item) =>
              <tr key={item.id} className="transition-colors duration-150 ease-out hover:bg-slate-50/70">
                    <td className="px-4 py-3">
                      <Link
                    to={`/opportunites/${item.opportunityId}`}
                    className="text-[13px] font-semibold text-ink hover:text-brand-700">
                    
                        {item.title}
                      </Link>
                      <div className="text-xs text-muted">
                        {item.company} · {item.city}
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-[13px] text-muted">{item.preparedAt}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-[13px] text-muted">{item.sentAt ?? '—'}</td>
                    <td className="px-4 py-3 text-[13px] text-ink-soft">{item.cv}</td>
                    <td className="px-4 py-3">
                      {item.hasLetter ? <Badge tone="success">Disponible</Badge> : <Badge tone="warning">À générer</Badge>}
                    </td>
                    <td className="px-4 py-3">
                      <Badge>{item.channel}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <ScoreBadge score={item.score} />
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={item.status} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1.5">
                        <Link
                      to={`/opportunites/${item.opportunityId}`}
                      className="inline-flex h-8 items-center rounded-lg border border-line-strong bg-white px-2.5 text-[13px] font-medium text-ink-soft transition-colors duration-150 ease-out hover:bg-slate-50">
                      
                          Ouvrir
                        </Link>
                        {item.status === 'prete' || item.status === 'qualifiee' ?
                    <Button variant="primary" size="sm">
                            Envoyer
                          </Button> :
                    null}
                      </div>
                    </td>
                  </tr>
              )}
              </tbody>
            </table>
          </div> :

        <div className="scroll-slim overflow-x-auto p-3">
            <div className="flex min-w-[1100px] gap-3">
              {columns.map((column) => {
              const items = results.filter((item) => item.status === column.id);
              return (
                <section key={column.id} className="w-56 shrink-0">
                    <div className="mb-2 flex items-center justify-between gap-2 px-1">
                      <h2 className="text-[13px] font-semibold text-ink">{column.label}</h2>
                      <span className="rounded bg-slate-100 px-1.5 py-px text-2xs font-semibold tabular-nums text-muted">
                        {items.length}
                      </span>
                    </div>
                    <div className="space-y-2 rounded-lg bg-slate-50/70 p-2">
                      {items.length === 0 ?
                    <p className="px-1 py-4 text-center text-xs text-muted-soft">Aucun dossier</p> :

                    items.map((item) =>
                    <article key={item.id} className="rounded-lg border border-line bg-white p-2.5 shadow-card">
                            <div className="flex items-start justify-between gap-2">
                              <h3 className="text-[13px] font-semibold leading-snug text-ink">{item.title}</h3>
                              <ScoreBadge score={item.score} />
                            </div>
                            <p className="mt-1 text-xs text-muted">{item.company}</p>
                            <p className="mt-2 border-t border-line pt-2 text-xs leading-relaxed text-muted">
                              {item.nextStep}
                            </p>
                          </article>
                    )
                    }
                    </div>
                  </section>);

            })}
            </div>
          </div>
        }
      </Card>
    </div>);

}