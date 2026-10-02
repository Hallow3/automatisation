import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CvData, EMPTY_CV_DATA } from '../../cv-preview/cv-preview.component';
import { CvTemplateComponent } from '../cv-template.contract';

@Component({
  selector: 'app-onyx-template',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './onyx-template.component.html',
  styleUrl: './onyx-template.component.css'
})
export class OnyxTemplateComponent implements CvTemplateComponent {
  @Input() data: CvData = EMPTY_CV_DATA;
  @Input() accent: string = '#0f172a';

  get currentAccent(): string {
    return this.data?.accent || this.accent || '#0f172a';
  }

  /** Monogramme : 1 à 2 initiales tirées du nom complet. */
  get initials(): string {
    const source = (this.data?.name || '').trim();
    if (!source) {
      return '·';
    }
    const letters = source
      .split(/\s+/)
      .filter((part: string) => part.length > 0)
      .slice(0, 2)
      .map((part: string) => part.charAt(0).toUpperCase())
      .join('');
    return letters || '·';
  }

  /** La colonne latérale n'existe que si elle a du contenu. */
  get hasAside(): boolean {
    const d = this.data;
    if (!d) {
      return false;
    }
    return (
      (d.skills?.length ?? 0) > 0 ||
      (d.education?.length ?? 0) > 0 ||
      (d.languages?.length ?? 0) > 0 ||
      (d.personalQualities?.length ?? 0) > 0 ||
      (d.interests?.length ?? 0) > 0
    );
  }
}
