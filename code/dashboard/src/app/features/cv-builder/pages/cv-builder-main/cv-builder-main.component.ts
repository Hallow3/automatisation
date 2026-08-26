import { Component, OnInit, OnDestroy, inject, signal, computed, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormArray, FormGroup, FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { GeminiLiveService } from '../../../../core/services/gemini-live.service';
import { CvApiService } from '../../../../core/services/cv-api.service';
import { CvEditorService } from '../../../../core/services/cv-editor.service';
import { AuthService } from '../../../../core/services/auth.service';
import { PdfExportService } from '../../../../core/services/pdf-export.service';
import { CvPreviewComponent, CvTemplateId, CvData, CvSectionKey, createDefaultCvData } from '../../../../shared/components/cv-preview/cv-preview.component';
import { CvThumbnailComponent, CvThumbnailLayout } from '../../../../shared/components/cv-thumbnail/cv-thumbnail.component';
import { PageHeaderComponent, Crumb } from '../../../../shared/components/page-header/page-header.component';
import { ButtonComponent } from '../../../../shared/components/button/button.component';
import { BadgeComponent } from '../../../../shared/components/badge/badge.component';
import { CardComponent } from '../../../../shared/components/card/card.component';
import { CardHeaderComponent } from '../../../../shared/components/card/card-header.component';
import { TabsComponent, TabItem } from '../../../../shared/components/tabs/tabs.component';

type Phase = 'templates' | 'editor' | 'voice' | 'wizard';
type RightTab = 'sections' | 'ai' | 'template';

export interface TemplateCard {
  id: CvTemplateId;
  name: string;
  category: 'senior' | 'modern' | 'tech' | 'classic' | 'creative' | 'minimal';
  badge: string;
  tag: string;
  description: string;
  layout: CvThumbnailLayout;
  accent: string;
  pages: string;
  features: string[];
}

interface AiMessage {
  id: string;
  role: 'assistant' | 'user';
  content: string;
}

@Component({
  selector: 'app-cv-builder-main',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    RouterLink,
    CvPreviewComponent,
    CvThumbnailComponent,
    PageHeaderComponent,
    ButtonComponent,
    BadgeComponent,
    CardComponent,
    CardHeaderComponent,
    TabsComponent
  ],
  templateUrl: './cv-builder-main.component.html',
  styleUrl: './cv-builder-main.component.css'
})
export class CvBuilderMainComponent implements OnInit, OnDestroy {
  private geminiService = inject(GeminiLiveService);
  readonly editor = inject(CvEditorService);
  private authService = inject(AuthService);
  private pdfService = inject(PdfExportService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private cvApi = inject(CvApiService);
  private destroyRef = inject(DestroyRef);

  currentPhase: Phase = 'templates';
  currentCvId: string | null = null;
  isLoadingCv = signal(false);

  selectedTemplate = signal<CvTemplateId>('moderne');
  activeRightTab: RightTab = 'sections';
  zoomLevel = signal<number>(0.9);
  newSkillInput = '';
  isImporting = signal(false);

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    const file = input.files[0];
    this.isImporting.set(true);

    this.cvApi.importCv(file).subscribe({
      next: (cv) => {
        this.isImporting.set(false);
        if (cv?.id) {
          this.loadCvById(cv.id);
          this.currentPhase = 'editor';
        }
      },
      error: (err) => {
        this.isImporting.set(false);
        alert("Erreur lors de l'import du CV : " + (err.error?.detail || 'Fichier non supporté'));
      }
    });
  }

  // Wizard state (Phase 3 Questionnaire IA)
  currentWizardStep = signal<number>(1);
  readonly wizardTotalSteps = 5;

  nextWizardStep(): void {
    if (this.currentWizardStep() < this.wizardTotalSteps) {
      this.currentWizardStep.update(s => s + 1);
    } else {
      this.finishWizard();
    }
  }

  prevWizardStep(): void {
    if (this.currentWizardStep() > 1) {
      this.currentWizardStep.update(s => s - 1);
    }
  }

  finishWizard(): void {
    this.saveManually();
    this.currentPhase = 'editor';
  }

  templateBreadcrumbs: Crumb[] = [
    { label: 'Mes CV', to: '/cvs' },
    { label: 'Nouveau CV' },
    { label: 'Choisir un modèle' }
  ];

  // Accordion state
  expandedSections = {
    identity: true,
    summary: true,
    experiences: true,
    education: true,
    skills: true,
    languages: true
  };

  // Mobile preview bottom sheet state
  showMobilePreview = signal<boolean>(false);
  mobileScaleMode = signal<'fit' | 'read'>('fit');
  mobileZoom = signal<number>(0.45);

  openMobilePreview(): void {
    this.mobileScaleMode.set('fit');
    this.showMobilePreview.set(true);
  }

  closeMobilePreview(): void {
    this.showMobilePreview.set(false);
  }

  toggleMobilePreview(): void {
    if (!this.showMobilePreview()) {
      this.mobileScaleMode.set('fit');
    }
    this.showMobilePreview.update(v => !v);
  }

  getMobileScale(): number {
    if (this.mobileScaleMode() === 'read') {
      return this.mobileZoom();
    }
    if (typeof window === 'undefined') return 0.45;
    const screenW = window.innerWidth;
    const padding = 28; // 14px on each side
    const availableW = Math.max(260, Math.min(screenW - padding, 750));
    return Math.min(1, Math.round((availableW / 794) * 100) / 100);
  }

  setMobileScaleMode(mode: 'fit' | 'read'): void {
    this.mobileScaleMode.set(mode);
    if (mode === 'read') {
      this.mobileZoom.set(0.9);
    }
  }

  zoomInMobile(): void {
    this.mobileScaleMode.set('read');
    this.mobileZoom.update(z => Math.min(1.3, Math.round((z + 0.1) * 10) / 10));
  }

  zoomOutMobile(): void {
    this.mobileScaleMode.set('read');
    this.mobileZoom.update(z => Math.max(0.3, Math.round((z - 0.1) * 10) / 10));
  }

  rightTabs: TabItem[] = [
    { id: 'sections', label: 'Formulaire' },
    { id: 'ai', label: 'Assistant IA' },
    { id: 'template', label: 'Modèles' }
  ];

  aiMessages: AiMessage[] = [
    {
      id: 'm1',
      role: 'assistant',
      content: 'Bonjour ! Je peux vous aider à formuler vos expériences, chiffrer vos réalisations ou ajuster le ton de votre CV. Que souhaitez-vous perfectionner ?'
    }
  ];
  aiInput = '';

  // Templates categories
  templateCategories = [
    { id: 'all', label: 'Tous les modèles' },
    { id: 'senior', label: '⭐ Senior & Exécutif' },
    { id: 'modern', label: '🚀 Moderne & Épuré' },
    { id: 'tech', label: '💻 Tech & Ingénierie' },
    { id: 'classic', label: '🏛️ Classique & ATS' },
    { id: 'minimal', label: '🌿 Minimaliste' },
    { id: 'creative', label: '🎨 Créatif & Design' }
  ];

  selectedCategory = signal<string>('all');
  searchTemplateQuery = signal<string>('');
  templatePage = signal<number>(1);
  templatePageSize = signal<number>(6);

  // Full rich templates catalog (Section 16 + Multi-templates)
  templateOptions: TemplateCard[] = [
    {
      id: 'moderne',
      name: 'Moderne Épuré',
      category: 'modern',
      badge: 'Populaire',
      tag: 'Polyvalent & Épuré',
      description: 'Mise en page épurée à une colonne avec repères visuels clairs. Maximise la lisibilité pour tout type de profil.',
      layout: 'sidebar',
      accent: '#2563eb',
      pages: '1–2 pages',
      features: ['Hiérarchie stricte', 'Compétences mises en valeur', 'Idéal profils techniques & juniors']
    },
    {
      id: 'senior-exec',
      name: 'Senior Exécutif & Direction',
      category: 'senior',
      badge: 'Senior 10+ ans',
      tag: 'Direction, Management & Stratégie',
      description: 'Structure dense et prestigieuse valorisant le leadership, les budgets gérés, équipes encadrées et impacts stratégiques chiffrés.',
      layout: 'editorial',
      accent: '#831843',
      pages: '2 pages',
      features: ['Bandeau exécutif noble', 'Focus réalisations chiffrées', 'Parcours managérial valorisé']
    },
    {
      id: 'split',
      name: 'Deux Colonnes Pro',
      category: 'modern',
      badge: 'Équilibré',
      tag: 'Devs, Créatifs & Marketing',
      description: 'Sidebar dédiée aux compétences clés, langues et coordonnées. Idéal pour un CV visuellement dense et structuré.',
      layout: 'sidebar',
      accent: '#0284c7',
      pages: '1–2 pages',
      features: ['Compétences immédiates', 'Deux colonnes nettes', 'Lecture rapide']
    },
    {
      id: 'classique',
      name: 'Classique Pro & ATS',
      category: 'classic',
      badge: 'ATS 100%',
      tag: 'Banque, Conseil & Grands Groupes',
      description: 'Structure chronologique conventionnelle et sobre, rassurante pour les grands groupes et cabinets de recrutement.',
      layout: 'classic',
      accent: '#1e293b',
      pages: '1–2 pages',
      features: ['100 % textuel & ATS compliant', 'Format institutionnel sobre', 'Zéro fioriture']
    },
    {
      id: 'tech-lead',
      name: 'Tech Lead & Architecte',
      category: 'tech',
      badge: 'Tech & Cloud',
      tag: 'Développeurs, DevOps & Architectes',
      description: 'Conçu pour mettre en avant les stacks technologiques, projets GitHub, déploiements cloud et contributions techniques.',
      layout: 'tech',
      accent: '#4f46e5',
      pages: '1–2 pages',
      features: ['Badges de technologies', 'Projets et GitHub valorisés', 'Méthodologies Agile']
    },
    {
      id: 'executive-dark',
      name: 'Exécutif Leader Sombre',
      category: 'senior',
      badge: 'Prestige',
      tag: 'C-Level, VP & Directeurs',
      description: 'En-tête sombre élégant avec monogramme de marque, reflétant autorité, crédibilité et maturité professionnelle.',
      layout: 'header-dark',
      accent: '#0f172a',
      pages: '2 pages',
      features: ['Header sombre haute autorité', 'Monogramme exécutif', 'Présentation statutaire']
    },
    {
      id: 'nordic-minimal',
      name: 'Nordique Minimaliste',
      category: 'minimal',
      badge: 'Design Épuré',
      tag: 'Design, Produit & Tech',
      description: 'Typographie soignée et grands espaces blancs selon les principes du design scandinave. Une élégance subtile.',
      layout: 'minimal',
      accent: '#059669',
      pages: '1–2 pages',
      features: ['Typographie aérée', 'Lignes ultra fines', 'Lecture fluide et reposante']
    },
    {
      id: 'creative-coral',
      name: 'Créatif & Impact Visuel',
      category: 'creative',
      badge: 'Créatif',
      tag: 'Designers, UI/UX & Communication',
      description: 'Touches colorées dynamiques et timeline d\'expériences expressive pour capter l\'attention dès les 5 premières secondes.',
      layout: 'sidebar',
      accent: '#ea580c',
      pages: '1–2 pages',
      features: ['Touche corail vive', 'Disposition dynamique', 'Idéal univers créatif & agences']
    },
    {
      id: 'compact-ats',
      name: 'Compact Haute Densité',
      category: 'minimal',
      badge: 'Haute Densité',
      tag: 'Profils Expérimentés (10+ ans)',
      description: 'Optimisation millimétrée de chaque ligne pour faire tenir une carrière riche et dense sans sacrifier la lisibilité.',
      layout: 'compact',
      accent: '#334155',
      pages: '1–2 pages',
      features: ['Espacements ultra optimisés', 'Maximum d\'expériences au cm²', '100% lisible par les robots']
    },
    {
      id: 'editorial-slate',
      name: 'Éditorial & Conseil',
      category: 'classic',
      badge: 'Éditorial',
      tag: 'Consulting, Juridique & Audit',
      description: 'Mise en page inspirée de la presse économique avec encart de profil mis en valeur et élégance sobre.',
      layout: 'editorial',
      accent: '#0d9488',
      pages: '1–2 pages',
      features: ['Encart profil éditorial', 'Typographie classique premium', 'Rigoureux et structuré']
    },
    {
      id: 'corporate-gold',
      name: 'Corporate Prestige Gold',
      category: 'senior',
      badge: 'Prestige Finance',
      tag: 'Finance, M&A & Private Equity',
      description: 'Finitions ambrées et dorées discrètes, parfait pour les profils en finance de marché, banque d\'affaires et direction financière.',
      layout: 'corporate',
      accent: '#b45309',
      pages: '2 pages',
      features: ['Accents dorés prestigieux', 'Structure chronologique d\'élite', 'Idéal finance & consulting']
    },
    {
      id: 'startup-innovative',
      name: 'Startup & Growth',
      category: 'tech',
      badge: 'Agile & Growth',
      tag: 'Product Managers, Growth & Startups',
      description: 'Format moderne axé sur les résultats, KPIs, métriques d\'impact et méthodologies innovantes.',
      layout: 'compact',
      accent: '#7c3aed',
      pages: '1–2 pages',
      features: ['Focus KPIs & métriques', 'Format agile et moderne', 'Badges de compétences vives']
    }
  ];

  readonly filteredTemplates = computed(() => {
    const cat = this.selectedCategory();
    const q = this.searchTemplateQuery().trim().toLowerCase();
    return this.templateOptions.filter(t => {
      const matchCat = cat === 'all' || t.category === cat;
      const matchQuery = !q ||
        t.name.toLowerCase().includes(q) ||
        t.tag.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        t.features.some(f => f.toLowerCase().includes(f));
      return matchCat && matchQuery;
    });
  });

  readonly totalTemplatePages = computed(() => {
    return Math.max(1, Math.ceil(this.filteredTemplates().length / this.templatePageSize()));
  });

  readonly paginatedTemplates = computed(() => {
    const start = (this.templatePage() - 1) * this.templatePageSize();
    return this.filteredTemplates().slice(start, start + this.templatePageSize());
  });

  readonly templatePagesArray = computed(() => {
    const total = this.totalTemplatePages();
    return Array.from({ length: total }, (_, i) => i + 1);
  });

  selectCategory(cat: string): void {
    this.selectedCategory.set(cat);
    this.templatePage.set(1);
  }

  onSearchTemplateChange(val: string): void {
    this.searchTemplateQuery.set(val);
    this.templatePage.set(1);
  }

  goToTemplatePage(p: number): void {
    if (p >= 1 && p <= this.totalTemplatePages()) {
      this.templatePage.set(p);
    }
  }

  prevTemplatePage(): void {
    this.goToTemplatePage(this.templatePage() - 1);
  }

  nextTemplatePage(): void {
    this.goToTemplatePage(this.templatePage() + 1);
  }

  readonly previewData = computed<CvData>(() => this.editor.cvData());
  readonly saveStatus = computed(() => this.editor.saveStatus());

  ngOnInit(): void {
    this.route.queryParamMap.pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(params => {
      const action = params.get('action');
      const cvId = params.get('cvId');

      if (action === 'interview') {
        this.router.navigate(['/cvs', 'cv_' + Date.now(), 'interview']);
      } else if (action === 'editor' || cvId) {
        this.currentPhase = 'editor';
        if (cvId) this.loadCvById(cvId);
        else this.loadFromDraftOrLatest();
      } else {
        this.currentPhase = 'templates';
      }
    });

    this.editor.form.valueChanges.pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(() => this.refreshPreview());
  }

  ngOnDestroy(): void {
    this.editor.destroy();
  }

  private loadCvById(cvId: string): void {
    this.currentCvId = cvId;
    this.isLoadingCv.set(true);

    const draft = this.geminiService.currentDraft();
    this.editor.init(cvId, draft || null);
    this.refreshPreview();

    this.cvApi.getCv(cvId).subscribe({
      next: (cv) => {
        if (cv?.contentJson) {
          this.editor.init(cvId, cv.contentJson);
          this.refreshPreview();
          if (cv.template) {
            this.selectedTemplate.set(cv.template as CvTemplateId);
          }
        }
        this.isLoadingCv.set(false);
      },
      error: () => {
        this.isLoadingCv.set(false);
      }
    });
  }

  private loadFromDraftOrLatest(): void {
    const draft = this.geminiService.currentDraft();
    this.editor.init('latest', draft || null);
    this.refreshPreview();
  }

  private refreshPreview(): void {
    this.editor.cvData.set(this.editor.toCvData());
  }

  setPhase(phase: Phase): void {
    if (phase === 'voice') {
      this.router.navigate(['/cvs', 'cv_' + Date.now(), 'interview']);
      return;
    }
    this.currentPhase = phase;
  }

  selectTemplate(id: CvTemplateId): void {
    this.selectedTemplate.set(id);
  }

  goToEditor(): void {
    if (!this.currentCvId) {
      const template = this.selectedTemplate();
      const templateName = this.templateOptions.find(t => t.id === template)?.name || 'Moderne';
      this.isLoadingCv.set(true);
      this.cvApi.createCv({
        title: `CV ${templateName}`,
        template: template
      }).subscribe({
        next: (newCv) => {
          this.currentCvId = newCv.id;
          this.router.navigate([], {
            relativeTo: this.route,
            queryParams: { action: 'editor', cvId: newCv.id },
            queryParamsHandling: 'merge'
          });
          this.currentPhase = 'editor';
          this.loadCvById(newCv.id);
        },
        error: () => {
          this.currentPhase = 'editor';
          this.loadFromDraftOrLatest();
        }
      });
    } else {
      this.currentPhase = 'editor';
    }
  }

  setRightTab(tab: string): void {
    this.activeRightTab = tab as RightTab;
  }

  toggleSection(section: keyof typeof this.expandedSections): void {
    this.expandedSections[section] = !this.expandedSections[section];
  }

  zoomIn(): void {
    this.zoomLevel.update(z => Math.min(1.3, Math.round((z + 0.1) * 10) / 10));
  }

  zoomOut(): void {
    this.zoomLevel.update(z => Math.max(0.6, Math.round((z - 0.1) * 10) / 10));
  }

  resetZoom(): void {
    this.zoomLevel.set(0.9);
  }

  isAiLoading = signal(false);

  sendAiMessage(promptText?: string): void {
    const text = promptText || this.aiInput;
    if (!text.trim() || this.isAiLoading()) return;

    this.aiMessages.push({
      id: 'msg_' + Date.now(),
      role: 'user',
      content: text.trim()
    });

    if (!promptText) this.aiInput = '';
    this.isAiLoading.set(true);

    const cvId = this.currentCvId || 'latest';
    this.cvApi.aiEdit(cvId, text.trim(), this.editor.toCvData()).subscribe({
      next: (updatedCv) => {
        this.isAiLoading.set(false);
        if (updatedCv?.contentJson) {
          try {
            const parsed = typeof updatedCv.contentJson === 'string'
              ? JSON.parse(updatedCv.contentJson)
              : updatedCv.contentJson;
            this.editor.patchFromData(parsed);
            this.refreshPreview();
          } catch (e) {}
        }
        this.aiMessages.push({
          id: 'msg_' + Date.now(),
          role: 'assistant',
          content: '✨ Votre CV a été optimisé avec succès selon votre demande ! Vous pouvez visualiser les changements en direct.'
        });
      },
      error: () => {
        this.isAiLoading.set(false);
        this.aiMessages.push({
          id: 'msg_' + Date.now(),
          role: 'assistant',
          content: 'Désolé, une erreur est survenue lors de l’optimisation de votre CV. Veuillez réessayer.'
        });
      }
    });
  }

  saveManually(): void {
    this.editor.saveNow();
  }

  downloadCurrentPdf(): void {
    this.pdfService.exportCvPdf(this.previewData(), this.selectedTemplate());
  }

  // Form helpers
  get links(): FormArray { return this.editor.links; }
  get experiences(): FormArray { return this.editor.experiences; }
  get education(): FormArray { return this.editor.education; }
  get skills(): FormArray { return this.editor.skills; }
  get languages(): FormArray { return this.editor.languages; }
  get sectionOrder(): CvSectionKey[] { return this.editor.sectionOrder(); }

  asFormGroup(ctrl: any): FormGroup { return ctrl as FormGroup; }

  moveSectionUp(key: CvSectionKey, event?: Event): void {
    if (event) event.stopPropagation();
    this.editor.moveSectionUp(key);
  }

  moveSectionDown(key: CvSectionKey, event?: Event): void {
    if (event) event.stopPropagation();
    this.editor.moveSectionDown(key);
  }

  isFirstSection(key: CvSectionKey): boolean {
    const list = this.editor.sectionOrder();
    return list.indexOf(key) === 0;
  }

  isLastSection(key: CvSectionKey): boolean {
    const list = this.editor.sectionOrder();
    return list.indexOf(key) === list.length - 1;
  }

  addLink(label = 'Lien', url = ''): void {
    this.editor.addLink(label, url);
  }
  removeLink(i: number): void {
    this.editor.removeLink(i);
  }

  addExperience(): void {
    this.editor.experiences.push(this.editor.newExperience());
  }
  removeExperience(i: number): void {
    this.editor.experiences.removeAt(i);
  }

  addEducation(): void {
    this.editor.education.push(this.editor.newEducation());
  }
  removeEducation(i: number): void {
    this.editor.education.removeAt(i);
  }

  addSkill(): void {
    this.handleAddSkill();
  }

  handleAddSkill(): void {
    if (this.newSkillInput.trim()) {
      this.editor.skills.push(this.editor.fb.control(this.newSkillInput.trim()));
      this.newSkillInput = '';
    }
  }

  removeSkill(i: number): void {
    this.editor.skills.removeAt(i);
  }

  getResponsibilities(expIndex: number): FormArray {
    const exp = this.experiences.at(expIndex) as FormGroup;
    return this.editor.getResponsibilities(exp);
  }

  addResponsibility(expIndex: number): void {
    const exp = this.experiences.at(expIndex) as FormGroup;
    this.editor.addResponsibility(exp);
  }

  removeResponsibility(expIndex: number, respIndex: number): void {
    const exp = this.experiences.at(expIndex) as FormGroup;
    this.editor.removeResponsibility(exp, respIndex);
  }

  addLanguage(): void {
    this.editor.languages.push(this.editor.newLanguage());
  }
  removeLanguage(i: number): void {
    this.editor.languages.removeAt(i);
  }

  getSelectedTemplateCard(): TemplateCard | undefined {
    return this.templateOptions.find(t => t.id === this.selectedTemplate());
  }
}
