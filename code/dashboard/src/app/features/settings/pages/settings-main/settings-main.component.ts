import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
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
export class SettingsMainComponent implements OnInit, OnDestroy {
  private authService = inject(AuthService);
  public paymentService = inject(PaymentService);
  private candidateProfileApi = inject(CandidateProfileApiService);

  activeTab = 'recherche';
  isSaving = false;
  isLoading = true;
  loadFailed = false;
  saveError = '';
  saveStatus: 'idle' | 'pending' | 'saving' | 'saved' | 'needsInput' | 'error' = 'idle';
  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private revision = 0;
  private savedRevision = 0;
  private retryCount = 0;
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
    this.flushSave();
    this.activeTab = tabId;
  }

  ngOnDestroy(): void {
    this.flushSave();
  }

  setBudget(amount: number): void {
    if (this.automation.dailyCreditBudget === amount) return;
    this.automation.dailyCreditBudget = amount;
    this.queueSave(true);
  }

  queueSave(immediate = false): void {
    if (this.isLoading || this.loadFailed) return;
    this.revision++;
    this.retryCount = 0;
    this.saveError = '';
    this.saveStatus = 'pending';
    this.scheduleSave(immediate ? 0 : 650);
  }

  flushSave(): void {
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = null;
    this.persistSettings();
  }

  private scheduleSave(delay: number): void {
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      this.persistSettings();
    }, delay);
  }

  private persistSettings(): void {
    if (this.isLoading || this.loadFailed || this.isSaving || this.revision === this.savedRevision) return;
    const budget = Number(this.automation.dailyCreditBudget);
    if (!Number.isInteger(budget) || budget < 1 || budget > 5) {
      this.saveError = 'Choisissez un budget entre 1 et 5 crédits par jour.';
      this.saveStatus = 'needsInput';
      return;
    }
    if (this.automation.searchEnabled && (!this.search.headline.trim() || !this.search.city.trim())) {
      this.saveError = 'Indiquez le poste et la ville pour activer la recherche.';
      this.saveStatus = 'needsInput';
      return;
    }
    if (this.automation.whatsappEnabled && !this.whatsappNumber.trim()) {
      this.saveError = 'Indiquez votre numéro pour les alertes WhatsApp.';
      this.saveStatus = 'needsInput';
      return;
    }
    if (!!this.automation.mailboxProvider !== !!this.automation.mailboxAddress.trim()) {
      this.saveError = 'Complétez le type et l’adresse de la boîte mail.';
      this.saveStatus = 'needsInput';
      return;
    }
    if (this.automation.mailboxAddress && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.automation.mailboxAddress.trim())) {
      this.saveError = 'Vérifiez l’adresse de votre boîte mail.';
      this.saveStatus = 'needsInput';
      return;
    }
    const sentRevision = this.revision;
    this.isSaving = true;
    this.saveStatus = 'saving';
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
        this.savedRevision = sentRevision;
        this.retryCount = 0;
        if (this.revision > sentRevision) {
          this.saveStatus = 'pending';
          this.scheduleSave(0);
        } else {
          this.automation.mailboxConnected = updated.automation?.mailboxConnected ?? false;
          this.saveStatus = 'saved';
        }
      },
      error: (error: HttpErrorResponse) => {
        this.isSaving = false;
        if (this.revision > sentRevision) {
          this.saveStatus = 'pending';
          this.scheduleSave(0);
        } else if ((error.status === 0 || error.status >= 500) && this.retryCount < 3) {
          this.retryCount++;
          this.saveStatus = 'pending';
          this.scheduleSave(2000 * this.retryCount);
        } else {
          this.saveError = 'Enregistrement interrompu. Modifiez un choix pour réessayer.';
          this.saveStatus = 'error';
        }
      }
    });
  }
}
