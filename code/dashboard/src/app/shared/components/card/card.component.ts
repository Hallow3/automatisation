import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

export type CardPattern = 'dot-grid' | 'orange-glow' | 'navy-grid' | null;

@Component({
  selector: 'app-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './card.component.html',
  styleUrl: './card.component.css'
})
export class CardComponent {
  @Input() padded: boolean = true;
  @Input() pattern: CardPattern = null;
  @Input() customClass: string = '';

  get patternClass(): string {
    if (this.pattern === 'dot-grid') return 'pattern-dot-grid';
    if (this.pattern === 'orange-glow') return 'pattern-orange-glow';
    if (this.pattern === 'navy-grid') return 'pattern-navy-grid';
    return '';
  }
}
