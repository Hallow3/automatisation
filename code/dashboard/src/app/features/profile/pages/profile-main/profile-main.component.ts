import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../../core/services/auth.service';
import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';
import { ButtonComponent } from '../../../../shared/components/button/button.component';
import { CardComponent } from '../../../../shared/components/card/card.component';
import { CardHeaderComponent } from '../../../../shared/components/card/card-header.component';
import { AlertBannerComponent } from '../../../../shared/components/feedback/alert-banner.component';
import { BadgeComponent } from '../../../../shared/components/badge/badge.component';
import { ChipComponent } from '../../../../shared/components/badge/chip.component';

@Component({
  selector: 'app-profile-main',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    PageHeaderComponent,
    ButtonComponent,
    CardComponent,
    CardHeaderComponent,
    AlertBannerComponent,
    BadgeComponent,
    ChipComponent
  ],
  templateUrl: './profile-main.component.html',
  styleUrl: './profile-main.component.css'
})
export class ProfileMainComponent implements OnInit {
  private authService = inject(AuthService);

  profile = {
    fullName: 'Léa Bernard',
    headline: 'Product Designer & UX Lead',
    email: 'lea.bernard@mail.com',
    phone: '+33 6 12 34 56 78',
    location: 'Paris, France',
    availability: 'Disponible immédiatement',
    experienceLevel: '5+ ans d’expérience',
    salaryExpectations: '65–75 k€ / an',
    contractTypes: ['CDI', 'Freelance', 'Temps plein'],
    targetLocations: ['Paris', 'Lyon', 'Télétravail complet'],
    remotePreference: 'Télétravail hybride ou complet',
    mobility: 'France entière & Europe',
    skills: ['Figma', 'Design System', 'User Research', 'Prototypage', 'UI/UX', 'Design Thinking'],
    aiInstructions: 'Mettre l’accent sur la vision produit, les tests utilisateurs et l’alignement business.'
  };

  newSkill = '';
  savedNotice = false;

  get userInitials(): string {
    if (!this.profile.fullName) return 'U';
    const parts = this.profile.fullName.trim().split(' ');
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return parts[0].substring(0, 2).toUpperCase();
  }

  ngOnInit(): void {
    const u = this.authService.currentUser();
    if (u) {
      if (u.fullName) this.profile.fullName = u.fullName;
      if (u.email) this.profile.email = u.email;
      if (u.city) this.profile.location = u.city;
      if (u.targetRole) this.profile.headline = u.targetRole;
    }
  }

  addSkill(): void {
    if (this.newSkill.trim()) {
      this.profile.skills.push(this.newSkill.trim());
      this.newSkill = '';
    }
  }

  removeSkill(index: number): void {
    this.profile.skills.splice(index, 1);
  }

  saveAll(): void {
    this.savedNotice = true;
    setTimeout(() => {
      this.savedNotice = false;
    }, 3000);
  }
}
