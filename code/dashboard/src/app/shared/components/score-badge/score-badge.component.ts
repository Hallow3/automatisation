import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-score-badge',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './score-badge.component.html',
  styleUrl: './score-badge.component.css'
})
export class ScoreBadgeComponent {
  @Input({ required: true }) score: number = 0;
  @Input() size: 'sm' | 'lg' = 'sm';
  @Input() withLabel: boolean = false;

  get tone(): string {
    return 'bg-gradient-to-r from-brand-500 to-brand-600 text-white shadow-sm';
  }

  get label(): string {
    if (this.score >= 85) return 'Très bon match';
    if (this.score >= 75) return 'Bon potentiel';
    if (this.score >= 65) return 'À approfondir';
    return 'Match modéré';
  }
}
