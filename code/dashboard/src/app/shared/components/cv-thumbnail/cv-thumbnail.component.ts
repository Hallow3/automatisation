import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

export type CvThumbnailLayout = 'classic' | 'sidebar' | 'compact' | 'editorial' | 'header-dark' | 'minimal' | 'corporate' | 'tech';

@Component({
  selector: 'app-cv-thumbnail',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './cv-thumbnail.component.html',
  styleUrl: './cv-thumbnail.component.css'
})
export class CvThumbnailComponent {
  @Input() layout: CvThumbnailLayout = 'sidebar';
  @Input() accent: string = '#2563eb';
  @Input() customClass: string = '';
}
