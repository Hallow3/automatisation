import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeftIcon,
  ChevronDownIcon,
  DownloadIcon,
  LayoutTemplateIcon,
  SaveIcon,
  SendIcon,
  SparklesIcon } from
'lucide-react';
import { PageHeader } from '../components/layout/PageHeader';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge, Chip } from '../components/ui/Badge';
import { Input, Textarea } from '../components/ui/Field';
import { Tabs } from '../components/ui/Tabs';
import { CvPreview } from '../components/cv/CvPreview';
import { profile } from '../data/activity';
import { cn } from '../utils/cn';
import { useScreenInit } from '../useScreenInit.js';

const editTabs = [
{ id: 'sections', label: 'Sections' },
{ id: 'assistant', label: 'Assistant IA' },
{ id: 'modele', label: 'Modèle' }];


const aiThread = [
{ role: 'user', text: 'Raccourcis le résumé et mets en avant le design system.' },
{
  role: 'ia',
  text: 'C’est fait : le résumé passe de 5 à 3 lignes et met en avant le pilotage du design system pour 5 équipes.'
}];


const suggestions = [
'Reformuler le résumé pour l’offre Alvéa',
'Quantifier les résultats de la refonte',
'Réduire le CV à une seule page'];


export function CvEditor() {
  const screenInit = useScreenInit();
  const [tab, setTab] = useState(screenInit.tab ?? 'sections');
  const [openSection, setOpenSection] = useState<string | null>('resume');
  const [summary, setSummary] = useState(
    'Développeuse front-end senior, 6 ans d’expérience sur des produits SaaS. Spécialisée dans la conception et la maintenance de design systems React utilisés par plusieurs équipes, avec une exigence forte sur l’accessibilité et la performance.'
  );

  const sections = [
  { id: 'resume', label: 'Résumé', count: '3 lignes' },
  { id: 'experiences', label: 'Expériences', count: `${profile.experiences.length} postes` },
  { id: 'formation', label: 'Formation', count: `${profile.education.length} diplômes` },
  { id: 'competences', label: 'Compétences', count: `${profile.skills.length} compétences` },
  { id: 'langues', label: 'Langues', count: `${profile.languages.length} langues` },
  { id: 'projets', label: 'Projets', count: `${profile.projects.length} éléments` }];


  return (
    <div>
      <PageHeader
        breadcrumbs={[{ label: 'Mes CV', to: '/cv' }, { label: 'CV Design System — 2026' }]}
        title="CV Design System — 2026"
        description="Relisez et ajustez le contenu généré. L’aperçu correspond au document exporté."
        actions={
        <>
            <Link
            to="/cv"
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-line-strong bg-white px-3.5 text-sm font-medium text-ink-soft transition-colors duration-150 ease-out hover:bg-slate-50">
            
              <ArrowLeftIcon className="h-4 w-4" />
              Mes CV
            </Link>
            <Button icon={SaveIcon}>Enregistrer</Button>
            <Button variant="primary" icon={DownloadIcon}>
              Télécharger le PDF
            </Button>
          </>
        } />
      

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_400px]">
        <Card padded={false} className="overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-slate-50/60 px-4 py-2.5">
            <div className="flex items-center gap-2">
              <Badge>Modèle Rigueur</Badge>
              <Badge>Page 1 / 2</Badge>
            </div>
            <div className="flex items-center gap-1.5">
              <Button size="sm" icon={LayoutTemplateIcon}>
                Changer de modèle
              </Button>
              <Button size="sm">Exporter</Button>
            </div>
          </div>
          <div className="scroll-slim max-h-[80vh] overflow-y-auto bg-slate-100 p-5">
            <CvPreview summary={summary} accent="#2563eb" />
            <p className="mt-3 text-center text-xs text-muted">Page 1 sur 2 · format A4</p>
          </div>
        </Card>

        <div>
          <Card padded={false} className="overflow-hidden">
            <div className="px-3 pt-1">
              <Tabs items={editTabs} value={tab} onChange={setTab} />
            </div>

            {tab === 'sections' ?
            <div className="divide-y divide-line">
                {sections.map((section) => {
                const open = openSection === section.id;
                return (
                  <div key={section.id}>
                      <button
                      type="button"
                      aria-expanded={open}
                      onClick={() => setOpenSection(open ? null : section.id)}
                      className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors duration-150 ease-out hover:bg-slate-50">
                      
                        <span className="text-[13px] font-medium text-ink">{section.label}</span>
                        <span className="flex items-center gap-2">
                          <span className="text-xs text-muted">{section.count}</span>
                          <ChevronDownIcon
                          className={cn(
                            'h-4 w-4 text-muted transition-transform duration-150 ease-out',
                            open && 'rotate-180'
                          )} />
                        
                        </span>
                      </button>
                      {open ?
                    <div className="space-y-3 bg-slate-50/60 px-4 pb-4 pt-1">
                          {section.id === 'resume' ?
                      <Textarea
                        rows={5}
                        label="Résumé professionnel"
                        value={summary}
                        onChange={(event) => setSummary(event.target.value)}
                        hint="3 à 4 lignes maximum pour rester lisible." /> :

                      section.id === 'experiences' ?
                      <div className="space-y-2">
                              {profile.experiences.map((experience) =>
                        <div key={experience.company} className="rounded-lg border border-line bg-white p-3">
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                      <p className="text-[13px] font-semibold text-ink">{experience.role}</p>
                                      <p className="text-xs text-muted">
                                        {experience.company} · {experience.period}
                                      </p>
                                    </div>
                                    <Button size="sm" variant="ghost">
                                      Modifier
                                    </Button>
                                  </div>
                                </div>
                        )}
                              <Button size="sm">Ajouter une expérience</Button>
                            </div> :
                      section.id === 'competences' ?
                      <div>
                              <div className="flex flex-wrap gap-1.5">
                                {profile.skills.map((skill) =>
                          <Chip key={skill} active>
                                    {skill}
                                  </Chip>
                          )}
                              </div>
                              <Input className="mt-3" placeholder="Ajouter une compétence…" name="skill" />
                            </div> :
                      section.id === 'langues' ?
                      <ul className="space-y-2">
                              {profile.languages.map((language) =>
                        <li
                          key={language.name}
                          className="flex items-center justify-between gap-3 rounded-lg border border-line bg-white px-3 py-2 text-[13px]">
                          
                                  <span className="font-medium text-ink">{language.name}</span>
                                  <span className="text-muted">{language.level}</span>
                                </li>
                        )}
                            </ul> :
                      section.id === 'formation' ?
                      <ul className="space-y-2">
                              {profile.education.map((item) =>
                        <li key={item.degree} className="rounded-lg border border-line bg-white p-3">
                                  <p className="text-[13px] font-semibold text-ink">{item.degree}</p>
                                  <p className="text-xs text-muted">
                                    {item.school} · {item.period}
                                  </p>
                                </li>
                        )}
                            </ul> :

                      <ul className="space-y-2">
                              {profile.projects.map((project) =>
                        <li key={project.name} className="rounded-lg border border-line bg-white p-3">
                                  <p className="text-[13px] font-semibold text-ink">{project.name}</p>
                                  <p className="text-xs text-muted">{project.detail}</p>
                                </li>
                        )}
                            </ul>
                      }
                        </div> :
                    null}
                    </div>);

              })}
              </div> :
            tab === 'assistant' ?
            <div className="flex h-[560px] flex-col">
                <div className="scroll-slim flex-1 space-y-3 overflow-y-auto px-4 py-4">
                  <p className="rounded-lg border border-line bg-slate-50 px-3 py-2 text-[13px] leading-relaxed text-muted">
                    Décrivez la modification souhaitée. Chaque proposition est appliquée uniquement après votre
                    validation.
                  </p>
                  {aiThread.map((entry, index) =>
                <div
                  key={index}
                  className={cn('flex flex-col gap-1', entry.role === 'user' ? 'items-end' : 'items-start')}>
                  
                      <span className="text-2xs font-semibold uppercase tracking-wide text-muted-soft">
                        {entry.role === 'ia' ? 'Assistant' : 'Vous'}
                      </span>
                      <p
                    className={cn(
                      'max-w-[88%] rounded-lg border px-3 py-2 text-[13px] leading-relaxed',
                      entry.role === 'ia' ?
                      'border-line bg-white text-ink-soft' :
                      'border-brand-100 bg-brand-50 text-ink'
                    )}>
                    
                        {entry.text}
                      </p>
                    </div>
                )}
                  <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
                    <SparklesIcon className="h-3.5 w-3.5 shrink-0 text-emerald-700" />
                    <p className="text-[13px] text-emerald-800">Modification appliquée au résumé.</p>
                  </div>
                </div>
                <div className="border-t border-line bg-slate-50/60 p-3">
                  <div className="mb-2 flex flex-wrap gap-1.5">
                    {suggestions.map((item) =>
                  <button
                    key={item}
                    type="button"
                    className="rounded-md border border-line bg-white px-2 py-1 text-xs text-ink-soft transition-colors duration-150 ease-out hover:border-line-strong hover:bg-slate-50">
                    
                        {item}
                      </button>
                  )}
                  </div>
                  <div className="flex items-end gap-2">
                    <Textarea rows={2} placeholder="Ex. : ajoute une expérience de mentorat…" aria-label="Instruction" />
                    <Button variant="primary" icon={SendIcon} aria-label="Envoyer l’instruction" />
                  </div>
                </div>
              </div> :

            <div className="space-y-3 p-4">
                <p className="text-[13px] leading-relaxed text-muted">
                  Changer de modèle conserve l’intégralité du contenu. Seule la mise en page est modifiée.
                </p>
                {['Rigueur', 'Colonne', 'Compact', 'Éditorial'].map((template, index) =>
              <label
                key={template}
                className="flex cursor-pointer items-center gap-3 rounded-lg border border-line bg-white p-3 transition-colors duration-150 ease-out hover:bg-slate-50">
                
                    <input type="radio" name="template" defaultChecked={index === 0} className="h-4 w-4 accent-brand-600" />
                    <span className="text-[13px] font-medium text-ink">{template}</span>
                    <span className="ml-auto text-xs text-muted">{index === 2 ? '1 page' : '2 pages'}</span>
                  </label>
              )}
              </div>
            }
          </Card>
        </div>
      </div>
    </div>);

}