import { Component, Output, EventEmitter, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../core/services/auth.service';
import { PaymentService } from '../../core/services/payment.service';
import { AgentPackModalComponent } from '../../shared/components/agent-pack-modal/agent-pack-modal.component';

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
  public paymentService = inject(PaymentService);
  private router = inject(Router);

  currentUser = this.authService.currentUser;
  openMenu = signal<'notifications' | 'user' | null>(null);

  notifications: NotificationItem[] = [];

  get firstName(): string {
    const fullName = this.currentUser()?.fullName;
    if (!fullName) return 'Utilisateur';
    return fullName.trim().split(' ')[0];
  }

  get initials(): string {
    const fullName = this.currentUser()?.fullName;
    if (!fullName) return 'U';
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

  openPacks(): void {
    this.closeMenus();
    this.paymentService.openPackModal();
  }

  startNewSearch(): void {
    this.router.navigate(['/opportunities']);
  }

  logout(): void {
    this.authService.logout();
  }
}
