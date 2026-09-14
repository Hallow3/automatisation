import { Component, Input, Type } from '@angular/core';
import { CommonModule, NgComponentOutlet } from '@angular/common';
import { resolveTemplateComponent, normalizeTemplateKey } from '../cv-templates/template-registry';
import { CvTemplateComponent } from '../cv-templates/cv-template.contract';

export type CvTemplateId =
  | 'modern'
  | 'classic'
  | 'moderne'
  | 'split'
  | 'classique'
  | 'senior-exec'
  | 'tech-lead'
  | 'executive-dark'
  | 'nordic-minimal'
  | 'creative-coral'
  | 'compact-ats'
  | 'editorial-slate'
  | 'corporate-gold'
  | 'startup-innovative';

export type CvSectionKey = 'summary' | 'experiences' | 'education' | 'skills' | 'languages' | 'projects';

export interface CvExperience {
  role: string;
  company: string;
  period: string;
  city?: string;
  description?: string;
  bullets?: string[];
}

export interface CvEducation {
  degree: string;
  school: string;
  year?: string;
  period?: string;
}

export interface CvLanguage {
  lang?: string;
  name?: string;
  level: string;
}

export interface CvProject {
  name: string;
  detail: string;
}

export interface CvLink {
  label: string;
  url: string;
}

export interface CvData {
  name: string;
  title: string;
  email: string;
  phone: string;
  city: string;
  summary: string;
  skills: string[];
  experiences: CvExperience[];
  education: CvEducation[];
  languages: CvLanguage[];
  projects?: CvProject[];
  links?: CvLink[];
  linkedin?: string;
  accent?: string;
  sectionOrder?: CvSectionKey[];
}

export function createDefaultCvData(user?: {
  fullName?: string | null;
  email?: string | null;
  phone?: string | null;
  city?: string | null;
  targetRole?: string | null;
} | null): CvData {
  return {
    name: user?.fullName || '',
    title: user?.targetRole || '',
    email: user?.email || '',
    phone: user?.phone || '',
    city: user?.city || '',
    summary: '',
    skills: [],
    experiences: [],
    education: [],
    languages: [],
    projects: [],
    links: [],
    accent: '#2563eb',
    sectionOrder: ['summary', 'experiences', 'education', 'skills', 'languages', 'projects']
  };
}

export const EMPTY_CV_DATA: CvData = createDefaultCvData();

/**
 * Host Component d'orchestration pour l'affichage et la prévisualisation des CVs.
 * Instancie dynamiquement le template dédié via NgComponentOutlet.
 */
@Component({
  selector: 'app-cv-preview',
  standalone: true,
  imports: [CommonModule, NgComponentOutlet],
  templateUrl: './cv-preview.component.html',
  styleUrl: './cv-preview.component.css'
})
export class CvPreviewComponent {
  @Input() template: CvTemplateId | string = 'modern';
  @Input() data: CvData = EMPTY_CV_DATA;
  @Input() set cv(val: CvData) { this.data = val || EMPTY_CV_DATA; }
  @Input() scale = 1;
  @Input() accent = '#2563eb';
  @Input() showPageBreaks = true;

  get activeComponent(): Type<CvTemplateComponent> {
    return resolveTemplateComponent(this.template);
  }

  get currentAccent(): string {
    if (this.data?.accent && this.data.accent !== '#2563eb') {
      return this.data.accent;
    }
    const key = normalizeTemplateKey(this.template);
    return key === 'classic' ? '#0f172a' : (this.accent || '#2563eb');
  }

  get templateInputs(): Record<string, any> {
    return {
      data: this.data,
      accent: this.currentAccent
    };
  }
}
