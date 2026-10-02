import { AfterViewInit, ChangeDetectorRef, Component, ElementRef, EventEmitter, Input, OnDestroy, Output, QueryList, Type, ViewChildren } from '@angular/core';
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
  | 'startup-innovative'
  | 'onyx'
  ;

export type CvSectionKey = 'summary' | 'experiences' | 'education' | 'skills' | 'languages' | 'projects';

export interface CvExperience {
  role: string;
  company: string;
  period: string;
  city?: string;
  description?: string;
  bullets?: string[];
  paginationContinuation?: boolean;
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
  personalQualities?: string[];
  interests?: string[];
  projects?: CvProject[];
  links?: CvLink[];
  linkedin?: string;
  accent?: string;
  sectionOrder?: CvSectionKey[];
  continuationPage?: boolean;
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
    personalQualities: [],
    interests: [],
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
export class CvPreviewComponent implements AfterViewInit, OnDestroy {
  @ViewChildren('pageSheet') private pageSheets!: QueryList<ElementRef<HTMLElement>>;
  private sourceData: CvData = EMPTY_CV_DATA;
  private sourceKey = '';
  private templateKey: CvTemplateId | string = 'modern';
  private viewReady = false;
  private destroyed = false;
  private paginationTimer: ReturnType<typeof setTimeout> | null = null;

  pages: CvData[] = [EMPTY_CV_DATA];

  constructor(private readonly cdr: ChangeDetectorRef) {}

  @Input() set template(value: CvTemplateId | string) {
    if (this.templateKey !== value) {
      this.templateKey = value;
      this.resetPages();
    }
  }
  get template(): CvTemplateId | string { return this.templateKey; }

  @Input() set data(value: CvData) { this.setSource(value); }
  get data(): CvData { return this.sourceData; }
  @Input() set cv(value: CvData) { this.setSource(value); }
  @Input() scale = 1;
  @Input() accent = '#2563eb';
  @Input() showPageBreaks = true;
  @Output() paginationSettled = new EventEmitter<void>();

  ngAfterViewInit(): void {
    this.viewReady = true;
    this.schedulePagination();
    if (this.showPageBreaks && typeof document !== 'undefined' && document.fonts) {
      void document.fonts.ready.then(() => {
        if (!this.destroyed) this.resetPages();
      });
    }
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    if (this.paginationTimer) clearTimeout(this.paginationTimer);
  }

  private setSource(value: CvData): void {
    const next = value || EMPTY_CV_DATA;
    const key = JSON.stringify(next);
    if (key === this.sourceKey) return;
    this.sourceKey = key;
    this.sourceData = next;
    this.resetPages();
  }

  private resetPages(): void {
    this.pages = [this.copyPage(this.sourceData)];
    this.schedulePagination();
  }

  private schedulePagination(): void {
    if (!this.viewReady || !this.showPageBreaks || this.paginationTimer) return;
    this.paginationTimer = setTimeout(() => {
      this.paginationTimer = null;
      const sheets = this.pageSheets.toArray();
      const overflowingIndex = sheets.findIndex(sheet => {
        const article = sheet.nativeElement.querySelector('article');
        return (article?.scrollHeight || sheet.nativeElement.scrollHeight) > 1125;
      });
      if (overflowingIndex < 0 || this.pages.length >= 20) {
        this.paginationSettled.emit();
        return;
      }
      const overflowingSheet = sheets[overflowingIndex].nativeElement;
      const mainColumn = overflowingSheet.querySelector<HTMLElement>('.exec-main-col, .onyx-main');
      const sideColumn = overflowingSheet.querySelector<HTMLElement>('.exec-side-col, .onyx-aside');
      const article = overflowingSheet.querySelector<HTMLElement>('article');
      const mainBottom = mainColumn && article ? this.bottomWithin(mainColumn, article) : 0;
      const sideBottom = sideColumn && article ? this.bottomWithin(sideColumn, article) : 0;
      const overflowingColumn = mainBottom > 1125 && mainBottom >= sideBottom
        ? 'main'
        : sideBottom > 1125
          ? 'side'
          : 'all';
      const current = this.copyPage(this.pages[overflowingIndex]);
      const next = this.pages[overflowingIndex + 1]
        ? this.copyPage(this.pages[overflowingIndex + 1])
        : this.emptyPage();
      next.continuationPage = true;
      if (!this.moveLastBlock(current, next, overflowingColumn)) {
        this.paginationSettled.emit();
        return;
      }
      this.pages = [
        ...this.pages.slice(0, overflowingIndex),
        current,
        next,
        ...this.pages.slice(overflowingIndex + 2)
      ];
      this.cdr.detectChanges();
      this.schedulePagination();
    }, 0);
  }

  private bottomWithin(element: HTMLElement, ancestor: HTMLElement): number {
    let bottom = element.scrollHeight;
    let current: HTMLElement | null = element;
    while (current && current !== ancestor) {
      bottom += current.offsetTop;
      current = current.offsetParent as HTMLElement | null;
    }
    return current === ancestor ? bottom : 0;
  }

  private emptyPage(): CvData {
    return {
      ...this.sourceData,
      summary: '',
      skills: [],
      experiences: [],
      education: [],
      languages: [],
      projects: [],
      personalQualities: [],
      interests: [],
      continuationPage: true
    };
  }

  private copyPage(page: CvData): CvData {
    return {
      ...page,
      skills: [...(page.skills || [])],
      experiences: [...(page.experiences || [])],
      education: [...(page.education || [])],
      languages: [...(page.languages || [])],
      projects: [...(page.projects || [])],
      personalQualities: [...(page.personalQualities || [])],
      interests: [...(page.interests || [])]
    };
  }

  private moveLastBlock(current: CvData, next: CvData, column: 'main' | 'side' | 'all'): boolean {
    const fields: Array<'interests' | 'personalQualities' | 'languages' | 'projects' | 'education' | 'skills'> = column === 'main'
      ? ['projects']
      : column === 'side'
        ? ['interests', 'personalQualities', 'languages', 'education', 'skills']
        : ['interests', 'personalQualities', 'languages', 'projects', 'skills', 'education'];
    for (const field of fields) {
      const source = current[field];
      if (source?.length) {
        const item = source.pop();
        if (item !== undefined) (next[field] as unknown[]).unshift(item);
        return true;
      }
    }
    const lastExperience = current.experiences[current.experiences.length - 1];
    if (column !== 'side' && lastExperience) {
      const bullets = lastExperience.bullets || [];
      // Une expérience peut dépasser une page à elle seule : continuer ses puces
      // sur la page suivante tout en répétant son intitulé pour garder le contexte.
      if (current.experiences.length === 1 && bullets.length > 1) {
        const movedBullet = bullets[bullets.length - 1];
        current.experiences[current.experiences.length - 1] = {
          ...lastExperience,
          bullets: bullets.slice(0, -1)
        };
        const continuation = next.experiences[0];
        if (continuation?.paginationContinuation &&
            continuation.role === lastExperience.role &&
            continuation.company === lastExperience.company &&
            continuation.period === lastExperience.period) {
          next.experiences[0] = {
            ...continuation,
            bullets: [movedBullet, ...(continuation.bullets || [])]
          };
        } else {
          next.experiences.unshift({
            ...lastExperience,
            description: '',
            bullets: [movedBullet],
            paginationContinuation: true
          });
        }
        return true;
      }
      next.experiences.unshift(current.experiences.pop()!);
      return true;
    }
    if (column !== 'side' && current.summary) {
      next.summary = current.summary;
      current.summary = '';
      return true;
    }
    return false;
  }

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

  inputsFor(page: CvData): Record<string, unknown> {
    return {
      data: page,
      accent: this.currentAccent
    };
  }
}
