import React, { useState } from 'react';
import { CheckCircle2Icon, PlugIcon, SaveIcon } from 'lucide-react';
import { PageHeader } from '../components/layout/PageHeader';
import { Card, CardHeader } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Input, Select, Toggle } from '../components/ui/Field';
import { Tabs } from '../components/ui/Tabs';
import { useScreenInit } from '../useScreenInit.js';

const tabs = [
{ id: 'compte', label: 'Compte' },
{ id: 'notifications', label: 'Notifications' },
{ id: 'automatisation', label: 'Automatisation' },
{ id: 'sources', label: 'Sources' },
{ id: 'documents', label: 'Documents' },
{ id: 'confidentialite', label: 'Confidentialité' }];


const sources = [
{ name: 'LinkedIn', status: 'Connectée', detail: 'Dernière synchronisation il y a 12 min', connected: true },
{ name: 'Indeed', status: 'Connectée', detail: 'Dernière synchronisation il y a 1 h', connected: true },
{ name: 'Welcome to the Jungle', status: 'Connectée', detail: 'Dernière synchronisation il y a 3 h', connected: true },
{ name: 'APEC', status: 'Non connectée', detail: 'Connexion requise pour importer les offres', connected: false }];


export function Settings() {
  const screenInit = useScreenInit();
  const [tab, setTab] = useState(screenInit.tab ?? 'compte');
  const [toggles, setToggles] = useState({
    emailDaily: true,
    emailInstant: false,
    autoLetter: true,
    autoQualify: true,
    autoSend: false,
    anonymise: true
  });

  const setToggle = (key: keyof typeof toggles) => (value: boolean) =>
  setToggles((prev) => ({ ...prev, [key]: value }));

  return (
    <div>
      <PageHeader
        title="Paramètres"
        description="Configuration du compte, des automatisations et des sources de recherche."
        actions={
        <Button variant="primary" icon={SaveIcon}>
            Enregistrer
          </Button>
        } />
      

      <Card padded={false} className="overflow-hidden">
        <div className="px-3 pt-1">
          <Tabs items={tabs} value={tab} onChange={setTab} />
        </div>

        <div className="p-4">
          {tab === 'compte' ?
          <div className="max-w-2xl space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Input label="Nom affiché" name="displayName" defaultValue="Léa Bertrand" />
                <Input label="Email de connexion" name="loginEmail" type="email" defaultValue="lea.bertrand@email.fr" />
                <Select
                label="Langue de l’interface"
                name="language"
                options={[
                { value: 'fr', label: 'Français' },
                { value: 'en', label: 'English' }]
                } />
              
                <Select
                label="Fuseau horaire"
                name="timezone"
                options={[
                { value: 'paris', label: 'Europe / Paris (UTC+2)' },
                { value: 'bruxelles', label: 'Europe / Bruxelles (UTC+2)' }]
                } />
              
              </div>
              <div className="rounded-lg border border-line p-3.5">
                <p className="text-[13px] font-semibold text-ink">Mot de passe</p>
                <p className="mt-0.5 text-[13px] text-muted">Dernière modification le 12 mai 2026.</p>
                <Button size="sm" className="mt-2.5">
                  Modifier le mot de passe
                </Button>
              </div>
            </div> :
          tab === 'notifications' ?
          <div className="max-w-2xl divide-y divide-line">
              <Toggle
              label="Résumé quotidien par email"
              description="Un email chaque matin avec les opportunités qualifiées de la veille."
              checked={toggles.emailDaily}
              onChange={setToggle('emailDaily')} />
            
              <Toggle
              label="Alerte immédiate sur score élevé"
              description="Notification dès qu’une offre dépasse 90 % de correspondance."
              checked={toggles.emailInstant}
              onChange={setToggle('emailInstant')} />
            
              <div className="pt-3">
                <Select
                label="Fréquence des rappels de relance"
                name="reminder"
                options={[
                { value: '7', label: 'Après 7 jours sans réponse' },
                { value: '10', label: 'Après 10 jours sans réponse' },
                { value: 'never', label: 'Jamais' }]
                } />
              
              </div>
            </div> :
          tab === 'automatisation' ?
          <div className="max-w-2xl divide-y divide-line">
              <Toggle
              label="Qualifier automatiquement les offres"
              description="Calcul du score et de l’explication dès l’import de l’offre."
              checked={toggles.autoQualify}
              onChange={setToggle('autoQualify')} />
            
              <Toggle
              label="Générer la lettre pour les offres qualifiées"
              description="La lettre est préparée à l’avance, mais jamais envoyée automatiquement."
              checked={toggles.autoLetter}
              onChange={setToggle('autoLetter')} />
            
              <Toggle
              label="Envoi automatique des candidatures"
              description="Déconseillé : l’envoi resterait sans relecture de votre part."
              checked={toggles.autoSend}
              onChange={setToggle('autoSend')} />
            
              <div className="pt-3">
                <Select
                label="Score minimum pour la préparation automatique"
                name="minScore"
                defaultValue="80"
                options={[
                { value: '70', label: '70 %' },
                { value: '80', label: '80 %' },
                { value: '90', label: '90 %' }]
                } />
              
              </div>
            </div> :
          tab === 'sources' ?
          <ul className="max-w-2xl divide-y divide-line">
              {sources.map((source) =>
            <li key={source.name} className="flex items-center justify-between gap-4 py-3">
                  <div className="flex min-w-0 items-start gap-3">
                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-line bg-slate-50">
                      <PlugIcon className="h-4 w-4 text-muted" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-[13px] font-medium text-ink">{source.name}</p>
                      <p className="text-xs text-muted">{source.detail}</p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {source.connected ?
                <Badge tone="success">
                        <CheckCircle2Icon className="h-3 w-3" />
                        {source.status}
                      </Badge> :

                <Badge>{source.status}</Badge>
                }
                    <Button size="sm" variant={source.connected ? 'secondary' : 'primary'}>
                      {source.connected ? 'Gérer' : 'Connecter'}
                    </Button>
                  </div>
                </li>
            )}
            </ul> :
          tab === 'documents' ?
          <div className="max-w-2xl space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Select
                label="Modèle de CV par défaut"
                name="defaultTemplate"
                options={[
                { value: 'rigueur', label: 'Rigueur' },
                { value: 'colonne', label: 'Colonne' },
                { value: 'compact', label: 'Compact' },
                { value: 'editorial', label: 'Éditorial' }]
                } />
              
                <Select
                label="Format d’export"
                name="exportFormat"
                options={[
                { value: 'pdf', label: 'PDF (recommandé)' },
                { value: 'docx', label: 'DOCX' }]
                } />
              
                <Input label="Nom de fichier" name="filename" defaultValue="CV_Lea_Bertrand_{poste}" />
                <Select
                label="Ton des lettres de motivation"
                name="tone"
                options={[
                { value: 'professionnel', label: 'Professionnel' },
                { value: 'direct', label: 'Direct' },
                { value: 'chaleureux', label: 'Chaleureux' }]
                } />
              
              </div>
            </div> :

          <div className="max-w-2xl divide-y divide-line">
              <Toggle
              label="Anonymiser les données envoyées au moteur d’analyse"
              description="Les coordonnées sont retirées avant l’analyse des offres."
              checked={toggles.anonymise}
              onChange={setToggle('anonymise')} />
            
              <div className="py-3">
                <p className="text-sm font-medium text-ink">Export de vos données</p>
                <p className="mt-0.5 text-[13px] text-muted">
                  Recevez une archive contenant vos CV, candidatures et notes.
                </p>
                <Button size="sm" className="mt-2.5">
                  Demander un export
                </Button>
              </div>
              <div className="py-3">
                <p className="text-sm font-medium text-ink">Supprimer le compte</p>
                <p className="mt-0.5 text-[13px] text-muted">
                  Cette action supprime définitivement vos documents et votre historique.
                </p>
                <Button size="sm" variant="destructive" className="mt-2.5">
                  Supprimer mon compte
                </Button>
              </div>
            </div>
          }
        </div>
      </Card>
    </div>);

}