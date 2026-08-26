import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  AlertTriangleIcon,
  CheckIcon,
  ArrowRightIcon,
  Loader2Icon,
  MicIcon,
  MicOffIcon,
  PauseIcon,
  RotateCcwIcon,
  Volume2Icon } from
'lucide-react';
import { PageHeader } from '../components/layout/PageHeader';
import { Card, CardHeader } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge, Chip } from '../components/ui/Badge';
import { AlertBanner } from '../components/ui/Feedback';
import { SegmentedControl } from '../components/ui/Tabs';
import { cn } from '../utils/cn';
import { useScreenInit } from '../useScreenInit.js';

type InterviewState = 'connexion' | 'ecoute' | 'ia_parle' | 'erreur' | 'termine';

const stateConfig: Record<
  InterviewState,
  {label: string;helper: string;dot: string;text: string;ring: string;}> =
{
  connexion: {
    label: 'Connexion en cours',
    helper: 'Initialisation du micro et de la session vocale…',
    dot: 'bg-slate-400',
    text: 'text-muted',
    ring: 'border-slate-200'
  },
  ecoute: {
    label: 'En écoute',
    helper: 'Parlez naturellement, l’IA vous guidera.',
    dot: 'bg-emerald-500',
    text: 'text-emerald-700',
    ring: 'border-emerald-200'
  },
  ia_parle: {
    label: 'L’IA parle',
    helper: 'Vous pouvez l’interrompre à tout moment en parlant.',
    dot: 'bg-brand-600',
    text: 'text-brand-700',
    ring: 'border-brand-200'
  },
  erreur: {
    label: 'Micro indisponible',
    helper: 'La connexion audio a été interrompue.',
    dot: 'bg-red-500',
    text: 'text-red-700',
    ring: 'border-red-200'
  },
  termine: {
    label: 'Entretien terminé',
    helper: 'Toutes les sections nécessaires ont été collectées.',
    dot: 'bg-emerald-600',
    text: 'text-emerald-700',
    ring: 'border-emerald-200'
  }
};

const transcript = [
{ role: 'ia', text: 'Bonjour Léa. Pour commencer, pouvez-vous me décrire votre poste actuel et vos responsabilités ?' },
{
  role: 'user',
  text: 'Je suis développeuse front-end senior chez Orlin Software depuis 2022. Je pilote le design system utilisé par cinq équipes produit.'
},
{ role: 'ia', text: 'Très clair. Quelle réalisation vous semble la plus marquante sur ce poste ?' },
{
  role: 'user',
  text: 'La refonte de l’espace client : on a divisé par deux le temps de chargement et harmonisé une trentaine de composants.'
},
{ role: 'ia', text: 'Parfait, je note. Passons à vos compétences techniques principales.' }];


const draftSections = [
{ label: 'Identité', status: 'complete', detail: 'Léa Bertrand · Paris' },
{ label: 'Titre', status: 'complete', detail: 'Développeuse Front-End Senior' },
{ label: 'Résumé', status: 'complete', detail: '6 ans d’expérience, spécialisation design system' },
{ label: 'Expériences', status: 'en_cours', detail: '2 postes sur 3 renseignés' },
{ label: 'Compétences', status: 'en_cours', detail: 'React, TypeScript, Tailwind…' },
{ label: 'Formation', status: 'attente', detail: 'À aborder' },
{ label: 'Langues', status: 'attente', detail: 'À aborder' },
{ label: 'Projets', status: 'attente', detail: 'À aborder' }] as
const;

const tips = [
'Parlez naturellement, l’IA s’occupe de vous guider.',
'Vous pouvez interrompre l’IA à tout moment.',
'Plus vous donnez de détails, plus le CV sera solide.'];


function StatusPill({ state }: {state: InterviewState;}) {
  const config = stateConfig[state];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md border bg-white px-2 py-1 text-xs font-medium',
        config.ring,
        config.text
      )}>
      
      <span className={cn('h-1.5 w-1.5 rounded-full', config.dot)} />
      {config.label}
    </span>);

}

export function VoiceInterview() {
  const screenInit = useScreenInit();
  const [state, setState] = useState<InterviewState>(screenInit.state as InterviewState ?? 'ecoute');
  const config = stateConfig[state];
  const completed = draftSections.filter((section) => section.status === 'complete').length;
  const progress = Math.round(completed / draftSections.length * 100);

  return (
    <div>
      <PageHeader
        breadcrumbs={[{ label: 'Mes CV', to: '/cv' }, { label: 'Entretien vocal' }]}
        title="Entretien vocal"
        description="Une conversation guidée de 8 à 10 minutes pour construire votre CV. Vous gardez la main : rien n’est publié sans votre relecture."
        actions={
        <SegmentedControl
          ariaLabel="État de la session (démonstration)"
          value={state}
          onChange={setState}
          items={[
          { id: 'connexion', label: 'Connexion' },
          { id: 'ecoute', label: 'Écoute' },
          { id: 'ia_parle', label: 'IA' },
          { id: 'erreur', label: 'Erreur' },
          { id: 'termine', label: 'Terminé' }]
          } />

        } />
      

      {state === 'erreur' ?
      <AlertBanner
        tone="danger"
        title="Le micro n’est plus accessible"
        description="Vérifiez les autorisations de votre navigateur, puis reprenez l’entretien. Vos réponses déjà enregistrées sont conservées."
        action={
        <Button size="sm" icon={RotateCcwIcon} onClick={() => setState('ecoute')}>
              Reprendre
            </Button>
        } /> :

      null}

      {state === 'termine' ?
      <AlertBanner
        tone="success"
        title="CV prêt à être finalisé"
        description="Les informations collectées ont été structurées. Passez à l’éditeur pour relire et ajuster avant export."
        action={
        <Link
          to="/cv/editeur"
          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-emerald-300 bg-white px-2.5 text-[13px] font-medium text-emerald-800 transition-colors duration-150 ease-out hover:bg-emerald-100">
          
              Ouvrir l’éditeur
              <ArrowRightIcon className="h-3.5 w-3.5" />
            </Link>
        } /> :

      null}

      <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-5">
          <Card className="flex flex-col items-center px-4 py-8">
            <StatusPill state={state} />

            <div className="relative mt-6 flex h-32 w-32 items-center justify-center">
              {state === 'ecoute' || state === 'ia_parle' ?
              <>
                  <span
                  className={cn(
                    'absolute inset-0 rounded-full animate-pulse-ring',
                    state === 'ecoute' ? 'bg-emerald-200' : 'bg-brand-200'
                  )} />
                
                  <span
                  className={cn(
                    'absolute inset-3 rounded-full',
                    state === 'ecoute' ? 'bg-emerald-100' : 'bg-brand-100'
                  )} />
                
                </> :
              null}
              <button
                type="button"
                aria-label={state === 'ecoute' ? 'Mettre l’entretien en pause' : 'Reprendre l’entretien'}
                onClick={() => setState(state === 'ecoute' ? 'ia_parle' : 'ecoute')}
                className={cn(
                  'relative flex h-20 w-20 items-center justify-center rounded-full border text-white shadow-raised',
                  'transition-colors duration-150 ease-out focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4',
                  state === 'erreur' ?
                  'border-red-600 bg-red-600 focus-visible:outline-red-600' :
                  state === 'ia_parle' ?
                  'border-brand-600 bg-brand-600 focus-visible:outline-brand-600' :
                  state === 'termine' ?
                  'border-emerald-600 bg-emerald-600 focus-visible:outline-emerald-600' :
                  'border-slate-800 bg-slate-900 focus-visible:outline-slate-900'
                )}>
                
                {state === 'connexion' ?
                <Loader2Icon className="h-7 w-7 animate-spin" /> :
                state === 'erreur' ?
                <MicOffIcon className="h-7 w-7" /> :
                state === 'ia_parle' ?
                <Volume2Icon className="h-7 w-7" /> :
                state === 'termine' ?
                <CheckIcon className="h-7 w-7" /> :

                <MicIcon className="h-7 w-7" />
                }
              </button>
            </div>

            <div className="mt-5 flex h-8 items-end gap-1" aria-hidden="true">
              {Array.from({ length: 24 }).map((_, index) => {
                const active = state === 'ecoute' || state === 'ia_parle';
                const height = 6 + index * 7 % 22;
                return (
                  <motion.span
                    key={index}
                    className={cn(
                      'w-1 rounded-full',
                      state === 'ia_parle' ? 'bg-brand-500' : state === 'ecoute' ? 'bg-emerald-500' : 'bg-slate-200'
                    )}
                    initial={{ height: 6 }}
                    animate={active ? { height: [8, height, 10] } : { height: 6 }}
                    transition={{
                      duration: 0.9,
                      repeat: active ? Infinity : 0,
                      repeatType: 'mirror',
                      delay: index * 0.03,
                      ease: 'easeInOut'
                    }} />);


              })}
            </div>

            <p className="mt-5 max-w-md text-center text-[13px] leading-relaxed text-muted">{config.helper}</p>

            <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
              <Button icon={PauseIcon} disabled={state === 'connexion' || state === 'termine'}>
                Mettre en pause
              </Button>
              <Button icon={RotateCcwIcon} disabled={state === 'connexion'}>
                Reprendre la question
              </Button>
              <Button
                variant={state === 'termine' ? 'primary' : 'secondary'}
                onClick={() => setState('termine')}
                disabled={state === 'connexion'}>
                
                Terminer l’entretien
              </Button>
            </div>

            <ul className="mt-6 flex flex-wrap items-center justify-center gap-2 border-t border-line pt-5">
              {tips.map((tip) =>
              <li key={tip}>
                  <Chip>{tip}</Chip>
                </li>
              )}
            </ul>
          </Card>

          <Card padded={false}>
            <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
              <div>
                <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-ink">Transcription en direct</h2>
                <p className="mt-0.5 text-[13px] text-muted">Question 5 sur 12 · durée 04:18</p>
              </div>
              <Badge tone={state === 'ecoute' || state === 'ia_parle' ? 'success' : 'neutral'}>
                {state === 'ecoute' || state === 'ia_parle' ? 'En cours' : 'En pause'}
              </Badge>
            </div>
            <div className="scroll-slim max-h-[360px] space-y-3 overflow-y-auto px-4 py-4">
              {transcript.map((entry, index) =>
              <div
                key={index}
                className={cn('flex flex-col gap-1', entry.role === 'user' ? 'items-end' : 'items-start')}>
                
                  <span className="text-2xs font-semibold uppercase tracking-wide text-muted-soft">
                    {entry.role === 'ia' ? 'Assistant' : 'Vous'}
                  </span>
                  <p
                  className={cn(
                    'max-w-[85%] rounded-lg border px-3 py-2 text-[13px] leading-relaxed',
                    entry.role === 'ia' ?
                    'border-line bg-slate-50 text-ink-soft' :
                    'border-brand-100 bg-brand-50 text-ink'
                  )}>
                  
                    {entry.text}
                  </p>
                </div>
              )}
              {state === 'ecoute' ?
              <div className="flex flex-col items-end gap-1">
                  <span className="text-2xs font-semibold uppercase tracking-wide text-muted-soft">Vous</span>
                  <p className="max-w-[85%] rounded-lg border border-dashed border-brand-200 bg-white px-3 py-2 text-[13px] italic text-muted">
                    Je travaille surtout avec React et TypeScript, et depuis deux ans…
                  </p>
                </div> :
              null}
            </div>
          </Card>
        </div>

        <div className="space-y-5">
          <Card>
            <CardHeader
              title="Brouillon du CV"
              description="Rempli au fil de la conversation."
              action={<span className="text-[13px] font-semibold tabular-nums text-ink">{progress} %</span>} />
            
            <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
              <div className="h-full rounded-full bg-brand-600 transition-[width] duration-300 ease-out" style={{ width: `${progress}%` }} />
            </div>
            <ul className="mt-3.5 divide-y divide-line border-t border-line">
              {draftSections.map((section) =>
              <li key={section.label} className="flex items-start gap-3 py-2.5">
                  <span
                  className={cn(
                    'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-2xs font-semibold',
                    section.status === 'complete' ?
                    'border-emerald-200 bg-emerald-50 text-emerald-700' :
                    section.status === 'en_cours' ?
                    'border-brand-200 bg-brand-50 text-brand-700' :
                    'border-line bg-slate-50 text-muted-soft'
                  )}>
                  
                    {section.status === 'complete' ? <CheckIcon className="h-3 w-3" /> : null}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-medium text-ink">{section.label}</p>
                    <p className="truncate text-xs text-muted">{section.detail}</p>
                  </div>
                  {section.status === 'en_cours' ? <Badge tone="brand">En cours</Badge> : null}
                </li>
              )}
            </ul>
            <Link
              to="/cv/editeur"
              className={cn(
                'mt-4 inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg border px-3.5 text-sm font-medium transition-colors duration-150 ease-out',
                state === 'termine' ?
                'border-brand-600 bg-brand-600 text-white hover:bg-brand-700' :
                'border-line-strong bg-white text-ink-soft hover:bg-slate-50'
              )}>
              
              {state === 'termine' ? 'Finaliser le CV' : 'Voir le brouillon'}
              <ArrowRightIcon className="h-4 w-4" />
            </Link>
          </Card>

          <Card>
            <CardHeader title="Bon à savoir" />
            <ul className="mt-3 space-y-2.5">
              {[
              'L’entretien peut être mis en pause et repris plus tard.',
              'Chaque réponse reste modifiable dans l’éditeur.',
              'L’enregistrement audio n’est pas conservé après la session.'].
              map((item) =>
              <li key={item} className="flex items-start gap-2 text-[13px] leading-relaxed text-ink-soft">
                  <AlertTriangleIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-soft" />
                  {item}
                </li>
              )}
            </ul>
          </Card>
        </div>
      </div>
    </div>);

}