import React, { useState } from 'react';
import {
  BriefcaseIcon,
  CalendarCheckIcon,
  CheckCircle2Icon,
  FileTextIcon,
  SendIcon,
  SparklesIcon } from
'lucide-react';
import { PageHeader } from '../components/layout/PageHeader';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Tabs } from '../components/ui/Tabs';
import { activity } from '../data/activity';

const icons = {
  opportunite: BriefcaseIcon,
  cv: FileTextIcon,
  lettre: SparklesIcon,
  candidature: SendIcon,
  entretien: CalendarCheckIcon
} as const;

const tabs = [
{ id: 'tout', label: 'Tout', count: activity.length },
{ id: 'auto', label: 'Automatique', count: activity.filter((item) => item.automated).length },
{ id: 'manuel', label: 'Vos actions', count: activity.filter((item) => !item.automated).length }];


export function ActivityPage() {
  const [tab, setTab] = useState('tout');
  const items = activity.filter((item) =>
  tab === 'tout' ? true : tab === 'auto' ? item.automated : !item.automated
  );

  return (
    <div>
      <PageHeader
        title="Activité"
        description="Historique complet : ce que le système a fait automatiquement et ce que vous avez validé." />
      

      <Card padded={false} className="overflow-hidden">
        <div className="px-3 pt-1">
          <Tabs items={tabs} value={tab} onChange={setTab} />
        </div>
        <ol className="divide-y divide-line">
          {items.map((item) => {
            const Icon = icons[item.type];
            return (
              <li key={item.id} className="flex items-start gap-3 px-4 py-3.5">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-line bg-slate-50">
                  <Icon className="h-4 w-4 text-muted" />
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
    </div>);

}