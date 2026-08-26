import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ApplicationApiService } from '../../../../core/services/application-api.service';
import { Application } from '../../../../core/models/application.model';
import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';
import { ButtonComponent } from '../../../../shared/components/button/button.component';
import { SegmentedControlComponent, SegmentItem } from '../../../../shared/components/tabs/segmented-control.component';
import { CardComponent } from '../../../../shared/components/card/card.component';
import { StatusBadgeComponent } from '../../../../shared/components/status-badge/status-badge.component';
import { ScoreBadgeComponent } from '../../../../shared/components/score-badge/score-badge.component';
import { BadgeComponent } from '../../../../shared/components/badge/badge.component';
import { EmptyStateComponent } from '../../../../shared/components/feedback/empty-state.component';

type ViewMode = 'tableau' | 'pipeline';

interface PipelineColumn {
  id: string;
  label: string;
}

@Component({
  selector: 'app-application-list',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    FormsModule,
    PageHeaderComponent,
    ButtonComponent,
    SegmentedControlComponent,
    CardComponent,
    StatusBadgeComponent,
    ScoreBadgeComponent,
    BadgeComponent,
    EmptyStateComponent
  ],
  templateUrl: './application-list.component.html',
  styleUrl: './application-list.component.css'
})
export class ApplicationListComponent implements OnInit {
  private applicationApi = inject(ApplicationApiService);

  applications: Application[] = [];
  loading = true;
  error: string | null = null;

  viewMode: ViewMode = 'tableau';
  searchQuery = '';
  statusFilter = 'tous';
  sourceFilter = 'toutes';
  periodFilter = '30';

  viewOptions: SegmentItem[] = [
    { id: 'tableau', label: 'Tableau', icon: 'list' },
    { id: 'pipeline', label: 'Pipeline', icon: 'grid' }
  ];

  columns: PipelineColumn[] = [
    { id: 'brouillon', label: 'Brouillon' },
    { id: 'qualifiee', label: 'Qualifiée' },
    { id: 'prete', label: 'Prête' },
    { id: 'envoyee', label: 'Envoyée' },
    { id: 'reponse', label: 'Réponse reçue' },
    { id: 'entretien', label: 'Entretien' },
    { id: 'cloturee', label: 'Clôturée' }
  ];

  get filteredApplications(): Application[] {
    return this.applications.filter((item) => {
      if (this.searchQuery) {
        const q = this.searchQuery.toLowerCase();
        const str = `${item.title} ${item.company}`.toLowerCase();
        if (!str.includes(q)) return false;
      }
      if (this.statusFilter !== 'tous' && item.status.toLowerCase() !== this.statusFilter.toLowerCase()) {
        return false;
      }
      return true;
    });
  }

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    this.loading = true;
    this.error = null;
    this.applicationApi.getApplications().subscribe({
      next: (apps) => {
        this.applications = apps;
        this.loading = false;
      },
      error: () => {
        this.error = 'Impossible de charger vos candidatures.';
        this.loading = false;
      }
    });
  }

  onViewChange(view: string): void {
    this.viewMode = view as ViewMode;
  }

  resetFilters(): void {
    this.searchQuery = '';
    this.statusFilter = 'tous';
    this.sourceFilter = 'toutes';
    this.periodFilter = '30';
  }

  getItemsForColumn(columnId: string): Application[] {
    return this.filteredApplications.filter(item => {
      const s = item.status.toLowerCase();
      if (columnId === 'brouillon') return s === 'draft' || s === 'brouillon';
      if (columnId === 'qualifiee') return s === 'qualified' || s === 'qualifiee';
      if (columnId === 'prete') return s === 'ready_to_apply' || s === 'prete' || s === 'preparing';
      if (columnId === 'envoyee') return s === 'applied' || s === 'envoyee' || s === 'submitted';
      if (columnId === 'reponse') return s === 'answered' || s === 'reponse';
      if (columnId === 'entretien') return s === 'interview' || s === 'entretien';
      if (columnId === 'cloturee') return s === 'closed' || s === 'rejected' || s === 'cloturee';
      return false;
    });
  }

  getAppsByColumn(columnId: string): Application[] {
    return this.getItemsForColumn(columnId);
  }

  formatDate(dateStr?: string): string {
    if (!dateStr) return '-';
    try {
      return new Date(dateStr).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
    } catch {
      return dateStr;
    }
  }
}
