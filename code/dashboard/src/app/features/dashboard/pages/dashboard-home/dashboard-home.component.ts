import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { OpportunityApiService } from '../../../../core/services/opportunity-api.service';
import { ApplicationApiService } from '../../../../core/services/application-api.service';
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

  loading = true;
  opportunities: Opportunity[] = [];
  applications: Application[] = [];

  // Stats
  sentCount = 42;
  pendingCount = 15;
  interviewCount = 7;
  averageScore = 76;

  // Chart data
  chartDays = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
  sentSeries = [3, 5, 2, 6, 4, 1, 2];
  replySeries = [1, 2, 1, 3, 2, 0, 1];

  // Recent apps
  recentApps: RecentAppItem[] = [
    {
      id: 'app1',
      initial: 'N',
      initialBg: 'bg-gradient-to-br from-brand-500 to-brand-700 text-white',
      title: 'Product Designer Senior',
      company: 'Nova Studio',
      city: 'Paris',
      status: 'Entretien',
      statusClass: 'text-brand-700 bg-brand-100',
      timeAgo: '2j'
    },
    {
      id: 'app2',
      initial: 'Q',
      initialBg: 'bg-brand-100 text-brand-700',
      title: 'UX Researcher',
      company: 'Quantik',
      city: 'Remote',
      status: 'En attente',
      statusClass: 'text-amber-700 bg-amber-50',
      timeAgo: '3j'
    },
    {
      id: 'app3',
      initial: 'B',
      initialBg: 'bg-brand-100 text-brand-700',
      title: 'Lead Product Designer',
      company: 'Brightly',
      city: 'Lyon',
      status: 'Refusée',
      statusClass: 'text-rose-700 bg-rose-50',
      timeAgo: '5j'
    },
    {
      id: 'app4',
      initial: 'F',
      initialBg: 'bg-brand-100 text-brand-700',
      title: 'Designer UI/UX',
      company: 'Flowbase',
      city: 'Paris',
      status: 'En attente',
      statusClass: 'text-amber-700 bg-amber-50',
      timeAgo: '6j'
    },
    {
      id: 'app5',
      initial: 'O',
      initialBg: 'bg-gradient-to-br from-brand-500 to-brand-700 text-white',
      title: 'Product Designer',
      company: 'Orbitly',
      city: 'Remote',
      status: 'Entretien',
      statusClass: 'text-brand-700 bg-brand-100',
      timeAgo: '1sem'
    }
  ];

  // Recommended jobs
  recommendedJobs: RecommendedJob[] = [
    {
      id: 'rec1',
      initial: 'P',
      gradient: 'from-brand-500 to-brand-700',
      title: 'Product Designer',
      company: 'Pixelworks',
      city: 'Paris',
      score: 92,
      tags: ['Figma', 'CDI']
    },
    {
      id: 'rec2',
      initial: 'S',
      gradient: 'from-brand-400 to-brand-600',
      title: 'UX Lead',
      company: 'Skyline',
      city: 'Remote',
      score: 89,
      tags: ['Remote', 'Senior']
    },
    {
      id: 'rec3',
      initial: 'A',
      gradient: 'from-brand-600 to-brand-800',
      title: 'Design System Lead',
      company: 'Atomik',
      city: 'Lyon',
      score: 85,
      tags: ['Hybride', 'CDI']
    }
  ];

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    this.loading = true;
    this.opportunityApi.getOpportunities().subscribe({
      next: (opps) => {
        this.opportunities = opps;
        if (opps.length > 0) {
          // Adapt real data
          const sumScore = opps.reduce((acc, o) => acc + (o.score || 70), 0);
          this.averageScore = Math.round(sumScore / opps.length);
          
          // Map top 3 recommended
          const topOpps = [...opps].sort((a, b) => (b.score || 0) - (a.score || 0)).slice(0, 3);
          if (topOpps.length > 0) {
            this.recommendedJobs = topOpps.map((o, idx) => ({
              id: o.id,
              initial: o.company ? o.company[0].toUpperCase() : 'O',
              gradient: idx === 0 ? 'from-brand-500 to-brand-700' : idx === 1 ? 'from-brand-400 to-brand-600' : 'from-brand-600 to-brand-800',
              title: o.title,
              company: o.company || 'Entreprise',
              city: o.city || 'Télétravail',
              score: o.score || 85,
              tags: Array.isArray(o.matchedSkills) ? o.matchedSkills.slice(0, 2) : ['CDI', 'Tech']
            }));
          }
        }
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      }
    });

    this.applicationApi.getApplications().subscribe({
      next: (apps) => {
        this.applications = apps;
        if (apps.length > 0) {
          this.sentCount = apps.length;
          this.pendingCount = apps.filter(a => a.status === 'PENDING' || a.status === 'APPLIED' || a.status === 'SUBMITTED').length;
          this.interviewCount = apps.filter(a => a.status === 'INTERVIEW').length;
        }
      }
    });
  }
}
