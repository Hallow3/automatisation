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
  @Input() score: number | null = 0;
  @Input() size: 'sm' | 'lg' = 'sm';
  @Input() withLabel: boolean = false;

  get isPublic(): boolean {
    return !this.score || this.score <= 0;
  }

  get tone(): string {
    if (this.isPublic) {
      return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700';
    }
    return 'bg-gradient-to-r from-brand-500 to-brand-600 text-white shadow-sm';
  }

  get label(): string {
    if (this.isPublic) return 'Offre ouverte';
    if (this.score! >= 85) return 'Très bon match';
    if (this.score! >= 75) return 'Bon potentiel';
    if (this.score! >= 65) return 'À approfondir';
    return 'Match modéré';
  }
}
