import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  CopyIcon,
  DownloadIcon,
  FileTextIcon,
  MoreHorizontalIcon,
  PencilIcon,
  PlusIcon,
  Trash2Icon } from
'lucide-react';
import { PageHeader } from '../components/layout/PageHeader';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { EmptyState, Skeleton } from '../components/ui/Feedback';
import { Modal } from '../components/ui/Modal';
import { Input } from '../components/ui/Field';
import { CvThumbnail } from '../components/cv/CvThumbnail';
import { cvs, cvTemplates } from '../data/cvs';

export function CvList({ loading = false }: {loading?: boolean;}) {
  const [menuId, setMenuId] = useState<string | null>(null);
  const [renameId, setRenameId] = useState<string | null>(null);

  const renaming = cvs.find((item) => item.id === renameId);

  return (
    <div>
      <PageHeader
        title="Mes CV"
        description="Vos versions de CV, réutilisables pour chaque candidature. Une version par cible de poste reste la méthode la plus efficace."
        actions={
        <>
            <Link
            to="/cv/modeles"
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-line-strong bg-white px-3.5 text-sm font-medium text-ink-soft transition-colors duration-150 ease-out hover:bg-slate-50">
            
              Choisir un modèle
            </Link>
            <Link
            to="/cv/entretien"
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-brand-600 bg-brand-600 px-3.5 text-sm font-medium text-white transition-colors duration-150 ease-out hover:bg-brand-700">
            
              <PlusIcon className="h-4 w-4" />
              Créer un nouveau CV
            </Link>
          </>
        } />
      

      {loading ?
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) =>
        <div key={index} className="rounded-xl border border-line bg-surface p-3 shadow-card">
              <Skeleton className="aspect-[1/1.414] w-full rounded" />
              <Skeleton className="mt-3 h-3.5 w-3/4" />
              <Skeleton className="mt-2 h-3 w-1/2" />
            </div>
        )}
        </div> :
      cvs.length === 0 ?
      <EmptyState
        icon={FileTextIcon}
        title="Aucun CV pour le moment"
        description="Créez votre premier CV en répondant à quelques questions à l’oral. Le contenu est ensuite modifiable."
        actionLabel="Créer mon premier CV" /> :


      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {cvs.map((cv) => {
          const template = cvTemplates.find((item) => item.name === cv.template) ?? cvTemplates[0];
          return (
            <Card key={cv.id} padded={false} className="flex flex-col overflow-visible">
                <div className="border-b border-line bg-slate-50/70 p-3">
                  <CvThumbnail layout={template.layout} accent={cv.accent} />
                </div>
                <div className="flex flex-1 flex-col p-3.5">
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="text-[14px] font-semibold leading-snug tracking-[-0.01em] text-ink">{cv.title}</h2>
                    <div className="relative shrink-0">
                      <button
                      type="button"
                      aria-label={`Actions pour ${cv.title}`}
                      onClick={() => setMenuId(menuId === cv.id ? null : cv.id)}
                      className="rounded p-1 text-muted transition-colors duration-150 ease-out hover:bg-slate-100 hover:text-ink">
                      
                        <MoreHorizontalIcon className="h-4 w-4" />
                      </button>
                      {menuId === cv.id ?
                    <div className="absolute right-0 top-8 z-20 w-52 overflow-hidden rounded-lg border border-line bg-surface py-1 shadow-pop">
                          {[
                      { label: 'Télécharger le PDF', icon: DownloadIcon },
                      { label: 'Renommer', icon: PencilIcon, action: () => setRenameId(cv.id) },
                      { label: 'Dupliquer', icon: CopyIcon },
                      { label: 'Utiliser pour une offre', icon: FileTextIcon }].
                      map((item) => {
                        const Icon = item.icon;
                        return (
                          <button
                            key={item.label}
                            type="button"
                            onClick={() => {
                              item.action?.();
                              setMenuId(null);
                            }}
                            className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-ink-soft transition-colors duration-150 ease-out hover:bg-slate-50">
                            
                                <Icon className="h-3.5 w-3.5 text-muted" />
                                {item.label}
                              </button>);

                      })}
                          <button
                        type="button"
                        onClick={() => setMenuId(null)}
                        className="flex w-full items-center gap-2 border-t border-line px-3 py-2 text-left text-[13px] text-red-600 transition-colors duration-150 ease-out hover:bg-red-50">
                        
                            <Trash2Icon className="h-3.5 w-3.5" />
                            Supprimer
                          </button>
                        </div> :
                    null}
                    </div>
                  </div>

                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <Badge>{cv.template}</Badge>
                    <Badge>{cv.pages} pages</Badge>
                    {cv.isDefault ? <Badge tone="brand">Par défaut</Badge> : null}
                  </div>

                  <p className="mt-2 text-xs text-muted">
                    Créé le {cv.createdAt}
                    <br />
                    Mis à jour le {cv.updatedAt} · {cv.usedIn} candidatures
                  </p>

                  <div className="mt-auto flex items-center gap-1.5 pt-3.5">
                    <Link
                    to="/cv/editeur"
                    className="inline-flex h-8 flex-1 items-center justify-center rounded-lg border border-line-strong bg-white px-2.5 text-[13px] font-medium text-ink-soft transition-colors duration-150 ease-out hover:bg-slate-50">
                    
                      Ouvrir
                    </Link>
                    <Button variant="primary" size="sm" className="flex-1">
                      Utiliser
                    </Button>
                  </div>
                </div>
              </Card>);

        })}
        </div>
      }

      <Modal
        open={Boolean(renameId)}
        onClose={() => setRenameId(null)}
        title="Renommer le CV"
        description="Le nom est visible uniquement dans votre espace."
        footer={
        <>
            <Button onClick={() => setRenameId(null)}>Annuler</Button>
            <Button variant="primary" onClick={() => setRenameId(null)}>
              Enregistrer
            </Button>
          </>
        }>
        
        <Input label="Nom du CV" defaultValue={renaming?.title} name="cv-name" />
      </Modal>
    </div>);

}