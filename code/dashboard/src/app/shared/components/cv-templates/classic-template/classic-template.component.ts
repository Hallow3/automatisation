import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CvData, EMPTY_CV_DATA } from '../../cv-preview/cv-preview.component';
import { CvTemplateComponent } from '../cv-template.contract';

@Component({
  selector: 'app-classic-template',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './classic-template.component.html',
  styleUrl: './classic-template.component.css'
})
export class ClassicTemplateComponent implements CvTemplateComponent {
  @Input() data: CvData = EMPTY_CV_DATA;
  @Input() accent: string = '#0f172a';

  get currentAccent(): string {
    return this.data?.accent || this.accent || '#0f172a';
  }
}
