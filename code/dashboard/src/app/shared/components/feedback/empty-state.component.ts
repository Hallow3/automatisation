import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonComponent } from '../button/button.component';

@Component({
  selector: 'app-empty-state',
  standalone: true,
  imports: [CommonModule, ButtonComponent],
  templateUrl: './empty-state.component.html',
  styleUrl: './empty-state.component.css'
})
export class EmptyStateComponent {
  @Input({ required: true }) title!: string;
  @Input({ required: true }) description!: string;
  @Input() actionLabel?: string;
  @Input() secondaryLabel?: string;
  @Input() iconType: 'search' | 'inbox' | 'file' | 'mail' | 'default' = 'default';
  @Input() customClass: string = '';

  @Output() actionClick = new EventEmitter<void>();
  @Output() secondaryClick = new EventEmitter<void>();
}
