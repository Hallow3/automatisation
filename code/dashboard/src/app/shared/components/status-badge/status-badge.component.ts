import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { getStatusBadgeConfig, StatusBadgeConfig } from '../../../core/utils/ui-mapping';

@Component({
  selector: 'app-status-badge',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './status-badge.component.html',
  styleUrl: './status-badge.component.css'
})
export class StatusBadgeComponent {
  @Input({ required: true }) status!: string;

  get config(): StatusBadgeConfig {
    return getStatusBadgeConfig(this.status);
  }
}
