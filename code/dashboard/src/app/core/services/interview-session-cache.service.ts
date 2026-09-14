import { Injectable } from '@angular/core';

export interface CachedInterviewSession {
  cvId: string;
  draft: any;
  transcript: Array<{
    id: string;
    role: 'user' | 'assistant' | 'system';
    text: string;
    timestamp: number;
  }>;
  lastUpdated: number;
}

@Injectable({
  providedIn: 'root'
})
export class InterviewSessionCacheService {
  private readonly STORAGE_PREFIX = 'getjob_interview_session_';
  private readonly EXPIRATION_MS = 10 * 60 * 1000; // 10 minutes

  constructor() {
    this.cleanExpiredSessions();
  }

  /**
   * Sauvegarde l'état courant de l'entretien dans le localStorage avec horodatage.
   */
  saveSession(cvId: string, draft: any, transcript: any[]): void {
    if (!cvId || cvId === 'cv_default' || cvId === 'new') {
      return;
    }

    try {
      const sessionData: CachedInterviewSession = {
        cvId,
        draft,
        transcript: (transcript || []).map(t => ({
          id: t.id || Math.random().toString(36).substring(2, 9),
          role: t.role,
          text: t.text,
          timestamp: t.timestamp || Date.now()
        })),
        lastUpdated: Date.now()
      };

      localStorage.setItem(this.getStorageKey(cvId), JSON.stringify(sessionData));
    } catch (err) {
      console.warn('[InterviewSessionCache] Impossible de sauvegarder la session:', err);
    }
  }

  /**
   * Restaure une session si elle existe et date de moins de 10 minutes.
   */
  getSession(cvId: string): CachedInterviewSession | null {
    if (!cvId) return null;

    try {
      const raw = localStorage.getItem(this.getStorageKey(cvId));
      if (!raw) return null;

      const session: CachedInterviewSession = JSON.parse(raw);
      const isExpired = Date.now() - session.lastUpdated > this.EXPIRATION_MS;

      if (isExpired) {
        this.clearSession(cvId);
        return null;
      }

      return session;
    } catch (err) {
      console.warn('[InterviewSessionCache] Erreur lecture session:', err);
      return null;
    }
  }

  /**
   * Supprime manuellement la session d'un CV (ex: fin d'entretien).
   */
  clearSession(cvId: string): void {
    if (!cvId) return;
    try {
      localStorage.removeItem(this.getStorageKey(cvId));
    } catch (err) {
      console.warn('[InterviewSessionCache] Erreur suppression session:', err);
    }
  }

  /**
   * Nettoie automatiquement toutes les sessions de plus de 10 minutes.
   */
  cleanExpiredSessions(): void {
    try {
      const now = Date.now();
      const keysToRemove: string[] = [];

      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(this.STORAGE_PREFIX)) {
          try {
            const item = JSON.parse(localStorage.getItem(key) || '{}');
            if (!item.lastUpdated || now - item.lastUpdated > this.EXPIRATION_MS) {
              keysToRemove.push(key);
            }
          } catch {
            keysToRemove.push(key);
          }
        }
      }

      keysToRemove.forEach(k => localStorage.removeItem(k));
      if (keysToRemove.length > 0) {
        console.info(`[InterviewSessionCache] ${keysToRemove.length} session(s) de plus de 10 min purgée(s).`);
      }
    } catch (err) {
      console.warn('[InterviewSessionCache] Erreur lors du nettoyage automatique:', err);
    }
  }

  private getStorageKey(cvId: string): string {
    return `${this.STORAGE_PREFIX}${cvId}`;
  }
}
