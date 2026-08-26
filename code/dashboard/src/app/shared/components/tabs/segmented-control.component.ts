import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface SegmentItem {
  id: string;
  label: string;
  icon?: string; // name of icon or svg key
}

@Component({
  selector: 'app-segmented-control',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './segmented-control.component.html',
  styleUrl: './segmented-control.component.css'
})
export class SegmentedControlComponent {
  @Input({ required: true }) items: SegmentItem[] = [];
  @Input({ required: true }) value!: string;
  @Input() ariaLabel: string = 'Choix';
  @Input() customClass: string = '';

  @Output() valueChange = new EventEmitter<string>();

  select(id: string): void {
    if (this.value !== id) {
      this.value = id;
      this.valueChange.emit(id);
    }
  }
}
