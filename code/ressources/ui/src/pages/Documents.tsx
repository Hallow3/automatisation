import React from 'react';
import { DownloadIcon, FileTextIcon, MailIcon } from 'lucide-react';
import { PageHeader } from '../components/layout/PageHeader';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { EmptyState } from '../components/ui/Feedback';

const documents = [
{ id: 'doc-1', name: 'Lettre — Alvéa Technologies', type: 'Lettre', date: '21 août 2026', status: 'Prête' },
{ id: 'doc-2', name: 'CV Design System — 2026', type: 'CV', date: '20 août 2026', status: 'Prête' },
{ id: 'doc-3', name: 'Lettre — Sillage', type: 'Lettre', date: '18 août 2026', status: 'Envoyée' },
{ id: 'doc-4', name: 'Lettre — Kaptio', type: 'Lettre', date: '20 août 2026', status: 'En génération' },
{ id: 'doc-5', name: 'CV Senior — Architecture', type: 'CV', date: '16 août 2026', status: 'Prête' }];


export function Documents() {
  return (
    <div>
      <PageHeader
        title="Documents"
        description="Tous les CV et lettres générés, classés par date de création."
        actions={<Button icon={DownloadIcon}>Tout télécharger</Button>} />
      

      {documents.length === 0 ?
      <EmptyState
        icon={FileTextIcon}
        title="Aucun document généré"
        description="Les CV et lettres apparaîtront ici dès qu’une candidature sera préparée."
        actionLabel="Voir les opportunités" /> :


      <Card padded={false} className="overflow-hidden">
          <ul className="divide-y divide-line">
            {documents.map((document) =>
          <li key={document.id} className="flex items-center justify-between gap-4 px-4 py-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-line bg-slate-50">
                    {document.type === 'CV' ?
                <FileTextIcon className="h-4 w-4 text-muted" /> :

                <MailIcon className="h-4 w-4 text-muted" />
                }
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-medium text-ink">{document.name}</p>
                    <p className="text-xs text-muted">
                      {document.type} · {document.date}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge
                tone={
                document.status === 'Envoyée' ? 'success' : document.status === 'Prête' ? 'brand' : 'warning'
                }>
                
                    {document.status}
                  </Badge>
                  <Button size="sm" icon={DownloadIcon} aria-label={`Télécharger ${document.name}`} />
                </div>
              </li>
          )}
          </ul>
        </Card>
      }
    </div>);

}