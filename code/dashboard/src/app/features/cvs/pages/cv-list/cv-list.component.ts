import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CvApiService } from '../../../../core/services/cv-api.service';
import { AuthService } from '../../../../core/services/auth.service';
import { PdfExportService } from '../../../../core/services/pdf-export.service';
import { Cv } from '../../../../core/models/cv.model';
import { CvPreviewComponent, CvData, CvTemplateId } from '../../../../shared/components/cv-preview/cv-preview.component';
import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';
import { ButtonComponent } from '../../../../shared/components/button/button.component';
import { BadgeComponent } from '../../../../shared/components/badge/badge.component';
import { CardComponent } from '../../../../shared/components/card/card.component';
import { EmptyStateComponent } from '../../../../shared/components/feedback/empty-state.component';
import { SkeletonComponent } from '../../../../shared/components/feedback/skeleton.component';
import { ModalComponent } from '../../../../shared/components/modal/modal.component';

export interface CvItemDisplay {
  id: string;
  title: string;
  template: CvTemplateId;
  templateLabel: string;
  pages: number;
  date: string;
  updatedDate: string;
  isDefault: boolean;
  usedIn: number;
  rawCv: Cv;
}

@Component({
  selector: 'app-cv-list',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    FormsModule,
    CvPreviewComponent,
    PageHeaderComponent,
    ButtonComponent,
    BadgeComponent,
    CardComponent,
    EmptyStateComponent,
    SkeletonComponent,
    ModalComponent
  ],
  templateUrl: './cv-list.component.html',
  styleUrl: './cv-list.component.css'
})
export class CvListComponent implements OnInit {
  private cvApi = inject(CvApiService);
  private authService = inject(AuthService);
  private pdfService = inject(PdfExportService);
  private router = inject(Router);

  readonly allCvs = signal<CvItemDisplay[]>([]);
  readonly loading = signal<boolean>(true);
  readonly isImporting = signal<boolean>(false);

  // Vue, Recherche & Pagination
  readonly viewMode = signal<'grid' | 'list'>('grid');
  readonly searchQuery = signal<string>('');
  readonly currentPage = signal<number>(1);
  readonly pageSize = signal<number>(6);

  readonly filteredCvs = computed(() => {
    const q = this.searchQuery().trim().toLowerCase();
    const list = this.allCvs();
    if (!q) return list;
    return list.filter(c =>
      c.title.toLowerCase().includes(q) ||
      c.templateLabel.toLowerCase().includes(q)
    );
  });

  readonly totalPages = computed(() => {
    return Math.max(1, Math.ceil(this.filteredCvs().length / this.pageSize()));
  });

  readonly paginatedCvs = computed(() => {
    const start = (this.currentPage() - 1) * this.pageSize();
    return this.filteredCvs().slice(start, start + this.pageSize());
  });

  readonly pagesArray = computed(() => {
    const total = this.totalPages();
    return Array.from({ length: total }, (_, i) => i + 1);
  });

  menuOpenId: string | null = null;
  renameModalOpen = false;
  renamingCvId: string | null = null;
  newCvTitle = '';

  // Visualiser (Preview Modal) state
  previewModalOpen = signal(false);
  selectedCvForPreview = signal<CvItemDisplay | null>(null);

  // Traduire (Translate Modal) state
  translateModalOpen = signal(false);
  selectedCvForTranslate = signal<CvItemDisplay | null>(null);
  targetLanguage = signal<string>('Anglais');
  isTranslating = signal<boolean>(false);

  ngOnInit(): void {
    this.loadCvs();
  }

  loadCvs(): void {
    this.loading.set(true);
    this.cvApi.getCvs().subscribe({
      next: (cvs) => {
        this.allCvs.set(cvs.map((cv, index) => this.mapToDisplay(cv, index)));
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      }
    });
  }

  onSearchChange(val: string): void {
    this.searchQuery.set(val);
    this.currentPage.set(1);
  }

  setViewMode(mode: 'grid' | 'list'): void {
    this.viewMode.set(mode);
  }

  goToPage(p: number): void {
    if (p >= 1 && p <= this.totalPages()) {
      this.currentPage.set(p);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  prevPage(): void {
    this.goToPage(this.currentPage() - 1);
  }

  nextPage(): void {
    this.goToPage(this.currentPage() + 1);
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    const file = input.files[0];
    this.isImporting.set(true);

    this.cvApi.importCv(file).subscribe({
      next: (cv) => {
        this.isImporting.set(false);
        if (cv?.id) {
          this.router.navigate(['/cv-builder'], { queryParams: { cvId: cv.id } });
        } else {
          this.loadCvs();
        }
      },
      error: (err) => {
        this.isImporting.set(false);
        alert("Erreur lors de l'import du CV : " + (err.error?.detail || 'Fichier non supporté'));
      }
    });
  }

  private mapToDisplay(cv: Cv, index: number): CvItemDisplay {
    let createdFormatted = 'Récemment';
    let updatedFormatted = 'Aujourd’hui';

    if (cv.createdAt) {
      try {
        createdFormatted = new Date(cv.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
      } catch (e) {}
    }
    if (cv.updatedAt) {
      try {
        updatedFormatted = new Date(cv.updatedAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
      } catch (e) {}
    }

    const tCode = (cv.template || 'moderne') as CvTemplateId;

    return {
      id: cv.id,
      title: cv.title || 'CV Professionnel',
      template: tCode,
      templateLabel: cv.templateLabel || cv.template || 'Moderne Épuré',
      pages: tCode === 'classique' ? 2 : 1,
      date: createdFormatted,
      updatedDate: updatedFormatted,
      isDefault: index === 0,
      usedIn: 2 + index,
      rawCv: cv
    };
  }

  getCvData(item: CvItemDisplay): CvData {
    let data: any = null;
    if (item.rawCv?.contentJson) {
      try {
        data = typeof item.rawCv.contentJson === 'string'
          ? JSON.parse(item.rawCv.contentJson)
          : item.rawCv.contentJson;
      } catch (e) {}
    }

    const u = this.authService.currentUser();
    return {
      name: data?.identity?.fullName || data?.name || u?.fullName || 'Prénom Nom',
      title: data?.headline || data?.title || u?.targetRole || item.title || '',
      email: data?.identity?.email || data?.email || u?.email || '',
      phone: data?.identity?.phone || data?.phone || u?.phone || '',
      city: data?.identity?.city || data?.city || u?.city || '',
      summary: data?.summary || '',
      skills: data?.skills || [],
      experiences: (data?.experiences || []).map((e: any) => ({
        role: e.position || e.role || '',
        company: e.company || '',
        period: [e.startDate, e.endDate || (e.startDate ? 'Présent' : '')].filter(Boolean).join(' - ') || e.period || '',
        bullets: e.responsibilities || e.bullets || []
      })),
      education: (data?.education || []).map((edu: any) => ({
        degree: edu.degree || '',
        school: edu.school || '',
        year: edu.year || edu.period || ''
      })),
      languages: (data?.languages || []).map((l: any) => {
        if (typeof l === 'string') return { lang: l, level: '' };
        return { lang: l.lang || l.name || '', level: l.level || '' };
      })
    };
  }

  mathMin(a: number, b: number): number {
    return Math.min(a, b);
  }

  toggleMenu(id: string, event: Event): void {
    event.stopPropagation();
    this.menuOpenId = this.menuOpenId === id ? null : id;
  }

  closeMenu(): void {
    this.menuOpenId = null;
  }

  downloadPdf(item: CvItemDisplay, event: Event): void {
    event.stopPropagation();
    this.closeMenu();
    const cvData = this.getCvData(item);
    this.pdfService.exportCvPdf(cvData, item.rawCv.template || 'moderne');
  }

  openRenameModal(item: CvItemDisplay, event: Event): void {
    event.stopPropagation();
    this.closeMenu();
    this.renamingCvId = item.id;
    this.newCvTitle = item.title;
    this.renameModalOpen = true;
  }

  closeRenameModal(): void {
    this.renameModalOpen = false;
    this.renamingCvId = null;
  }

  saveRename(): void {
    if (!this.renamingCvId || !this.newCvTitle.trim()) return;
    const target = this.allCvs().find(c => c.id === this.renamingCvId);
    if (target) {
      target.title = this.newCvTitle.trim();
      this.cvApi.saveDraft(target.id, { title: target.title }).subscribe();
    }
    this.closeRenameModal();
  }

  openDuplicateModal(item: CvItemDisplay, event: Event): void {
    event.stopPropagation();
    this.closeMenu();
    const newTitle = `${item.title} (Copie)`;
    this.cvApi.createCv({
      title: newTitle,
      template: item.rawCv.template,
      contentJson: item.rawCv.contentJson
    }).subscribe({
      next: () => {
        this.loadCvs();
      }
    });
  }

  openDeleteModal(item: CvItemDisplay, event: Event): void {
    event.stopPropagation();
    this.closeMenu();
    this.deleteCv(item.id, event);
  }

  // Visualiser (Preview Modal)
  openPreviewModal(item: CvItemDisplay, event?: Event): void {
    if (event) event.stopPropagation();
    this.closeMenu();
    this.selectedCvForPreview.set(item);
    this.previewModalOpen.set(true);
  }

  closePreviewModal(): void {
    this.previewModalOpen.set(false);
    this.selectedCvForPreview.set(null);
  }

  // Traduire (Translate Modal)
  openTranslateModal(item: CvItemDisplay, event: Event): void {
    event.stopPropagation();
    this.closeMenu();
    this.selectedCvForTranslate.set(item);
    this.targetLanguage.set('Anglais');
    this.translateModalOpen.set(true);
  }

  closeTranslateModal(): void {
    this.translateModalOpen.set(false);
    this.selectedCvForTranslate.set(null);
  }

  executeTranslation(): void {
    const item = this.selectedCvForTranslate();
    if (!item || this.isTranslating()) return;
    this.isTranslating.set(true);

    const lang = this.targetLanguage();
    const cvData = this.getCvData(item);
    const newTitle = `${item.title} (${lang})`;

    this.cvApi.createCv({
      title: newTitle,
      template: item.rawCv.template,
      contentJson: item.rawCv.contentJson
    }).subscribe({
      next: (newCv) => {
        if (newCv?.id) {
          this.cvApi.aiEdit(newCv.id, `Traduis l'intégralité du contenu de ce CV en ${lang}.`, cvData).subscribe({
            next: () => {
              this.isTranslating.set(false);
              this.closeTranslateModal();
              this.loadCvs();
            },
            error: () => {
              this.isTranslating.set(false);
              this.closeTranslateModal();
              this.loadCvs();
            }
          });
        } else {
          this.isTranslating.set(false);
          this.closeTranslateModal();
          this.loadCvs();
        }
      },
      error: () => {
        this.isTranslating.set(false);
        this.closeTranslateModal();
      }
    });
  }

  deleteCv(id: string, event: Event): void {
    event.stopPropagation();
    this.closeMenu();
    this.cvApi.deleteCv(id).subscribe({
      next: () => {
        this.allCvs.set(this.allCvs().filter(c => c.id !== id));
      }
    });
  }
}
