import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface TabItem {
  id: string;
  label: string;
  count?: number;
}

@Component({
  selector: 'app-tabs',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './tabs.component.html',
  styleUrl: './tabs.component.css'
})
export class TabsComponent {
  @Input({ required: true }) items: TabItem[] = [];
  @Input({ required: true }) value!: string;
  @Input() customClass: string = '';

  @Output() tabChange = new EventEmitter<string>();

  selectTab(id: string): void {
    if (this.value !== id) {
      this.value = id;
      this.tabChange.emit(id);
    }
  }
}
