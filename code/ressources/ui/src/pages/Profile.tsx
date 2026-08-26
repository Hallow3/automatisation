import React, { useState } from 'react';
import { PlusIcon, SaveIcon, XIcon } from 'lucide-react';
import { PageHeader } from '../components/layout/PageHeader';
import { Card, CardHeader } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Chip } from '../components/ui/Badge';
import { Input, Select, Textarea } from '../components/ui/Field';
import { AlertBanner } from '../components/ui/Feedback';
import { profile } from '../data/activity';

const anchors = [
{ id: 'identite', label: 'Identité' },
{ id: 'recherche', label: 'Recherche' },
{ id: 'competences', label: 'Compétences' },
{ id: 'parcours', label: 'Parcours' },
{ id: 'liens', label: 'Liens' }];


export function Profile() {
  const [skills, setSkills] = useState(profile.skills);

  return (
    <div>
      <PageHeader
        title="Profil"
        description="Les informations utilisées pour le matching, la génération des CV et des lettres de motivation."
        actions={
        <>
            <Button>Annuler</Button>
            <Button variant="primary" icon={SaveIcon}>
              Enregistrer
            </Button>
          </>
        } />
      

      <AlertBanner
        tone="info"
        title="Profil complété à 86 %"
        description="Ajoutez vos préférences de rémunération et votre disponibilité pour améliorer la qualité du matching." />
      

      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-[200px_minmax(0,1fr)]">
        <nav aria-label="Sections du profil" className="hidden lg:block">
          <ul className="sticky top-20 space-y-0.5">
            {anchors.map((anchor) =>
            <li key={anchor.id}>
                <a
                href={`#${anchor.id}`}
                className="block rounded-lg px-2.5 py-1.5 text-[13px] font-medium text-muted transition-colors duration-150 ease-out hover:bg-white hover:text-ink">
                
                  {anchor.label}
                </a>
              </li>
            )}
          </ul>
        </nav>

        <div className="space-y-5">
          <Card id="identite">
            <CardHeader title="Identité" description="Ces informations apparaissent en en-tête de vos CV." />
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input label="Prénom" name="firstName" defaultValue={profile.firstName} />
              <Input label="Nom" name="lastName" defaultValue={profile.lastName} />
              <Input label="Titre professionnel" name="title" defaultValue={profile.title} />
              <Input label="Ville" name="city" defaultValue={profile.city} />
              <Input label="Email" name="email" type="email" defaultValue={profile.email} />
              <Input label="Téléphone" name="phone" defaultValue={profile.phone} />
            </div>
          </Card>

          <Card id="recherche">
            <CardHeader
              title="Recherche"
              description="Ces critères orientent la détection et la qualification des offres." />
            
            <div className="mt-4 space-y-4">
              <div>
                <p className="mb-1.5 text-[13px] font-medium text-ink-soft">Postes ciblés</p>
                <div className="flex flex-wrap gap-1.5">
                  {profile.targetRoles.map((role) =>
                  <Chip key={role} active>
                      {role}
                    </Chip>
                  )}
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 rounded-md border border-dashed border-line-strong px-2 py-0.5 text-xs font-medium text-muted transition-colors duration-150 ease-out hover:bg-slate-50 hover:text-ink">
                    
                    <PlusIcon className="h-3 w-3" />
                    Ajouter
                  </button>
                </div>
              </div>
              <div>
                <p className="mb-1.5 text-[13px] font-medium text-ink-soft">Localisations</p>
                <div className="flex flex-wrap gap-1.5">
                  {profile.locations.map((location) =>
                  <Chip key={location}>{location}</Chip>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Select
                  label="Séniorité"
                  name="seniority"
                  defaultValue={profile.seniority}
                  options={[
                  { value: '2 – 4 ans', label: '2 – 4 ans' },
                  { value: '4 – 6 ans', label: '4 – 6 ans' },
                  { value: '6 – 8 ans', label: '6 – 8 ans' },
                  { value: '8 ans et +', label: '8 ans et +' }]
                  } />
                
                <Select
                  label="Type de contrat"
                  name="contract"
                  defaultValue={profile.preferences.contract}
                  options={[
                  { value: 'CDI', label: 'CDI' },
                  { value: 'CDD', label: 'CDD' },
                  { value: 'Freelance', label: 'Freelance' }]
                  } />
                
                <Input label="Rémunération visée" name="salary" defaultValue={profile.preferences.salary} />
                <Input label="Disponibilité" name="availability" defaultValue={profile.preferences.availability} />
              </div>
            </div>
          </Card>

          <Card id="competences">
            <CardHeader title="Compétences" description="Utilisées pour calculer le score de correspondance." />
            <div className="mt-4 flex flex-wrap gap-1.5">
              {skills.map((skill) =>
              <span
                key={skill}
                className="inline-flex items-center gap-1 rounded-md border border-brand-200 bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700">
                
                  {skill}
                  <button
                  type="button"
                  aria-label={`Retirer ${skill}`}
                  onClick={() => setSkills(skills.filter((item) => item !== skill))}
                  className="rounded transition-colors duration-150 ease-out hover:text-brand-800">
                  
                    <XIcon className="h-3 w-3" />
                  </button>
                </span>
              )}
            </div>
            <Input className="mt-3 sm:max-w-xs" placeholder="Ajouter une compétence…" name="new-skill" />
          </Card>

          <Card id="parcours">
            <CardHeader title="Parcours" description="Expériences, formation et langues reprises dans vos CV." />
            <div className="mt-4 space-y-4">
              <div>
                <h3 className="text-[13px] font-semibold text-ink">Expériences</h3>
                <ul className="mt-2 space-y-2">
                  {profile.experiences.map((experience) =>
                  <li key={experience.company} className="rounded-lg border border-line p-3">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-[13px] font-semibold text-ink">
                            {experience.role} — {experience.company}
                          </p>
                          <p className="text-xs text-muted">
                            {experience.period} · {experience.city}
                          </p>
                        </div>
                        <Button size="sm" variant="ghost">
                          Modifier
                        </Button>
                      </div>
                      <p className="mt-2 text-[13px] leading-relaxed text-ink-soft">{experience.description}</p>
                    </li>
                  )}
                </ul>
                <Button size="sm" icon={PlusIcon} className="mt-2">
                  Ajouter une expérience
                </Button>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <h3 className="text-[13px] font-semibold text-ink">Formation</h3>
                  <ul className="mt-2 space-y-2">
                    {profile.education.map((item) =>
                    <li key={item.degree} className="rounded-lg border border-line p-3">
                        <p className="text-[13px] font-semibold text-ink">{item.degree}</p>
                        <p className="text-xs text-muted">
                          {item.school} · {item.period}
                        </p>
                      </li>
                    )}
                  </ul>
                </div>
                <div>
                  <h3 className="text-[13px] font-semibold text-ink">Langues</h3>
                  <ul className="mt-2 space-y-2">
                    {profile.languages.map((language) =>
                    <li
                      key={language.name}
                      className="flex items-center justify-between gap-3 rounded-lg border border-line px-3 py-2.5 text-[13px]">
                      
                        <span className="font-medium text-ink">{language.name}</span>
                        <span className="text-muted">{language.level}</span>
                      </li>
                    )}
                  </ul>
                </div>
              </div>
            </div>
          </Card>

          <Card id="liens">
            <CardHeader title="Liens" description="Ajoutés en en-tête du CV lorsque le modèle le permet." />
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
              {profile.links.map((link) =>
              <Input key={link.label} label={link.label} name={link.label} defaultValue={link.value} />
              )}
            </div>
            <Textarea
              className="mt-4"
              rows={3}
              label="Note pour la génération des lettres"
              defaultValue="Insister sur l’expérience design system et l’accompagnement des équipes."
              hint="Cette consigne est reprise à chaque génération de lettre de motivation." />
            
          </Card>
        </div>
      </div>
    </div>);

}