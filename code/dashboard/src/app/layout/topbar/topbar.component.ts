import { Component, Output, EventEmitter, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../core/services/auth.service';

interface NotificationItem {
  id: string;
  title: string;
  detail: string;
  time: string;
}

@Component({
  selector: 'app-topbar',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './topbar.component.html',
  styleUrl: './topbar.component.css'
})
export class TopbarComponent {
  @Output() openNav = new EventEmitter<void>();

  private authService = inject(AuthService);
  private router = inject(Router);

  currentUser = this.authService.currentUser;
  openMenu = signal<'notifications' | 'user' | null>(null);

  notifications: NotificationItem[] = [
    {
      id: 'n1',
      title: '7 nouvelles opportunités qualifiées',
      detail: 'Score moyen supérieur à 85 %',
      time: 'Il y a 12 min'
    },
    {
      id: 'n2',
      title: 'Lettre de motivation générée',
      detail: 'Prête pour relecture et envoi',
      time: 'Il y a 45 min'
    },
    {
      id: 'n3',
      title: 'Entretien confirmé',
      detail: 'Session planifiée',
      time: 'Hier à 11:15'
    }
  ];

  get firstName(): string {
    const fullName = this.currentUser()?.fullName;
    if (!fullName) return 'Léa';
    return fullName.trim().split(' ')[0];
  }

  get initials(): string {
    const fullName = this.currentUser()?.fullName;
    if (!fullName) return 'LP';
    const parts = fullName.trim().split(' ');
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return parts[0].substring(0, 2).toUpperCase();
  }

  toggleMenu(menu: 'notifications' | 'user'): void {
    this.openMenu.update(current => current === menu ? null : menu);
  }

  closeMenus(): void {
    this.openMenu.set(null);
  }

  startNewSearch(): void {
    this.router.navigate(['/opportunities']);
  }

  logout(): void {
    this.authService.logout();
  }
}
