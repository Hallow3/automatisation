import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

export type CvTemplateId =
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

export interface CvPageSection {
  key: CvSectionKey;
  isContinuation?: boolean;
  summary?: string;
  experiences?: CvExperience[];
  education?: CvEducation[];
  languages?: CvLanguage[];
  skills?: string[];
  projects?: CvProject[];
}

export interface CvPageData {
  pageNumber: number;
  totalPages: number;
  isFirstPage: boolean;
  sections: CvPageSection[];
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

@Component({
  selector: 'app-cv-preview',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './cv-preview.component.html',
  styleUrl: './cv-preview.component.css'
})
export class CvPreviewComponent {
  @Input() template: CvTemplateId = 'moderne';
  @Input() data: CvData = EMPTY_CV_DATA;
  @Input() set cv(val: CvData) { this.data = val; }
  @Input() scale = 1;
  @Input() accent = '#2563eb';
  @Input() showPageBreaks = true;

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

  get currentAccent(): string {
    if (this.data?.accent && this.data.accent !== '#2563eb') {
      return this.data.accent;
    }
    const templateAccents: Record<string, string> = {
      'moderne': '#2563eb',
      'senior-exec': '#831843',
      'split': '#0284c7',
      'classique': '#1e293b',
      'tech-lead': '#4f46e5',
      'executive-dark': '#0f172a',
      'nordic-minimal': '#059669',
      'creative-coral': '#ea580c',
      'compact-ats': '#334155',
      'editorial-slate': '#0d9488',
      'corporate-gold': '#b45309',
      'startup-innovative': '#7c3aed'
    };
    return templateAccents[this.template] || this.accent || '#2563eb';
  }

  /**
   * Calcule et découpe intelligemment le contenu du CV en véritables pages A4 indépendantes.
   * Remplissage maximal de la page 1 avec marge basse équilibrée (~30px).
   */
  get calculatedPages(): CvPageData[] {
    const rawOrder = this.data?.sectionOrder && this.data.sectionOrder.length > 0
      ? this.data.sectionOrder
      : ['summary', 'experiences', 'education', 'skills', 'languages', 'projects'];

    const defaultOrder: CvSectionKey[] = ['summary', 'experiences', 'education', 'skills', 'languages', 'projects'];
    const validRaw = (rawOrder as string[]).filter(k => defaultOrder.includes(k as CvSectionKey)) as CvSectionKey[];
    const activeOrder: CvSectionKey[] = [
      ...validRaw,
      ...defaultOrder.filter(k => !validRaw.includes(k))
    ];

    const pages: CvPageData[] = [
      { pageNumber: 1, totalPages: 1, isFirstPage: true, sections: [] }
    ];

    let currentPageIdx = 0;
    let currentHeight = 0;
    // Page 1 : 1123px - 48px padding - 75px header = 1000px budget utilisable réel
    let pageBudget = 1025;

    const startNewPage = () => {
      currentPageIdx++;
      // Page 2+ : 1123px - 48px padding = 1075px budget utilisable réel
      pageBudget = 1060;
      currentHeight = 0;
      pages.push({
        pageNumber: currentPageIdx + 1,
        totalPages: 1,
        isFirstPage: false,
        sections: []
      });
    };

    for (const key of activeOrder) {
      if (key === 'summary' && this.data.summary?.trim()) {
        const textLines = Math.ceil(this.data.summary.trim().length / 90);
        const h = 24 + (textLines * 15) + 12;
        if (currentHeight + h > pageBudget && currentHeight > 60) {
          startNewPage();
        }
        pages[currentPageIdx].sections.push({
          key: 'summary',
          summary: this.data.summary.trim()
        });
        currentHeight += h;
      }
      else if (key === 'experiences' && this.data.experiences && this.data.experiences.length > 0) {
        let currentExpList: CvExperience[] = [];
        let isFirstBlock = true;

        for (const exp of this.data.experiences) {
          const baseH = 18 + (exp.city ? 12 : 0) + (exp.description ? Math.ceil(exp.description.length / 90) * 15 + 4 : 0);
          const bullets = exp.bullets && exp.bullets.length > 0 ? exp.bullets : [];
          const headerCost = currentExpList.length === 0 ? 24 : 0;

          // Estimer la hauteur de chaque puce
          const bulletHeights = bullets.map(b => (Math.ceil((b?.length || 1) / 90) * 15) + 4);
          const totalBulletsH = bulletHeights.reduce((a, b) => a + b, 0);
          const fullExpH = baseH + totalBulletsH + 10;

          // Cas 1 : L'expérience entière rentre sur la page courante
          if (currentHeight + fullExpH + headerCost <= pageBudget || currentHeight <= 60) {
            currentExpList.push(exp);
            currentHeight += fullExpH + (currentExpList.length === 1 ? headerCost : 0);
          }
          // Cas 2 : L'expérience a plusieurs puces et une partie peut rentrer pour combler la page
          else if (bullets.length > 1 && currentHeight + baseH + bulletHeights[0] + headerCost <= pageBudget) {
            let availableH = pageBudget - currentHeight - baseH - headerCost - 10;
            let fitCount = 0;
            for (let bi = 0; bi < bullets.length; bi++) {
              if (availableH >= bulletHeights[bi]) {
                availableH -= bulletHeights[bi];
                fitCount++;
              } else {
                break;
              }
            }

            if (fitCount > 0) {
              // Pousser les premières puces sur la page courante
              currentExpList.push({
                ...exp,
                bullets: bullets.slice(0, fitCount)
              });
              pages[currentPageIdx].sections.push({
                key: 'experiences',
                isContinuation: !isFirstBlock,
                experiences: [...currentExpList]
              });
              currentExpList = [];
              isFirstBlock = false;

              // Démarrer la page suivante avec la suite des puces
              startNewPage();
              const remainingBullets = bullets.slice(fitCount);
              const remH = baseH + remainingBullets.map(b => (Math.ceil((b?.length || 1) / 90) * 15) + 4).reduce((a, b) => a + b, 0) + 10;
              currentExpList.push({
                ...exp,
                role: `${exp.role} (suite)`,
                description: undefined,
                bullets: remainingBullets
              });
              currentHeight += remH + 24;
            } else {
              if (currentExpList.length > 0) {
                pages[currentPageIdx].sections.push({
                  key: 'experiences',
                  isContinuation: !isFirstBlock,
                  experiences: [...currentExpList]
                });
                currentExpList = [];
                isFirstBlock = false;
              }
              startNewPage();
              currentExpList.push(exp);
              currentHeight += fullExpH + 24;
            }
          }
          // Cas 3 : Ne rentre pas, passer à la page suivante
          else {
            if (currentExpList.length > 0) {
              pages[currentPageIdx].sections.push({
                key: 'experiences',
                isContinuation: !isFirstBlock,
                experiences: [...currentExpList]
              });
              currentExpList = [];
              isFirstBlock = false;
            }
            startNewPage();
            currentExpList.push(exp);
            currentHeight += fullExpH + 24;
          }
        }

        if (currentExpList.length > 0) {
          pages[currentPageIdx].sections.push({
            key: 'experiences',
            isContinuation: !isFirstBlock,
            experiences: currentExpList
          });
        }
      }
      else if (key === 'education' && this.data.education && this.data.education.length > 0) {
        let currentEduList: CvEducation[] = [];
        let isFirstBlock = true;

        for (const edu of this.data.education) {
          const eduH = 26;
          const headerCost = currentEduList.length === 0 ? 24 : 0;

          if (currentHeight + eduH + headerCost > pageBudget && currentHeight > 60) {
            if (currentEduList.length > 0) {
              pages[currentPageIdx].sections.push({
                key: 'education',
                isContinuation: !isFirstBlock,
                education: [...currentEduList]
              });
              currentEduList = [];
              isFirstBlock = false;
            }
            startNewPage();
          }

          currentEduList.push(edu);
          currentHeight += eduH + (currentEduList.length === 1 ? 24 : 0);
        }

        if (currentEduList.length > 0) {
          pages[currentPageIdx].sections.push({
            key: 'education',
            isContinuation: !isFirstBlock,
            education: currentEduList
          });
        }
      }
      else if (key === 'skills' && this.data.skills && this.data.skills.length > 0) {
        let currentSkillList: string[] = [];
        let isFirstBlock = true;

        const chunkSize = 5;
        for (let i = 0; i < this.data.skills.length; i += chunkSize) {
          const chunk = this.data.skills.slice(i, i + chunkSize);
          const rowH = 24;
          const headerCost = currentSkillList.length === 0 ? 24 : 0;

          if (currentHeight + rowH + headerCost > pageBudget && currentHeight > 60) {
            if (currentSkillList.length > 0) {
              pages[currentPageIdx].sections.push({
                key: 'skills',
                isContinuation: !isFirstBlock,
                skills: [...currentSkillList]
              });
              currentSkillList = [];
              isFirstBlock = false;
            }
            startNewPage();
          }

          currentSkillList.push(...chunk);
          currentHeight += rowH + (currentSkillList.length === chunk.length ? 24 : 0);
        }

        if (currentSkillList.length > 0) {
          pages[currentPageIdx].sections.push({
            key: 'skills',
            isContinuation: !isFirstBlock,
            skills: currentSkillList
          });
        }
      }
      else if (key === 'languages' && this.data.languages && this.data.languages.length > 0) {
        let currentLangList: CvLanguage[] = [];
        let isFirstBlock = true;

        for (const lang of this.data.languages) {
          const langH = 18;
          const headerCost = currentLangList.length === 0 ? 24 : 0;

          if (currentHeight + langH + headerCost > pageBudget && currentHeight > 60) {
            if (currentLangList.length > 0) {
              pages[currentPageIdx].sections.push({
                key: 'languages',
                isContinuation: !isFirstBlock,
                languages: [...currentLangList]
              });
              currentLangList = [];
              isFirstBlock = false;
            }
            startNewPage();
          }

          currentLangList.push(lang);
          currentHeight += langH + (currentLangList.length === 1 ? 24 : 0);
        }

        if (currentLangList.length > 0) {
          pages[currentPageIdx].sections.push({
            key: 'languages',
            isContinuation: !isFirstBlock,
            languages: currentLangList
          });
        }
      }
      else if (key === 'projects' && this.data.projects && this.data.projects.length > 0) {
        let currentProjList: CvProject[] = [];
        let isFirstBlock = true;

        for (const proj of this.data.projects) {
          const projH = 22;
          const headerCost = currentProjList.length === 0 ? 24 : 0;

          if (currentHeight + projH + headerCost > pageBudget && currentHeight > 60) {
            if (currentProjList.length > 0) {
              pages[currentPageIdx].sections.push({
                key: 'projects',
                isContinuation: !isFirstBlock,
                projects: [...currentProjList]
              });
              currentProjList = [];
              isFirstBlock = false;
            }
            startNewPage();
          }

          currentProjList.push(proj);
          currentHeight += projH + (currentProjList.length === 1 ? 24 : 0);
        }

        if (currentProjList.length > 0) {
          pages[currentPageIdx].sections.push({
            key: 'projects',
            isContinuation: !isFirstBlock,
            projects: currentProjList
          });
        }
      }
    }

    // Mettre à jour le total des pages sur toutes les instances
    const total = pages.length;
    pages.forEach(p => p.totalPages = total);

    return pages;
  }
}
