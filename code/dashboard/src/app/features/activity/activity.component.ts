import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { CardComponent } from '../../shared/components/card/card.component';
import { TabsComponent, TabItem } from '../../shared/components/tabs/tabs.component';
import { BadgeComponent } from '../../shared/components/badge/badge.component';

interface ActivityRecord {
  id: string;
  type: 'opportunite' | 'lettre' | 'candidature' | 'entretien';
  title: string;
  detail: string;
  time: string;
  automated: boolean;
}

@Component({
  selector: 'app-activity',
  standalone: true,
  imports: [
    CommonModule,
    PageHeaderComponent,
    CardComponent,
    TabsComponent,
    BadgeComponent
  ],
  templateUrl: './activity.component.html',
  styleUrl: './activity.component.css'
})
export class ActivityComponent {
  activeTab = 'tout';

  tabs: TabItem[] = [
    { id: 'tout', label: 'Tout l’historique' },
    { id: 'auto', label: 'Automatique' },
    { id: 'manuel', label: 'Vos actions' }
  ];

  records: ActivityRecord[] = [
    {
      id: 'r1',
      type: 'opportunite',
      title: '7 nouvelles opportunités qualifiées',
      detail: 'Recherche Full-Stack & Frontend · LinkedIn & Indeed',
      time: 'Aujourd’hui à 09:42',
      automated: true
    },
    {
      id: 'r2',
      type: 'lettre',
      title: 'Lettre de motivation générée',
      detail: 'Préparée pour l’offre Lead Developer - FinTech',
      time: 'Aujourd’hui à 08:54',
      automated: true
    },
    {
      id: 'r3',
      type: 'candidature',
      title: 'Candidature marquée comme prête',
      detail: 'Dossier validé et prêt à l’envoi',
      time: 'Hier à 16:30',
      automated: false
    },
    {
      id: 'r4',
      type: 'entretien',
      title: 'Entretien confirmé',
      detail: 'Premier échange technique planifié',
      time: 'Hier à 11:15',
      automated: false
    },
    {
      id: 'r5',
      type: 'opportunite',
      title: 'Synchronisation des scrapers effectuée',
      detail: '14 offres analysées sur 4 plateformes',
      time: 'Hier à 08:00',
      automated: true
    }
  ];

  get filteredRecords(): ActivityRecord[] {
    if (this.activeTab === 'auto') return this.records.filter(r => r.automated);
    if (this.activeTab === 'manuel') return this.records.filter(r => !r.automated);
    return this.records;
  }

  setTab(tabId: string): void {
    this.activeTab = tabId;
  }
}
