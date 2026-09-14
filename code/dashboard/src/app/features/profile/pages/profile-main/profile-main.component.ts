import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../../core/services/auth.service';
import { CandidateProfileApiService, CandidateProfile } from '../../../../core/services/candidate-profile-api.service';
import { CvApiService } from '../../../../core/services/cv-api.service';
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
  private candidateProfileApi = inject(CandidateProfileApiService);
  private cvApi = inject(CvApiService);

  profile: CandidateProfile = {
    fullName: '',
    headline: '',
    email: '',
    phone: '',
    city: '',
    availability: 'Disponible',
    experienceLevel: '',
    salaryExpectations: '',
    contractTypes: ['CDI', 'Temps plein'],
    targetLocations: [],
    remotePreference: '',
    mobility: '',
    skills: [],
    aiInstructions: ''
  };

  newSkill = '';
  savedNotice = false;
  isSaving = false;

  get userInitials(): string {
    if (!this.profile.fullName) return 'U';
    const parts = this.profile.fullName.trim().split(' ');
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return parts[0].substring(0, 2).toUpperCase();
  }

  get completionPercentage(): number {
    let score = 0;
    if (this.profile.fullName?.trim()) score += 20;
    if (this.profile.email?.trim()) score += 20;
    if (this.profile.headline?.trim()) score += 20;
    if (this.profile.city?.trim()) score += 15;
    if (this.profile.skills?.length > 0) score += 15;
    if (this.profile.experienceLevel?.trim() || this.profile.salaryExpectations?.trim() || this.profile.remotePreference?.trim()) score += 10;
    return Math.min(100, score);
  }

  ngOnInit(): void {
    const u = this.authService.currentUser();
    if (u) {
      this.profile.fullName = u.fullName || '';
      this.profile.email = u.email || '';
      this.profile.city = u.city || '';
      this.profile.phone = u.phone || '';
      this.profile.headline = u.targetRole || '';
    }

    // Chargement du profil depuis le backend MySQL
    this.candidateProfileApi.getProfile().subscribe({
      next: (backendProfile) => {
        if (backendProfile) {
          this.profile = {
            ...this.profile,
            ...backendProfile,
            contractTypes: backendProfile.contractTypes?.length ? backendProfile.contractTypes : ['CDI', 'Temps plein'],
            targetLocations: backendProfile.targetLocations || [],
            skills: backendProfile.skills || []
          };
        }
      },
      error: () => {
        // En cas d'erreur de chargement réseau, enrichissement de secours depuis le dernier CV
        this.fallbackFromLatestCv();
      }
    });
  }

  private fallbackFromLatestCv(): void {
    this.cvApi.getCvs().subscribe({
      next: (cvs) => {
        if (cvs && cvs.length > 0) {
          const latestCv = cvs[0];
          let content: any = null;
          if (latestCv?.contentJson) {
            try {
              content = typeof latestCv.contentJson === 'string' ? JSON.parse(latestCv.contentJson) : latestCv.contentJson;
            } catch {}
          }

          if (content) {
            if (!this.profile.headline && content.headline) {
              this.profile.headline = content.headline;
            }
            if (!this.profile.city && content.identity?.city) {
              this.profile.city = content.identity.city;
            }
            if (!this.profile.phone && content.identity?.phone) {
              this.profile.phone = content.identity.phone;
            }
            if (this.profile.skills.length === 0 && Array.isArray(content.skills) && content.skills.length > 0) {
              this.profile.skills = [...content.skills];
            }
            if (!this.profile.experienceLevel && Array.isArray(content.experiences) && content.experiences.length > 0) {
              const expCount = content.experiences.length;
              this.profile.experienceLevel = expCount > 3 ? '5+ ans d’expérience' : `${expCount} expérience(s)`;
            }
          }
        }
      }
    });
  }

  addSkill(): void {
    const trimmed = this.newSkill.trim();
    if (trimmed && !this.profile.skills.includes(trimmed)) {
      this.profile.skills.push(trimmed);
      this.newSkill = '';
    }
  }

  removeSkill(index: number): void {
    this.profile.skills.splice(index, 1);
  }

  saveAll(): void {
    this.isSaving = true;
    this.candidateProfileApi.updateProfile(this.profile).subscribe({
      next: (updated) => {
        this.profile = { ...this.profile, ...updated };
        this.isSaving = false;
        this.savedNotice = true;
        setTimeout(() => {
          this.savedNotice = false;
        }, 3000);
      },
      error: () => {
        this.isSaving = false;
      }
    });
  }
}
