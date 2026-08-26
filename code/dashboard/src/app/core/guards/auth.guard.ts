import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

/**
 * Guard Angular qui protège les routes de l'application.
 *
 * Logique :
 *   - Si l'utilisateur est authentifié (signal currentUser non null) → laisse passer.
 *   - Sinon → redirige vers /login avec returnUrl pour revenir après connexion.
 *
 * Ce guard s'appuie sur le signal `isAuthenticated` de AuthService,
 * alimenté par checkSession() au démarrage (APP_INITIALIZER).
 * Donc si l'utilisateur arrive avec un cookie valide, le profil est déjà chargé
 * et le guard laisse passer sans appel réseau supplémentaire.
 */
export const authGuard: CanActivateFn = (_route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isAuthenticated()) {
    return true;
  }

  // Sauvegarde l'URL demandée pour rediriger après connexion
  return router.createUrlTree(['/login'], {
    queryParams: { returnUrl: state.url }
  });
};
