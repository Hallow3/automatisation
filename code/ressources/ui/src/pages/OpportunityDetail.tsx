import React, { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  AlertTriangleIcon,
  BuildingIcon,
  CalendarIcon,
  CheckIcon,
  ExternalLinkIcon,
  FileTextIcon,
  MailIcon,
  MapPinIcon,
  SendIcon,
  SparklesIcon,
  UserIcon,
  EyeOffIcon } from
'lucide-react';
import { PageHeader } from '../components/layout/PageHeader';
import { Card, CardHeader } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge, Chip, ScoreBadge, StatusBadge, scoreLabel } from '../components/ui/Badge';
import { Textarea } from '../components/ui/Field';
import { Modal } from '../components/ui/Modal';
import { AlertBanner, EmptyState } from '../components/ui/Feedback';
import { getOpportunity, opportunities } from '../data/opportunities';
import { cvs } from '../data/cvs';

export function OpportunityDetail() {
  const { id } = useParams();
  const opportunity = getOpportunity(id ?? '') ?? opportunities[0];
  const [cvModal, setCvModal] = useState(false);
  const [selectedCv, setSelectedCv] = useState(cvs[0].id);
  const [notes, setNotes] = useState('');

  const currentCv = cvs.find((item) => item.id === selectedCv) ?? cvs[0];

  return (
    <div>
      <PageHeader
        breadcrumbs={[{ label: 'Opportunités', to: '/opportunites' }, { label: opportunity.company }]}
        title={opportunity.title}
        actions={
        <>
            <Button variant="ghost" icon={EyeOffIcon}>
              Ignorer
            </Button>
            <Button icon={FileTextIcon}>Voir la lettre</Button>
            <Button variant="primary" icon={SendIcon}>
              Candidater
            </Button>
          </>
        }
        meta={
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[13px] text-muted">
            <span className="inline-flex items-center gap-1.5">
              <BuildingIcon className="h-3.5 w-3.5 text-muted-soft" />
              {opportunity.company}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <MapPinIcon className="h-3.5 w-3.5 text-muted-soft" />
              {opportunity.city} · {opportunity.remote}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <CalendarIcon className="h-3.5 w-3.5 text-muted-soft" />
              Publiée le{' '}
              {new Date(opportunity.publishedAt).toLocaleDateString('fr-FR', {
              day: 'numeric',
              month: 'long'
            })}
            </span>
            <Badge>{opportunity.source}</Badge>
            <StatusBadge status={opportunity.status} />
          </div>
        } />
      

      <AlertBanner
        tone="info"
        title="Dossier préparé automatiquement"
        description="Le CV et la lettre ont été sélectionnés par le système. Rien n’est envoyé sans votre validation." />
      

      <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-3">
        <div className="space-y-5 xl:col-span-2">
          <Card>
            <CardHeader
              title="Analyse de correspondance"
              description="Pourquoi cette offre vous a été proposée."
              action={<ScoreBadge score={opportunity.score} size="lg" />} />
            
            <p className="mt-4 rounded-lg border border-brand-100 bg-brand-50/60 p-3 text-[13px] leading-relaxed text-ink-soft">
              <SparklesIcon className="mr-1.5 inline h-4 w-4 -translate-y-px text-brand-600" />
              {opportunity.explanation}
            </p>
            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <h3 className="text-[13px] font-semibold text-ink">Points forts</h3>
                <ul className="mt-2 space-y-2">
                  {opportunity.strengths.map((item) =>
                  <li key={item} className="flex items-start gap-2 text-[13px] leading-relaxed text-ink-soft">
                      <CheckIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
                      {item}
                    </li>
                  )}
                </ul>
              </div>
              <div>
                <h3 className="text-[13px] font-semibold text-ink">Points de vigilance</h3>
                <ul className="mt-2 space-y-2">
                  {opportunity.gaps.map((item) =>
                  <li key={item} className="flex items-start gap-2 text-[13px] leading-relaxed text-ink-soft">
                      <AlertTriangleIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
                      {item}
                    </li>
                  )}
                </ul>
              </div>
            </div>
            <div className="mt-4 border-t border-line pt-3">
              <h3 className="text-[13px] font-semibold text-ink">Compétences en correspondance</h3>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {opportunity.skills.map((skill) =>
                <Chip key={skill} active>
                    {skill}
                  </Chip>
                )}
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader title="L’offre" description={`${opportunity.contract} · ${opportunity.salary}`} />
            <p className="mt-3 text-[13px] leading-relaxed text-ink-soft">{opportunity.description}</p>
            <h3 className="mt-4 text-[13px] font-semibold text-ink">Exigences principales</h3>
            <ul className="mt-2 space-y-1.5">
              {opportunity.requirements.map((item) =>
              <li key={item} className="flex items-start gap-2 text-[13px] leading-relaxed text-ink-soft">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-muted-soft" />
                  {item}
                </li>
              )}
            </ul>
            <dl className="mt-4 grid grid-cols-1 gap-3 border-t border-line pt-3 sm:grid-cols-2">
              <div>
                <dt className="text-xs text-muted">Méthode de candidature</dt>
                <dd className="mt-0.5 text-[13px] text-ink-soft">{opportunity.applyMethod}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Contact identifié</dt>
                <dd className="mt-0.5 text-[13px] text-ink-soft">
                  {opportunity.contact ?
                  <span className="inline-flex flex-wrap items-center gap-x-2">
                      <UserIcon className="h-3.5 w-3.5 text-muted-soft" />
                      {opportunity.contact.name} — {opportunity.contact.role}
                      <a
                      href={`mailto:${opportunity.contact.email}`}
                      className="inline-flex items-center gap-1 text-brand-700 hover:text-brand-800">
                      
                        <MailIcon className="h-3.5 w-3.5" />
                        {opportunity.contact.email}
                      </a>
                    </span> :

                  'Aucun contact trouvé pour cette offre'
                  }
                </dd>
              </div>
            </dl>
            <a
              href="#offre"
              className="mt-4 inline-flex items-center gap-1.5 text-[13px] font-medium text-brand-700 hover:text-brand-800">
              
              Ouvrir l’offre d’origine sur {opportunity.source}
              <ExternalLinkIcon className="h-3.5 w-3.5" />
            </a>
          </Card>

          <Card>
            <CardHeader
              title="Votre décision"
              description="Ajoutez une note personnelle avant de trancher. Ces éléments restent privés." />
            
            <Textarea
              className="mt-3"
              rows={3}
              placeholder="Ex. : demander la politique de télétravail, salaire à confirmer…"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              aria-label="Notes personnelles" />
            
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Button variant="primary" size="sm">
                Marquer comme prête
              </Button>
              <Button size="sm">Mettre en attente</Button>
              <Button variant="destructive" size="sm">
                Ignorer l’offre
              </Button>
            </div>
          </Card>
        </div>

        <div className="space-y-5">
          <Card>
            <CardHeader title="Préparation de la candidature" description={`Score ${opportunity.score} % · ${scoreLabel(opportunity.score)}`} />
            <div className="mt-3.5 space-y-3">
              <div className="rounded-lg border border-line p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs text-muted">CV sélectionné</p>
                    <p className="mt-0.5 truncate text-[13px] font-semibold text-ink">{currentCv.title}</p>
                    <p className="mt-0.5 text-xs text-muted">
                      Modèle {currentCv.template} · {currentCv.pages} pages · mis à jour le {currentCv.updatedAt}
                    </p>
                  </div>
                  <Button size="sm" onClick={() => setCvModal(true)}>
                    Changer
                  </Button>
                </div>
              </div>

              <div className="rounded-lg border border-line p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs text-muted">Lettre de motivation</p>
                    <p className="mt-0.5 text-[13px] font-semibold text-ink">
                      {opportunity.hasLetter ? 'Lettre disponible' : 'Lettre non générée'}
                    </p>
                    <p className="mt-0.5 text-xs text-muted">
                      {opportunity.hasLetter ?
                      'Générée automatiquement à partir de l’offre et de votre profil.' :
                      'La génération prend environ 30 secondes.'}
                    </p>
                  </div>
                  <Button variant={opportunity.hasLetter ? 'secondary' : 'primary'} size="sm">
                    {opportunity.hasLetter ? 'Voir' : 'Générer'}
                  </Button>
                </div>
              </div>
            </div>
            <Button variant="primary" icon={SendIcon} className="mt-4 w-full">
              Candidater maintenant
            </Button>
            <p className="mt-2 text-center text-xs text-muted">Vous validerez l’envoi à l’étape suivante.</p>
          </Card>

          <Card>
            <CardHeader title="Chronologie" />
            <ol className="mt-3 space-y-3 border-l border-line pl-4">
              {[
              { label: 'Offre détectée', time: '21 août · 09:42', done: true },
              { label: 'Qualification automatique', time: '21 août · 09:43', done: true },
              { label: 'Documents préparés', time: '21 août · 10:31', done: opportunity.hasLetter },
              { label: 'Candidature envoyée', time: 'En attente de votre validation', done: false }].
              map((step) =>
              <li key={step.label} className="relative">
                  <span
                  className={`absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full border-2 border-white ${
                  step.done ? 'bg-brand-600' : 'bg-slate-300'}`
                  } />
                
                  <p className="text-[13px] font-medium text-ink">{step.label}</p>
                  <p className="text-xs text-muted">{step.time}</p>
                </li>
              )}
            </ol>
          </Card>

          {!opportunity.hasContact ?
          <EmptyState
            icon={MailIcon}
            title="Aucun contact identifié"
            description="Le système n’a pas trouvé d’interlocuteur pour cette offre. La candidature passera par la plateforme d’origine."
            actionLabel="Rechercher un contact" /> :

          null}
        </div>
      </div>

      <Modal
        open={cvModal}
        onClose={() => setCvModal(false)}
        title="Choisir un autre CV"
        description="Le CV sélectionné sera utilisé pour cette candidature uniquement."
        footer={
        <>
            <Button onClick={() => setCvModal(false)}>Annuler</Button>
            <Button variant="primary" onClick={() => setCvModal(false)}>
              Utiliser ce CV
            </Button>
          </>
        }>
        
        <ul className="space-y-2">
          {cvs.map((item) =>
          <li key={item.id}>
              <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-line p-3 transition-colors duration-150 ease-out hover:bg-slate-50">
                <input
                type="radio"
                name="cv"
                value={item.id}
                checked={selectedCv === item.id}
                onChange={() => setSelectedCv(item.id)}
                className="mt-1 h-4 w-4 accent-brand-600" />
              
                <span className="min-w-0">
                  <span className="block text-[13px] font-semibold text-ink">{item.title}</span>
                  <span className="mt-0.5 block text-xs text-muted">
                    Modèle {item.template} · {item.pages} pages · utilisé dans {item.usedIn} candidatures
                  </span>
                </span>
              </label>
            </li>
          )}
        </ul>
        <Link to="/cv" className="mt-3 inline-block text-[13px] font-medium text-brand-700 hover:text-brand-800">
          Gérer mes CV
        </Link>
      </Modal>
    </div>);

}