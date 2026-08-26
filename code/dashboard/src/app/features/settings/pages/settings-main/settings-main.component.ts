import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../../core/services/auth.service';
import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';
import { ButtonComponent } from '../../../../shared/components/button/button.component';
import { CardComponent } from '../../../../shared/components/card/card.component';
import { CardHeaderComponent } from '../../../../shared/components/card/card-header.component';
import { TabsComponent, TabItem } from '../../../../shared/components/tabs/tabs.component';
import { BadgeComponent } from '../../../../shared/components/badge/badge.component';

@Component({
  selector: 'app-settings-main',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    PageHeaderComponent,
    ButtonComponent,
    CardComponent,
    CardHeaderComponent,
    TabsComponent,
    BadgeComponent
  ],
  templateUrl: './settings-main.component.html',
  styleUrl: './settings-main.component.css'
})
export class SettingsMainComponent implements OnInit {
  private authService = inject(AuthService);

  activeTab = 'compte';
  savedNotice = false;

  tabs: TabItem[] = [
    { id: 'compte', label: 'Compte' },
    { id: 'notifications', label: 'Notifications' },
    { id: 'automations', label: 'Automatisations & Flux' }
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
      this.account.fullName = u.fullName || 'Waffo Mohamed Brayant';
      this.account.email = u.email || 'brayant@exemple.com';
    }
  }

  setTab(tabId: string): void {
    this.activeTab = tabId;
  }

  saveSettings(): void {
    this.savedNotice = true;
    setTimeout(() => {
      this.savedNotice = false;
    }, 3000);
  }
}
