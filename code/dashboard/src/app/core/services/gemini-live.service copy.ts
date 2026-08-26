import { Injectable, signal, inject } from '@angular/core';
import { Subject, firstValueFrom } from 'rxjs';
import { CvInterviewApiService } from './cv-interview-api.service';

export type LiveInterviewState = 'READY' | 'CONNECTING' | 'LISTENING' | 'AI_SPEAKING' | 'ERROR' | 'COMPLETED';

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

  public state = signal<LiveInterviewState>('READY');
  public transcript = signal<TranscriptEntry[]>([]);
  public errorMessage = signal<string | null>(null);
  public currentDraft = signal<any>({
    identity: { fullName: '', email: '', phone: '', city: '' },
    headline: '',
    summary: '',
    experiences: [],
    education: [],
    skills: [],
    languages: []
  });
  public interviewCompleted$ = new Subject<void>();

  private ws: WebSocket | null = null;
  private audioCtx: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private workletNode: AudioWorkletNode | null = null;
  private workletUrl: string | null = null;
  private scriptNode: ScriptProcessorNode | null = null;

  // --- Lecture audio en flux continu (duplex temps réel) ---
  private playbackCtx: AudioContext | null = null;
  private nextPlayTime = 0;
  private activeSources: AudioBufferSourceNode[] = [];
  private pendingSourceCount = 0;

  private isSetupComplete = false;
  public currentCvId: string = 'cv_default';

  async startSession(cvId: string = 'cv_default'): Promise<void> {
    try {
      this.currentCvId = cvId;
      this.state.set('CONNECTING');
      this.errorMessage.set(null);
      this.resetDraft();
      this.isSetupComplete = false;

      // 1. Obtenir le token éphémère depuis le backend Spring Boot
      const session = await firstValueFrom(this.apiService.createSession(cvId)).catch((err) => {
        const msg = err?.error?.message || err?.message || 'Service vocal indisponible.';
        throw new Error(msg);
      });

      const token = session?.token;
      const model = session?.model || 'gemini-3.1-flash-live-preview';

      if (session?.cvId) {
        this.currentCvId = session.cvId;
      }

      if (!token) {
        throw new Error('Aucun token reçu depuis le backend.');
      }

      // 2. Construire l'URL WebSocket selon le type de token
      // Token éphémère (auth_tokens/...) → access_token
      // Clé API directe (AQ... / AIza...) → ?key=
      const isEphemeralToken = token.startsWith('auth_tokens/');
      let wsUrl: string;

      if (isEphemeralToken) {
        wsUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContentConstrained?access_token=${token}`;
      } else {
        wsUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${token}`;
      }

      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.sendInitialSetup(model);
      };

      this.ws.onmessage = async (event) => {
        await this.handleServerMessage(event.data);
      };

      this.ws.onerror = () => {
        this.setError('Connexion WebSocket impossible. Vérifiez votre connexion internet.');
      };

      this.ws.onclose = (event) => {
        if (this.state() !== 'COMPLETED') {
          if (event.code !== 1000 && !this.isSetupComplete) {
            this.setError(`Connexion Gemini perdue (code ${event.code}). Veuillez réessayer.`);
          } else {
            this.state.set('READY');
          }
        }
      };

    } catch (err: any) {
      this.setError(err?.message || 'Impossible de démarrer la session vocale.');
    }
  }

  private setError(message: string): void {
    this.errorMessage.set(message);
    this.state.set('ERROR');
  }

  private sendInitialSetup(model: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    const fullModelName = model.startsWith('models/') ? model : `models/${model}`;

    const setupPayload = {
      setup: {
        model: fullModelName,
        generationConfig: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: 'Puck'
              }
            }
          }
        },
        realtimeInputConfig: {
          automaticActivityDetection: {
            disabled: false
          }
        },
        systemInstruction: {
          parts: [
            {
              text: `Tu es un assistant RH et expert CV bienveillant. Dès l'ouverture de la connexion, PRENDS IMMÉDIATEMENT LA PAROLE DE VIVE VOIX pour accueillir le candidat et piloter l'entretien.

C'est TOI qui pilotes la conversation en posant UNE SEULE QUESTION À LA FOIS.

Déroulement guidé :
1. Accueil vocal chaleureux : "Bonjour et bienvenue ! Je suis votre assistant vocal IA. Je vais piloter notre entretien pour construire votre CV. Pour commencer, quel est le titre du poste que vous recherchez ou votre domaine principal ?"
2. Attends la réponse du candidat.
3. Extrais les informations utiles avec update_cv_draft, puis enchaîne avec la question suivante (ex: expérience récente, compétences clés, formations, langues).
4. Ne pose jamais deux questions en même temps.
5. Ne lis jamais à voix haute le JSON ou les données techniques.
6. Lorsque les informations sont complètes, demande : "Souhaitez-vous ajouter autre chose à votre CV ?"
7. Si le candidat dit qu'il a terminé ou n'a rien à ajouter, appelle immédiatement complete_interview.`
            }
          ]
        },
        tools: [
          {
            functionDeclarations: [
              {
                name: 'update_cv_draft',
                description: 'Met à jour les informations structurées du CV.',
                parameters: {
                  type: 'OBJECT',
                  properties: {
                    identity: {
                      type: 'OBJECT',
                      properties: {
                        fullName: { type: 'STRING' },
                        email: { type: 'STRING' },
                        phone: { type: 'STRING' },
                        city: { type: 'STRING' }
                      }
                    },
                    headline: { type: 'STRING' },
                    summary: { type: 'STRING' },
                    skills: {
                      type: 'ARRAY',
                      items: { type: 'STRING' }
                    },
                    experiences: {
                      type: 'ARRAY',
                      items: {
                        type: 'OBJECT',
                        properties: {
                          company: { type: 'STRING' },
                          position: { type: 'STRING' },
                          startDate: { type: 'STRING' },
                          endDate: { type: 'STRING' },
                          responsibilities: { type: 'ARRAY', items: { type: 'STRING' } }
                        }
                      }
                    },
                    education: {
                      type: 'ARRAY',
                      items: {
                        type: 'OBJECT',
                        properties: {
                          school: { type: 'STRING' },
                          degree: { type: 'STRING' },
                          year: { type: 'STRING' }
                        }
                      }
                    }
                  }
                }
              },
              {
                name: 'complete_interview',
                description: 'Marque l\'entretien comme terminé lorsque le candidat a terminé.',
                parameters: {
                  type: 'OBJECT',
                  properties: {
                    finished: { type: 'BOOLEAN' }
                  }
                }
              }
            ]
          }
        ]
      }
    };

    this.ws.send(JSON.stringify(setupPayload));
  }

  private async startMicrophone(): Promise<void> {
    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1
        },
        video: false
      });
      this.audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      const source = this.audioCtx.createMediaStreamSource(this.mediaStream);

      if (this.audioCtx.audioWorklet) {
        const workletCode = `
          class PcmProcessor extends AudioWorkletProcessor {
            process(inputs) {
              const input = inputs[0];
              if (input && input.length > 0) {
                const channelData = input[0];
                if (channelData && channelData.length > 0) {
                  this.port.postMessage(channelData);
                }
              }
              return true;
            }
          }
          registerProcessor('pcm-processor', PcmProcessor);
        `;
        const blob = new Blob([workletCode], { type: 'application/javascript' });
        this.workletUrl = URL.createObjectURL(blob);
        await this.audioCtx.audioWorklet.addModule(this.workletUrl);

        this.workletNode = new AudioWorkletNode(this.audioCtx, 'pcm-processor');
        this.workletNode.port.onmessage = (e: MessageEvent<Float32Array>) => {
          this.processAudioChunk(e.data);
        };

        source.connect(this.workletNode);
        this.workletNode.connect(this.audioCtx.destination);
      } else {
        this.scriptNode = this.audioCtx.createScriptProcessor(2048, 1, 1);
        this.scriptNode.onaudioprocess = (e) => {
          const inputData = e.inputBuffer.getChannelData(0);
          this.processAudioChunk(inputData);
        };
        source.connect(this.scriptNode);
        this.scriptNode.connect(this.audioCtx.destination);
      }
    } catch (err: any) {
      if (err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError') {
        this.setError('Accès au microphone refusé. Veuillez autoriser le microphone dans votre navigateur.');
      } else {
        this.setError('Impossible d\'accéder au microphone.');
      }
    }
  }

  private processAudioChunk(inputData: Float32Array): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN || !this.isSetupComplete) return;

    const pcm16 = new Int16Array(inputData.length);
    for (let i = 0; i < inputData.length; i++) {
      const s = Math.max(-1, Math.min(1, inputData[i]));
      pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }

    const base64Audio = this.arrayBufferToBase64(pcm16.buffer);
    this.ws.send(JSON.stringify({
      realtimeInput: {
        audio: {
          data: base64Audio,
          mimeType: 'audio/pcm;rate=16000'
        }
      }
    }));
  }

  private async handleServerMessage(data: any): Promise<void> {
    try {
      let rawText = data;
      if (data instanceof Blob) {
        rawText = await data.text();
      }
      const msg = JSON.parse(rawText);

      if (msg.setupComplete) {
        this.isSetupComplete = true;
        this.ensurePlaybackContext();
        await this.startMicrophone();
        this.state.set('LISTENING');
      }

      if (msg.serverContent) {
        const serverContent = msg.serverContent;

        if (serverContent.interrupted) {
          this.stopPlayback();
          this.state.set('LISTENING');
        }

        if (serverContent.inputTranscription?.text) {
          this.addTranscript('user', serverContent.inputTranscription.text);
        }
        if (serverContent.outputTranscription?.text) {
          this.addTranscript('ai', serverContent.outputTranscription.text);
        }

        const parts = msg.serverContent.modelTurn?.parts || [];
        for (const part of parts) {
          if (part.inlineData?.data) {
            this.state.set('AI_SPEAKING');
            this.enqueuePcmAudio24k(part.inlineData.data);
          }
        }
      }

      if (msg.toolCall) {
        const calls = msg.toolCall.functionCalls || [];
        for (const call of calls) {
          if (call.name === 'update_cv_draft') {
            await this.handleUpdateCvDraft(call.args);
            this.respondToolCall(call.id, { success: true });
          } else if (call.name === 'complete_interview') {
            await this.handleCompleteInterview();
            this.respondToolCall(call.id, { finished: true });
          }
        }
      }
    } catch (e) {
      console.error('Erreur traitement message Gemini:', e);
    }
  }

  private respondToolCall(callId: string, result: any): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify({
      toolResponse: {
        functionResponses: [
          {
            response: { output: result },
            id: callId
          }
        ]
      }
    }));
  }

  public async handleUpdateCvDraft(newInfo: any): Promise<void> {
    const current = this.currentDraft();
    const updated = {
      ...current,
      ...newInfo,
      identity: { ...current.identity, ...newInfo.identity },
      skills: Array.from(new Set([...(current.skills || []), ...(newInfo.skills || [])])),
      experiences: newInfo.experiences ? [...(current.experiences || []), ...newInfo.experiences] : current.experiences,
      education: newInfo.education ? [...(current.education || []), ...newInfo.education] : current.education
    };

    this.currentDraft.set(updated);
    await firstValueFrom(this.apiService.saveDraft(this.currentCvId, updated)).catch(() => null);
  }

  public async handleCompleteInterview(): Promise<void> {
    await firstValueFrom(this.apiService.saveDraft(this.currentCvId, this.currentDraft())).catch(() => null);
    await firstValueFrom(this.apiService.completeInterview(this.currentCvId)).catch(() => null);
    this.state.set('COMPLETED');
    this.stopSession();
    this.interviewCompleted$.next();
  }

  // --- Lecture audio en flux continu ------------------------------------

  private ensurePlaybackContext(): void {
    if (!this.playbackCtx || this.playbackCtx.state === 'closed') {
      this.playbackCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      this.nextPlayTime = this.playbackCtx.currentTime;
    }
  }

  private enqueuePcmAudio24k(base64Data: string): void {
    try {
      this.ensurePlaybackContext();
      const ctx = this.playbackCtx!;

      const binary = atob(base64Data);
      const len = binary.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binary.charCodeAt(i);
      }

      const pcm16 = new Int16Array(bytes.buffer);
      const float32 = new Float32Array(pcm16.length);
      for (let i = 0; i < pcm16.length; i++) {
        float32[i] = pcm16[i] / 32768.0;
      }

      const buffer = ctx.createBuffer(1, float32.length, 24000);
      buffer.getChannelData(0).set(float32);

      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);

      const startAt = Math.max(this.nextPlayTime, ctx.currentTime);
      source.start(startAt);
      this.nextPlayTime = startAt + buffer.duration;

      this.pendingSourceCount++;
      this.activeSources.push(source);

      source.onended = () => {
        this.activeSources = this.activeSources.filter(s => s !== source);
        this.pendingSourceCount = Math.max(0, this.pendingSourceCount - 1);
        if (this.pendingSourceCount === 0 && this.state() === 'AI_SPEAKING') {
          this.state.set('LISTENING');
        }
      };
    } catch (e) {
      console.error('Erreur lecture audio PCM 24k:', e);
    }
  }

  private stopPlayback(): void {
    for (const src of this.activeSources) {
      try { src.onended = null; src.stop(); } catch { /* déjà arrêté */ }
    }
    this.activeSources = [];
    this.pendingSourceCount = 0;
    if (this.playbackCtx) {
      this.nextPlayTime = this.playbackCtx.currentTime;
    }
  }

  // -----------------------------------------------------------------------

  private addTranscript(role: 'user' | 'ai', text: string): void {
    this.transcript.update(entries => [
      ...entries,
      { id: String(Date.now() + Math.random()), role, text, isFinal: true }
    ]);
  }

  stopSession(): void {
    this.isSetupComplete = false;
    this.stopPlayback();
    if (this.playbackCtx) {
      this.playbackCtx.close().catch(() => null);
      this.playbackCtx = null;
    }
    if (this.workletNode) {
      this.workletNode.disconnect();
      this.workletNode = null;
    }
    if (this.workletUrl) {
      URL.revokeObjectURL(this.workletUrl);
      this.workletUrl = null;
    }
    if (this.scriptNode) {
      this.scriptNode.disconnect();
      this.scriptNode = null;
    }
    if (this.audioCtx) {
      this.audioCtx.close().catch(() => null);
      this.audioCtx = null;
    }
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    if (this.state() !== 'COMPLETED') {
      this.state.set('READY');
    }
    // currentDraft conservé après stopSession pour le cv-builder-main
  }

  resetDraft(): void {
    this.currentDraft.set({
      identity: { fullName: '', email: '', phone: '', city: '' },
      headline: '',
      summary: '',
      experiences: [],
      education: [],
      skills: [],
      languages: []
    });
    this.transcript.set([]);
  }

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  }
}
