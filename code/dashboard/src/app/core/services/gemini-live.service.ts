import { Injectable, signal, computed, inject } from '@angular/core';
import { Subject, firstValueFrom } from 'rxjs';
import { CvInterviewApiService } from './cv-interview-api.service';
import { AuthService } from './auth.service';
import {
  CV_INTERVIEW_START_TRIGGER,
  CV_INTERVIEW_SYSTEM_PROMPT
} from './cv-interview-system.prompt';

export type LiveInterviewState =
  | 'READY'
  | 'CONNECTING'
  | 'LISTENING'
  | 'AI_SPEAKING'
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

  public state = signal<LiveInterviewState>('READY');
  public transcript = signal<TranscriptEntry[]>([]);
  public errorMessage = signal<string | null>(null);
  public isQuotaReached = computed(() => {
    const msg = this.errorMessage();
    return !!msg && (msg.includes('limite de 3 entretiens') || msg.includes('QUOTA_REACHED') || msg.includes('crédits se réinitialiseront'));
  });

  public currentDraft = signal<any>(this.createEmptyDraft());
  public interviewCompleted$ = new Subject<void>();

  private ws: WebSocket | null = null;

  // Capture micro
  private audioCtx: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private workletNode: AudioWorkletNode | null = null;
  private workletUrl: string | null = null;
  private scriptNode: ScriptProcessorNode | null = null;
  private silentGainNode: GainNode | null = null;
  private microphoneReadyPromise: Promise<void> | null = null;

  // Lecture Gemini
  private playbackCtx: AudioContext | null = null;
  private nextPlayTime = 0;
  private activeSources: AudioBufferSourceNode[] = [];
  private pendingSourceCount = 0;
  private modelTurnComplete = false;

  private isSetupComplete = false;
  private welcomeTriggered = false;

  // Inactivité : on ferme uniquement lorsque Gemini a fini de parler
  // et attend réellement une réponse utilisateur.
  private inactivityTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly inactivityTimeoutMs = 90_000;

  // Gestion du streaming transcript par tour de parole
  private activeTurnRole: 'user' | 'ai' | null = null;
  private activeTurnId: string | null = null;

  public currentCvId: string = 'cv_default';

  async startSession(cvId: string = 'cv_default'): Promise<void> {
    try {
      this.currentCvId = cvId;
      this.state.set('CONNECTING');
      this.errorMessage.set(null);
      this.resetDraft();

      this.isSetupComplete = false;
      this.welcomeTriggered = false;
      this.modelTurnComplete = false;
      this.clearInactivityTimer();

      /**
       * Optimisation sans toucher au contrat Gemini :
       * on demande le micro pendant que Spring crée le token éphémère.
       * Le micro ne sera pas envoyé tant que setupComplete n'a pas été reçu.
       */
      this.microphoneReadyPromise = this.startMicrophone();

      const session = await firstValueFrom(
        this.apiService.createSession(cvId)
      ).catch((err) => {
        let msg =
          err?.error?.message ||
          err?.error?.reason ||
          err?.message ||
          'Service vocal indisponible.';
        if (typeof msg === 'string' && msg.includes('QUOTA_REACHED:')) {
          msg = msg.split('QUOTA_REACHED:')[1]?.trim() || msg;
        }
        if (err?.status === 429 && (!msg || msg === 'Service vocal indisponible.' || msg.includes('429'))) {
          msg = "Vous avez atteint votre limite de 3 entretiens vocaux IA pour aujourd'hui. Vos crédits se réinitialiseront demain à minuit.";
        }
        throw new Error(msg);
      });

      const token = session?.token;
      const model =
        session?.model ||
        'gemini-3.1-flash-live-preview';

      if (session?.cvId) {
        this.currentCvId = session.cvId;
      }

      if (!token) {
        throw new Error(
          'Aucun token reçu depuis le backend.'
        );
      }

      // On conserve exactement le mécanisme de connexion déjà fonctionnel.
      const isEphemeralToken =
        token.startsWith('auth_tokens/');

      const wsUrl = isEphemeralToken
        ? `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContentConstrained?access_token=${token}`
        : `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${token}`;

      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.sendInitialSetup(model);
      };

      this.ws.onmessage = async (event) => {
        await this.handleServerMessage(event.data);
      };

      this.ws.onerror = () => {
        this.setError(
          'Connexion WebSocket impossible. Vérifiez votre connexion internet.'
        );
      };

      this.ws.onclose = (event) => {
        this.clearInactivityTimer();

        if (this.state() !== 'COMPLETED') {
          if (
            event.code !== 1000 &&
            !this.isSetupComplete
          ) {
            this.setError(
              `Connexion à l’assistant IA perdue (code ${event.code}). Veuillez réessayer.`
            );
          } else if (this.state() !== 'ERROR') {
            this.state.set('READY');
          }
        }
      };
    } catch (err: any) {
      this.stopSession();
      this.setError(
        err?.message ||
        'Impossible de démarrer la session vocale.'
      );
    }
  }

  private setError(message: string): void {
    this.errorMessage.set(message);
    this.state.set('ERROR');
  }

  private sendInitialSetup(model: string): void {
    if (
      !this.ws ||
      this.ws.readyState !== WebSocket.OPEN
    ) {
      return;
    }

    const fullModelName = model.startsWith('models/')
      ? model
      : `models/${model}`;

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
            disabled: false,
            // Valeurs volontairement conservatrices pour une conversation naturelle.
            prefixPaddingMs: 40,
            silenceDurationMs: 650
          },
          activityHandling:
            'START_OF_ACTIVITY_INTERRUPTS'
        },

        // Le code gérait déjà ces messages côté réception ;
        // on les active explicitement.
        inputAudioTranscription: {},
        outputAudioTranscription: {},

        systemInstruction: {
          parts: [
            {
              text: CV_INTERVIEW_SYSTEM_PROMPT
            }
          ]
        },

        tools: [
          {
            functionDeclarations: [
              {
                name: 'update_cv_draft',
                description:
                  'Met à jour les informations structurées et rédigées du CV à partir des faits confirmés par le candidat.',
                parameters: {
                  type: 'OBJECT',
                  properties: {
                    identity: {
                      type: 'OBJECT',
                      properties: {
                        fullName: {
                          type: 'STRING'
                        },
                        email: {
                          type: 'STRING'
                        },
                        phone: {
                          type: 'STRING'
                        },
                        city: {
                          type: 'STRING'
                        }
                      }
                    },

                    headline: {
                      type: 'STRING'
                    },

                    summary: {
                      type: 'STRING',
                      description:
                        'Paragraphe professionnel rédigé, synthétique et factuellement fidèle.'
                    },

                    skills: {
                      type: 'ARRAY',
                      items: {
                        type: 'STRING'
                      }
                    },

                    experiences: {
                      type: 'ARRAY',
                      items: {
                        type: 'OBJECT',
                        properties: {
                          company: {
                            type: 'STRING'
                          },
                          position: {
                            type: 'STRING'
                          },
                          startDate: {
                            type: 'STRING'
                          },
                          endDate: {
                            type: 'STRING'
                          },
                          context: {
                            type: 'STRING',
                            description:
                              'Contexte rédigé de la mission, du produit ou du projet.'
                          },
                          responsibilities: {
                            type: 'ARRAY',
                            items: {
                              type: 'STRING'
                            }
                          },
                          achievements: {
                            type: 'ARRAY',
                            items: {
                              type: 'STRING'
                            }
                          },
                          technologies: {
                            type: 'ARRAY',
                            items: {
                              type: 'STRING'
                            }
                          }
                        }
                      }
                    },

                    education: {
                      type: 'ARRAY',
                      items: {
                        type: 'OBJECT',
                        properties: {
                          school: {
                            type: 'STRING'
                          },
                          degree: {
                            type: 'STRING'
                          },
                          year: {
                            type: 'STRING'
                          },
                          details: {
                            type: 'STRING'
                          }
                        }
                      }
                    },

                    languages: {
                      type: 'ARRAY',
                      items: {
                        type: 'STRING'
                      }
                    },

                    projects: {
                      type: 'ARRAY',
                      items: {
                        type: 'OBJECT',
                        properties: {
                          name: {
                            type: 'STRING'
                          },
                          role: {
                            type: 'STRING'
                          },
                          context: {
                            type: 'STRING'
                          },
                          description: {
                            type: 'STRING'
                          },
                          contributions: {
                            type: 'ARRAY',
                            items: {
                              type: 'STRING'
                            }
                          },
                          achievements: {
                            type: 'ARRAY',
                            items: {
                              type: 'STRING'
                            }
                          },
                          technologies: {
                            type: 'ARRAY',
                            items: {
                              type: 'STRING'
                            }
                          },
                          url: {
                            type: 'STRING'
                          }
                        }
                      }
                    },

                    certifications: {
                      type: 'ARRAY',
                      items: {
                        type: 'OBJECT',
                        properties: {
                          name: {
                            type: 'STRING'
                          },
                          issuer: {
                            type: 'STRING'
                          },
                          year: {
                            type: 'STRING'
                          }
                        }
                      }
                    },

                    additionalSections: {
                      type: 'ARRAY',
                      items: {
                        type: 'OBJECT',
                        properties: {
                          title: {
                            type: 'STRING'
                          },
                          content: {
                            type: 'STRING'
                          }
                        }
                      }
                    }
                  }
                }
              },

              {
                name: 'complete_interview',
                description:
                  'Termine l’entretien uniquement lorsque suffisamment de matière a été collectée et que le candidat confirme ne plus avoir d’élément important à ajouter.',
                parameters: {
                  type: 'OBJECT',
                  properties: {
                    finished: {
                      type: 'BOOLEAN'
                    }
                  }
                }
              }
            ]
          }
        ]
      }
    };

    this.ws.send(
      JSON.stringify(setupPayload)
    );
  }

  /**
   * Le systemInstruction donne le comportement mais ne déclenche pas
   * à lui seul une génération. Après setupComplete, on envoie donc un
   * clientContent interne qui demande à Gemini de prendre la parole.
   */
  private triggerAssistantWelcome(): void {
    if (
      this.welcomeTriggered ||
      !this.ws ||
      this.ws.readyState !== WebSocket.OPEN ||
      !this.isSetupComplete
    ) {
      return;
    }

    this.welcomeTriggered = true;

    this.ws.send(
      JSON.stringify({
        clientContent: {
          turns: [
            {
              role: 'user',
              parts: [
                {
                  text: CV_INTERVIEW_START_TRIGGER
                }
              ]
            }
          ],
          turnComplete: true
        }
      })
    );
  }

  private async startMicrophone(): Promise<void> {
    if (
      this.mediaStream &&
      this.audioCtx
    ) {
      return;
    }

    try {
      this.mediaStream =
        await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            channelCount: 1
          },
          video: false
        });

      this.audioCtx =
        new (
          window.AudioContext ||
          (window as any).webkitAudioContext
        )({
          sampleRate: 16000
        });

      const source =
        this.audioCtx.createMediaStreamSource(
          this.mediaStream
        );

      /**
       * On garde le graphe audio actif sans renvoyer le micro
       * dans les haut-parleurs.
       */
      this.silentGainNode =
        this.audioCtx.createGain();
      this.silentGainNode.gain.value = 0;
      this.silentGainNode.connect(
        this.audioCtx.destination
      );

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

        const blob = new Blob(
          [workletCode],
          {
            type: 'application/javascript'
          }
        );

        this.workletUrl =
          URL.createObjectURL(blob);

        await this.audioCtx.audioWorklet.addModule(
          this.workletUrl
        );

        this.workletNode =
          new AudioWorkletNode(
            this.audioCtx,
            'pcm-processor'
          );

        this.workletNode.port.onmessage = (
          e: MessageEvent<Float32Array>
        ) => {
          this.processAudioChunk(e.data);
        };

        source.connect(
          this.workletNode
        );

        this.workletNode.connect(
          this.silentGainNode
        );
      } else {
        this.scriptNode =
          this.audioCtx.createScriptProcessor(
            2048,
            1,
            1
          );

        this.scriptNode.onaudioprocess = (
          e
        ) => {
          const inputData =
            e.inputBuffer.getChannelData(0);

          this.processAudioChunk(
            inputData
          );
        };

        source.connect(
          this.scriptNode
        );

        this.scriptNode.connect(
          this.silentGainNode
        );
      }
    } catch (err: any) {
      if (
        err?.name === 'NotAllowedError' ||
        err?.name ===
        'PermissionDeniedError'
      ) {
        throw new Error(
          'Accès au microphone refusé. Veuillez autoriser le microphone dans votre navigateur.'
        );
      }

      throw new Error(
        'Impossible d’accéder au microphone.'
      );
    }
  }

  private processAudioChunk(
    inputData: Float32Array
  ): void {
    if (
      !this.ws ||
      this.ws.readyState !== WebSocket.OPEN ||
      !this.isSetupComplete
    ) {
      return;
    }

    const pcm16 =
      new Int16Array(
        inputData.length
      );

    for (
      let i = 0;
      i < inputData.length;
      i++
    ) {
      const sample = Math.max(
        -1,
        Math.min(
          1,
          inputData[i]
        )
      );

      pcm16[i] =
        sample < 0
          ? sample * 0x8000
          : sample * 0x7fff;
    }

    const base64Audio =
      this.arrayBufferToBase64(
        pcm16.buffer
      );

    this.ws.send(
      JSON.stringify({
        realtimeInput: {
          audio: {
            data: base64Audio,
            mimeType:
              'audio/pcm;rate=16000'
          }
        }
      })
    );
  }

  private async handleServerMessage(
    data: any
  ): Promise<void> {
    try {
      let rawText = data;

      if (data instanceof Blob) {
        rawText =
          await data.text();
      }

      const msg =
        JSON.parse(rawText);

      if (msg.setupComplete) {
        this.isSetupComplete = true;

        this.ensurePlaybackContext();

        if (this.microphoneReadyPromise) {
          await this.microphoneReadyPromise;
        } else {
          await this.startMicrophone();
        }

        this.state.set('LISTENING');

        // Gemini prend réellement la parole ici.
        this.triggerAssistantWelcome();
      }

      if (msg.serverContent) {
        const serverContent =
          msg.serverContent;

        if (
          serverContent.interrupted
        ) {
          this.stopPlayback();
          this.modelTurnComplete =
            false;
          this.state.set('LISTENING');
          this.finalizeCurrentTurn();

          // L'utilisateur vient d'interrompre Gemini :
          // il est actif, donc on ne doit pas fermer la session.
          this.clearInactivityTimer();
        }

        if (
          serverContent
            .inputTranscription
            ?.text
        ) {
          this.markUserActivity();

          this.appendTranscriptChunk(
            'user',
            serverContent
              .inputTranscription.text
          );
        }

        if (
          serverContent
            .outputTranscription
            ?.text
        ) {
          this.appendTranscriptChunk(
            'ai',
            serverContent
              .outputTranscription.text
          );
        }

        const parts =
          serverContent
            .modelTurn?.parts ||
          [];

        for (
          const part of parts
        ) {
          if (
            part.inlineData?.data
          ) {
            this.clearInactivityTimer();

            this.modelTurnComplete =
              false;

            this.state.set(
              'AI_SPEAKING'
            );

            this.enqueuePcmAudio24k(
              part.inlineData.data
            );
          }
        }

        if (
          serverContent.turnComplete
        ) {
          this.modelTurnComplete =
            true;
          this.finalizeCurrentTurn();
          this.tryEnterListeningState();
        }
      }

      if (msg.toolCall) {
        const calls =
          msg.toolCall
            .functionCalls || [];

        for (
          const call of calls
        ) {
          if (
            call.name ===
            'update_cv_draft'
          ) {
            await this.handleUpdateCvDraft(
              call.args
            );

            this.respondToolCall(
              call.id,
              {
                success: true
              }
            );
          } else if (
            call.name ===
            'complete_interview'
          ) {
            /**
             * On répond au tool call avant de fermer la socket.
             */
            await this.saveAndCompleteInterview();

            this.respondToolCall(
              call.id,
              {
                finished: true
              }
            );

            this.state.set(
              'COMPLETED'
            );

            setTimeout(() => {
              this.stopSession();
              this.interviewCompleted$.next();
            }, 100);
          }
        }
      }
    } catch (e) {
      console.error(
        'Erreur traitement message Gemini:',
        e
      );
    }
  }

  private respondToolCall(
    callId: string,
    result: any
  ): void {
    if (
      !this.ws ||
      this.ws.readyState !==
      WebSocket.OPEN
    ) {
      return;
    }

    // Contrat déjà utilisé par le code actuel : conservé.
    this.ws.send(
      JSON.stringify({
        toolResponse: {
          functionResponses: [
            {
              response: {
                output: result
              },
              id: callId
            }
          ]
        }
      })
    );
  }

  public async handleUpdateCvDraft(
    newInfo: any
  ): Promise<void> {
    if (!newInfo) {
      return;
    }

    const current =
      this.currentDraft();

    const updated = {
      ...current,
      ...newInfo,

      identity: {
        ...current.identity,
        ...(newInfo.identity || {})
      },

      skills:
        newInfo.skills
          ? this.mergeUniqueStrings(
            current.skills || [],
            newInfo.skills
          )
          : current.skills,

      languages:
        newInfo.languages
          ? this.mergeUniqueStrings(
            current.languages || [],
            newInfo.languages
          )
          : current.languages,

      experiences:
        newInfo.experiences
          ? this.mergeExperiences(
            current.experiences || [],
            newInfo.experiences
          )
          : current.experiences,

      education:
        newInfo.education
          ? this.mergeEducation(
            current.education || [],
            newInfo.education
          )
          : current.education,

      projects:
        newInfo.projects
          ? this.mergeProjects(
            current.projects || [],
            newInfo.projects
          )
          : current.projects,

      certifications:
        newInfo.certifications
          ? this.mergeCertifications(
            current.certifications || [],
            newInfo.certifications
          )
          : current.certifications,

      additionalSections:
        newInfo.additionalSections
          ? this.mergeAdditionalSections(
            current.additionalSections || [],
            newInfo.additionalSections
          )
          : current.additionalSections
    };

    this.currentDraft.set(
      updated
    );

    await firstValueFrom(
      this.apiService.saveDraft(
        this.currentCvId,
        updated
      )
    ).catch(() => null);
  }

  public async handleCompleteInterview(): Promise<void> {
    await this.saveAndCompleteInterview();

    this.state.set('COMPLETED');
    this.stopSession();
    this.interviewCompleted$.next();
  }

  private isDraftEmptyOrIncomplete(draft: any): boolean {
    const userMessages = this.transcript().filter(t => t.role === 'user');
    // S'il y a eu moins de 2 messages utilisateur, l'entretien n'a pas vraiment eu lieu
    if (userMessages.length < 2) return false;

    const hasNoExperience = !draft?.experiences || draft.experiences.length === 0;
    const hasNoEducation = !draft?.education || draft.education.length === 0;
    const hasNoSummary = !draft?.summary || draft.summary.trim().length < 20;
    const hasNoSkills = !draft?.skills || draft.skills.length === 0;

    // Déclenché si (aucune expérience ET aucune formation) OU (aucun résumé ET aucune compétence)
    return (hasNoExperience && hasNoEducation) || (hasNoSummary && hasNoSkills);
  }

  private async saveAndCompleteInterview(): Promise<void> {
    const current = this.currentDraft();

    if (this.isDraftEmptyOrIncomplete(current)) {
      const fullTranscript = this.transcript()
        .map(t => `${t.role === 'user' ? 'Candidat' : 'Recruteur IA'}: ${t.text}`)
        .join('\n');

      if (fullTranscript.trim().length > 30) {
        try {
          const synthesized = await firstValueFrom(
            this.apiService.synthesize(this.currentCvId, fullTranscript)
          );
          if (synthesized?.contentJson) {
            const parsed = typeof synthesized.contentJson === 'string'
              ? JSON.parse(synthesized.contentJson)
              : synthesized.contentJson;
            this.currentDraft.set(parsed);
          }
        } catch (e) {
          console.warn('Synthèse IA de secours échouée, conservation du draft courant:', e);
        }
      }
    } else {
      await firstValueFrom(
        this.apiService.saveDraft(
          this.currentCvId,
          this.currentDraft()
        )
      ).catch(() => null);
    }

    await firstValueFrom(
      this.apiService.completeInterview(
        this.currentCvId
      )
    ).catch(() => null);
  }

  // ---------------------------------------------------------------------
  // Lecture audio en flux continu
  // ---------------------------------------------------------------------

  private ensurePlaybackContext(): void {
    if (
      !this.playbackCtx ||
      this.playbackCtx.state ===
      'closed'
    ) {
      this.playbackCtx =
        new (
          window.AudioContext ||
          (window as any)
            .webkitAudioContext
        )({
          sampleRate: 24000
        });

      this.nextPlayTime =
        this.playbackCtx.currentTime;
    }
  }

  private enqueuePcmAudio24k(
    base64Data: string
  ): void {
    try {
      this.ensurePlaybackContext();

      const ctx =
        this.playbackCtx!;

      const binary =
        atob(base64Data);

      const len =
        binary.length;

      const bytes =
        new Uint8Array(len);

      for (
        let i = 0;
        i < len;
        i++
      ) {
        bytes[i] =
          binary.charCodeAt(i);
      }

      const pcm16 =
        new Int16Array(
          bytes.buffer
        );

      const float32 =
        new Float32Array(
          pcm16.length
        );

      for (
        let i = 0;
        i < pcm16.length;
        i++
      ) {
        float32[i] =
          pcm16[i] /
          32768.0;
      }

      const buffer =
        ctx.createBuffer(
          1,
          float32.length,
          24000
        );

      buffer
        .getChannelData(0)
        .set(float32);

      const source =
        ctx.createBufferSource();

      source.buffer =
        buffer;

      source.connect(
        ctx.destination
      );

      const startAt =
        Math.max(
          this.nextPlayTime,
          ctx.currentTime
        );

      source.start(startAt);

      this.nextPlayTime =
        startAt +
        buffer.duration;

      this.pendingSourceCount++;
      this.activeSources.push(
        source
      );

      source.onended = () => {
        this.activeSources =
          this.activeSources.filter(
            (item) =>
              item !== source
          );

        this.pendingSourceCount =
          Math.max(
            0,
            this.pendingSourceCount -
            1
          );

        this.tryEnterListeningState();
      };
    } catch (e) {
      console.error(
        'Erreur lecture audio PCM 24k:',
        e
      );
    }
  }

  private tryEnterListeningState(): void {
    if (
      !this.modelTurnComplete ||
      this.pendingSourceCount > 0 ||
      this.state() ===
      'COMPLETED' ||
      this.state() === 'ERROR'
    ) {
      return;
    }

    this.modelTurnComplete =
      false;

    this.state.set(
      'LISTENING'
    );

    this.armInactivityTimer();
  }

  private stopPlayback(): void {
    for (
      const src of
      this.activeSources
    ) {
      try {
        src.onended = null;
        src.stop();
      } catch {
        // déjà arrêté
      }
    }

    this.activeSources = [];
    this.pendingSourceCount = 0;

    if (this.playbackCtx) {
      this.nextPlayTime =
        this.playbackCtx.currentTime;
    }
  }

  // ---------------------------------------------------------------------
  // Inactivité
  // ---------------------------------------------------------------------

  private markUserActivity(): void {
    this.clearInactivityTimer();
  }

  private armInactivityTimer(): void {
    this.clearInactivityTimer();

    if (
      this.state() !==
      'LISTENING'
    ) {
      return;
    }

    this.inactivityTimer =
      setTimeout(() => {
        if (
          this.state() !==
          'LISTENING'
        ) {
          return;
        }

        this.stopSession();

        this.setError(
          'Entretien interrompu après 90 secondes sans réponse. Vous pouvez le relancer pour continuer.'
        );
      }, this.inactivityTimeoutMs);
  }

  private clearInactivityTimer(): void {
    if (
      this.inactivityTimer
    ) {
      clearTimeout(
        this.inactivityTimer
      );

      this.inactivityTimer =
        null;
    }
  }

  // ---------------------------------------------------------------------
  // Merge du draft : évite de dupliquer une expérience à chaque enrichissement
  // ---------------------------------------------------------------------

  private normalizeKey(
    value: unknown
  ): string {
    return String(
      value || ''
    )
      .normalize('NFD')
      .replace(
        /[\u0300-\u036f]/g,
        ''
      )
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();
  }

  private mergeUniqueStrings(
    current: string[],
    incoming: string[]
  ): string[] {
    const map =
      new Map<
        string,
        string
      >();

    for (
      const value of [
        ...current,
        ...incoming
      ]
    ) {
      const clean =
        String(
          value || ''
        ).trim();

      const key =
        this.normalizeKey(
          clean
        );

      if (
        clean &&
        !map.has(key)
      ) {
        map.set(
          key,
          clean
        );
      }
    }

    return Array.from(
      map.values()
    );
  }

  private mergeExperiences(
    current: any[],
    incoming: any[]
  ): any[] {
    const result =
      current.map(
        (item) => ({
          ...item
        })
      );

    for (
      const experience of incoming
    ) {
      const key =
        this.experienceKey(
          experience
        );

      const index =
        result.findIndex(
          (item) =>
            this.experienceKey(
              item
            ) === key
        );

      if (
        index === -1 ||
        !key
      ) {
        result.push({
          ...experience
        });
        continue;
      }

      const existing =
        result[index];

      result[index] = {
        ...existing,
        ...experience,

        responsibilities:
          this.mergeUniqueStrings(
            existing.responsibilities ||
            [],
            experience.responsibilities ||
            []
          ),

        achievements:
          this.mergeUniqueStrings(
            existing.achievements ||
            [],
            experience.achievements ||
            []
          ),

        technologies:
          this.mergeUniqueStrings(
            existing.technologies ||
            [],
            experience.technologies ||
            []
          )
      };
    }

    return result;
  }

  private experienceKey(
    item: any
  ): string {
    return [
      item?.company,
      item?.position,
      item?.startDate
    ]
      .map((value) =>
        this.normalizeKey(
          value
        )
      )
      .filter(Boolean)
      .join('|');
  }

  private mergeEducation(
    current: any[],
    incoming: any[]
  ): any[] {
    return this.mergeObjectsByKey(
      current,
      incoming,
      (item) =>
        [
          item?.school,
          item?.degree,
          item?.year
        ]
          .map((value) =>
            this.normalizeKey(
              value
            )
          )
          .filter(Boolean)
          .join('|')
    );
  }

  private mergeProjects(
    current: any[],
    incoming: any[]
  ): any[] {
    return this.mergeObjectsByKey(
      current,
      incoming,
      (item) =>
        this.normalizeKey(
          item?.name
        )
    );
  }

  private mergeCertifications(
    current: any[],
    incoming: any[]
  ): any[] {
    return this.mergeObjectsByKey(
      current,
      incoming,
      (item) =>
        [
          item?.name,
          item?.issuer
        ]
          .map((value) =>
            this.normalizeKey(
              value
            )
          )
          .filter(Boolean)
          .join('|')
    );
  }

  private mergeAdditionalSections(
    current: any[],
    incoming: any[]
  ): any[] {
    return this.mergeObjectsByKey(
      current,
      incoming,
      (item) =>
        this.normalizeKey(
          item?.title
        )
    );
  }

  private mergeObjectsByKey(
    current: any[],
    incoming: any[],
    keyFn: (
      item: any
    ) => string
  ): any[] {
    const result =
      current.map(
        (item) => ({
          ...item
        })
      );

    for (
      const item of incoming
    ) {
      const key =
        keyFn(item);

      const index =
        result.findIndex(
          (existing) =>
            key &&
            keyFn(existing) ===
            key
        );

      if (
        index === -1 ||
        !key
      ) {
        result.push({
          ...item
        });
      } else {
        result[index] = {
          ...result[index],
          ...item
        };
      }
    }

    return result;
  }

  private appendTranscriptChunk(
    role: 'user' | 'ai',
    chunkText: string
  ): void {
    const text = String(chunkText || '');
    if (!text) {
      return;
    }

    this.transcript.update((entries) => {
      const lastEntry = entries[entries.length - 1];

      // Si le dernier message appartient au même locuteur et n'est pas encore finalisé, on concatène
      if (lastEntry && lastEntry.role === role && lastEntry.id === this.activeTurnId) {
        const updatedEntries = [...entries];
        updatedEntries[updatedEntries.length - 1] = {
          ...lastEntry,
          text: lastEntry.text + text
        };
        return updatedEntries;
      }

      // Nouveau tour de parole
      const newId = `${Date.now()}-${Math.random()}`;
      this.activeTurnRole = role;
      this.activeTurnId = newId;

      return [
        ...entries,
        {
          id: newId,
          role,
          text: text.trimStart(),
          isFinal: false
        }
      ];
    });
  }

  private finalizeCurrentTurn(): void {
    this.activeTurnId = null;
    this.activeTurnRole = null;
    this.transcript.update((entries) =>
      entries.map((e) => ({
        ...e,
        text: e.text.trim(),
        isFinal: true
      }))
    );
  }

  // ---------------------------------------------------------------------
  // Cleanup / reset
  // ---------------------------------------------------------------------

  stopSession(): void {
    this.isSetupComplete =
      false;

    this.clearInactivityTimer();
    this.stopPlayback();

    if (
      this.playbackCtx
    ) {
      this.playbackCtx
        .close()
        .catch(() => null);

      this.playbackCtx =
        null;
    }

    if (
      this.workletNode
    ) {
      this.workletNode
        .disconnect();

      this.workletNode =
        null;
    }

    if (
      this.workletUrl
    ) {
      URL.revokeObjectURL(
        this.workletUrl
      );

      this.workletUrl =
        null;
    }

    if (
      this.scriptNode
    ) {
      this.scriptNode
        .disconnect();

      this.scriptNode =
        null;
    }

    if (
      this.silentGainNode
    ) {
      this.silentGainNode
        .disconnect();

      this.silentGainNode =
        null;
    }

    if (this.audioCtx) {
      this.audioCtx
        .close()
        .catch(() => null);

      this.audioCtx =
        null;
    }

    if (
      this.mediaStream
    ) {
      this.mediaStream
        .getTracks()
        .forEach((track) =>
          track.stop()
        );

      this.mediaStream =
        null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.microphoneReadyPromise =
      null;

    this.welcomeTriggered =
      false;

    this.modelTurnComplete =
      false;

    if (
      this.state() !==
      'COMPLETED'
    ) {
      this.state.set(
        'READY'
      );
    }

    // currentDraft est volontairement conservé après stopSession.
  }

  resetDraft(): void {
    this.currentDraft.set(
      this.createEmptyDraft()
    );

    this.transcript.set([]);
  }

  private createEmptyDraft(): any {
    const u = this.authService.currentUser();
    return {
      identity: {
        fullName: u?.fullName || '',
        email: u?.email || '',
        phone: u?.phone || '',
        city: u?.city || ''
      },
      headline: u?.targetRole || '',
      summary: '',
      experiences: [],
      education: [],
      skills: [],
      languages: [],
      projects: [],
      certifications: [],
      additionalSections: []
    };
  }

  private arrayBufferToBase64(
    buffer: ArrayBuffer
  ): string {
    let binary = '';

    const bytes =
      new Uint8Array(
        buffer
      );

    for (
      let i = 0;
      i < bytes.byteLength;
      i++
    ) {
      binary +=
        String.fromCharCode(
          bytes[i]
        );
    }

    return window.btoa(
      binary
    );
  }
}