import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-pagination',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './pagination.component.html',
  styleUrl: './pagination.component.css'
})
export class PaginationComponent {
  @Input({ required: true }) page: number = 1;
  @Input({ required: true }) pageCount: number = 1;
  @Input({ required: true }) total: number = 0;

  @Output() pageChange = new EventEmitter<number>();

  get pages(): number[] {
    return Array.from({ length: this.pageCount }, (_, i) => i + 1);
  }

  setPage(p: number): void {
    if (p >= 1 && p <= this.pageCount && p !== this.page) {
      this.pageChange.emit(p);
    }
  }
}
