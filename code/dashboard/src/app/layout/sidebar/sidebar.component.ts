import { Component, Output, EventEmitter, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../core/services/auth.service';
import { PaymentService } from '../../core/services/payment.service';

interface NavItem {
  label: string;
  route: string;
  icon: string;
  exact?: boolean;
  isAi?: boolean;
}

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, CommonModule],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.css'
})
export class SidebarComponent {
  @Output() linkClicked = new EventEmitter<void>();

  private authService = inject(AuthService);
  public paymentService = inject(PaymentService);

  currentUser = this.authService.currentUser;

  primaryNav: NavItem[] = [
    { label: 'Dashboard', route: '/dashboard', icon: 'dashboard', exact: true },
    { label: 'Opportunités', route: '/opportunities', icon: 'briefcase' },
    { label: 'Candidatures', route: '/applications', icon: 'send' },
    { label: 'Mes CV', route: '/cvs', icon: 'file-text', exact: true },
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
    if (!user?.fullName) return 'U';
    const parts = user.fullName.trim().split(' ');
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return parts[0].substring(0, 2).toUpperCase();
  }

  onNavigate(): void {
    this.linkClicked.emit();
  }

  logout(): void {
    this.authService.logout();
  }
}
