import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CvData, EMPTY_CV_DATA } from '../../cv-preview/cv-preview.component';
import { CvTemplateComponent } from '../cv-template.contract';

@Component({
  selector: 'app-modern-template',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './modern-template.component.html',
  styleUrl: './modern-template.component.css'
})
export class ModernTemplateComponent implements CvTemplateComponent {
  @Input() data: CvData = EMPTY_CV_DATA;
  @Input() accent: string = '#2563eb';

  get currentAccent(): string {
    return this.data?.accent || this.accent || '#2563eb';
  }

  get initials(): string {
    if (!this.data?.name?.trim()) return 'CV';
    return this.data.name
      .trim()
      .split(/\s+/)
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }
}
