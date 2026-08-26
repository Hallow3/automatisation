import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { OpportunityApiService } from '../../../../core/services/opportunity-api.service';
import { CvApiService } from '../../../../core/services/cv-api.service';
import { Opportunity, OpportunityStatus } from '../../../../core/models/opportunity.model';
import { Cv } from '../../../../core/models/cv.model';
import { PageHeaderComponent, Crumb } from '../../../../shared/components/page-header/page-header.component';
import { ButtonComponent } from '../../../../shared/components/button/button.component';
import { CardComponent } from '../../../../shared/components/card/card.component';
import { CardHeaderComponent } from '../../../../shared/components/card/card-header.component';
import { StatusBadgeComponent } from '../../../../shared/components/status-badge/status-badge.component';
import { ScoreBadgeComponent } from '../../../../shared/components/score-badge/score-badge.component';
import { BadgeComponent } from '../../../../shared/components/badge/badge.component';
import { ChipComponent } from '../../../../shared/components/badge/chip.component';
import { AlertBannerComponent } from '../../../../shared/components/feedback/alert-banner.component';
import { EmptyStateComponent } from '../../../../shared/components/feedback/empty-state.component';
import { SkeletonComponent, SkeletonCardComponent } from '../../../../shared/components/feedback/skeleton.component';
import { ModalComponent } from '../../../../shared/components/modal/modal.component';
import { getMatchReasonLabel } from '../../../../core/utils/ui-mapping';

@Component({
  selector: 'app-opportunity-detail',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    FormsModule,
    PageHeaderComponent,
    ButtonComponent,
    CardComponent,
    CardHeaderComponent,
    StatusBadgeComponent,
    ScoreBadgeComponent,
    BadgeComponent,
    ChipComponent,
    AlertBannerComponent,
    EmptyStateComponent,
    SkeletonComponent,
    SkeletonCardComponent,
    ModalComponent
  ],
  templateUrl: './opportunity-detail.component.html',
  styleUrl: './opportunity-detail.component.css'
})
export class OpportunityDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private api = inject(OpportunityApiService);
  private cvApi = inject(CvApiService);

  opportunity?: Opportunity;
  cvs: Cv[] = [];
  selectedCvId: string = '';
  decisionNotes: string = '';
  
  loading = true;
  error: string | null = null;
  actionLoading = false;

  cvModalOpen = false;
  letterModalOpen = false;
  coverLetterContent: string = '';
  coverLetterLoading = false;

  readonly OpportunityStatus = OpportunityStatus;

  get breadcrumbs(): Crumb[] {
    return [
      { label: 'Opportunités', to: '/opportunities' },
      { label: this.opportunity?.company || 'Détail' }
    ];
  }

  get skillsList(): string[] {
    if (!this.opportunity) return [];
    if (Array.isArray(this.opportunity.matchedSkills)) return this.opportunity.matchedSkills;
    if (typeof this.opportunity.matchedSkills === 'string') {
      return (this.opportunity.matchedSkills as string).split(',').map(s => s.trim()).filter(Boolean);
    }
    return [];
  }

  get availableCvs(): Cv[] {
    return this.cvs;
  }

  get matchExplanationText(): string {
    return getMatchReasonLabel(this.opportunity?.matchExplanation);
  }

  get selectedCvTitle(): string {
    const found = this.cvs.find(c => c.id === this.selectedCvId);
    return found?.title || 'CV Professionnel';
  }

  get selectedCvTemplate(): string {
    const found = this.cvs.find(c => c.id === this.selectedCvId);
    return found?.templateLabel || found?.template || 'Moderne';
  }

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.loadData(id);
      this.loadCvs();
    } else {
      this.error = "Identifiant d'opportunité introuvable.";
      this.loading = false;
    }
  }

  loadData(id: string): void {
    this.api.getOpportunity(id).subscribe({
      next: (data) => {
        if (data) {
          this.opportunity = data;
        } else {
          this.error = "Cette opportunité n'existe pas ou n'est plus disponible.";
        }
        this.loading = false;
      },
      error: () => {
        this.error = 'Erreur lors de la récupération des détails.';
        this.loading = false;
      }
    });
  }

  loadCvs(): void {
    this.cvApi.getCvs().subscribe({
      next: (cvs) => {
        this.cvs = cvs;
        if (cvs.length > 0) {
          this.selectedCvId = cvs[0].id;
        }
      }
    });
  }

  openCvSelectModal(): void {
    this.cvModalOpen = true;
  }

  closeCvSelectModal(): void {
    this.cvModalOpen = false;
  }

  selectCv(id: string): void {
    this.selectedCvId = id;
    this.closeCvSelectModal();
  }

  saveNotes(): void {
    // Local persistence / notification
  }

  viewOrGenerateLetter(): void {
    if (!this.opportunity) return;
    this.letterModalOpen = true;
    this.coverLetterLoading = true;

    this.api.getCoverLetter(this.opportunity.id).subscribe({
      next: (res) => {
        this.coverLetterContent = `Madame, Monsieur,\n\nVivement intéressé(e) par le poste de ${this.opportunity?.title} au sein de ${this.opportunity?.company}, je vous adresse ma candidature.\n\nMon parcours technique et mes réalisations passées sont en adéquation avec vos besoins.\n\nRestant à votre disposition pour un entretien,\n\nCordialement.`;
        this.coverLetterLoading = false;
      },
      error: () => {
        this.coverLetterContent = `Madame, Monsieur,\n\nVivement intéressé(e) par le poste de ${this.opportunity?.title} au sein de ${this.opportunity?.company}, je me permets de vous adresser ma candidature.\n\nMon parcours et mes compétences correspondent aux exigences de votre offre.\n\nRestant à votre entière disposition pour un entretien,\n\nCordialement.`;
        this.coverLetterLoading = false;
      }
    });
  }

  closeLetterModal(): void {
    this.letterModalOpen = false;
  }

  prepareApplication(): void {
    if (!this.opportunity) return;
    this.actionLoading = true;
    this.api.prepareApplication(this.opportunity.id).subscribe({
      next: () => {
        this.actionLoading = false;
        if (this.opportunity) {
          this.opportunity.status = OpportunityStatus.READY_TO_APPLY;
          this.opportunity.coverLetterAvailable = true;
        }
      },
      error: () => { this.actionLoading = false; }
    });
  }

  submitApplication(): void {
    if (!this.opportunity) return;
    this.actionLoading = true;
    this.api.submitApplication(this.opportunity.id).subscribe({
      next: () => {
        this.actionLoading = false;
        if (this.opportunity) this.opportunity.status = OpportunityStatus.APPLIED;
      },
      error: () => { this.actionLoading = false; }
    });
  }

  dismiss(): void {
    if (!this.opportunity) return;
    this.actionLoading = true;
    this.api.dismissOpportunity(this.opportunity.id).subscribe({
      next: () => this.router.navigate(['/opportunities']),
      error: () => { this.actionLoading = false; }
    });
  }

  formatDate(dateStr?: string | null): string {
    if (!dateStr) return '21 août 2026';
    try {
      return new Date(dateStr).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
    } catch {
      return dateStr;
    }
  }
}
