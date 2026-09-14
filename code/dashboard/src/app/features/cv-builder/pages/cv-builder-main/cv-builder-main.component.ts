import { Component, OnInit, OnDestroy, inject, signal, computed, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormArray, FormGroup, FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { GeminiLiveService } from '../../../../core/services/gemini-live.service';
import { CvApiService } from '../../../../core/services/cv-api.service';
import { CvEditorService } from '../../../../core/services/cv-editor.service';
import { AuthService } from '../../../../core/services/auth.service';
import { PdfExportService } from '../../../../core/services/pdf-export.service';
import { PaymentService } from '../../../../core/services/payment.service';
import { PaymentModalComponent } from '../../../../shared/components/payment-modal/payment-modal.component';
import { CvPreviewComponent, CvTemplateId, CvData, CvSectionKey, createDefaultCvData } from '../../../../shared/components/cv-preview/cv-preview.component';
import { normalizeTemplateKey } from '../../../../shared/components/cv-templates/template-registry';
import { SAMPLE_CIVIL_ENGINEER_CV } from '../../../../shared/components/cv-templates/sample-cv-data';
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
    TabsComponent,
    PaymentModalComponent
  ],
  templateUrl: './cv-builder-main.component.html',
  styleUrl: './cv-builder-main.component.css'
})
export class CvBuilderMainComponent implements OnInit, OnDestroy {
  private geminiService = inject(GeminiLiveService);
  readonly editor = inject(CvEditorService);
  private authService = inject(AuthService);
  private pdfService = inject(PdfExportService);
  public paymentService = inject(PaymentService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private cvApi = inject(CvApiService);
  private destroyRef = inject(DestroyRef);

  currentPhase: Phase = 'templates';
  currentCvId: string | null = null;
  isLoadingCv = signal(false);
  showPaymentModal = signal<boolean>(false);
  proNotification = signal<string | null>(null);

  selectedTemplate = signal<CvTemplateId>('modern');
  readonly sampleCvData = SAMPLE_CIVIL_ENGINEER_CV;
  activeRightTab: RightTab = 'sections';
  zoomLevel = signal<number>(0.9);
  newSkillInput = '';
  isImporting = signal(false);

  handleImportClick(input: HTMLInputElement): void {
    const credits = this.authService.currentUser()?.proCredits ?? 0;
    if (credits < 2) {
      this.paymentService.openPackModal();
      return;
    }
    input.click();
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    const file = input.files[0];

    const credits = this.authService.currentUser()?.proCredits ?? 0;
    if (credits < 2) {
      this.paymentService.openPackModal();
      input.value = '';
      return;
    }

    this.isImporting.set(true);

    this.cvApi.importCv(file).subscribe({
      next: (cv) => {
        this.isImporting.set(false);
        input.value = '';
        if (cv?.id) {
          this.loadCvById(cv.id);
          this.currentPhase = 'editor';
        }
      },
      error: (err) => {
        this.isImporting.set(false);
        input.value = '';
        if (err.status === 402 || err.error?.message?.includes('INSUFFICIENT_CREDITS') || err.error?.detail?.includes('INSUFFICIENT_CREDITS')) {
          this.paymentService.openPackModal();
        } else {
          alert("Erreur lors de l'import du CV : " + (err.error?.detail || err.error?.message || 'Fichier non supporté'));
        }
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

  // Templates categories (limité aux 2 architectures majeures)
  templateCategories = [
    { id: 'all', label: 'Tous les modèles (2)' },
    { id: 'modern', label: 'Moderne & 2 Colonnes' },
    { id: 'classic', label: 'Classique & ATS' }
  ];

  selectedCategory = signal<string>('all');
  searchTemplateQuery = signal<string>('');
  templatePage = signal<number>(1);
  templatePageSize = signal<number>(12);

  // État de la modale de prévisualisation interactive
  previewModalOpen = signal<boolean>(false);
  previewModalTemplate = signal<CvTemplateId>('modern');
  previewModalScaleMode = signal<'fit' | 'read'>('fit');
  previewModalZoom = signal<number>(0.9);

  openTemplatePreview(templateId: CvTemplateId, event?: MouseEvent): void {
    if (event) event.stopPropagation();
    this.previewModalTemplate.set(templateId);
    this.previewModalScaleMode.set('fit');
    this.previewModalZoom.set(0.9);
    this.previewModalOpen.set(true);
  }

  closeTemplatePreview(): void {
    this.previewModalOpen.set(false);
  }

  getPreviewModalScale(): number {
    if (this.previewModalScaleMode() === 'read') {
      return this.previewModalZoom();
    }
    if (typeof window === 'undefined') return 0.45;
    const screenW = window.innerWidth;
    if (screenW >= 1024) return 0.85;
    if (screenW >= 768) return 0.70;
    const padding = 28;
    const availableW = Math.max(260, Math.min(screenW - padding, 750));
    return Math.min(1, Math.round((availableW / 794) * 100) / 100);
  }

  setPreviewModalScaleMode(mode: 'fit' | 'read'): void {
    this.previewModalScaleMode.set(mode);
    if (mode === 'read') {
      this.previewModalZoom.set(0.9);
    }
  }

  zoomInTemplatePreview(): void {
    this.previewModalScaleMode.set('read');
    this.previewModalZoom.update(z => Math.min(1.3, Math.round((z + 0.1) * 10) / 10));
  }

  zoomOutTemplatePreview(): void {
    this.previewModalScaleMode.set('read');
    this.previewModalZoom.update(z => Math.max(0.35, Math.round((z - 0.1) * 10) / 10));
  }

  chooseTemplateFromPreview(): void {
    this.selectedTemplate.set(this.previewModalTemplate());
    this.closeTemplatePreview();
    this.goToEditor();
  }

  // Exactement 2 templates officiels de haute qualité
  templateOptions: TemplateCard[] = [
    {
      id: 'modern',
      name: 'CV Moderne & Dynamique',
      category: 'modern',
      badge: 'Recommandé',
      tag: 'Tech, Produit, Management & Cadres',
      description: 'En-tête immersif bicolore, structure équilibrée à 2 colonnes et mise en valeur percutante des compétences.',
      layout: 'word-bloc',
      accent: '#2563eb',
      pages: '1–2 pages',
      features: ['En-tête bicolore soigné', '2 colonnes asymétriques', 'Badges de compétences']
    },
    {
      id: 'classic',
      name: 'CV Classique & ATS',
      category: 'classic',
      badge: 'Universel ATS',
      tag: 'Finance, Droit, Ingénierie & Tout profil',
      description: 'Typographie éditoriale intemporelle, agencement monocolonne linéaire et clarté absolue pour les recruteurs et robots ATS.',
      layout: 'word-ats',
      accent: '#0f172a',
      pages: '1–2 pages',
      features: ['100% compatible robots ATS', 'Structure monocolonne aérée', 'Idéal profils confirmés & seniors']
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
        t.features.some(f => f.toLowerCase().includes(q));
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
    this.paymentService.syncWithBackend();
    this.route.queryParamMap.pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(params => {
      const action = params.get('action');
      const cvId = params.get('cvId');
      const paymentStatus = params.get('payment');
      const paymentRef = params.get('ref');

      // Si retour de paiement NotchPay réussi
      if (paymentStatus === 'success') {
        this.paymentService.syncWithBackend();
        if (paymentRef) {
          this.paymentService.verifyPayment(paymentRef).subscribe(res => {
            if (res.success) {
              this.paymentService.syncWithBackend();
            }
          });
        }
      }

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
          if (cv.template) {
            const normalized = normalizeTemplateKey(cv.template);
            this.selectedTemplate.set(normalized);
            this.editor.templateId.set(normalized);
          }
          this.refreshPreview();
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
    const normalized = normalizeTemplateKey(id);
    this.selectedTemplate.set(normalized);
    this.editor.templateId.set(normalized);
    if (this.currentCvId && this.currentCvId !== 'sample' && this.currentCvId !== 'demo') {
      this.editor.saveDraft(this.currentCvId, normalized).subscribe({
        error: (err) => console.warn('Erreur sauvegarde template :', err)
      });
    }
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

  readonly isDownloading = signal<boolean>(false);

  async downloadCurrentPdf(): Promise<void> {
    if (this.isDownloading()) return;
    this.isDownloading.set(true);
    const tpl = normalizeTemplateKey(this.selectedTemplate());
    try {
      if (this.currentCvId && this.currentCvId !== 'sample' && this.currentCvId !== 'demo') {
        try {
          await firstValueFrom(this.editor.saveDraft(this.currentCvId, tpl));
        } catch (e) {
          console.warn('Sauvegarde préalable avant export PDF échouée, continuation de l\'export :', e);
        }
      }
      await this.pdfService.exportCvPdf(this.previewData(), tpl, true, this.currentCvId);
    } finally {
      this.isDownloading.set(false);
    }
  }

  onPaymentSuccess(event: { cvId: string }): void {
    const tpl = normalizeTemplateKey(this.selectedTemplate());
    this.pdfService.exportCvPdf(this.previewData(), tpl, true, event?.cvId || this.currentCvId);
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
