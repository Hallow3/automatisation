import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';

/**
 * Intercepteur HTTP Angular — deux responsabilités :
 *
 * 1. withCredentials: true sur toutes les requêtes vers notre API.
 *    → Le navigateur joint automatiquement le cookie jwt_token.
 *    → Sans ça, le cookie n'est JAMAIS envoyé sur les requêtes cross-origin.
 *
 * 2. Gestion des 401 : si Spring retourne 401 (token expiré, cookie absent),
 *    on redirige vers /login avec un message "session expirée".
 *    → L'utilisateur ne voit pas d'erreur cryptique, juste la page de login.
 *
 * ── Pourquoi withCredentials ? ───────────────────────────────────────────────
 * Par défaut, les requêtes fetch/XHR n'envoient pas les cookies cross-origin.
 * Notre API est sur localhost:8081 et Angular sur localhost:4200 = origines différentes.
 * withCredentials: true autorise l'envoi des cookies sur ces requêtes.
 * Spring doit avoir allowCredentials(true) dans sa config CORS (c'est fait).
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);

  // Cloner la requête en ajoutant withCredentials
  const authReq = req.clone({ withCredentials: true });

  return next(authReq).pipe(
    catchError((error: HttpErrorResponse) => {
      const isAuthEndpoint = req.url.includes('/auth/');
      if (error.status === 401 && !isAuthEndpoint) {
        // Session expirée ou cookie absent sur une ressource protégée uniquement
        authService.handleUnauthorized();
      }
      return throwError(() => error);
    })
  );
};
