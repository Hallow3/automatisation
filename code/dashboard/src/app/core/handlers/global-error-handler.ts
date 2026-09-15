import { ErrorHandler, Injectable } from '@angular/core';

/**
 * Gestionnaire global d'erreurs Angular.
 * Détecte automatiquement les erreurs de chargement de chunks (mises à jour de l'app / redéploiements)
 * et recharge proprement l'application sans bloquer l'utilisateur.
 */
@Injectable()
export class GlobalErrorHandler implements ErrorHandler {
  handleError(error: any): void {
    const errorStr = (error?.message || error?.toString() || '');
    const isChunkFailed =
      /Loading chunk [\d]+ failed/i.test(errorStr) ||
      /Failed to fetch dynamically imported module/i.test(errorStr) ||
      /Importing a module script failed/i.test(errorStr);

    if (isChunkFailed) {
      console.warn('[GlobalErrorHandler] Nouveau déploiement détecté, rechargement automatique de l\'application...');
      const lastReload = sessionStorage.getItem('fallajobs_chunk_reload_ts');
      const now = Date.now();
      if (!lastReload || now - parseInt(lastReload, 10) > 10000) {
        sessionStorage.setItem('fallajobs_chunk_reload_ts', String(now));
        window.location.reload();
        return;
      }
    }

    console.error('[GlobalErrorHandler]', error);
  }
}
