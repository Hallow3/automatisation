import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../../core/services/auth.service';
import { PaymentService } from '../../../../core/services/payment.service';
import { AutomationSettings, CandidateProfileApiService } from '../../../../core/services/candidate-profile-api.service';
import { ButtonComponent } from '../../../../shared/components/button/button.component';
import { TabsComponent, TabItem } from '../../../../shared/components/tabs/tabs.component';

@Component({
  selector: 'app-settings-main',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonComponent,
    TabsComponent
  ],
  templateUrl: './settings-main.component.html',
  styleUrl: './settings-main.component.css'
})
export class SettingsMainComponent implements OnInit {
  private authService = inject(AuthService);
  public paymentService = inject(PaymentService);
  private candidateProfileApi = inject(CandidateProfileApiService);

  activeTab = 'recherche';
  savedNotice = false;
  isSaving = false;
  isLoading = true;
  loadFailed = false;
  saveError = '';
  search = { headline: '', city: '', salaryExpectations: '' };
  whatsappNumber = '';
  automation: AutomationSettings = {
    searchEnabled: false,
    autoApplyEnabled: false,
    coverLetterEnabled: false,
    whatsappEnabled: false,
    dailyCreditBudget: 1,
    mailboxProvider: '',
    mailboxAddress: '',
    mailboxConnected: false
  };

  tabs: TabItem[] = [
    { id: 'recherche', label: 'Ma recherche' },
    { id: 'automations', label: 'Automatisation' },
    { id: 'compte', label: 'Compte' }
  ];

  account = {
    fullName: '',
    email: '',
    plan: 'Pro Automation'
  };

  notifications = {
    emailNewOpportunities: true,
    emailWeeklyReport: false,
    interviewReminders: true
  };

  ngOnInit(): void {
    const u = this.authService.currentUser();
    if (u) {
      this.account.fullName = u.fullName || '';
      this.account.email = u.email || '';
    }

    this.candidateProfileApi.getProfile().subscribe({
      next: (profile) => {
        this.search = {
          headline: profile.headline || '',
          city: profile.city || '',
          salaryExpectations: profile.salaryExpectations || ''
        };
        this.whatsappNumber = profile.whatsappNumber || profile.phone || '';
        this.automation = { ...this.automation, ...profile.automation };
        if (profile?.notifications) {
          this.notifications = {
            ...this.notifications,
            ...profile.notifications
          };
        }
        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
        this.loadFailed = true;
        this.saveError = 'Impossible de charger vos réglages. Rechargez la page avant de les modifier.';
      }
    });
  }

  setTab(tabId: string): void {
    this.activeTab = tabId;
  }

  saveSettings(): void {
    if (this.isLoading || this.loadFailed || this.isSaving) return;
    this.saveError = '';
    this.savedNotice = false;
    const budget = Number(this.automation.dailyCreditBudget);
    if (!Number.isInteger(budget) || budget < 1 || budget > 5) {
      this.saveError = 'Choisissez un budget entre 1 et 5 crédits par jour.';
      this.activeTab = 'recherche';
      return;
    }
    if (this.automation.searchEnabled && (!this.search.headline.trim() || !this.search.city.trim())) {
      this.saveError = 'Indiquez le poste et la ville souhaités pour lancer la recherche.';
      this.activeTab = 'recherche';
      return;
    }
    if (this.automation.whatsappEnabled && !this.whatsappNumber.trim()) {
      this.saveError = 'Indiquez votre numéro WhatsApp pour recevoir les notifications.';
      this.activeTab = 'automations';
      return;
    }
    if (!!this.automation.mailboxProvider !== !!this.automation.mailboxAddress.trim()) {
      this.saveError = 'Choisissez le type de boîte mail et indiquez son adresse.';
      this.activeTab = 'automations';
      return;
    }
    if (this.automation.mailboxAddress && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.automation.mailboxAddress.trim())) {
      this.saveError = 'Vérifiez l’adresse de votre boîte mail.';
      this.activeTab = 'automations';
      return;
    }
    this.isSaving = true;
    this.candidateProfileApi.updateProfile({
      headline: this.search.headline.trim(),
      city: this.search.city.trim(),
      salaryExpectations: this.search.salaryExpectations.trim(),
      whatsappNumber: this.whatsappNumber.trim(),
      notifications: this.notifications,
      automation: {
        ...this.automation,
        dailyCreditBudget: budget,
        mailboxAddress: this.automation.mailboxAddress.trim()
      }
    }).subscribe({
      next: (updated) => {
        this.isSaving = false;
        this.automation = { ...this.automation, ...updated.automation };
        this.savedNotice = true;
        setTimeout(() => {
          this.savedNotice = false;
        }, 3000);
      },
      error: () => {
        this.isSaving = false;
        this.saveError = 'Vos réglages n’ont pas été enregistrés. Réessayez dans un instant.';
      }
    });
  }
}
