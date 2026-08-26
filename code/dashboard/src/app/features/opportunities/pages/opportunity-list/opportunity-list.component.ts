import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { OpportunityApiService } from '../../../../core/services/opportunity-api.service';
import { Opportunity, OpportunityStatus } from '../../../../core/models/opportunity.model';
import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';
import { ButtonComponent } from '../../../../shared/components/button/button.component';
import { SegmentedControlComponent, SegmentItem } from '../../../../shared/components/tabs/segmented-control.component';
import { TabsComponent, TabItem } from '../../../../shared/components/tabs/tabs.component';
import { CardComponent } from '../../../../shared/components/card/card.component';
import { StatusBadgeComponent } from '../../../../shared/components/status-badge/status-badge.component';
import { ScoreBadgeComponent } from '../../../../shared/components/score-badge/score-badge.component';
import { BadgeComponent } from '../../../../shared/components/badge/badge.component';
import { ChipComponent } from '../../../../shared/components/badge/chip.component';
import { OpportunityCardComponent } from '../../../../shared/components/opportunity-card/opportunity-card.component';
import { EmptyStateComponent } from '../../../../shared/components/feedback/empty-state.component';
import { SkeletonCardComponent, SkeletonRowComponent } from '../../../../shared/components/feedback/skeleton.component';
import { PaginationComponent } from '../../../../shared/components/pagination/pagination.component';

type ViewMode = 'cartes' | 'tableau';

@Component({
  selector: 'app-opportunity-list',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    FormsModule,
    PageHeaderComponent,
    ButtonComponent,
    SegmentedControlComponent,
    TabsComponent,
    CardComponent,
    StatusBadgeComponent,
    ScoreBadgeComponent,
    BadgeComponent,
    ChipComponent,
    OpportunityCardComponent,
    EmptyStateComponent,
    SkeletonCardComponent,
    SkeletonRowComponent,
    PaginationComponent
  ],
  templateUrl: './opportunity-list.component.html',
  styleUrl: './opportunity-list.component.css'
})
export class OpportunityListComponent implements OnInit {
  private api = inject(OpportunityApiService);

  allOpportunities: Opportunity[] = [];
  loading = true;
  error: string | null = null;

  viewMode: ViewMode = 'cartes';
  activeTab = 'toutes';
  searchQuery = '';
  scoreFilter = 'tous';
  sourceFilter = 'toutes';
  page = 1;
  readonly pageSize = 6;

  viewOptions: SegmentItem[] = [
    { id: 'cartes', label: 'Cartes', icon: 'grid' },
    { id: 'tableau', label: 'Tableau', icon: 'list' }
  ];

  get tabs(): TabItem[] {
    const total = this.allOpportunities.length;
    const nouvelles = this.allOpportunities.filter(o => o.status === OpportunityStatus.NEW).length;
    const aExaminer = this.allOpportunities.filter(o => o.status === OpportunityStatus.QUALIFIED).length;
    const pretes = this.allOpportunities.filter(o => o.status === OpportunityStatus.READY_TO_APPLY || o.status === OpportunityStatus.PREPARING).length;
    const postulees = this.allOpportunities.filter(o => o.status === OpportunityStatus.APPLIED).length;
    const ignorees = this.allOpportunities.filter(o => o.status === OpportunityStatus.IGNORED).length;

    return [
      { id: 'toutes', label: 'Toutes', count: total },
      { id: 'nouvelles', label: 'Nouvelles', count: nouvelles },
      { id: 'a_examiner', label: 'À examiner', count: aExaminer },
      { id: 'pretes', label: 'Prêtes', count: pretes },
      { id: 'postulees', label: 'Postulées', count: postulees },
      { id: 'ignorees', label: 'Ignorées', count: ignorees }
    ];
  }

  get filteredOpportunities(): Opportunity[] {
    return this.allOpportunities.filter((item) => {
      // Tab filter
      if (this.activeTab === 'nouvelles' && item.status !== OpportunityStatus.NEW) return false;
      if (this.activeTab === 'a_examiner' && item.status !== OpportunityStatus.QUALIFIED) return false;
      if (this.activeTab === 'pretes' && (item.status !== OpportunityStatus.READY_TO_APPLY && item.status !== OpportunityStatus.PREPARING)) return false;
      if (this.activeTab === 'postulees' && item.status !== OpportunityStatus.APPLIED) return false;
      if (this.activeTab === 'ignorees' && item.status !== OpportunityStatus.IGNORED) return false;

      // Query filter
      if (this.searchQuery) {
        const q = this.searchQuery.toLowerCase();
        const str = `${item.title} ${item.company} ${item.city || ''}`.toLowerCase();
        if (!str.includes(q)) return false;
      }

      // Score filter
      if (this.scoreFilter === '85' && item.score < 85) return false;
      if (this.scoreFilter === '75' && item.score < 75) return false;

      // Source filter
      if (this.sourceFilter !== 'toutes' && item.source !== this.sourceFilter) return false;

      return true;
    });
  }

  get paginatedOpportunities(): Opportunity[] {
    const start = (this.page - 1) * this.pageSize;
    return this.filteredOpportunities.slice(start, start + this.pageSize);
  }

  get totalPages(): number {
    return Math.ceil(this.filteredOpportunities.length / this.pageSize) || 1;
  }

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    this.loading = true;
    this.error = null;
    this.api.getOpportunities().subscribe({
      next: (data) => {
        this.allOpportunities = data;
        this.loading = false;
      },
      error: () => {
        this.error = 'Impossible de récupérer vos opportunités.';
        this.loading = false;
      }
    });
  }

  onTabChange(tabId: string): void {
    this.activeTab = tabId;
    this.page = 1;
  }

  onViewChange(view: string): void {
    this.viewMode = view as ViewMode;
  }

  onPageChange(p: number): void {
    this.page = p;
  }

  resetFilters(): void {
    this.searchQuery = '';
    this.scoreFilter = 'tous';
    this.sourceFilter = 'toutes';
    this.activeTab = 'toutes';
    this.page = 1;
  }

  handleDismiss(oppId: string): void {
    this.api.dismissOpportunity(oppId).subscribe({
      next: () => {
        this.allOpportunities = this.allOpportunities.filter(o => o.id !== oppId);
      }
    });
  }

  handlePrepare(oppId: string): void {
    this.api.prepareApplication(oppId).subscribe({
      next: () => {
        this.loadData();
      }
    });
  }

  getSkillsArray(opp: Opportunity): string[] {
    if (Array.isArray(opp.matchedSkills)) return opp.matchedSkills;
    if (typeof opp.matchedSkills === 'string') return (opp.matchedSkills as string).split(',').map(s => s.trim()).filter(Boolean);
    return [];
  }

  formatDate(dateStr?: string | null): string {
    if (!dateStr) return 'Récemment';
    try {
      return new Date(dateStr).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
    } catch {
      return dateStr;
    }
  }
}
