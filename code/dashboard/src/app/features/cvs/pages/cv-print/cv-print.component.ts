import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { CvApiService } from '../../../../core/services/cv-api.service';
import { CvPreviewComponent, CvData, CvExperience, CvEducation, CvLanguage, CvLink, CvTemplateId } from '../../../../shared/components/cv-preview/cv-preview.component';
import { normalizeTemplateKey } from '../../../../shared/components/cv-templates/template-registry';
import { SAMPLE_CIVIL_ENGINEER_CV } from '../../../../shared/components/cv-templates/sample-cv-data';

/**
 * Route isolée dédiée à l'impression haute fidélité (Chromium headless / Native Print).
 * URL : /print/cv/:id
 */
@Component({
  selector: 'app-cv-print',
  standalone: true,
  imports: [CommonModule, CvPreviewComponent],
  templateUrl: './cv-print.component.html',
  styleUrl: './cv-print.component.css'
})
export class CvPrintComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private cvApi = inject(CvApiService);

  cvId = signal<string>('sample');
  template = signal<CvTemplateId>('modern');
  cvData = signal<CvData | null>(null);
  loading = signal<boolean>(true);
  isReady = signal<boolean>(false);

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id') || 'sample';
    const queryTpl = this.route.snapshot.queryParamMap.get('template');
    const printToken = this.route.snapshot.queryParamMap.get('token');
    const autoPrint = this.route.snapshot.queryParamMap.get('print') === 'true';

    this.cvId.set(id);
    if (queryTpl) {
      this.template.set(normalizeTemplateKey(queryTpl));
    }

    if (id === 'sample' || id === 'demo') {
      this.cvData.set(SAMPLE_CIVIL_ENGINEER_CV);
      this.markAsReady(autoPrint);
      return;
    }

    // Charger les données réelles du CV : soit via le jeton éphémère (Chromium), soit via la session candidate
    const data$ = printToken
      ? this.cvApi.getCvPrintData(id, printToken)
      : this.cvApi.getCv(id);

    data$.subscribe({
      next: (cv) => {
        // Priorité absolue au query paramètre demandé par l'exporteur
        if (queryTpl) {
          this.template.set(normalizeTemplateKey(queryTpl));
        } else if (cv?.template) {
          this.template.set(normalizeTemplateKey(cv.template));
        }

        if (cv?.contentJson) {
          try {
            const parsed = typeof cv.contentJson === 'string'
              ? JSON.parse(cv.contentJson)
              : cv.contentJson;
            this.cvData.set(this.normalizeCvData(parsed, cv));
          } catch (e) {
            this.loadFallbackData();
          }
        } else {
          this.loadFallbackData();
        }
        this.markAsReady(autoPrint);
      },
      error: () => {
        this.loadFallbackData();
        this.markAsReady(autoPrint);
      }
    });
  }

  private normalizeCvData(raw: any, cvMeta?: any): CvData {
    if (!raw) return SAMPLE_CIVIL_ENGINEER_CV;

    const identity = raw.identity || {};
    const name = (raw.name || raw.fullName || identity.fullName || identity.name || cvMeta?.candidateName || cvMeta?.title || '').trim();
    const title = (raw.title || raw.headline || identity.title || identity.headline || identity.role || '').trim();
    const email = (raw.email || identity.email || '').trim();
    const phone = (raw.phone || identity.phone || '').trim();
    const city = (raw.city || identity.city || identity.location || '').trim();
    const linkedin = (raw.linkedin || identity.linkedin || '').trim();
    const summary = (raw.summary || raw.profile || raw.about || raw.bio || '').trim();

    // Skills
    const rawSkills = Array.isArray(raw.skills) ? raw.skills : [];
    const skills: string[] = [];
    const seenSkills = new Set<string>();
    for (const s of rawSkills) {
      const str = (typeof s === 'string' ? s : s?.name || s?.skill || '').trim();
      if (str && !seenSkills.has(str)) {
        seenSkills.add(str);
        skills.push(str);
      }
    }

    // Experiences
    const rawExperiences = Array.isArray(raw.experiences) ? raw.experiences : [];
    const experiences: CvExperience[] = rawExperiences.map((e: any) => {
      const role = (e.role || e.position || e.jobTitle || e.title || '').trim();
      const company = (e.company || e.employer || e.organization || e.name || '').trim();
      const expCity = (e.city || e.location || '').trim();

      let period = (e.period || '').trim();
      if (!period && (e.startDate || e.endDate)) {
        const start = (e.startDate || '').trim();
        const end = (e.endDate || (start ? 'Présent' : '')).trim();
        period = [start, end].filter(Boolean).join(' - ');
      }

      const description = (e.description || e.context || '').trim();

      const rawBullets = [
        ...(Array.isArray(e.bullets) ? e.bullets : (typeof e.bullets === 'string' && e.bullets.trim() ? [e.bullets] : [])),
        ...(Array.isArray(e.responsibilities) ? e.responsibilities : (typeof e.responsibilities === 'string' && e.responsibilities.trim() ? [e.responsibilities] : [])),
        ...(Array.isArray(e.achievements) ? e.achievements : (typeof e.achievements === 'string' && e.achievements.trim() ? [e.achievements] : []))
      ];

      const bullets: string[] = [];
      const seenBullets = new Set<string>();
      for (const b of rawBullets) {
        const str = String(b || '').trim();
        if (str && !seenBullets.has(str)) {
          seenBullets.add(str);
          bullets.push(str);
        }
      }

      return {
        role,
        company,
        city: expCity,
        period,
        description,
        bullets
      };
    }).filter((e: CvExperience) => e.role || e.company || e.description || (e.bullets && e.bullets.length > 0));

    // Education
    const rawEducation = Array.isArray(raw.education) ? raw.education : [];
    const education: CvEducation[] = rawEducation.map((edu: any) => ({
      degree: (edu.degree || edu.diploma || edu.title || '').trim(),
      school: (edu.school || edu.institution || edu.university || '').trim(),
      year: (edu.year || edu.date || edu.period || [edu.startDate, edu.endDate].filter(Boolean).join(' - ') || '').trim()
    })).filter((edu: CvEducation) => edu.degree || edu.school);

    // Languages
    const rawLanguages = Array.isArray(raw.languages) ? raw.languages : [];
    const languages: CvLanguage[] = rawLanguages.map((l: any) => {
      if (typeof l === 'string') {
        const match = l.match(/^([^(]+)(?:\(([^)]+)\))?$/);
        if (match) {
          return { lang: match[1].trim(), level: match[2]?.trim() || '' };
        }
        return { lang: l.trim(), level: '' };
      }
      return {
        lang: (l?.lang || l?.name || l?.language || '').trim(),
        level: (l?.level || '').trim()
      };
    }).filter((l: CvLanguage) => l.lang);

    // Links
    const rawLinks = Array.isArray(raw.links) ? raw.links : [];
    const links: CvLink[] = rawLinks.map((link: any) => ({
      label: (link.label || 'Lien').trim(),
      url: (link.url || '').trim()
    })).filter((link: CvLink) => link.url);

    if (linkedin && !links.some(l => l.url.includes('linkedin.com'))) {
      links.push({ label: 'LinkedIn', url: linkedin });
    }

    return {
      name: name || 'Candidat',
      title: title || 'Titre Professionnel',
      email,
      phone,
      city,
      summary,
      skills,
      experiences,
      education,
      languages,
      links,
      linkedin,
      accent: raw.accent || '#2563eb',
      sectionOrder: Array.isArray(raw.sectionOrder) && raw.sectionOrder.length > 0
        ? raw.sectionOrder
        : ['summary', 'experiences', 'education', 'skills', 'languages', 'projects']
    };
  }

  private loadFallbackData(): void {
    try {
      const localDraft = localStorage.getItem('fallajobs_cv_draft_latest') || localStorage.getItem('getjob_cv_draft_latest');
      if (localDraft) {
        const parsed = JSON.parse(localDraft);
        this.cvData.set(this.normalizeCvData(parsed));
        return;
      }
    } catch (e) {}
    this.cvData.set(SAMPLE_CIVIL_ENGINEER_CV);
  }

  private markAsReady(autoPrint: boolean): void {
    this.loading.set(false);
    setTimeout(() => {
      this.isReady.set(true);
      document.body.classList.add('cv-print-ready');
      if (autoPrint) {
        setTimeout(() => window.print(), 300);
      }
    }, 250);
  }
}
