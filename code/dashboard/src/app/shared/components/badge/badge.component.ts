import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

export type BadgeTone = 'neutral' | 'brand' | 'accent' | 'success' | 'warning' | 'danger' | 'info';

@Component({
  selector: 'app-badge',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './badge.component.html',
  styleUrl: './badge.component.css'
})
export class BadgeComponent {
  @Input() tone: BadgeTone = 'neutral';
  @Input() customClass = '';

  get toneClass(): string {
    switch (this.tone) {
      case 'neutral': return 'bg-surface-soft text-text-secondary border-border-default';
      case 'brand': return 'bg-brand-navy-50 text-brand-navy-900 border-brand-navy-100';
      case 'accent': return 'bg-brand-orange-50 text-brand-orange-700 border-brand-orange-100';
      case 'success': return 'bg-success-bg text-success border-success-100';
      case 'warning': return 'bg-warning-bg text-warning-text border-warning-100';
      case 'danger': return 'bg-danger-bg text-danger-text border-danger-100';
      case 'info': return 'bg-info-bg text-info border-info-100';
    }
  }
}
