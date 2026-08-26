import { Component, Output, EventEmitter, OnInit, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';
import { OpportunityApiService } from '../../core/services/opportunity-api.service';
import { ApplicationApiService } from '../../core/services/application-api.service';
import { AuthService } from '../../core/services/auth.service';

interface NavItem {
  label: string;
  route: string;
  icon: string;
  exact?: boolean;
  badge?: string;
  isAi?: boolean;
}

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, CommonModule],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.css'
})
export class SidebarComponent implements OnInit {
  @Output() linkClicked = new EventEmitter<void>();

  private opportunityApi = inject(OpportunityApiService);
  private applicationApi = inject(ApplicationApiService);
  private authService = inject(AuthService);

  currentUser = this.authService.currentUser;

  primaryNav: NavItem[] = [
    { label: 'Dashboard', route: '/dashboard', icon: 'dashboard', exact: true },
    { label: 'Opportunités', route: '/opportunities', icon: 'briefcase', badge: '7' },
    { label: 'Candidatures', route: '/applications', icon: 'send', badge: '12' },
    { label: 'Mes CV', route: '/cvs', icon: 'file-text' },
    { label: 'Entretien vocal IA', route: '/cvs/interview', icon: 'mic', isAi: true }
  ];

  accountNav: NavItem[] = [
    { label: 'Profil', route: '/profile', icon: 'user' },
    { label: 'Paramètres', route: '/settings', icon: 'settings' }
  ];

  secondaryNav: NavItem[] = [
    { label: 'Documents', route: '/documents', icon: 'folder' },
    { label: 'Activité', route: '/activity', icon: 'activity' }
  ];

  get initials(): string {
    const user = this.currentUser();
    if (!user?.fullName) return 'LP';
    const parts = user.fullName.trim().split(' ');
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return parts[0].substring(0, 2).toUpperCase();
  }

  ngOnInit(): void {
    this.opportunityApi.getOpportunities().subscribe({
      next: (opps) => {
        const oppItem = this.primaryNav.find(i => i.route === '/opportunities');
        if (oppItem && opps.length > 0) {
          oppItem.badge = String(opps.length);
        }
      }
    });

    this.applicationApi.getApplications().subscribe({
      next: (apps) => {
        const appItem = this.primaryNav.find(i => i.route === '/applications');
        if (appItem && apps.length > 0) {
          appItem.badge = String(apps.length);
        }
      }
    });
  }

  onNavigate(): void {
    this.linkClicked.emit();
  }

  logout(): void {
    this.authService.logout();
  }
}
