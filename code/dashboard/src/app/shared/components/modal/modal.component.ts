import { Component, Input, Output, EventEmitter, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './modal.component.html',
  styleUrl: './modal.component.css'
})
export class ModalComponent {
  @Input() open: boolean = true;
  @Input({ required: true }) title!: string;
  @Input() description?: string;
  @Input() variant: 'modal' | 'drawer' = 'modal';
  @Input() customClass: string = '';

  @Output() close = new EventEmitter<void>();

  @HostListener('document:keydown.escape', ['$event'])
  onKeydownHandler(event: KeyboardEvent): void {
    if (this.open) {
      this.onClose();
    }
  }

  onClose(): void {
    this.close.emit();
  }
}
