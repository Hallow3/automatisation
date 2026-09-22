import { Component, OnInit, OnDestroy, inject, DestroyRef, signal, computed } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { GeminiLiveService } from '../../../../core/services/gemini-live.service';
import { AuthService } from '../../../../core/services/auth.service';
import { PdfExportService } from '../../../../core/services/pdf-export.service';
import { PaymentService } from '../../../../core/services/payment.service';
import { CvPreviewComponent, CvData } from '../../../../shared/components/cv-preview/cv-preview.component';
import { PageHeaderComponent, Crumb } from '../../../../shared/components/page-header/page-header.component';
import { ButtonComponent } from '../../../../shared/components/button/button.component';
import { BadgeComponent } from '../../../../shared/components/badge/badge.component';
import { CardComponent } from '../../../../shared/components/card/card.component';
import { CardHeaderComponent } from '../../../../shared/components/card/card-header.component';
import { ModalComponent } from '../../../../shared/components/modal/modal.component';

interface DraftSectionItem {
  id: string;
  name: string;
  status: 'completed' | 'in_progress' | 'pending';
}

@Component({
  selector: 'app-cv-interview',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    CvPreviewComponent,
    PageHeaderComponent,
    ButtonComponent,
    BadgeComponent,
    CardComponent,
    CardHeaderComponent,
    ModalComponent
  ],
  templateUrl: './cv-interview.component.html',
  styleUrl: './cv-interview.component.css'
})
export class CvInterviewComponent implements OnInit, OnDestroy {
  public geminiService = inject(GeminiLiveService);
  private authService = inject(AuthService);
  private pdfService = inject(PdfExportService);
  public paymentService = inject(PaymentService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private destroyRef = inject(DestroyRef);


  cvId: string = 'cv_default';
  showConfirmModal = false;
  isPaused = false;
  isMuted = signal(false);

  desktopScale = signal<number>(0.56);
  showMobilePreview = signal<boolean>(false);
  mobileScaleMode = signal<'fit' | 'read'>('fit');
  mobileZoom = signal<number>(0.9);

  state = this.geminiService.state;
  transcript = this.geminiService.transcript;
  draft = this.geminiService.currentDraft;
  errorMessage = this.geminiService.errorMessage;
  isQuotaReached = this.geminiService.isQuotaReached;
  auditReport = this.geminiService.auditReport;
  hasStarted = this.geminiService.hasStarted;
  isStarting = this.geminiService.isStarting;
  isWsReady = this.geminiService.isWsReady;
  isSynthesizing = this.geminiService.isSynthesizing;

  readonly cvPreviewData = computed<CvData>(() => this.getCvPreviewData());

  isAiSpeaking = computed(() => this.state() === 'AI_SPEAKING');
  isUserSpeaking = computed(() => this.state() === 'LISTENING');
  isConnected = computed(() => this.state() === 'LISTENING' || this.state() === 'AI_SPEAKING');
  audioBars = signal<number[]>([0.15, 0.2, 0.15, 0.2, 0.15, 0.2, 0.15, 0.2, 0.15, 0.2]);
  private animInterval: any = null;

  startInterview(): void {
    const credits = this.authService.currentUser()?.proCredits ?? 0;
    const cached = this.geminiService.hasActiveCachedSession(this.cvId);
    if (credits < 1 && !cached) {
      this.paymentService.openPackModal();
      return;
    }
    this.geminiService.startInterviewFlow(this.cvId);
  }

  retrySession(): void {
    const credits = this.authService.currentUser()?.proCredits ?? 0;
    const targetId = (this.geminiService.currentCvId && this.geminiService.currentCvId !== 'cv_default' && this.geminiService.currentCvId !== 'new')
      ? this.geminiService.currentCvId
      : this.cvId;
    const cached = this.geminiService.hasActiveCachedSession(targetId);
    if (credits < 1 && !cached) {
      this.paymentService.openPackModal();
      return;
    }
    this.geminiService.startInterviewFlow(targetId);
  }

  goToManualBuilder(): void {
    this.router.navigate(['/cv-builder'], { queryParams: { action: 'create' } });
  }

  breadcrumbs: Crumb[] = [
    { label: 'Mes CV', to: '/cvs' },
    { label: 'Entretien vocal IA' }
  ];

  toggleMobilePreview(): void {
    if (!this.showMobilePreview()) {
      this.mobileScaleMode.set('fit');
    }
    this.showMobilePreview.update(v => !v);
  }

  closeMobilePreview(): void {
    this.showMobilePreview.set(false);
  }

  getMobileScale(): number {
    if (this.mobileScaleMode() === 'read') {
      return this.mobileZoom();
    }
    if (typeof window === 'undefined') return 0.45;
    const screenW = window.innerWidth;
    const padding = 28;
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

  zoomInDesktop(): void {
    this.desktopScale.update(s => Math.min(1.0, Math.round((s + 0.05) * 100) / 100));
  }

  zoomOutDesktop(): void {
    this.desktopScale.update(s => Math.max(0.35, Math.round((s - 0.05) * 100) / 100));
  }

  resetDesktopZoom(): void {
    this.desktopScale.set(0.56);
  }

  downloadPdf(): void {
    this.pdfService.exportCvPdf(this.cvPreviewData(), 'moderne', true);
  }


  isTemporarilyUnavailable = computed(() => this.state() === 'TEMPORARILY_UNAVAILABLE');
  isUserStopped = computed(() => this.state() === 'USER_STOPPED');
  isReview = computed(() => this.state() === 'REVIEW');
  currentState = this.geminiService.currentState;
  sectionStatus = this.geminiService.sectionStatus;

  get draftSections(): DraftSectionItem[] {
    const stateOrder = ['IDENTITY', 'TARGET', 'EXPERIENCE', 'PROJECTS', 'EDUCATION', 'SKILLS', 'LANGUAGES', 'FINALIZE', 'REVIEW', 'DONE'];
    const cur = this.currentState();
    const curIdx = stateOrder.indexOf(cur);

    const sections = [
      { id: 's1', state: 'IDENTITY', name: 'Identité & Coordonnées' },
      { id: 's2', state: 'TARGET', name: 'Titre visé & Défi professionnel' },
      { id: 's3', state: 'EXPERIENCE', name: 'Expériences professionnelles' },
      { id: 's4', state: 'PROJECTS', name: 'Projets & Réalisations' },
      { id: 's5', state: 'EDUCATION', name: 'Formation & Diplômes' },
      { id: 's6', state: 'SKILLS', name: 'Compétences clés' },
      { id: 's7', state: 'LANGUAGES', name: 'Langues & Niveaux' }
    ];

    return sections.map(s => {
      const idx = stateOrder.indexOf(s.state);
      let status: 'completed' | 'in_progress' | 'pending' = 'pending';
      if (curIdx > idx) {
        status = 'completed';
      } else if (curIdx === idx) {
        status = 'in_progress';
      }
      return {
        id: s.id,
        name: s.name,
        status
      };
    });
  }

  ngOnInit(): void {
    const idParam = this.route.snapshot.paramMap.get('id');
    if (idParam) {
      this.cvId = idParam;
    }

    let tick = 0;
    this.animInterval = setInterval(() => {
      tick++;
      if (this.isAiSpeaking()) {
        this.audioBars.set([
          0.3 + 0.5 * Math.abs(Math.sin(tick * 0.4)),
          0.4 + 0.6 * Math.abs(Math.cos(tick * 0.3)),
          0.5 + 0.5 * Math.abs(Math.sin(tick * 0.5 + 1)),
          0.2 + 0.7 * Math.abs(Math.cos(tick * 0.4 + 2)),
          0.6 + 0.4 * Math.abs(Math.sin(tick * 0.6 + 0.5)),
          0.4 + 0.5 * Math.abs(Math.cos(tick * 0.35)),
          0.3 + 0.6 * Math.abs(Math.sin(tick * 0.45)),
          0.5 + 0.4 * Math.abs(Math.cos(tick * 0.5)),
          0.3 + 0.5 * Math.abs(Math.sin(tick * 0.3)),
          0.2 + 0.4 * Math.abs(Math.cos(tick * 0.25))
        ]);
      } else if (this.isUserSpeaking()) {
        this.audioBars.set([
          0.2 + 0.4 * Math.abs(Math.sin(tick * 0.25)),
          0.3 + 0.5 * Math.abs(Math.cos(tick * 0.2)),
          0.4 + 0.5 * Math.abs(Math.sin(tick * 0.3 + 1)),
          0.5 + 0.4 * Math.abs(Math.cos(tick * 0.35 + 2)),
          0.3 + 0.5 * Math.abs(Math.sin(tick * 0.3 + 0.5)),
          0.4 + 0.4 * Math.abs(Math.cos(tick * 0.25)),
          0.2 + 0.5 * Math.abs(Math.sin(tick * 0.2)),
          0.3 + 0.4 * Math.abs(Math.cos(tick * 0.3)),
          0.2 + 0.3 * Math.abs(Math.sin(tick * 0.2)),
          0.15 + 0.2 * Math.abs(Math.cos(tick * 0.15))
        ]);
      } else {
        this.audioBars.set([0.15, 0.2, 0.15, 0.2, 0.15, 0.2, 0.15, 0.2, 0.15, 0.2]);
      }
    }, 100);

    this.geminiService.interviewCompleted$.pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(() => {
      const realCvId = this.geminiService.currentCvId;
      this.router.navigate(['/cv-builder'], { queryParams: { action: 'editor', cvId: realCvId } });
    });

    // Si une session active précédente sur ce CV existe en cache local, restaurer le brouillon passivement
    const cachedDraft = this.geminiService.getCachedDraft(this.cvId);
    if (cachedDraft) {
      this.geminiService.currentDraft.set(cachedDraft);
    }
  }

  ngOnDestroy(): void {
    if (this.animInterval) {
      clearInterval(this.animInterval);
    }
    this.geminiService.stopSession();
  }


  toggleMute(): void {
    this.isMuted.update(m => !m);
    this.geminiService.setMuted(this.isMuted());
  }

  confirmQuit(): void {
    this.geminiService.triggerRefundIfAborted('user_quit');
    this.router.navigate(['/cvs']);
  }

  togglePause(): void {
    this.isPaused = !this.isPaused;
  }

  stopInterview(): void {
    this.showConfirmModal = true;
  }

  confirmFinish(): void {
    this.showConfirmModal = false;
    this.geminiService.handleCompleteInterview();
  }

  cancelFinish(): void {
    this.showConfirmModal = false;
  }

  retryConnection(): void {
    const targetId = (this.geminiService.currentCvId && this.geminiService.currentCvId !== 'cv_default' && this.geminiService.currentCvId !== 'new')
      ? this.geminiService.currentCvId
      : this.cvId;
    this.geminiService.startInterviewFlow(targetId);
  }

  goToEditor(): void {
    if (this.isSynthesizing()) {
      return;
    }
    if (this.hasStarted() && this.transcript().length > 0) {
      this.geminiService.handleCompleteInterview();
    } else {
      const realCvId = this.geminiService.currentCvId;
      this.router.navigate(['/cv-builder'], { queryParams: { action: 'editor', cvId: realCvId } });
    }
  }

  getCvPreviewData(): CvData {
    const d = this.draft();
    const u = this.authService.currentUser();
    return {
      name: d?.identity?.fullName || u?.fullName || 'Prénom Nom',
      title: d?.headline || u?.targetRole || 'Titre recherché',
      email: d?.identity?.email || u?.email || '',
      phone: d?.identity?.phone || u?.phone || '',
      city: d?.identity?.city || u?.city || '',
      summary: d?.summary || '',
      skills: (d?.skills || []).filter((s: string) => s && s.trim()),
      experiences: (d?.experiences || [])
        .filter((exp: any) => exp?.position?.trim() || exp?.role?.trim() || exp?.company?.trim())
        .map((exp: any) => {
          const bullets = exp.responsibilities || exp.achievements || exp.bullets || [];
          return {
            role: exp.position || exp.role || exp.title || '',
            company: exp.company || '',
            period: [exp.startDate, exp.endDate || (exp.startDate ? 'Présent' : '')].filter(Boolean).join(' - ') || exp.period || '',
            bullets: Array.isArray(bullets) ? bullets.filter((b: string) => b && b.trim()) : (typeof bullets === 'string' ? [bullets] : [])
          };
        }),
      education: (d?.education || [])
        .filter((edu: any) => edu?.degree?.trim() || edu?.school?.trim() || edu?.diploma?.trim())
        .map((edu: any) => ({
          degree: edu.degree || edu.diploma || '',
          school: edu.school || edu.institution || '',
          year: edu.year || edu.period || edu.date || ''
        })),
      languages: (d?.languages || [])
        .filter((l: any) => (typeof l === 'string' && l.trim()) || l?.lang?.trim() || l?.name?.trim())
        .map((l: any) => {
          if (typeof l === 'string') {
            const match = l.match(/^([^(]+)(?:\(([^)]+)\))?$/);
            return {
              lang: match ? match[1].trim() : l.trim(),
              level: match && match[2] ? match[2].trim() : ''
            };
          }
          return {
            lang: l.lang || l.name || l.language || '',
            level: l.level || ''
          };
        })
    };
  }
}
