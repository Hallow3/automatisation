import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { LayoutGridIcon, ListIcon, SearchXIcon, SlidersHorizontalIcon, RefreshCwIcon } from 'lucide-react';
import { PageHeader } from '../components/layout/PageHeader';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { SearchInput, Select } from '../components/ui/Field';
import { SegmentedControl, Tabs } from '../components/ui/Tabs';
import { Badge, Chip, ScoreBadge, StatusBadge } from '../components/ui/Badge';
import { EmptyState, SkeletonCard, SkeletonRow } from '../components/ui/Feedback';
import { Pagination } from '../components/ui/Pagination';
import { OpportunityCard } from '../components/opportunities/OpportunityCard';
import { opportunities } from '../data/opportunities';
import type { OpportunityStatus } from '../types';
import { useScreenInit } from '../useScreenInit.js';

type View = 'cartes' | 'tableau';

const tabs = [
{ id: 'toutes', label: 'Toutes', count: opportunities.length },
{ id: 'nouveau', label: 'Nouvelles', count: opportunities.filter((o) => o.status === 'nouveau').length },
{ id: 'qualifiee', label: 'Qualifiées', count: opportunities.filter((o) => o.status === 'qualifiee').length },
{ id: 'prete', label: 'Préparées', count: opportunities.filter((o) => o.status === 'prete').length },
{ id: 'envoyee', label: 'Candidatées', count: opportunities.filter((o) => ['envoyee', 'entretien'].includes(o.status)).length },
{ id: 'ignoree', label: 'Ignorées', count: opportunities.filter((o) => o.status === 'ignoree').length }];


export function Opportunities({
  defaultView = 'cartes',
  loading = false



}: {defaultView?: View;loading?: boolean;}) {
  const screenInit = useScreenInit();
  const [view, setView] = useState<View>(screenInit.view as View ?? defaultView);
  const [tab, setTab] = useState('toutes');
  const [query, setQuery] = useState('');
  const [score, setScore] = useState('tous');
  const [source, setSource] = useState('toutes');
  const [contact, setContact] = useState('tous');
  const [page, setPage] = useState(1);

  const results = useMemo(() => {
    return opportunities.filter((item) => {
      if (tab === 'envoyee' && !['envoyee', 'entretien'].includes(item.status)) return false;
      if (tab !== 'toutes' && tab !== 'envoyee' && item.status !== tab as OpportunityStatus) return false;
      if (query && !`${item.title} ${item.company} ${item.city}`.toLowerCase().includes(query.toLowerCase())) return false;
      if (score === '85' && item.score < 85) return false;
      if (score === '75' && item.score < 75) return false;
      if (source !== 'toutes' && item.source !== source) return false;
      if (contact === 'avec' && !item.hasContact) return false;
      if (contact === 'sans' && item.hasContact) return false;
      return true;
    });
  }, [tab, query, score, source, contact]);

  const resetFilters = () => {
    setQuery('');
    setScore('tous');
    setSource('toutes');
    setContact('tous');
    setTab('toutes');
  };

  return (
    <div>
      <PageHeader
        title="Opportunités"
        description="Les offres détectées par vos recherches automatiques, qualifiées puis triées par pertinence. Vous décidez de ce qui passe en candidature."
        actions={
        <>
            <Button icon={RefreshCwIcon}>Synchroniser</Button>
            <SegmentedControl
            ariaLabel="Type d’affichage"
            value={view}
            onChange={setView}
            items={[
            { id: 'cartes', label: 'Cartes', icon: LayoutGridIcon },
            { id: 'tableau', label: 'Tableau', icon: ListIcon }]
            } />
          
          </>
        }
        meta={<p className="text-xs text-muted">Dernière synchronisation : aujourd’hui à 09:42 · 14 offres importées</p>} />
      

      <Card padded={false} className="overflow-hidden">
        <div className="px-3 pt-1">
          <Tabs items={tabs} value={tab} onChange={(id) => {setTab(id);setPage(1);}} />
        </div>
        <div className="flex flex-wrap items-center gap-2 border-b border-line bg-slate-50/60 px-3 py-2.5">
          <SearchInput
            placeholder="Intitulé, entreprise, ville…"
            aria-label="Rechercher une opportunité"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            wrapperClassName="w-full sm:w-72" />
          
          <Select
            aria-label="Score"
            value={score}
            onChange={(event) => setScore(event.target.value)}
            className="sm:w-40"
            options={[
            { value: 'tous', label: 'Score : tous' },
            { value: '85', label: 'Score ≥ 85 %' },
            { value: '75', label: 'Score ≥ 75 %' }]
            } />
          
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
            aria-label="Contact"
            value={contact}
            onChange={(event) => setContact(event.target.value)}
            className="sm:w-44"
            options={[
            { value: 'tous', label: 'Contact : indifférent' },
            { value: 'avec', label: 'Avec contact' },
            { value: 'sans', label: 'Sans contact' }]
            } />
          
          <Button variant="ghost" size="sm" icon={SlidersHorizontalIcon} className="ml-auto">
            Plus de filtres
          </Button>
          <Button variant="ghost" size="sm" onClick={resetFilters}>
            Réinitialiser
          </Button>
        </div>

        {loading ?
        view === 'cartes' ?
        <div className="grid grid-cols-1 gap-3 p-3 lg:grid-cols-2">
              {Array.from({ length: 4 }).map((_, index) =>
          <SkeletonCard key={index} />
          )}
            </div> :

        <div>
              {Array.from({ length: 6 }).map((_, index) =>
          <SkeletonRow key={index} />
          )}
            </div> :

        results.length === 0 ?
        <div className="p-3">
            <EmptyState
            icon={SearchXIcon}
            title="Aucune opportunité ne correspond à ces filtres"
            description="Élargissez le score minimum ou retirez un filtre pour retrouver des résultats."
            actionLabel="Réinitialiser les filtres"
            onAction={resetFilters} />
          
          </div> :
        view === 'cartes' ?
        <div className="grid grid-cols-1 gap-3 p-3 lg:grid-cols-2">
            {results.map((opportunity) =>
          <OpportunityCard key={opportunity.id} opportunity={opportunity} />
          )}
          </div> :

        <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] border-collapse text-left">
              <thead>
                <tr className="border-b border-line bg-slate-50/60 text-2xs uppercase tracking-wide text-muted">
                  <th scope="col" className="px-4 py-2.5 font-semibold">Poste</th>
                  <th scope="col" className="px-4 py-2.5 font-semibold">Entreprise</th>
                  <th scope="col" className="px-4 py-2.5 font-semibold">Source</th>
                  <th scope="col" className="px-4 py-2.5 font-semibold">Publiée</th>
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
                    to={`/opportunites/${item.id}`}
                    className="text-[13px] font-semibold text-ink hover:text-brand-700">
                    
                        {item.title}
                      </Link>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {item.skills.slice(0, 3).map((skill) =>
                    <Chip key={skill}>{skill}</Chip>
                    )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[13px] text-ink-soft">
                      {item.company}
                      <div className="text-xs text-muted">{item.city}</div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge>{item.source}</Badge>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-[13px] tabular-nums text-muted">
                      {new Date(item.publishedAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
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
                      to={`/opportunites/${item.id}`}
                      className="inline-flex h-8 items-center rounded-lg border border-line-strong bg-white px-2.5 text-[13px] font-medium text-ink-soft transition-colors duration-150 ease-out hover:bg-slate-50">
                      
                          Détail
                        </Link>
                        <Button variant="primary" size="sm">
                          Préparer
                        </Button>
                      </div>
                    </td>
                  </tr>
              )}
              </tbody>
            </table>
          </div>
        }

        {!loading && results.length > 0 ?
        <Pagination page={page} pageCount={4} total={results.length * 4} onChange={setPage} /> :
        null}
      </Card>
    </div>);

}