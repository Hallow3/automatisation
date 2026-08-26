import React from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRightIcon,
  BriefcaseIcon,
  CalendarCheckIcon,
  CheckCircle2Icon,
  FileTextIcon,
  MicIcon,
  RefreshCwIcon,
  SendIcon,
  SparklesIcon,
  TargetIcon,
  ZapIcon } from
'lucide-react';
import { PageHeader } from '../components/layout/PageHeader';
import { Card, CardHeader } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { SkeletonCard, Skeleton, AlertBanner } from '../components/ui/Feedback';
import { OpportunityCard } from '../components/opportunities/OpportunityCard';
import { opportunities } from '../data/opportunities';
import { applications } from '../data/applications';
import { activity, automations } from '../data/activity';
import { cn } from '../utils/cn';

const kpis = [
{ label: 'Opportunités détectées', value: 128, delta: '+14 aujourd’hui', icon: BriefcaseIcon, to: '/opportunites' },
{ label: 'Opportunités qualifiées', value: 34, delta: '+3 cette semaine', icon: TargetIcon, to: '/opportunites' },
{ label: 'Candidatures en cours', value: 7, delta: '2 à envoyer', icon: SendIcon, to: '/candidatures' },
{ label: 'Entretiens', value: 2, delta: 'Prochain le 26 août', icon: CalendarCheckIcon, to: '/candidatures' },
{ label: 'CV disponibles', value: 4, delta: '1 mis à jour hier', icon: FileTextIcon, to: '/cv' }];


const pipeline = [
{ label: 'Brouillon', value: 1, tone: 'bg-slate-300' },
{ label: 'Prêtes', value: 2, tone: 'bg-amber-400' },
{ label: 'Envoyées', value: 2, tone: 'bg-brand-500' },
{ label: 'Entretien', value: 1, tone: 'bg-emerald-500' },
{ label: 'Clôturées', value: 1, tone: 'bg-slate-400' }];


const activityIcons = {
  opportunite: BriefcaseIcon,
  cv: FileTextIcon,
  lettre: SparklesIcon,
  candidature: SendIcon,
  entretien: CalendarCheckIcon
} as const;

export function Dashboard({ loading = false }: {loading?: boolean;}) {
  const priority = opportunities.filter((item) => ['nouveau', 'qualifiee', 'prete'].includes(item.status)).slice(0, 3);
  const totalApplications = pipeline.reduce((sum, item) => sum + item.value, 0);

  return (
    <div>
      <PageHeader
        title="Tableau de bord"
        description="Votre point quotidien : ce qui a été détecté automatiquement, et ce qui attend votre décision."
        actions={
        <>
            <Button icon={RefreshCwIcon}>Relancer l’analyse</Button>
            <Button variant="primary" icon={MicIcon}>
              Créer un CV
            </Button>
          </>
        } />
      

      <AlertBanner
        tone="warning"
        title="2 candidatures sont prêtes mais non envoyées"
        description="Les documents ont été préparés automatiquement. L’envoi reste à votre initiative."
        action={
        <Link
          to="/candidatures"
          className="inline-flex h-8 items-center rounded-lg border border-amber-300 bg-white px-2.5 text-[13px] font-medium text-amber-900 transition-colors duration-150 ease-out hover:bg-amber-100">
          
            Vérifier
          </Link>
        } />
      

      <section aria-label="Indicateurs" className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {loading ?
        Array.from({ length: 5 }).map((_, index) =>
        <div key={index} className="rounded-xl border border-line bg-surface p-4 shadow-card">
                <Skeleton className="h-3 w-2/3" />
                <Skeleton className="mt-3 h-6 w-12" />
                <Skeleton className="mt-3 h-3 w-1/2" />
              </div>
        ) :
        kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <Link
              key={kpi.label}
              to={kpi.to}
              className="group rounded-xl border border-line bg-surface p-4 shadow-card transition-colors duration-150 ease-out hover:border-line-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600">
              
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[13px] font-medium text-muted">{kpi.label}</p>
                    <Icon className="h-4 w-4 shrink-0 text-muted-soft" />
                  </div>
                  <p className="mt-2 text-2xl font-semibold tabular-nums tracking-[-0.02em] text-ink">{kpi.value}</p>
                  <p className="mt-1 text-xs text-muted">{kpi.delta}</p>
                </Link>);

        })}
      </section>

      <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-3">
        <section aria-label="À traiter en priorité" className="xl:col-span-2">
          <div className="mb-3 flex items-end justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold tracking-[-0.01em] text-ink">À traiter en priorité</h2>
              <p className="mt-0.5 text-[13px] text-muted">
                Les opportunités les mieux notées qui attendent une décision de votre part.
              </p>
            </div>
            <Link
              to="/opportunites"
              className="inline-flex shrink-0 items-center gap-1 text-[13px] font-medium text-brand-700 transition-colors duration-150 ease-out hover:text-brand-800">
              
              Tout voir
              <ArrowRightIcon className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="space-y-3">
            {loading ?
            Array.from({ length: 3 }).map((_, index) => <SkeletonCard key={index} />) :
            priority.map((opportunity) =>
            <OpportunityCard key={opportunity.id} opportunity={opportunity} />
            )}
          </div>
        </section>

        <div className="space-y-5">
          <Card>
            <CardHeader
              title="Automatisations"
              description="Ce que le système fait pour vous en arrière-plan."
              action={<Badge tone="success">Actif</Badge>} />
            
            <dl className="mt-3.5 grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-line bg-slate-50/70 p-2.5">
                <dt className="text-xs text-muted">Recherches actives</dt>
                <dd className="mt-0.5 text-lg font-semibold tabular-nums text-ink">{automations.activeWorkflows}</dd>
              </div>
              <div className="rounded-lg border border-line bg-slate-50/70 p-2.5">
                <dt className="text-xs text-muted">Offres importées</dt>
                <dd className="mt-0.5 text-lg font-semibold tabular-nums text-ink">{automations.importedToday}</dd>
              </div>
            </dl>
            <p className="mt-3 flex items-center gap-1.5 text-xs text-muted">
              <ZapIcon className="h-3.5 w-3.5 text-brand-600" />
              Dernière synchronisation : {automations.lastScan}
            </p>
            <div className="mt-3 rounded-lg border border-line p-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[13px] font-medium text-ink">{automations.documentQueue.label}</p>
                <span className="text-xs tabular-nums text-muted">{automations.documentQueue.progress}%</span>
              </div>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
                <div
                  className="h-full rounded-full bg-brand-600"
                  style={{ width: `${automations.documentQueue.progress}%` }} />
                
              </div>
            </div>
            <ul className="mt-3 divide-y divide-line border-t border-line">
              {automations.workflows.map((workflow) =>
              <li key={workflow.name} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-medium text-ink">{workflow.name}</p>
                    <p className="truncate text-xs text-muted">
                      {workflow.sources} · {workflow.frequency}
                    </p>
                  </div>
                  <span
                  className={cn(
                    'shrink-0 text-xs font-medium',
                    workflow.active ? 'text-emerald-700' : 'text-muted-soft'
                  )}>
                  
                    {workflow.active ? 'Actif' : 'En pause'}
                  </span>
                </li>
              )}
            </ul>
          </Card>

          <Card>
            <CardHeader
              title="Mes candidatures"
              description={`${totalApplications} dossiers suivis`}
              action={
              <Link to="/candidatures" className="text-[13px] font-medium text-brand-700 hover:text-brand-800">
                  Détail
                </Link>
              } />
            
            <div className="mt-3.5 flex h-2 w-full overflow-hidden rounded-full">
              {pipeline.map((step) =>
              <div
                key={step.label}
                className={cn(step.tone, 'h-full')}
                style={{ width: `${step.value / totalApplications * 100}%` }} />

              )}
            </div>
            <ul className="mt-3 space-y-1.5">
              {pipeline.map((step) =>
              <li key={step.label} className="flex items-center gap-2 text-[13px]">
                  <span className={cn('h-2 w-2 rounded-full', step.tone)} />
                  <span className="text-ink-soft">{step.label}</span>
                  <span className="ml-auto font-semibold tabular-nums text-ink">{step.value}</span>
                </li>
              )}
            </ul>
          </Card>
        </div>
      </div>

      <section aria-label="Activité récente" className="mt-5">
        <Card>
          <CardHeader
            title="Activité récente"
            description="Les actions automatiques et vos décisions, dans l’ordre chronologique."
            action={
            <Link to="/activite" className="text-[13px] font-medium text-brand-700 hover:text-brand-800">
                Tout voir
              </Link>
            } />
          
          <ol className="mt-3.5 divide-y divide-line border-t border-line">
            {activity.map((item) => {
              const Icon = activityIcons[item.type];
              return (
                <li key={item.id} className="flex items-start gap-3 py-3">
                  <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-line bg-slate-50">
                    <Icon className="h-3.5 w-3.5 text-muted" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-[13px] font-medium text-ink">{item.label}</p>
                      {item.automated ?
                      <Badge tone="brand">
                          <SparklesIcon className="h-3 w-3" />
                          Automatique
                        </Badge> :

                      <Badge>
                          <CheckCircle2Icon className="h-3 w-3" />
                          Votre action
                        </Badge>
                      }
                    </div>
                    <p className="mt-0.5 text-[13px] text-muted">{item.detail}</p>
                  </div>
                  <span className="shrink-0 text-xs text-muted-soft">{item.time}</span>
                </li>);

            })}
          </ol>
        </Card>
      </section>
    </div>);

}