import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Opportunity } from '../../../core/models/opportunity.model';
import { StatusBadgeComponent } from '../status-badge/status-badge.component';
import { ScoreBadgeComponent } from '../score-badge/score-badge.component';
import { BadgeComponent } from '../badge/badge.component';
import { ChipComponent } from '../badge/chip.component';
import { ButtonComponent } from '../button/button.component';
import { getMatchReasonLabel } from '../../../core/utils/ui-mapping';

@Component({
  selector: 'app-opportunity-card',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    StatusBadgeComponent,
    ScoreBadgeComponent,
    BadgeComponent,
    ChipComponent,
    ButtonComponent
  ],
  templateUrl: './opportunity-card.component.html',
  styleUrl: './opportunity-card.component.css'
})
export class OpportunityCardComponent {
  @Input({ required: true }) opportunity!: Opportunity;
  @Input() customClass: string = '';

  @Output() dismiss = new EventEmitter<string>();
  @Output() prepare = new EventEmitter<string>();

  get skillsList(): string[] {
    if (Array.isArray(this.opportunity.matchedSkills)) {
      return this.opportunity.matchedSkills;
    }
    if (typeof this.opportunity.matchedSkills === 'string') {
      return (this.opportunity.matchedSkills as string).split(',').map(s => s.trim()).filter(Boolean);
    }
    return [];
  }

  get matchExplanationText(): string {
    return getMatchReasonLabel(this.opportunity.matchExplanation);
  }

  onDismiss(event: Event): void {
    event.stopPropagation();
    this.dismiss.emit(this.opportunity.id);
  }

  onPrepare(event: Event): void {
    event.stopPropagation();
    this.prepare.emit(this.opportunity.id);
  }
}
