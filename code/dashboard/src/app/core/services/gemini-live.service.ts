import { Injectable, signal, computed, inject } from '@angular/core';
import { Subject, firstValueFrom } from 'rxjs';
import { CvInterviewApiService } from './cv-interview-api.service';
import { AuthService } from './auth.service';
import { PaymentService } from './payment.service';
import { AudioPcmEngineService } from './audio-pcm-engine.service';
import { GeminiLiveWsClientService } from './gemini-live-ws-client.service';
import { InterviewSessionCacheService } from './interview-session-cache.service';
import { CV_INTERVIEW_START_TRIGGER, buildStartTrigger } from './cv-interview-system.prompt';
import { CvAuditEngineService, CvAuditReport } from './cv-audit-engine.service';

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

  public state = signal<LiveInterviewState>('READY');
  public transcript = signal<TranscriptEntry[]>([]);
  public errorMessage = signal<string | null>(null);
  public auditReport = signal<CvAuditReport | null>(null);
  public isRefunding = signal<boolean>(false);
  public isSynthesizing = signal<boolean>(false);
  public isQuotaReached = computed(() => {
    const currentState = this.state();
    // Ne jamais écraser un problème technique de connexion ou un remboursement en cours par un faux épuisement de quota
    if (currentState === 'TEMPORARILY_UNAVAILABLE' || currentState === 'ERROR' || this.isRefunding()) {
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

  // ── Signaux State Machine & Orchestrateur V2 (Spec V2) ──
  public currentV2SessionId = signal<string | null>(null);
  public currentState = signal<string>('IDENTITY');
  public sectionStatus = signal<string>('IN_PROGRESS');
  public turnsInSection = signal<number>(0);
  public latestControlMessage = signal<string>('');

  private lastUserTurnText = '';
  private lastAiTurnText = '';

  private isAiSpeakingCooldown = false;
  private echoCooldownTimer: any = null;
  private inactivityTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly inactivityTimeoutMs = 90_000;
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
  private currentCandidateFirstName = '';

  setMuted(muted: boolean): void {
    this.isMutedSignal.set(muted);
    this.audioEngine.setMuted(muted);
  }

  public hasActiveCachedSession(cvId: string): boolean {
    const cached = this.sessionCache.getSession(cvId);
    return !!cached && !!(cached.draft || (cached.transcript && cached.transcript.length > 0));
  }

  public getCachedDraft(cvId: string): any {
    return this.sessionCache.getSession(cvId)?.draft ?? null;
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
      this.resetDraft();
      this.clearInactivityTimer();
      this.hasStarted.set(false);
      this.isWsReady.set(false);

      // Vérifier si une session récente (< 10 min) existe en cache
      const cached = this.sessionCache.getSession(cvId);
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
        let msg = err?.error?.detail || err?.error?.message || err?.error?.reason || err?.message || 'Service vocal indisponible.';
        if (typeof msg === 'string' && msg.includes('INSUFFICIENT_CREDITS:')) {
          msg = msg.split('INSUFFICIENT_CREDITS:')[1]?.trim() || msg;
          this.paymentService.openPackModal();
        } else if (err?.status === 402 || (typeof msg === 'string' && msg.includes('INSUFFICIENT_CREDITS'))) {
          msg = "Solde insuffisant : l'accès à l'entretien vocal IA nécessite au moins 1 crédit Pro. Veuillez recharger votre compte.";
          this.paymentService.openPackModal();
        } else if (typeof msg === 'string' && msg.includes('QUOTA_REACHED:')) {
          msg = msg.split('QUOTA_REACHED:')[1]?.trim() || msg;
        }
        throw new Error(msg);
      });

      if (abortController.signal.aborted) {
        this.stopSession();
        return;
      }

      const token = session?.token;
      const model = session?.model || 'gemini-3.1-flash-live-preview';

      if (session?.cvId) {
        this.currentCvId = session.cvId;
      }

      // Initialisation / reprise de l'orchestrateur V2 en base
      try {
        const v2Session = await firstValueFrom(this.apiService.initOrResumeV2Session(this.currentCvId));
        if (v2Session) {
          this.currentV2SessionId.set(v2Session.sessionId);
          this.currentState.set(v2Session.currentState);
          this.sectionStatus.set(v2Session.sectionStatus);
          this.turnsInSection.set(v2Session.turnsInSection);
          this.latestControlMessage.set(v2Session.controlMessage);
          if (v2Session.cvDataSoFar && Object.keys(v2Session.cvDataSoFar).length > 0) {
            this.currentDraft.set(v2Session.cvDataSoFar);
          }
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
      this.setError(err?.message || 'Impossible de démarrer la session vocale.');
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
        this.pendingProCredits = null;
        this.shouldRefreshProStatusOnSetup = false;
        this.initialGreetingPending = false;
        this.isStarting.set(false);
        this.state.set('TEMPORARILY_UNAVAILABLE');
        this.triggerRefundIfAborted('ws_error: ' + err);
        this.setError('Le service vocal n\'est pas disponible pour le moment. Votre progression a été conservée.');
      },
      onSessionResumptionUpdate: (handle: string) => {
        console.log('[GeminiLive] Handle de reprise de session mis à jour:', handle);
        this.wsClient.setResumptionHandle(handle);
      },
      onGoAway: (timeLeft?: string) => {
        console.warn('[GeminiLive] Signal go_away reçu du serveur Gemini (coupure imminente, délai:', timeLeft, '). Préparation de la reconnexion transparente.');
        this.isResumingConnection = true;
      },
      onClose: (code: number) => {
        this.pendingProCredits = null;
        this.shouldRefreshProStatusOnSetup = false;
        this.initialGreetingPending = false;
        this.isStarting.set(false);

        // 1. Reprise de session transparente si signal go_away reçu et handle présent
        if (this.isResumingConnection && this.wsClient.getResumptionHandle() && this.state() !== 'COMPLETED' && this.state() !== 'USER_STOPPED') {
          console.log('[GeminiLive] Bascule transparente vers une nouvelle session avec jeton de reprise...');
          this.isResumingConnection = false;
          this.attemptSeamlessResume();
          return;
        }

        // 2. Remboursement automatique en cas de rupture de connexion anormale avant usage réel
        if (code !== 1000 && !this.hasMeaningfulUsage) {
          this.triggerRefundIfAborted(`ws_close_${code}`);
        }

        if (this.state() !== 'COMPLETED' && this.state() !== 'USER_STOPPED' && code !== 1000 && this.state() !== 'ERROR') {
          this.state.set('TEMPORARILY_UNAVAILABLE');
          this.setError('Le service vocal n\'est pas disponible pour le moment. Votre progression a été conservée.');
        }
      }
    };
  }

  /**
   * Déclenche le remboursement automatique du crédit Pro débité si la session a échoué ou s'est
   * arrêtée de manière anormale avant toute utilisation effective du service vocal.
   */
  triggerRefundIfAborted(reason: string = 'interruption'): void {
    if (this.hasMeaningfulUsage || this.state() === 'COMPLETED') return;
    const targetCvId = this.currentCvId;
    if (!targetCvId || targetCvId === 'cv_default' || targetCvId === 'new') return;

    console.warn(`[GeminiLive] Déclenchement de remboursement automatique (${reason}) pour cvId=${targetCvId}`);
    this.isRefunding.set(true);
    this.apiService.refundAbortedSession(targetCvId).subscribe({
      next: (res) => {
        if (res?.refunded) {
          console.log('[GeminiLive] 1 crédit Pro remboursé avec succès suite à l\'incident technique.');
          this.paymentService.fetchProStatus();
          this.authService.refreshCurrentUser().subscribe({
            next: () => this.isRefunding.set(false),
            error: () => this.isRefunding.set(false)
          });
        } else {
          this.isRefunding.set(false);
        }
      },
      error: (e) => {
        console.warn('[GeminiLive] Erreur lors de la notification de remboursement automatique:', e);
        this.isRefunding.set(false);
      }
    });
  }

  private async attemptSeamlessResume(): Promise<void> {
    try {
      console.log('[GeminiLive] Obtention d\'un jeton de session pour reprise transparente (sans débit de crédit)...');
      const session = await firstValueFrom(this.apiService.createSession(this.currentCvId));
      if (session?.token) {
        const token = session.token;
        const model = session.model || 'gemini-3.1-flash-live-preview';
        this.wsClient.connect(
          token,
          model,
          this.buildWsCallbacks(this.currentCandidateFirstName),
          this.currentCandidateFirstName
        );
      }
    } catch (e) {
      console.warn('[GeminiLive] Échec de la reprise transparente:', e);
      this.setError('Connexion interrompue avec le serveur.');
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
      // 1. Démarrer le microphone avec la barrière anti-écho
      await this.audioEngine.startMicrophone((base64Pcm) => {
        if (this.initialGreetingPending || this.state() === 'AI_SPEAKING' || this.isAiSpeakingCooldown || this.isMutedSignal()) {
          return;
        }
        this.wsClient.sendAudioChunk(base64Pcm);
      });

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
    } catch (err: any) {
      this.isStarting.set(false);
      this.userWantsToStart = false;
      this.triggerRefundIfAborted('mic_permission_error');
      this.setError(err?.message || 'Impossible d’accéder au microphone. Vérifiez vos autorisations.');
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
    this.pendingProCredits = null;
    this.shouldRefreshProStatusOnSetup = false;
    this.initialGreetingPending = false;
    this.isSessionStarting = false;
    this.isResumingConnection = false;
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
    this.finalizeCurrentTurn();
    this.audioEngine.destroy();
    this.wsClient.disconnect();
    if (this.state() !== 'COMPLETED' && this.state() !== 'ERROR') {
      this.state.set('READY');
    }
  }

  private async syncCurrentTurnToBackend(): Promise<void> {
    const sessionId = this.currentV2SessionId();
    if (!sessionId || !this.hasStarted() || this.lastUserTurnText.trim().length === 0) {
      return;
    }

    const userTurnToSend = this.lastUserTurnText.trim();
    const aiTurnToSend = this.lastAiTurnText.trim();
    this.lastUserTurnText = '';
    this.lastAiTurnText = '';

    try {
      const v2Res = await firstValueFrom(
        this.apiService.syncTurnV2(this.currentCvId, {
          sessionId,
          userTurn: userTurnToSend,
          aiTurn: aiTurnToSend
        })
      );

      if (v2Res) {
        this.currentState.set(v2Res.currentState);
        this.sectionStatus.set(v2Res.sectionStatus);
        this.turnsInSection.set(v2Res.turnsInSection);
        if (v2Res.cvDataSoFar) {
          this.currentDraft.set(v2Res.cvDataSoFar);
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
    }
  }

  async handleCompleteInterview(): Promise<void> {
    this.finalizeCurrentTurn();
    if (this.lastUserTurnText.trim().length > 0) {
      await this.syncCurrentTurnToBackend();
    }
    this.state.set('COMPLETED');
    const targetCvId = this.currentCvId;
    this.sessionCache.clearSession(targetCvId);
    this.wsClient.setResumptionHandle(null);
    this.stopSession();

    if (targetCvId && targetCvId !== 'cv_default' && targetCvId !== 'new') {
      const transcriptEntries = this.transcript();
      const transcriptText = transcriptEntries
        .map(t => `${t.role === 'user' ? 'Candidat' : 'Recruteur'}: ${t.text}`)
        .join('\n')
        .trim();

      if (transcriptText.length >= 30) {
        this.isSynthesizing.set(true);
        try {
          console.log('[GeminiLive] Déclenchement de la synthèse IA complète du CV à partir de la conversation...');
          const synthesized = await firstValueFrom(this.apiService.synthesize(targetCvId, transcriptText));
          if (synthesized?.contentJson) {
            try {
              const parsed = typeof synthesized.contentJson === 'string'
                ? JSON.parse(synthesized.contentJson)
                : synthesized.contentJson;
              this.currentDraft.set(parsed);
              console.log('[GeminiLive] CV synthétisé avec succès :', parsed);
            } catch (e) {
              console.warn('[GeminiLive] Erreur parsing contentJson synthétisé:', e);
            }
          }
        } catch (err) {
          console.warn('[GeminiLive] Synthèse échouée, fallback sur completeInterview standard:', err);
          try {
            await firstValueFrom(this.apiService.completeInterview(targetCvId));
          } catch (e) {}
        } finally {
          this.isSynthesizing.set(false);
          this.paymentService.fetchProStatus();
          this.authService.refreshCurrentUser().subscribe();
        }
      } else {
        try {
          await firstValueFrom(this.apiService.completeInterview(targetCvId));
          this.paymentService.fetchProStatus();
          this.authService.refreshCurrentUser().subscribe();
        } catch (e) {}
      }
    }

    this.interviewCompleted$.next();
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

    if (patch.headline) updated.headline = patch.headline;
    if (patch.summary) updated.summary = patch.summary;

    if (Array.isArray(patch.skills) && patch.skills.length > 0) {
      const set = new Set([...(updated.skills || []), ...patch.skills]);
      updated.skills = Array.from(set);
    }

    if (Array.isArray(patch.experiences) && patch.experiences.length > 0) {
      const existing = updated.experiences || [];
      const merged = [...existing];

      for (const newExp of patch.experiences) {
        const idx = merged.findIndex(
          (e: any) =>
            e.company?.toLowerCase() === newExp.company?.toLowerCase() &&
            e.position?.toLowerCase() === newExp.position?.toLowerCase()
        );
        if (idx !== -1) {
          merged[idx] = { ...merged[idx], ...newExp };
        } else {
          merged.push(newExp);
        }
      }
      updated.experiences = merged;
    }

    if (Array.isArray(patch.education) && patch.education.length > 0) {
      const existing = updated.education || [];
      const merged = [...existing];

      for (const newEdu of patch.education) {
        const idx = merged.findIndex(
          (e: any) =>
            (e.school && newEdu.school && e.school.toLowerCase() === newEdu.school.toLowerCase()) ||
            (e.degree && newEdu.degree && e.degree.toLowerCase() === newEdu.degree.toLowerCase())
        );
        if (idx !== -1) {
          merged[idx] = { ...merged[idx], ...newEdu };
        } else {
          merged.push(newEdu);
        }
      }
      updated.education = merged;
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
      languages: []
    };
  }

  private setError(msg: string): void {
    this.errorMessage.set(msg);
    this.state.set('ERROR');
  }

  private armInactivityTimer(): void {
    this.clearInactivityTimer();
    this.inactivityTimer = setTimeout(() => {
      console.warn('[GeminiLive] Délai d\'inactivité atteint.');
      this.stopSession();
    }, this.inactivityTimeoutMs);
  }

  private clearInactivityTimer(): void {
    if (this.inactivityTimer) {
      clearTimeout(this.inactivityTimer);
      this.inactivityTimer = null;
    }
  }
}
