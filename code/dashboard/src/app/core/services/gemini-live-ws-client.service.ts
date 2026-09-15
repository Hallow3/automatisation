import { Injectable } from '@angular/core';
import { CV_INTERVIEW_SYSTEM_PROMPT } from './cv-interview-system.prompt';

export interface WsCallbacks {
  onSetupComplete: () => void;
  onAudioChunkReceived: (base64Pcm: string) => void;
  onTextChunkReceived: (role: 'user' | 'ai', text: string) => void;
  onModelTurnComplete: () => void;
  onInterrupted: () => void;
  onToolCall: (name: string, callId: string, args: any) => Promise<any>;
  onError: (errorMessage: string) => void;
  onClose: (code: number, reason: string) => void;
  onSessionResumptionUpdate?: (handle: string) => void;
  onGoAway?: (timeLeft?: string) => void;
}

@Injectable({
  providedIn: 'root'
})
export class GeminiLiveWsClientService {
  private ws: WebSocket | null = null;
  private callbacks: WsCallbacks | null = null;
  private isSetupComplete = false;
  private candidateName = '';
  private currentResumptionHandle: string | null = null;

  setResumptionHandle(handle: string | null): void {
    this.currentResumptionHandle = handle;
  }

  getResumptionHandle(): string | null {
    return this.currentResumptionHandle;
  }

  connect(token: string, model: string, callbacks: WsCallbacks, candidateName?: string): void {
    this.disconnect();
    this.callbacks = callbacks;
    this.isSetupComplete = false;
    this.candidateName = (candidateName || '').trim();

    const isEphemeralToken = token.startsWith('auth_tokens/');
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

    this.ws.onerror = (err) => {
      console.error('[GeminiWsClient] Erreur WebSocket:', err);
      this.callbacks?.onError('Connexion WebSocket interrompue. Vérifiez votre accès internet.');
    };

    this.ws.onclose = (event) => {
      console.warn('[GeminiWsClient] WebSocket fermé:', event.code, event.reason);
      this.callbacks?.onClose(event.code, event.reason);
    };
  }

  sendAudioChunk(base64Pcm: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN || !this.isSetupComplete) {
      return;
    }

    if (this.ws.bufferedAmount > 1024 * 1024) {
      console.warn('[GeminiWsClient] Débit réseau saturé, frame audio ignorée');
      return;
    }

    const payload = {
      realtimeInput: {
        audio: {
          mimeType: 'audio/pcm;rate=16000',
          data: base64Pcm
        }
      }
    };

    this.ws.send(JSON.stringify(payload));
  }

  sendClientContent(textPrompt: string, endOfTurn: boolean = true): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    const payload = {
      clientContent: {
        turns: [
          {
            role: 'user',
            parts: [{ text: textPrompt }]
          }
        ],
        turnComplete: endOfTurn
      }
    };

    this.ws.send(JSON.stringify(payload));
  }

  sendToolResponse(name: string, callId: string, output: any): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    const payload = {
      toolResponse: {
        functionResponses: [
          {
            response: { output },
            id: callId
          }
        ]
      }
    };

    this.ws.send(JSON.stringify(payload));
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.onopen = null;
      this.ws.onmessage = null;
      this.ws.onerror = null;
      this.ws.onclose = null;
      if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) {
        this.ws.close(1000, 'Normal closure');
      }
      this.ws = null;
    }
    this.isSetupComplete = false;
    this.callbacks = null;
    this.candidateName = '';
  }

  private sendInitialSetup(model: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    const fullModelName = model.startsWith('models/') ? model : `models/${model}`;

    let systemPromptText = CV_INTERVIEW_SYSTEM_PROMPT;
    if (this.candidateName) {
      systemPromptText += `\n\n<candidate_identity>\nLe candidat que tu reçois en entretien s'appelle : ${this.candidateName}.\nSalue-le dès ta première prise de parole par : « Bonjour ${this.candidateName} ! ».\nAdresse-toi régulièrement à lui par son prénom « ${this.candidateName} » avec chaleur et respect tout au long de l'échange.\n</candidate_identity>`;
    }

    const setupPayload: any = {
      setup: {
        model: fullModelName,
        generationConfig: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: 'Charon'
              }
            }
          }
        },
        inputAudioTranscription: {},
        outputAudioTranscription: {},
        // ── Point 2: Compression de fenêtre de contexte pour prolonger les sessions vocales ──
        contextWindowCompression: {
          slidingWindow: {}
        },
        realtimeInputConfig: {
          automaticActivityDetection: {
            disabled: false,
            prefixPaddingMs: 40,
            silenceDurationMs: 650
          },
          activityHandling: 'START_OF_ACTIVITY_INTERRUPTS'
        },
        systemInstruction: {
          parts: [{ text: systemPromptText }]
        },
        tools: [
          {
            functionDeclarations: [
              {
                name: 'update_cv_draft',
                description: 'Met à jour le brouillon structuré du CV avec les informations validées lors de l\'échange vocal.',
                parameters: {
                  type: 'OBJECT',
                  properties: {
                    headline: { type: 'STRING' },
                    summary: { type: 'STRING' },
                    skills: { type: 'ARRAY', items: { type: 'STRING' } },
                    experiences: {
                      type: 'ARRAY',
                      items: {
                        type: 'OBJECT',
                        properties: {
                          company: { type: 'STRING' },
                          position: { type: 'STRING' },
                          startDate: { type: 'STRING' },
                          endDate: { type: 'STRING' },
                          context: { type: 'STRING' },
                          responsibilities: { type: 'ARRAY', items: { type: 'STRING' } },
                          achievements: { type: 'ARRAY', items: { type: 'STRING' } },
                          technologies: { type: 'ARRAY', items: { type: 'STRING' } }
                        },
                        required: ['company', 'position']
                      }
                    },
                    education: {
                      type: 'ARRAY',
                      items: {
                        type: 'OBJECT',
                        properties: {
                          school: { type: 'STRING' },
                          degree: { type: 'STRING' },
                          startDate: { type: 'STRING' },
                          endDate: { type: 'STRING' }
                        },
                        required: ['school', 'degree']
                      }
                    },
                    languages: {
                      type: 'ARRAY',
                      items: {
                        type: 'OBJECT',
                        properties: {
                          language: { type: 'STRING' },
                          level: { type: 'STRING' }
                        },
                        required: ['language']
                      }
                    }
                  }
                }
              },
              {
                name: 'audit_cv_integrity',
                description: 'Analyse l\'ensemble du CV actuel pour détecter les incohérences chronologiques (expériences qui se chevauchent, dates inversées), les doublons, les sections incomplètes et la densité de contenu (densityScore, thinSections). Retourne les anomalies, les sections trop succinctes et des suggestions de relances concrètes.',
                parameters: {
                  type: 'OBJECT',
                  properties: {
                    focus: {
                      type: 'STRING',
                      description: 'Focus optionnel de l\'audit : "all" (défaut), "dates", "duplicates", "completeness", "density"'
                    }
                  }
                }
              },
              {
                name: 'complete_interview',
                description: 'Indique que le candidat a validé la fin de l\'entretien vocal.',
                parameters: {
                  type: 'OBJECT',
                  properties: {
                    summary: { type: 'STRING' }
                  }
                }
              }
            ]
          }
        ]
      }
    };

    // ── Point 1: Handle de reprise de session Gemini Live ──
    if (this.currentResumptionHandle) {
      setupPayload.setup.sessionResumption = {
        handle: this.currentResumptionHandle
      };
      console.log('[GeminiWsClient] Envoi setup avec sessionResumption handle:', this.currentResumptionHandle);
    }

    this.ws.send(JSON.stringify(setupPayload));
  }

  private async handleServerMessage(data: any): Promise<void> {
    try {
      let rawText = '';
      if (typeof data === 'string') {
        rawText = data;
      } else if (data instanceof Blob) {
        rawText = await data.text();
      } else if (data instanceof ArrayBuffer) {
        rawText = new TextDecoder().decode(data);
      }

      if (!rawText) return;
      const message = JSON.parse(rawText);

      // ── Point 1: Écoute du signal go_away / goAway ──
      const goAway = message.goAway || message.go_away;
      if (goAway) {
        const timeLeft = goAway.timeLeft || goAway.time_left;
        console.warn('[GeminiWsClient] Signal go_away reçu du serveur Gemini (temps restant:', timeLeft, ').');
        this.callbacks?.onGoAway?.(timeLeft);
      }

      // ── Point 1: Maintien du jeton de reprise SessionResumptionUpdate ──
      const resumptionUpdate = message.sessionResumptionUpdate || message.SessionResumptionUpdate || message.serverContent?.sessionResumptionUpdate;
      if (resumptionUpdate) {
        const handle = resumptionUpdate.newHandle || resumptionUpdate.new_handle || resumptionUpdate.handle;
        if (handle) {
          console.log('[GeminiWsClient] Jeton SessionResumptionUpdate reçu:', handle);
          this.currentResumptionHandle = handle;
          this.callbacks?.onSessionResumptionUpdate?.(handle);
        }
      }

      if (message.setupComplete) {
        this.isSetupComplete = true;
        this.callbacks?.onSetupComplete();
        return;
      }

      const serverContent = message.serverContent;
      if (serverContent) {
        if (serverContent.interrupted) {
          this.callbacks?.onInterrupted();
        }

        // Live Audio Transcription natively returned by Gemini Live
        if (serverContent.inputTranscription?.text) {
          this.callbacks?.onTextChunkReceived('user', serverContent.inputTranscription.text);
        }
        if (serverContent.outputTranscription?.text) {
          this.callbacks?.onTextChunkReceived('ai', serverContent.outputTranscription.text);
        }

        const modelTurn = serverContent.modelTurn;
        if (modelTurn?.parts) {
          for (const part of modelTurn.parts) {
            if (part.text) {
              this.callbacks?.onTextChunkReceived('ai', part.text);
            }
            if (part.inlineData?.data) {
              this.callbacks?.onAudioChunkReceived(part.inlineData.data);
            }
          }
        }

        if (serverContent.turnComplete) {
          this.callbacks?.onModelTurnComplete();
        }
      }

      const toolCall = message.toolCall;
      if (toolCall?.functionCalls) {
        for (const call of toolCall.functionCalls) {
          if (this.callbacks?.onToolCall) {
            const result = await this.callbacks.onToolCall(call.name, call.id, call.args);
            this.sendToolResponse(call.name, call.id, result);
          }
        }
      }
    } catch (err) {
      console.error('[GeminiWsClient] Erreur décodage message:', err);
    }
  }
}
