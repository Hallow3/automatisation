import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { CardComponent } from '../../shared/components/card/card.component';
import { TabsComponent, TabItem } from '../../shared/components/tabs/tabs.component';
import { BadgeComponent } from '../../shared/components/badge/badge.component';
import { EmptyStateComponent } from '../../shared/components/feedback/empty-state.component';
import { ApplicationApiService } from '../../core/services/application-api.service';
import { OpportunityApiService } from '../../core/services/opportunity-api.service';

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
    BadgeComponent,
    EmptyStateComponent
  ],
  templateUrl: './activity.component.html',
  styleUrl: './activity.component.css'
})
export class ActivityComponent implements OnInit {
  private applicationApi = inject(ApplicationApiService);
  private opportunityApi = inject(OpportunityApiService);

  activeTab = 'tout';
  loading = true;

  tabs: TabItem[] = [
    { id: 'tout', label: 'Tout l’historique' },
    { id: 'auto', label: 'Automatique' },
    { id: 'manuel', label: 'Vos actions' }
  ];

  records: ActivityRecord[] = [];

  ngOnInit(): void {
    this.loadActivities();
  }

  loadActivities(): void {
    this.loading = true;
    this.applicationApi.getApplications().subscribe({
      next: (apps) => {
        const appRecords: ActivityRecord[] = (apps || []).map(app => ({
          id: `app-${app.id}`,
          type: app.status === 'INTERVIEW' ? 'entretien' : 'candidature',
          title: app.status === 'INTERVIEW' ? `Entretien obtenu : ${app.company}` : `Candidature : ${app.title || app.company}`,
          detail: `Statut : ${app.status} · Entreprise : ${app.company || 'Non précisée'}`,
          time: app.appliedAt ? new Date(app.appliedAt).toLocaleDateString('fr-FR') : 'Récemment',
          automated: false
        }));

        this.opportunityApi.getOpportunities().subscribe({
          next: (opps) => {
            const oppRecords: ActivityRecord[] = (opps || []).slice(0, 5).map(opp => ({
              id: `opp-${opp.id}`,
              type: 'opportunite',
              title: `Opportunité qualifiée : ${opp.title}`,
              detail: `${opp.company} · Score de correspondance ${opp.score || 80}%`,
              time: 'Récemment',
              automated: true
            }));

            this.records = [...appRecords, ...oppRecords];
            this.loading = false;
          },
          error: () => {
            this.records = [...appRecords];
            this.loading = false;
          }
        });
      },
      error: () => {
        this.loading = false;
      }
    });
  }

  get filteredRecords(): ActivityRecord[] {
    if (this.activeTab === 'auto') return this.records.filter(r => r.automated);
    if (this.activeTab === 'manuel') return this.records.filter(r => !r.automated);
    return this.records;
  }

  setTab(tabId: string): void {
    this.activeTab = tabId;
  }
}
