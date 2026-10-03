import { Injectable, signal, computed, inject } from '@angular/core';
import { Subject, Subscription, firstValueFrom } from 'rxjs';
import { CvInterviewApiService } from './cv-interview-api.service';
import { AuthService } from './auth.service';
import { PaymentService } from './payment.service';
import { AudioPcmEngineService } from './audio-pcm-engine.service';
import { GeminiLiveWsClientService } from './gemini-live-ws-client.service';
import { InterviewSessionCacheService } from './interview-session-cache.service';
import { CV_INTERVIEW_START_TRIGGER, buildStartTrigger } from './cv-interview-system.prompt';
import { CvAuditEngineService, CvAuditReport } from './cv-audit-engine.service';
import { CvStreamService } from './cv-stream.service';

export type LiveInterviewState =
  | 'READY'
  | 'CONNECTING'
  | 'LISTENING'
  | 'AI_SPEAKING'
  | 'USER_STOPPED'
  | 'TEMPORARILY_UNAVAILABLE'
  | 'REVIEW'
  | 'ERROR'
  | 'COMPLETED';

export type InterviewIssueKind = 'network' | 'microphone' | 'service' | 'credits';
export type AudioGuidanceKind = 'noise' | 'distance';

export interface TranscriptEntry {
  id: string;
  role: 'user' | 'ai';
  text: string;
  isFinal: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class GeminiLiveService {
  private apiService = inject(CvInterviewApiService);
  private authService = inject(AuthService);
  private paymentService = inject(PaymentService);
  private audioEngine = inject(AudioPcmEngineService);
  private wsClient = inject(GeminiLiveWsClientService);
  private sessionCache = inject(InterviewSessionCacheService);
  private auditEngine = inject(CvAuditEngineService);
  private cvStream = inject(CvStreamService);

  public state = signal<LiveInterviewState>('READY');
  public transcript = signal<TranscriptEntry[]>([]);
  public errorMessage = signal<string | null>(null);
  public errorKind = signal<InterviewIssueKind | null>(null);
  public displayErrorMessage = computed(() => {
    const message = this.errorMessage();
    if (!message) return null;
    return /http failure response|\/api\/|https?:\/\/|status\s*\d{3}|exception|stack trace/i.test(message)
      ? 'L’entretien vocal est momentanément indisponible. Votre progression est conservée ; vous pouvez réessayer.'
      : message;
  });
  public reconnecting = signal(false);
  public audioGuidance = signal<AudioGuidanceKind | null>(null);
  public auditReport = signal<CvAuditReport | null>(null);
  public isRefunding = signal<boolean>(false);
  public isSynthesizing = signal<boolean>(false);
  public isQuotaReached = computed(() => {
    const currentState = this.state();
    if (this.errorMessage() && this.errorKind() === 'credits') return true;
    // Ne jamais écraser un problème technique de connexion ou un remboursement en cours par un faux épuisement de quota
    if (((currentState === 'TEMPORARILY_UNAVAILABLE' || currentState === 'ERROR')
        && this.errorKind() !== 'credits') || this.isRefunding()) {
      return false;
    }

    const msg = this.errorMessage();
    const credits = this.authService.currentUser()?.proCredits ?? 0;
    const hasCached = !!this.sessionCache.getSession(this.currentCvId);
    return (!hasCached && credits < 1) || (!!msg && (msg.includes('crédit Pro') || msg.includes('INSUFFICIENT_CREDITS') || msg.includes('Solde insuffisant') || msg.includes('limite de 3 entretiens') || msg.includes('QUOTA_REACHED')));
  });

  public currentDraft = signal<any>(this.createEmptyDraft());
  public interviewCompleted$ = new Subject<void>();
  public currentCvId: string = 'cv_default';
  public isMutedSignal = signal<boolean>(false);

  // Nouveaux signaux pour le contrôle manuel par l'utilisateur
  public hasStarted = signal<boolean>(false);
  public isStarting = signal<boolean>(false);
  public isWsReady = signal<boolean>(false);

  // ── Signaux de facturation au temps réel (1 crédit = 1 minute) ──
  public liveElapsedSeconds = signal<number>(0);
  public liveRemainingSeconds = signal<number>(0);
  public liveRemainingCredits = signal<number>(0);

  public liveDurationFormatted = computed(() => {
    const s = this.liveElapsedSeconds();
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  });

  public liveRemainingMinutesFormatted = computed(() => {
    const rem = this.liveRemainingSeconds();
    const mins = Math.max(0, Math.ceil(rem / 60));
    return `${mins} min`;
  });

  // ── Signaux State Machine & Orchestrateur V2 (Spec V2) ──
  public currentV2SessionId = signal<string | null>(null);
  public currentState = signal<string>('IDENTITY');
  public sectionStatus = signal<string>('IN_PROGRESS');
  public turnsInSection = signal<number>(0);
  public latestControlMessage = signal<string>('');

  private lastUserTurnText = '';
  private lastReportedError = new Map<string, number>();
  private lastAiTurnText = '';
  private syncInFlight = false;

  private isAiSpeakingCooldown = false;
  private echoCooldownTimer: any = null;
  private inactivityTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly inactivityTimeoutMs = 240_000;
  private _startAbortController: AbortController | null = null;

  // Verrou d'exclusion mutuelle et sas acoustique initial :
  // Tant que l'accueil IA initial (CV_INTERVIEW_START_TRIGGER) n'a pas fini d'être énoncé
  // par Bray, le microphone est STRICTEMENT MUTÉ côté client.
  // Cela élimine radicalement tout double déclencheur audio et toute boucle acoustique
  // générant deux voix Gemini en parallèle au démarrage.
  private initialGreetingPending = false;
  private isSessionStarting = false;
  private pendingStartTriggerPrompt = '';
  private userWantsToStart = false;
  private pendingProCredits: number | null = null;
  private shouldRefreshProStatusOnSetup = false;

  private lineBuffers: { user: string; ai: string } = { user: '', ai: '' };
  private flushTimeouts: { user?: any; ai?: any } = {};

  private hasMeaningfulUsage = false;
  private isResumingConnection = false;
  private isRecoveringConnection = false;
  private resumeUsedHandle = false;
  private resumeAttempts = 0;
  private readonly maxResumeAttempts = 3;
  private resumeTimer: ReturnType<typeof setTimeout> | null = null;
  private lastWsSetupAt = 0;
  private recentAudioLevels: Array<{ rms: number; peak: number }> = [];
  private lastUserTranscriptionAt = 0;
  private lastAudioGuidanceAt = 0;
  private audioGuidanceTimer: ReturnType<typeof setTimeout> | null = null;
  private currentCandidateFirstName = '';
  private cvStreamSubscription: Subscription | null = null;
  private heartbeatTimer: any = null;
  private elapsedTimer: any = null;

  private startLiveTimers(): void {
    this.stopLiveTimers();
    this.liveElapsedSeconds.set(0);
    const credits = this.authService.currentUser()?.proCredits ?? 10;
    this.liveRemainingSeconds.set(credits * 60);
    this.liveRemainingCredits.set(credits);

    // Timer local chaque seconde pour la réactivité visuelle
    this.elapsedTimer = setInterval(() => {
      this.liveElapsedSeconds.update(v => v + 1);
      this.liveRemainingSeconds.update(v => Math.max(0, v - 1));
    }, 1000);

    // Heartbeat backend toutes les 15 secondes pour synchroniser l'autorité de facturation
    this.heartbeatTimer = setInterval(() => {
      const sessionId = this.currentV2SessionId();
      if (!sessionId || !this.hasStarted()) return;

      this.apiService.sendHeartbeat(this.currentCvId, sessionId).subscribe({
        next: async (res) => {
          if (res?.status === 'EXPIRED') {
            console.warn('[GeminiLive] Bail expiré par le serveur : crédits épuisés. Finalisation et sauvegarde du CV...');
            await this.handleExpiredSession();
          } else if (res) {
            this.liveElapsedSeconds.set(res.elapsedSeconds);
            this.liveRemainingSeconds.set(res.remainingSeconds);
            this.liveRemainingCredits.set(res.remainingCredits);
          }
        },
        error: (err) => {
          console.warn('[GeminiLive] Échec heartbeat non bloquant :', err);
        }
      });
    }, 15000);
  }

  private stopLiveTimers(): void {
    if (this.elapsedTimer) {
      clearInterval(this.elapsedTimer);
      this.elapsedTimer = null;
    }
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  setMuted(muted: boolean): void {
    this.isMutedSignal.set(muted);
    this.audioEngine.setMuted(muted);
    if (muted) this.clearAudioGuidance();
  }

  public hasActiveCachedSession(cvId: string): boolean {
    const cached = this.sessionCache.getSession(cvId);
    return !!cached && !!(cached.draft || (cached.transcript && cached.transcript.length > 0));
  }

  public getCachedDraft(cvId: string): any {
    return this.sessionCache.getSession(cvId)?.draft ?? null;
  }

  public startFreshInterview(): void {
    this.sessionCache.clearAllSessions();
    this.resetDraft();
    this.currentCvId = 'new';
    this.currentState.set('IDENTITY');
    this.sectionStatus.set('IN_PROGRESS');
  }

  /**
   * Déclenche activement le cycle complet d'entretien vocal au clic explicite de l'utilisateur :
   * 1. Débit du crédit & obtention du jeton de session backend
   * 2. Connexion WebSocket à Gemini Live
   * 3. Engagement du microphone et accueil interactif
   */
  async startInterviewFlow(cvId: string = 'cv_default'): Promise<void> {
    if (this.hasStarted()) {
      return;
    }

    const credits = this.authService.currentUser()?.proCredits ?? 0;
    const cached = this.sessionCache.getSession(cvId);
    if (credits < 1 && !cached) {
      this.setError("Solde insuffisant : l'accès à l'entretien vocal IA nécessite au moins 1 crédit Pro. Veuillez recharger votre compte.");
      this.paymentService.openPackModal();
      return;
    }

    this.userWantsToStart = true;
    this.isStarting.set(true);

    if (this.isWsReady() && this.currentCvId === cvId) {
      await this.beginInterview();
      return;
    }

    await this.prepareSession(cvId);
  }

  /**
   * Alias de rétrocompatibilité : prépare la session WebSocket sans démarrer la parole.
   */
  async startSession(cvId: string = 'cv_default'): Promise<void> {
    return this.prepareSession(cvId);
  }

  /**
   * Prépare et ouvre la connexion Gemini Live lors du démarrage explicite de l'entretien.
   */
  async prepareSession(cvId: string = 'cv_default'): Promise<void> {
    // 0. Protection contre les doubles déclenchements concurrents
    if (this.isSessionStarting) {
      console.warn('[GeminiLive] Une initialisation de session est déjà en cours, requête ignorée.');
      return;
    }

    // Protection stricte contre les accès sans crédit Pro
    const credits = this.authService.currentUser()?.proCredits ?? 0;
    const cachedSession = this.sessionCache.getSession(cvId);
    if (credits < 1 && !cachedSession) {
      this.setError("Solde insuffisant : l'accès à l'entretien vocal IA nécessite au moins 1 crédit Pro. Veuillez recharger votre compte.");
      this.paymentService.openPackModal();
      return;
    }

    // Si déjà prêt sur le même cvId et non démarré, ne pas recharger inutilement
    if (this.isWsReady() && this.currentCvId === cvId && !this.hasStarted() && !this.errorMessage()) {
      return;
    }

    this.isSessionStarting = true;

    // Annuler tout démarrage précédent
    if (this._startAbortController) {
      this._startAbortController.abort();
    }
    const abortController = new AbortController();
    this._startAbortController = abortController;

    const wantsToStart = this.userWantsToStart;

    try {
      // 1. Fermer rigoureusement toute session ou connexion WebSocket précédente
      this.stopSession();

      // Conserver l'intention de démarrage utilisateur et l'état de lancement
      this.userWantsToStart = wantsToStart;
      this.isStarting.set(wantsToStart);

      this.currentCvId = cvId;
      this.state.set('CONNECTING');
      this.errorMessage.set(null);
      this.errorKind.set(null);
      this.reconnecting.set(false);
      this.resetDraft();
      this.clearInactivityTimer();
      this.hasStarted.set(false);
      this.isWsReady.set(false);

      // Restaurer le dernier brouillon local de ce CV après une coupure.
      const cached = cvId === 'new' ? null : this.sessionCache.getSession(cvId);
      let isResume = false;
      let cachedContext = '';
      if (cached) {
        if (cached.draft) this.currentDraft.set(cached.draft);
        if (cached.transcript?.length > 0) {
          this.transcript.set(cached.transcript.map(t => ({
            id: t.id,
            role: t.role === 'user' ? 'user' : 'ai',
            text: t.text,
            isFinal: true
          })));
        }
        const hasDraftData = cached.draft && (
          (cached.draft.experiences && cached.draft.experiences.length > 0) ||
          (cached.draft.skills && cached.draft.skills.length > 0) ||
          cached.draft.headline ||
          cached.draft.summary
        );
        if (hasDraftData || (cached.transcript && cached.transcript.length > 1)) {
          isResume = true;
          const parts: string[] = [];
          if (cached.draft?.headline) parts.push(`- Métier visé / Titre : ${cached.draft.headline}`);
          if (cached.draft?.experiences?.length) {
            parts.push(`- Expériences déjà notées : ${cached.draft.experiences.map((e: any) => `${e.position} chez ${e.company} (${e.startDate || ''} - ${e.endDate || ''})`).join(', ')}`);
          }
          if (cached.draft?.education?.length) {
            parts.push(`- Formations déjà notées : ${cached.draft.education.map((ed: any) => `${ed.degree} à ${ed.school} (${ed.year || ''})`).join(', ')}`);
          }
          if (cached.draft?.skills?.length) {
            parts.push(`- Compétences notées : ${cached.draft.skills.join(', ')}`);
          }
          cachedContext = parts.join('\n');
        }
      }

      // Obtenir le jeton de session backend
      if (abortController.signal.aborted) return;

      const session = await firstValueFrom(
        this.apiService.createSession(cvId)
      ).catch((err) => {
        console.warn('[GeminiLive] Échec création session vocale:', err);
        let msg = err?.error?.detail || err?.error?.message || err?.error?.reason || '';
        if (typeof msg === 'string' && msg.includes('INSUFFICIENT_CREDITS:')) {
          msg = "Solde insuffisant : l'accès à l'entretien vocal IA nécessite au moins 1 crédit Pro. Veuillez recharger votre compte.";
          this.paymentService.openPackModal();
        } else if (err?.status === 402 || (typeof msg === 'string' && msg.includes('INSUFFICIENT_CREDITS'))) {
          msg = "Solde insuffisant : l'accès à l'entretien vocal IA nécessite au moins 1 crédit Pro. Veuillez recharger votre compte.";
          this.paymentService.openPackModal();
        } else if (typeof msg === 'string' && msg.includes('QUOTA_REACHED:')) {
          msg = 'Le nombre d’entretiens autorisés est atteint pour le moment.';
        } else if (err?.status === 0 || (typeof navigator !== 'undefined' && !navigator.onLine)) {
          msg = 'Votre connexion semble instable. Vérifiez votre réseau, puis réessayez. Votre CV est conservé.';
        } else {
          msg = 'L’entretien vocal est momentanément indisponible. Votre CV est conservé ; réessayez dans un instant.';
        }
        throw new Error(msg);
      });

      if (abortController.signal.aborted) {
        this.stopSession();
        return;
      }

      const token = session?.token;
      const model = session?.model || 'gemini-3.8-live';

      if (session?.cvId) {
        this.currentCvId = session.cvId;
      }

      // Initialisation / reprise de l'orchestrateur V2 en base
      try {
        const v2Session = await firstValueFrom(this.apiService.initOrResumeV2Session(this.currentCvId));
        if (v2Session) {
          if (v2Session.cvId) {
            this.currentCvId = v2Session.cvId;
          }
          this.currentV2SessionId.set(v2Session.sessionId);
          this.currentState.set(v2Session.currentState);
          this.sectionStatus.set(v2Session.sectionStatus);
          this.turnsInSection.set(v2Session.turnsInSection);
          this.latestControlMessage.set(v2Session.controlMessage);
          if (v2Session.cvDataSoFar && Object.keys(v2Session.cvDataSoFar).length > 0) {
            this.currentDraft.set(v2Session.cvDataSoFar);
            if (cached?.draft) this.mergeDraft(cached.draft);
            this.sessionCache.saveSession(this.currentCvId, this.currentDraft(), this.transcript());
          }
          // Ouvrir le canal SSE pour les patches CV en temps réel
          this.cvStreamSubscription?.unsubscribe();
          this.cvStream.connect(this.currentCvId, v2Session.sessionId);
          this.cvStreamSubscription = this.cvStream.cvPatch$.subscribe(event => {
            if (event?.patch && Object.keys(event.patch).length > 0) {
              this.mergeDraft(event.patch);
              this.sessionCache.saveSession(this.currentCvId, this.currentDraft(), this.transcript());
            }
          });
        }
      } catch (e) {
        console.warn('[GeminiLive] Échec initialisation V2 non bloquante:', e);
      }

      if (session?.proCredits !== undefined) {
        const remaining = parseInt(session.proCredits, 10);
        if (!isNaN(remaining)) {
          this.pendingProCredits = remaining;
          this.shouldRefreshProStatusOnSetup = false;
        }
      } else {
        this.pendingProCredits = null;
        this.shouldRefreshProStatusOnSetup = true;
      }

      if (!token) {
        throw new Error('Aucun token reçu depuis le backend.');
      }

      if (abortController.signal.aborted) {
        this.stopSession();
        return;
      }

      const candidateFirstName = this.extractCandidateFirstName();
      this.currentCandidateFirstName = candidateFirstName;
      this.pendingStartTriggerPrompt = buildStartTrigger(candidateFirstName, isResume, cachedContext);

      // Connecter le WebSocket avec callbacks réactifs
      this.wsClient.connect(token, model, this.buildWsCallbacks(candidateFirstName), candidateFirstName);
    } catch (err: any) {
      this.pendingProCredits = null;
      this.shouldRefreshProStatusOnSetup = false;
      this.initialGreetingPending = false;
      this.isStarting.set(false);
      if (abortController.signal.aborted) return;
      this.triggerRefundIfAborted('prepare_session_error');
      this.stopSession();
      this.setError(err?.message || 'L’entretien vocal est momentanément indisponible. Réessayez dans un instant.');
    } finally {
      this.isSessionStarting = false;
      if (this._startAbortController === abortController) {
        this._startAbortController = null;
      }
    }
  }

  private buildWsCallbacks(candidateFirstName: string): any {
    return {
      onSetupComplete: () => {
        this.isWsReady.set(true);
        this.reconnecting.set(false);
        this.errorKind.set(null);
        this.lastWsSetupAt = Date.now();
        if (this.isRecoveringConnection) {
          this.isRecoveringConnection = false;
          this.isResumingConnection = false;
          this.errorMessage.set(null);
          if (this.hasStarted()) {
            this.state.set('LISTENING');
            if (!this.resumeUsedHandle && this.latestControlMessage()) {
              this.wsClient.sendClientContent(this.latestControlMessage(), false);
            }
            this.armInactivityTimer();
            return;
          }
        }

        // Synchronisation effective des crédits uniquement après confirmation de la connexion WebSocket
        if (this.pendingProCredits !== null) {
          this.paymentService.setProCreditsValue(this.pendingProCredits);
          this.authService.updateProCredits(this.pendingProCredits);
          this.pendingProCredits = null;
        } else if (this.shouldRefreshProStatusOnSetup) {
          this.paymentService.fetchProStatus();
          this.authService.refreshCurrentUser().subscribe();
          this.shouldRefreshProStatusOnSetup = false;
        }

        if (this.userWantsToStart) {
          this.beginInterview();
        } else {
          this.state.set('READY');
        }
      },
      onAudioChunkReceived: (base64Pcm: string) => {
        this.state.set('AI_SPEAKING');
        this.clearAudioGuidance();
        this.clearInactivityTimer();
        if (this.echoCooldownTimer) {
          clearTimeout(this.echoCooldownTimer);
          this.echoCooldownTimer = null;
        }
        this.audioEngine.playPcmChunk(base64Pcm, () => {
          this.initialGreetingPending = false;
          this.state.set('LISTENING');
          this.isAiSpeakingCooldown = true;
          if (this.echoCooldownTimer) clearTimeout(this.echoCooldownTimer);
          this.echoCooldownTimer = setTimeout(() => {
            this.isAiSpeakingCooldown = false;
            this.armInactivityTimer();
          }, 400);
        });
      },
      onTextChunkReceived: (role: 'user' | 'ai', text: string) => {
        if (role === 'user' && text.trim()) {
          this.lastUserTranscriptionAt = Date.now();
          this.clearAudioGuidance();
        }
        this.appendTranscriptChunk(role, text);
      },
      onModelTurnComplete: async () => {
        this.finalizeCurrentTurn();
        if (this.hasStarted()) {
          const hasUserSpoken = this.transcript().some(t => t.role === 'user' && t.text.trim().length > 5);
          if (hasUserSpoken) {
            this.hasMeaningfulUsage = true;
          }
        }
        await this.syncCurrentTurnToBackend();
      },
      onInterrupted: async () => {
        this.audioEngine.interruptPlayback();
        this.initialGreetingPending = false;
        this.isAiSpeakingCooldown = false;
        this.state.set('LISTENING');
        this.finalizeCurrentTurn();
        if (this.lastUserTurnText.trim().length > 0) {
          await this.syncCurrentTurnToBackend();
        }
      },
      onToolCall: async (name: string, callId: string, args: any) => {
        return await this.handleToolCall(name, callId, args);
      },
      onError: (err: string) => {
        this.finalizeCurrentTurn();
        this.initialGreetingPending = false;
        this.isStarting.set(false);
        this.isWsReady.set(false);
        console.warn('[GeminiLive] Connexion Live interrompue:', err);
      },
      onSessionResumptionUpdate: (handle: string) => {
        this.wsClient.setResumptionHandle(handle);
      },
      onGoAway: (timeLeft?: string) => {
        console.warn('[GeminiLive] Signal go_away reçu du serveur Gemini (coupure imminente, délai:', timeLeft, '). Préparation de la reconnexion transparente.');
        this.isResumingConnection = true;
      },
      onClose: (code: number) => {
        this.finalizeCurrentTurn();
        if (this.lastUserTurnText.trim()) void this.syncCurrentTurnToBackend();
        this.initialGreetingPending = false;
        this.isStarting.set(false);
        this.isWsReady.set(false);

        if (this.state() === 'COMPLETED' || this.state() === 'USER_STOPPED') return;

        const setupAgeMs = this.lastWsSetupAt ? Date.now() - this.lastWsSetupAt : 0;
        if (this.lastWsSetupAt && setupAgeMs > 30_000) this.resumeAttempts = 0;
        // Un handle qui échoue aussitôt après le setup ne doit pas être réutilisé.
        if (this.resumeUsedHandle && (!this.lastWsSetupAt || setupAgeMs < 30_000)) {
          this.wsClient.setResumptionHandle(null);
        }
        if ((this.isResumingConnection || [1006, 1011, 1012, 1013].includes(code)
            || (code === 1008 && this.isRecoveringConnection && this.resumeUsedHandle))
            && this.scheduleResume()) {
          return;
        }

        if (code !== 1000 && !this.hasMeaningfulUsage) {
          this.triggerRefundIfAborted(`ws_close_${code}`);
        }

        this.stopLiveTimers();
        this.hasStarted.set(false);
        this.isRecoveringConnection = false;
        this.pendingProCredits = null;
        this.shouldRefreshProStatusOnSetup = false;
        if (this.state() !== 'ERROR') {
          const networkIssue = code === 1006 || (typeof navigator !== 'undefined' && !navigator.onLine);
          this.setError(networkIssue
            ? 'La liaison avec l’entretien s’est interrompue. Votre progression est conservée ; réessayez quand votre connexion sera stable.'
            : 'L’entretien vocal est momentanément indisponible. Votre progression est conservée ; réessayez dans un instant.',
          networkIssue ? 'network' : 'service');
          this.state.set('TEMPORARILY_UNAVAILABLE');
        }
      }
    };
  }

  /**
   * Déclenche le remboursement automatique du crédit Pro débité si la session a échoué ou s'est
   * arrêtée de manière anormale avant toute utilisation effective du service vocal.
   */
  triggerRefundIfAborted(reason: string = 'interruption'): void {
    // La facturation s'effectue désormais au temps réel consommé en backend (aucun remboursement nécessaire)
    this.isRefunding.set(false);
  }

  private scheduleResume(): boolean {
    if (this.resumeAttempts >= this.maxResumeAttempts || this.resumeTimer) return false;
    this.resumeAttempts++;
    this.isRecoveringConnection = true;
    this.reconnecting.set(true);
    this.state.set('CONNECTING');
    const cvId = this.currentCvId;
    const delay = 1000 * (2 ** (this.resumeAttempts - 1)) + Math.floor(Math.random() * 250);
    this.resumeTimer = setTimeout(() => {
      this.resumeTimer = null;
      if (this.currentCvId === cvId && this.isRecoveringConnection && this.state() === 'CONNECTING') {
        void this.attemptSeamlessResume();
      }
    }, delay);
    return true;
  }

  private async attemptSeamlessResume(): Promise<void> {
    try {
      const handle = this.wsClient.getResumptionHandle();
      const session = await firstValueFrom(this.apiService.createSession(this.currentCvId, handle));
      if (!this.isRecoveringConnection || this.state() !== 'CONNECTING') return;
      if (!session?.token) throw new Error('Jeton de reprise absent.');
      this.resumeUsedHandle = !!handle;
      this.wsClient.connect(session.token, session.model || 'gemini-3.8-live',
        this.buildWsCallbacks(this.currentCandidateFirstName), this.currentCandidateFirstName);
    } catch (e) {
      if (!this.isRecoveringConnection) return;
      console.warn('[GeminiLive] Échec de la reprise transparente:', e);
      this.wsClient.setResumptionHandle(null);
      if (!this.scheduleResume()) {
        this.stopLiveTimers();
        this.hasStarted.set(false);
        this.isRecoveringConnection = false;
        this.reconnecting.set(false);
        this.setError('La liaison avec l’entretien s’est interrompue. Votre brouillon est conservé ; vous pouvez réessayer.', 'network');
        this.state.set('TEMPORARILY_UNAVAILABLE');
      }
    }
  }

  /**
   * Déclenche activement l'entretien vocal au clic explicite de l'utilisateur :
   * 1. Engage le microphone
   * 2. Initialise la lecture audio
   * 3. Envoie le trigger à Gemini pour qu'il commence sa prise de parole d'accueil
   */
  async beginInterview(): Promise<void> {
    if (this.hasStarted()) {
      return;
    }

    // Si la connexion WebSocket n'a pas encore finalisé le setup, attendre onSetupComplete
    if (!this.isWsReady()) {
      this.userWantsToStart = true;
      this.isStarting.set(true);
      return;
    }

    try {
      // 1. Démarrer le microphone avec transmission continue et réarmement d'activité
      await this.audioEngine.startMicrophone(
        (base64Pcm) => {
          if (this.initialGreetingPending || this.isMutedSignal()) return;
          this.clearInactivityTimer();
          this.wsClient.sendAudioChunk(base64Pcm);
        },
        (rms, peak) => this.observeAudioLevel(rms, peak)
      );

      // 2. Initialiser l'AudioContext de lecture sur le gesture utilisateur
      this.audioEngine.initPlayback();

      // 3. Activer le sas d'accueil : le micro est hermétiquement bloqué pendant la salutation de Bray
      this.initialGreetingPending = true;

      // 4. Envoyer le trigger pour faire parler Gemini
      this.wsClient.sendClientContent(this.pendingStartTriggerPrompt);

      // 5. Basculer l'état
      this.hasStarted.set(true);
      this.isStarting.set(false);
      this.userWantsToStart = false;
      this.startLiveTimers();
    } catch (err: any) {
      this.isStarting.set(false);
      this.userWantsToStart = false;
      this.triggerRefundIfAborted('mic_permission_error');
      console.warn('[GeminiLive] Microphone indisponible:', err);
      this.setError('Le microphone semble indisponible. Vérifiez son accès dans votre navigateur, puis réessayez.', 'microphone');
    }
  }

  /**
   * Extrait le prénom du candidat à partir du profil connecté ou du brouillon de CV.
   */
  private extractCandidateFirstName(): string {
    const user = this.authService.currentUser();
    const draft = this.currentDraft();
    const rawName = (draft?.identity?.fullName || user?.fullName || '').trim();
    if (!rawName) return '';
    const parts = rawName.split(/\s+/);
    let first = parts[0] || '';
    if (first.length > 0) {
      first = first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
    }
    return first;
  }

  stopSession(): void {
    this.stopLiveTimers();
    if (this.resumeTimer) {
      clearTimeout(this.resumeTimer);
      this.resumeTimer = null;
    }
    this.pendingProCredits = null;
    this.shouldRefreshProStatusOnSetup = false;
    this.initialGreetingPending = false;
    this.isSessionStarting = false;
    this.isResumingConnection = false;
    this.isRecoveringConnection = false;
    this.reconnecting.set(false);
    this.resumeUsedHandle = false;
    this.resumeAttempts = 0;
    this.lastWsSetupAt = 0;
    this.wsClient.setResumptionHandle(null);
    this.userWantsToStart = false;
    this.hasStarted.set(false);
    this.isStarting.set(false);
    this.isWsReady.set(false);
    if (this.echoCooldownTimer) {
      clearTimeout(this.echoCooldownTimer);
      this.echoCooldownTimer = null;
    }
    this.isAiSpeakingCooldown = false;
    this.clearInactivityTimer();
    this.clearAudioGuidance();
    this.recentAudioLevels = [];
    this.lastUserTranscriptionAt = 0;
    this.finalizeCurrentTurn();
    this.audioEngine.destroy();
    this.wsClient.disconnect();
    this.cvStream.disconnect();
    this.cvStreamSubscription?.unsubscribe();
    this.cvStreamSubscription = null;
    if (this.state() !== 'COMPLETED' && this.state() !== 'ERROR') {
      this.state.set('READY');
    }
  }

  private async syncCurrentTurnToBackend(): Promise<void> {
    if (this.syncInFlight) return;
    const sessionId = this.currentV2SessionId();
    if (!sessionId || !this.hasStarted() || this.lastUserTurnText.trim().length === 0) {
      return;
    }

    const userTurnToSend = this.lastUserTurnText.trim();
    const aiTurnToSend = this.lastAiTurnText.trim();

    this.syncInFlight = true;
    try {
      const v2Res = await firstValueFrom(
        this.apiService.syncTurnV2(this.currentCvId, {
          sessionId,
          userTurn: userTurnToSend,
          aiTurn: aiTurnToSend
        })
      );

      if (v2Res) {
        if (this.lastUserTurnText.startsWith(userTurnToSend)) {
          this.lastUserTurnText = this.lastUserTurnText.slice(userTurnToSend.length).trim();
        }
        if (this.lastAiTurnText.startsWith(aiTurnToSend)) {
          this.lastAiTurnText = this.lastAiTurnText.slice(aiTurnToSend.length).trim();
        }
        this.currentState.set(v2Res.currentState);
        this.sectionStatus.set(v2Res.sectionStatus);
        this.turnsInSection.set(v2Res.turnsInSection);
        if (v2Res.cvDataSoFar) {
          this.mergeDraft(v2Res.cvDataSoFar);
          this.sessionCache.saveSession(this.currentCvId, this.currentDraft(), this.transcript());
        }

        if (v2Res.interviewStatus === 'OBSERVER_UNAVAILABLE') {
          this.stopSession();
          this.state.set('TEMPORARILY_UNAVAILABLE');
          this.errorMessage.set('Le rédacteur du CV a atteint sa limite temporaire. Votre entretien est enregistré et cette session ne sera pas facturée.');
          return;
        }

        // Injection du contexte [INTERVIEW_STATE] dans Gemini Live
        if (v2Res.controlMessage && v2Res.controlMessage !== this.latestControlMessage()) {
          this.latestControlMessage.set(v2Res.controlMessage);
          this.wsClient.sendClientContent(v2Res.controlMessage, false);
        }

        if (v2Res.interviewStatus === 'REVIEW' || v2Res.interviewStatus === 'COMPLETED') {
          this.handleCompleteInterview();
        }
      }
    } catch (err) {
      console.warn('[GeminiLive] Erreur synchronisation tour V2:', err);
    } finally {
      this.syncInFlight = false;
      if (this.lastUserTurnText.trim() && this.lastUserTurnText !== userTurnToSend) {
        void this.syncCurrentTurnToBackend();
      }
    }
  }

  async handleCompleteInterview(): Promise<void> {
    if (['ERROR', 'TEMPORARILY_UNAVAILABLE'].includes(this.state())) {
      this.sessionCache.saveSession(this.currentCvId, this.currentDraft(), this.transcript());
      this.stopSession();
      this.state.set('TEMPORARILY_UNAVAILABLE');
      this.errorMessage.set('Votre entretien est interrompu. Le brouillon est conservé pour une reprise ou une modification.');
      return;
    }
    this.finalizeCurrentTurn();
    if (this.lastUserTurnText.trim().length > 0) {
      await this.syncCurrentTurnToBackend();
    }
    const targetCvId = this.currentCvId;
    this.sessionCache.saveSession(targetCvId, this.currentDraft(), this.transcript());
    this.wsClient.setResumptionHandle(null);
    this.stopSession();

    let completionSaved = false;

    if (targetCvId && targetCvId !== 'cv_default' && targetCvId !== 'new') {
      const transcriptEntries = this.transcript();
      const candidateText = transcriptEntries
        .filter(t => t.role === 'user')
        .map(t => t.text.trim())
        .join(' ');
      const transcriptText = transcriptEntries
        .map(t => `${t.role === 'user' ? 'Candidat' : 'Recruteur'}: ${t.text}`)
        .join('\n')
        .trim();

      // Preserve the structured interview draft when it can be finalized.
      if (this.hasSubstantiveCvContent(this.currentDraft())) {
        try {
          await firstValueFrom(this.apiService.completeInterview(targetCvId));
          completionSaved = true;
        } catch (err) {
          console.warn('[GeminiLive] Finalisation du brouillon indisponible:', err);
        }
      }

      if (!completionSaved && !this.hasSubstantiveCvContent(this.currentDraft())
          && candidateText.length >= 60 && candidateText.split(/\s+/).length >= 10) {
        this.isSynthesizing.set(true);
        try {
          console.log('[GeminiLive] Déclenchement de la synthèse IA complète du CV à partir de la conversation...');
          const synthesized = await firstValueFrom(this.apiService.synthesize(targetCvId, transcriptText));
          if (synthesized?.contentJson) {
            const parsed = typeof synthesized.contentJson === 'string'
              ? JSON.parse(synthesized.contentJson)
              : synthesized.contentJson;
            if (this.hasSubstantiveCvContent(parsed)) {
              this.currentDraft.set(parsed);
              completionSaved = true;
              console.log('[GeminiLive] CV synthétisé avec succès :', parsed);
            }
          }
        } catch (err) {
          console.warn('[GeminiLive] Synthèse échouée, transcription conservée pour reprise:', err);
        } finally {
          this.isSynthesizing.set(false);
        }
      }
    }

    if (completionSaved) {
      await firstValueFrom(this.authService.refreshCurrentUser());
      this.paymentService.fetchProStatus();
      this.state.set('COMPLETED');
      this.sessionCache.clearSession(targetCvId);
      this.interviewCompleted$.next();
    } else {
      this.sessionCache.saveSession(targetCvId, this.currentDraft(), this.transcript());
      this.state.set('TEMPORARILY_UNAVAILABLE');
      this.errorMessage.set('La rédaction du CV est momentanément indisponible. Votre entretien est conservé ; ne recommencez pas à zéro.');
    }
  }

  public async quitInterview(): Promise<void> {
    const sessionId = this.currentV2SessionId();
    const cvId = this.currentCvId;
    if (sessionId && /^\d+$/.test(cvId) && this.hasStarted()) {
      try {
        await firstValueFrom(this.apiService.requestEndInterviewV2(cvId, {
          sessionId,
          reason: 'user_quit',
          userIntentExcerpt: 'Je veux quitter',
          lastUserTurn: 'Je veux quitter'
        }));
      } catch (error) {
        console.warn('[GeminiLive] Clôture immédiate indisponible :', error);
      }
    }
    this.stopSession();
    await firstValueFrom(this.authService.refreshCurrentUser());
    this.paymentService.fetchProStatus();
  }

  private hasSubstantiveCvContent(draft: any): boolean {
    if (!draft || typeof draft !== 'object') return false;
    if (typeof draft.summary === 'string' && draft.summary.trim().length > 20) return true;
    if (Array.isArray(draft.skills) && draft.skills.some((skill: unknown) => typeof skill === 'string' && skill.trim())) return true;
    return ['experiences', 'education', 'projects'].some((key) =>
      Array.isArray(draft[key]) && draft[key].some((entry: any) =>
        entry && typeof entry === 'object' &&
        ['position', 'company', 'context', 'school', 'degree', 'details', 'name', 'description']
          .some((field) => typeof entry[field] === 'string' && entry[field].trim())
      )
    );
  }

  private async handleToolCall(name: string, callId: string, args: any): Promise<any> {
    if (name === 'request_end_interview') {
      const sessionId = this.currentV2SessionId() || '';
      try {
        const res = await firstValueFrom(
          this.apiService.requestEndInterviewV2(this.currentCvId, {
            sessionId,
            reason: args?.reason || 'user_requested_stop',
            userIntentExcerpt: args?.user_intent_excerpt || '',
            lastUserTurn: this.lastUserTurnText
          })
        );
        if (res?.approved) {
          this.state.set('USER_STOPPED');
          this.stopSession();
          return {
            status: 'stopped',
            approved: true,
            message: 'Entretien arrêté à la demande de l\'utilisateur. Votre progression a été enregistrée.'
          };
        } else {
          return {
            status: 'rejected',
            approved: false,
            reason: res?.reason,
            instruction: res?.instruction || 'Continue l\'entretien selon la section active.'
          };
        }
      } catch (e) {
        return { status: 'rejected', approved: false, instruction: 'Continue l\'entretien selon la section active.' };
      }
    }

    if (name === 'update_cv_draft') {
      this.hasMeaningfulUsage = true;
      this.mergeDraft(args);
      this.sessionCache.saveSession(this.currentCvId, this.currentDraft(), this.transcript());
      if (this.currentCvId && this.currentCvId !== 'cv_default' && this.currentCvId !== 'new') {
        this.apiService.saveDraft(this.currentCvId, this.currentDraft()).subscribe({
          next: (res) => { if (res?.id) this.currentCvId = String(res.id); },
          error: (e) => console.warn('[GeminiLive] Save draft silencieux:', e)
        });
      }
      return { status: 'success', updated: true };
    }

    if (name === 'audit_cv_integrity') {
      const report = this.auditEngine.audit(this.currentDraft());
      this.auditReport.set(report);
      return report;
    }

    if (name === 'complete_interview') {
      this.handleCompleteInterview();
      return { status: 'completed' };
    }

    return { status: 'unsupported' };
  }

  /**
   * Ajoute un chunk de transcription en le regroupant STRICTEMENT ligne par ligne.
   * Ne modifie pas l'affichage mot par mot pour éviter tout sautillement visuel.
   */
  private appendTranscriptChunk(role: 'user' | 'ai', chunk: string): void {
    if (!chunk) return;
    this.clearInactivityTimer();
    this.lineBuffers[role] += chunk;

    // Détection des phrases ou lignes complètes (terminées par . ? ! : ou saut de ligne)
    let match: RegExpMatchArray | null;
    while ((match = this.lineBuffers[role].match(/^([\s\S]*?[.?!:\n]+)(?:\s+|$)/))) {
      const completedLine = match[1].trim();
      this.lineBuffers[role] = this.lineBuffers[role].slice(match[0].length);
      if (completedLine) {
        this.commitLine(role, completedLine);
      }
    }

    // Sécurité : si le locuteur fait une pause prolongée (> 800ms) sans ponctuation finale
    if (this.flushTimeouts[role]) {
      clearTimeout(this.flushTimeouts[role]);
    }
    this.flushTimeouts[role] = setTimeout(() => {
      const pending = this.lineBuffers[role].trim();
      if (pending.length >= 25 || pending.includes(' ')) {
        this.commitLine(role, pending);
        this.lineBuffers[role] = '';
      }
    }, 800);
  }

  private commitLine(role: 'user' | 'ai', line: string): void {
    if (!line) return;

    if (role === 'user') {
      this.lastUserTurnText = (this.lastUserTurnText ? this.lastUserTurnText + ' ' : '') + line;
    } else if (role === 'ai') {
      this.lastAiTurnText = (this.lastAiTurnText ? this.lastAiTurnText + ' ' : '') + line;
    }

    this.transcript.update((items) => {
      const last = items[items.length - 1];
      // Si le dernier message appartient au même interlocuteur et est toujours en cours, on insère un retour ligne
      if (last && last.role === role && !last.isFinal) {
        const updated = [...items];
        updated[updated.length - 1] = {
          ...last,
          text: last.text ? `${last.text}\n${line}` : line
        };
        return updated;
      }

      // Nouveau bloc de conversation avec la ligne complète
      return [
        ...items,
        {
          id: Math.random().toString(36).substring(2, 9),
          role,
          text: line,
          isFinal: false
        }
      ];
    });

    this.sessionCache.saveSession(this.currentCvId, this.currentDraft(), this.transcript());
  }

  private finalizeCurrentTurn(): void {
    // Vider tout reliquat dans les buffers de lignes
    for (const role of ['user', 'ai'] as const) {
      if (this.flushTimeouts[role]) {
        clearTimeout(this.flushTimeouts[role]);
        delete this.flushTimeouts[role];
      }
      const pending = this.lineBuffers[role].trim();
      if (pending) {
        this.commitLine(role, pending);
        this.lineBuffers[role] = '';
      }
    }

    this.transcript.update((items) =>
      items.map((item) => (item.isFinal ? item : { ...item, isFinal: true }))
    );
    this.sessionCache.saveSession(this.currentCvId, this.currentDraft(), this.transcript());
  }

  private mergeDraft(patch: any): void {
    if (!patch) return;
    const current = this.currentDraft();
    const updated = { ...current };

    if (patch.identity) {
      const curId = updated.identity || {};
      updated.identity = {
        ...curId,
        ...patch.identity,
        fullName: this.authService.currentUser()?.fullName || curId.fullName || patch.identity.fullName || '',
        email: this.authService.currentUser()?.email || curId.email || patch.identity.email || ''
      };
    }

    if (patch.headline) updated.headline = patch.headline;
    if (patch.summary) updated.summary = patch.summary;
    for (const key of ['personalQualities', 'interests'] as const) {
      if (Array.isArray(patch[key])) {
        updated[key] = [...new Set([...(updated[key] || []), ...patch[key]])];
      }
    }

    if (Array.isArray(patch.skills) && patch.skills.length > 0) {
      const set = new Set([...(updated.skills || []), ...patch.skills]);
      updated.skills = Array.from(set);
    }

    if (Array.isArray(patch.experiences) && patch.experiences.length > 0) {
      const merged = [...(updated.experiences || [])];
      patch.experiences.forEach((experience: any, index: number) => {
        merged[index] = { ...(merged[index] || {}), ...experience };
      });
      updated.experiences = merged;
    }

    if (Array.isArray(patch.education) && patch.education.length > 0) {
      const merged = [...(updated.education || [])];
      patch.education.forEach((item: any, index: number) => {
        merged[index] = { ...(merged[index] || {}), ...item };
      });
      updated.education = merged;
    }

    if (Array.isArray(patch.projects) && patch.projects.length > 0) {
      const merged = [...(updated.projects || [])];
      patch.projects.forEach((project: any, index: number) => {
        merged[index] = { ...(merged[index] || {}), ...project };
      });
      updated.projects = merged;
    }

    if (Array.isArray(patch.languages) && patch.languages.length > 0) {
      const existing = updated.languages || [];
      const merged = [...existing];
      for (const newLang of patch.languages) {
        const langName = typeof newLang === 'string' ? newLang : (newLang.name || newLang.language || newLang.lang || '');
        const idx = merged.findIndex((l: any) => {
          const lName = typeof l === 'string' ? l : (l.name || l.language || l.lang || '');
          return lName.toLowerCase() === langName.toLowerCase();
        });
        if (idx !== -1) {
          merged[idx] = newLang;
        } else {
          merged.push(newLang);
        }
      }
      updated.languages = merged;
    }

    this.currentDraft.set(updated);
  }

  private resetDraft(): void {
    this.currentDraft.set(this.createEmptyDraft());
    this.transcript.set([]);
    this.auditReport.set(null);
  }

  private createEmptyDraft(): any {
    const user = this.authService.currentUser();
    return {
      identity: {
        fullName: user?.fullName || '',
        email: user?.email || '',
        phone: user?.phone || '',
        city: user?.city || ''
      },
      headline: user?.targetRole || '',
      summary: '',
      skills: [],
      experiences: [],
      education: [],
      languages: [],
      personalQualities: [],
      interests: []
    };
  }

  private observeAudioLevel(rms: number, peak: number): void {
    if (!this.hasStarted() || this.state() !== 'LISTENING' || this.isMutedSignal()
        || this.initialGreetingPending || this.isAiSpeakingCooldown) {
      this.recentAudioLevels = [];
      return;
    }
    this.recentAudioLevels.push({ rms, peak });
    if (this.recentAudioLevels.length > 32) this.recentAudioLevels.shift();
    if (this.recentAudioLevels.length < 32 || this.audioGuidance()
        || Date.now() - this.lastAudioGuidanceAt < 45_000
        || Date.now() - this.lastUserTranscriptionAt < 8_000) return;

    const active = this.recentAudioLevels.filter(level => level.rms > 0.007);
    const strong = this.recentAudioLevels.filter(level => level.rms > 0.075 && level.peak > 0.18);
    if (strong.length >= 24) {
      this.showAudioGuidance('noise');
    } else if (active.length >= 18
        && active.every(level => level.rms < 0.028 && level.peak < 0.16)) {
      this.showAudioGuidance('distance');
    }
  }

  private showAudioGuidance(kind: AudioGuidanceKind): void {
    this.lastAudioGuidanceAt = Date.now();
    this.audioGuidance.set(kind);
    if (this.audioGuidanceTimer) clearTimeout(this.audioGuidanceTimer);
    this.audioGuidanceTimer = setTimeout(() => this.clearAudioGuidance(), 8_000);
  }

  private clearAudioGuidance(): void {
    this.audioGuidance.set(null);
    if (this.audioGuidanceTimer) clearTimeout(this.audioGuidanceTimer);
    this.audioGuidanceTimer = null;
  }

  private setError(msg: string, kind?: InterviewIssueKind): void {
    const lower = msg.toLowerCase();
    const issue = kind || (/crédit|solde/.test(lower) ? 'credits'
      : /microphone|micro/.test(lower) ? 'microphone'
      : /connexion|liaison|réseau|internet/.test(lower) ? 'network' : 'service');
    const safeMessage = /http failure response|\/api\/|https?:\/\/|status\s*\d{3}|exception|stack trace/i.test(msg)
      ? 'L’entretien vocal est momentanément indisponible. Votre progression est conservée ; réessayez dans un instant.'
      : msg;
    this.errorKind.set(issue);
    this.errorMessage.set(safeMessage);
    this.state.set('ERROR');
    if (!this.currentV2SessionId()) return;
    const code = issue === 'network' ? 'WS_CONNECTION'
      : issue === 'microphone' ? 'MICROPHONE'
      : /rédacteur|rédaction/.test(lower) ? 'CV_WRITER'
      : /vocal|gemini|ia|indisponible/.test(lower) ? 'AI_UNAVAILABLE'
      : /démarrer|session/.test(lower) ? 'SESSION_START' : 'OTHER';
    const key = `${this.currentV2SessionId()}:${code}`;
    const now = Date.now();
    if (now - (this.lastReportedError.get(key) || 0) < 30_000) return;
    this.lastReportedError.set(key, now);
    this.apiService.reportClientError(code).subscribe({ error: () => {} });
  }

  public async handleExpiredSession(): Promise<void> {
    const targetCvId = this.currentCvId;
    console.log('[GeminiLive] Fin de temps ou expiration : sauvegarde d\'urgence du CV en cours...', targetCvId);

    // 1. Sauvegarde préalable du brouillon actuel
    if (targetCvId && targetCvId !== 'cv_default' && targetCvId !== 'new') {
      try {
        await firstValueFrom(this.apiService.saveDraft(targetCvId, this.currentDraft()));
      } catch (e) {
        console.warn('[GeminiLive] Sauvegarde draft à expiration non bloquante:', e);
      }
    }

    // Une expiration conserve les données recueillies sans finaliser le CV.
    this.sessionCache.saveSession(targetCvId, this.currentDraft(), this.transcript());
    this.stopSession();
    this.state.set('TEMPORARILY_UNAVAILABLE');
    this.errorMessage.set('Votre entretien a expiré. Le brouillon est conservé pour une reprise ou une modification.');

    // Rafraîchissement des soldes
    this.paymentService.fetchProStatus();
    this.authService.refreshCurrentUser().subscribe();
  }

  private armInactivityTimer(): void {
    this.clearInactivityTimer();
    this.inactivityTimer = setTimeout(async () => {
      console.warn('[GeminiLive] Délai d\'inactivité prolongé atteint (silence total de 4 min). Finalisation et sauvegarde du CV...');
      await this.handleExpiredSession();
    }, this.inactivityTimeoutMs);
  }

  private clearInactivityTimer(): void {
    if (this.inactivityTimer) {
      clearTimeout(this.inactivityTimer);
      this.inactivityTimer = null;
    }
  }
}
