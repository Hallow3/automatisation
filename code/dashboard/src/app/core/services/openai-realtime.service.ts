import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom, Subject } from 'rxjs';
import { environment } from '../../../environments/environment';

export type VoiceState = 'disconnected' | 'connecting' | 'listening' | 'user_speaking' | 'ai_thinking' | 'ai_speaking' | 'error';

export interface TranscriptMessage {
  id: string;
  role: 'user' | 'ai';
  text: string;
  isFinal: boolean;
}

export interface FunctionCallEvent {
  name: string;
  args: any;
}

@Injectable({
  providedIn: 'root'
})
export class OpenaiRealtimeService {
  private peerConnection: RTCPeerConnection | null = null;
  private dataChannel: RTCDataChannel | null = null;
  private localStream: MediaStream | null = null;
  private audioElement: HTMLAudioElement;

  public state = signal<VoiceState>('disconnected');
  public transcript = signal<TranscriptMessage[]>([]);
  public onFunctionCall = new Subject<FunctionCallEvent>();

  constructor(private http: HttpClient) {
    this.audioElement = document.createElement('audio');
    this.audioElement.autoplay = true;
  }

  async startSession() {
    try {
      this.state.set('connecting');
      this.transcript.set([]);

      // 1. Get Ephemeral Session Token from Spring Boot Backend
      const sessionResponse = await firstValueFrom(
        this.http.post<{ client_secret: { value: string } }>(`${environment.apiUrl}/voice/session`, {})
      ).catch(() => ({ client_secret: { value: 'mock_ephemeral_token' } }));

      const ephemeralKey = sessionResponse?.client_secret?.value || 'mock_ephemeral_token';

      // 2. Create RTCPeerConnection
      this.peerConnection = new RTCPeerConnection();

      // 3. Play remote audio
      this.peerConnection.ontrack = e => {
        this.audioElement.srcObject = e.streams[0];
      };

      // 4. Add local microphone track if mediaDevices supported
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        this.localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        this.localStream.getTracks().forEach(track => {
          if (this.peerConnection) {
            this.peerConnection.addTrack(track, this.localStream!);
          }
        });
      }

      // 5. Setup Data Channel for WebRTC events
      this.dataChannel = this.peerConnection.createDataChannel('oai-events');
      this.setupDataChannel(this.dataChannel);

      // Emulate successful connection
      this.state.set('listening');

      // Initial AI greeting
      setTimeout(() => {
        this.addTranscriptMessage('ai', "Bonjour ! Je suis votre Agent CV. L'objectif est de construire ensemble votre CV. Parlez-moi un peu de vous.", true);
      }, 800);

    } catch (err) {
      console.error('Failed to start voice session', err);
      this.state.set('error');
    }
  }

  private setupDataChannel(channel: RTCDataChannel) {
    channel.onmessage = (e) => {
      try {
        const event = JSON.parse(e.data);

        if (event.type === 'response.audio_transcript.delta') {
          this.updateTranscript('ai', event.delta, false);
          this.state.set('ai_speaking');
        }

        if (event.type === 'response.audio_transcript.done') {
          this.updateTranscript('ai', event.transcript, true);
          this.state.set('listening');
        }

        if (event.type === 'conversation.item.input_audio_transcription.completed') {
          this.updateTranscript('user', event.transcript, true);
          this.state.set('ai_thinking');
        }

        if (event.type === 'response.function_call_arguments.done') {
          const args = JSON.parse(event.arguments);
          this.onFunctionCall.next({ name: event.name, args });
        }
      } catch (err) {
        console.error('Failed to handle data channel message', err);
      }
    };
  }

  private updateTranscript(role: 'user' | 'ai', text: string, isFinal: boolean) {
    this.transcript.update(msgs => {
      const last = msgs[msgs.length - 1];
      if (last && last.role === role && !last.isFinal) {
        last.text += text;
        last.isFinal = isFinal;
        return [...msgs];
      } else {
        return [...msgs, { id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()), role, text, isFinal }];
      }
    });
  }

  private addTranscriptMessage(role: 'user' | 'ai', text: string, isFinal: boolean) {
    this.transcript.update(msgs => [...msgs, { id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()), role, text, isFinal }]);
  }

  stopSession() {
    if (this.dataChannel) {
      this.dataChannel.close();
      this.dataChannel = null;
    }
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }
    if (this.localStream) {
      this.localStream.getTracks().forEach(t => t.stop());
      this.localStream = null;
    }
    this.state.set('disconnected');
  }

  simulateUserSpeaking(text: string) {
    this.state.set('user_speaking');
    this.addTranscriptMessage('user', text, true);

    setTimeout(() => {
      this.state.set('ai_thinking');
      setTimeout(() => {
        this.state.set('ai_speaking');
        this.addTranscriptMessage('ai', "C'est noté, j'ajoute cette expérience à votre profil.", true);

        this.onFunctionCall.next({
          name: 'update_cv_draft',
          args: {
            section: 'experience',
            operation: 'upsert',
            data: {
              company: 'TechCorp',
              position: 'Développeur Frontend',
              description: text
            }
          }
        });

        setTimeout(() => this.state.set('listening'), 1000);
      }, 1200);
    }, 800);
  }
}
