import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

export type AlertTone = 'info' | 'success' | 'warning' | 'danger';

@Component({
  selector: 'app-alert-banner',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './alert-banner.component.html',
  styleUrl: './alert-banner.component.css'
})
export class AlertBannerComponent {
  @Input() tone: AlertTone = 'info';
  @Input({ required: true }) title!: string;
  @Input() description?: string;
  @Input() dismissible: boolean = false;
  @Input() customClass: string = '';

  @Output() dismissed = new EventEmitter<void>();

  get wrapClass(): string {
    switch (this.tone) {
      case 'info': return 'border-brand-navy-100 bg-brand-navy-50';
      case 'success': return 'border-success-100 bg-success-bg';
      case 'warning': return 'border-brand-orange-100 bg-brand-orange-50';
      case 'danger': return 'border-danger-100 bg-danger-bg';
    }
  }

  get iconColorClass(): string {
    switch (this.tone) {
      case 'info': return 'text-brand-navy-700';
      case 'success': return 'text-success';
      case 'warning': return 'text-brand-orange-500';
      case 'danger': return 'text-danger';
    }
  }

  onDismiss(): void {
    this.dismissed.emit();
  }
}
