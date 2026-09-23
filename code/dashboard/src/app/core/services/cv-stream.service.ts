import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ReplaySubject } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface CvPatchEvent {
  sessionId: string;
  patch: Record<string, any>;
}

@Injectable({ providedIn: 'root' })
export class CvStreamService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/cvs`;

  private eventSource: EventSource | null = null;
  private patchSubject = new ReplaySubject<CvPatchEvent>(1);

  get cvPatch$() {
    return this.patchSubject.asObservable();
  }

  connect(cvId: string, sessionId: string): void {
    this.disconnect();
    // Nouveau subject à chaque session pour éviter les événements résiduels
    this.patchSubject = new ReplaySubject<CvPatchEvent>(1);

    const url = `${this.base}/${cvId}/interview/stream?sessionId=${encodeURIComponent(sessionId)}`;
    this.eventSource = new EventSource(url, { withCredentials: true });

    this.eventSource.addEventListener('cv_patch', (event: MessageEvent) => {
      try {
        const data: CvPatchEvent = JSON.parse(event.data);
        if (data?.patch && Object.keys(data.patch).length > 0) {
          this.patchSubject.next(data);
        }
      } catch (e) {
        console.warn('[CvStream] Erreur parsing patch SSE:', e);
      }
    });

    this.eventSource.onerror = () => {
      // Reconnexion automatique native de EventSource
    };
  }

  disconnect(): void {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
  }

  /**
   * Pousse un segment de transcription + l'état courant du CV vers le backend.
   * Appelé dès la fin de parole du candidat (avant onModelTurnComplete).
   * cvDataSoFar permet au backend d'avoir l'état le plus récent sans lire la DB.
   */
  pushTranscriptSegment(cvId: string, sessionId: string, segment: string, cvDataSoFar: any): void {
    this.http.post(`${this.base}/${cvId}/interview/push-transcript`, { sessionId, segment, cvDataSoFar })
      .subscribe({ error: e => console.warn('[CvStream] Erreur push segment:', e) });
  }
}
