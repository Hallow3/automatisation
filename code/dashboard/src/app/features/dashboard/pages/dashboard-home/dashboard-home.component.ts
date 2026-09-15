import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { OpportunityApiService } from '../../../../core/services/opportunity-api.service';
import { ApplicationApiService } from '../../../../core/services/application-api.service';
import { AuthService } from '../../../../core/services/auth.service';
import { PaymentService } from '../../../../core/services/payment.service';
import { Opportunity } from '../../../../core/models/opportunity.model';
import { Application } from '../../../../core/models/application.model';

interface RecentAppItem {
  id: string;
  initial: string;
  initialBg: string;
  title: string;
  company: string;
  city: string;
  status: 'Entretien' | 'En attente' | 'Refusée' | 'Envoyée';
  statusClass: string;
  timeAgo: string;
  opportunityId?: string;
}

interface RecommendedJob {
  id: string;
  initial: string;
  gradient: string;
  title: string;
  company: string;
  city: string;
  score: number;
  tags: string[];
}

@Component({
  selector: 'app-dashboard-home',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './dashboard-home.component.html',
  styleUrl: './dashboard-home.component.css'
})
export class DashboardHomeComponent implements OnInit {
  private opportunityApi = inject(OpportunityApiService);
  private applicationApi = inject(ApplicationApiService);
  public authService = inject(AuthService);
  public paymentService = inject(PaymentService);
  private router = inject(Router);

  startVoiceInterview(): void {
    const credits = this.authService.currentUser()?.proCredits ?? 0;
    if (credits < 1) {
      this.paymentService.openPackModal();
      return;
    }
    this.router.navigate(['/cvs/interview']);
  }

  private readonly SENT_STATUSES = new Set(['APPLIED', 'SUBMITTED', 'INTERVIEW', 'REJECTED', 'OFFER']);
  private readonly PENDING_STATUSES = new Set(['PENDING', 'DRAFT', 'READY']);

  loading = true;
  opportunities: Opportunity[] = [];
  applications: Application[] = [];

  sentCount = 0;
  pendingCount = 0;
  interviewCount = 0;
  averageScore = 0;

  chartDays = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
  sentSeries = [0, 0, 0, 0, 0, 0, 0];
  replySeries = [0, 0, 0, 0, 0, 0, 0];

  recentApps: RecentAppItem[] = [];
  recommendedJobs: RecommendedJob[] = [];

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    this.loading = true;
    forkJoin({
      opps: this.opportunityApi.getOpportunities(),
      apps: this.applicationApi.getApplications()
    }).subscribe({
      next: ({ opps, apps }) => {
        this.opportunities = opps || [];
        if (this.opportunities.length > 0) {
          const sumScore = this.opportunities.reduce((acc, o) => acc + (o.score || 70), 0);
          this.averageScore = Math.round(sumScore / this.opportunities.length);
          const topOpps = [...this.opportunities].sort((a, b) => (b.score || 0) - (a.score || 0)).slice(0, 3);
          this.recommendedJobs = topOpps.map((o, idx) => ({
            id: o.id,
            initial: o.company ? o.company[0].toUpperCase() : 'O',
            gradient: idx === 0 ? 'from-brand-500 to-brand-700' : idx === 1 ? 'from-brand-400 to-brand-600' : 'from-brand-600 to-brand-800',
            title: o.title,
            company: o.company || 'Entreprise',
            city: o.city || 'Télétravail',
            score: o.score || 85,
            tags: Array.isArray(o.matchedSkills) && o.matchedSkills.length > 0 ? o.matchedSkills.slice(0, 2) : ['Offre', 'Qualifiée']
          }));
        } else {
          this.averageScore = 0;
          this.recommendedJobs = [];
        }

        this.applications = apps || [];
        this.sentCount = this.applications.filter(a => this.SENT_STATUSES.has(a.status)).length;
        this.pendingCount = this.applications.filter(a => this.PENDING_STATUSES.has(a.status)).length;
        this.interviewCount = this.applications.filter(a => a.status === 'INTERVIEW').length;
        this.recentApps = this.applications.slice(0, 5).map((app, idx) => ({
          id: app.id,
          initial: app.company ? app.company[0].toUpperCase() : 'C',
          initialBg: idx % 2 === 0 ? 'bg-gradient-to-br from-brand-500 to-brand-700 text-white' : 'bg-brand-100 text-brand-700',
          title: app.title || 'Candidature',
          company: app.company || 'Entreprise',
          city: 'Postulé en ligne',
          status: this.mapStatusLabel(app.status),
          statusClass: this.mapStatusClass(app.status),
          timeAgo: app.appliedAt ? 'Récemment' : "Aujourd'hui",
          opportunityId: app.opportunityId
        }));

        this.loading = false;
      },
      error: () => {
        this.loading = false;
      }
    });
  }

  private mapStatusLabel(status: string): 'Entretien' | 'En attente' | 'Refusée' | 'Envoyée' {
    switch (status) {
      case 'INTERVIEW': return 'Entretien';
      case 'REJECTED': return 'Refusée';
      case 'APPLIED':
      case 'SUBMITTED': return 'Envoyée';
      default: return 'En attente';
    }
  }

  private mapStatusClass(status: string): string {
    switch (status) {
      case 'INTERVIEW': return 'text-brand-700 bg-brand-100';
      case 'REJECTED': return 'text-rose-700 bg-rose-50';
      case 'APPLIED':
      case 'SUBMITTED': return 'text-emerald-700 bg-emerald-50';
      default: return 'text-amber-700 bg-amber-50';
    }
  }
}
