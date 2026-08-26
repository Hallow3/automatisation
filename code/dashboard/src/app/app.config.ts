import { ApplicationConfig, provideZoneChangeDetection, APP_INITIALIZER } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';

import { routes } from './app.routes';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { AuthService } from './core/services/auth.service';

/**
 * Factory pour APP_INITIALIZER.
 *
 * Angular exécute cette fonction AVANT d'afficher quoi que ce soit.
 * Elle appelle GET /auth/me pour savoir si le cookie JWT est encore valide.
 *
 * — Cookie valide → AuthService stocke le profil → le guard laisse passer.
 * — Cookie expiré/absent → profil null → le guard redirige vers /login.
 *
 * Sans ça, un utilisateur avec un cookie valide verrait le guard le renvoyer
 * vers /login parce que le signal `isAuthenticated` serait encore à false
 * au moment où Angular évalue la route.
 */
function initializeAuth(authService: AuthService): () => Promise<void> {
  return () => authService.checkSession();
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),

    // HttpClient avec l'intercepteur d'authentification
    provideHttpClient(
      withInterceptors([authInterceptor])
    ),

    // Vérification de session au démarrage
    {
      provide: APP_INITIALIZER,
      useFactory: initializeAuth,
      deps: [AuthService],
      multi: true
    }
  ]
};
