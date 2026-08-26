import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap, catchError, throwError, of, firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthUser, LoginRequest, RegisterRequest } from '../models/auth.model';

/**
 * Service d'authentification Angular.
 *
 * ── Stratégie Cookie HttpOnly ────────────────────────────────────────────────
 *
 * Le token JWT est stocké dans un cookie HttpOnly géré par Spring Boot.
 * Angular ne peut pas lire ce cookie (c'est le but : protection XSS).
 *
 * Ce service stocke uniquement le profil utilisateur (nom, email, rôle)
 * dans un signal Angular pour l'affichage. Ce n'est PAS une preuve
 * d'authentification — c'est juste du confort affichage.
 *
 * La vraie vérification se fait côté Spring : si le cookie est expiré
 * ou absent, Spring retourne 401 et l'AuthInterceptor redirige vers /login.
 *
 * ── Vérification de session au démarrage ─────────────────────────────────────
 * Au démarrage de l'application (APP_INITIALIZER dans app.config.ts),
 * Angular appelle GET /auth/me. Si Spring retourne 200 → cookie valide,
 * on stocke le profil. Si 401 → cookie expiré/absent, on redirige /login.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private router = inject(Router);
  private base = `${environment.apiUrl}/auth`;

  // Signal contenant l'utilisateur connecté. null = non connecté (ou pas encore chargé).
  private _currentUser = signal<AuthUser | null>(null);

  /** Lecture publique de l'utilisateur connecté. */
  readonly currentUser = this._currentUser.asReadonly();

  /** true si un utilisateur est connecté. */
  readonly isAuthenticated = computed(() => this._currentUser() !== null);

  // ── Register ──────────────────────────────────────────────────────────────

  register(request: RegisterRequest): Observable<{ message: string; email: string; requiresVerification: boolean }> {
    return this.http.post<{ message: string; email: string; requiresVerification: boolean }>(
      `${this.base}/register`,
      request
    );
  }

  // ── Email Verification ───────────────────────────────────────────────────

  verifyEmail(request: { email: string; code: string }): Observable<AuthUser> {
    return this.http.post<AuthUser>(`${this.base}/verify-email`, request, {
      withCredentials: true
    }).pipe(
      tap(user => this._currentUser.set(user))
    );
  }

  resendVerification(email: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.base}/resend-verification`, { email });
  }

  // ── Login ─────────────────────────────────────────────────────────────────

  login(request: LoginRequest): Observable<AuthUser> {
    return this.http.post<AuthUser>(`${this.base}/login`, request, {
      withCredentials: true
    }).pipe(
      tap(user => this._currentUser.set(user))
    );
  }

  // ── Google Sign-In ────────────────────────────────────────────────────────

  loginWithGoogle(request: { credential: string; email?: string; fullName?: string }): Observable<AuthUser> {
    return this.http.post<AuthUser>(`${this.base}/google`, request, {
      withCredentials: true
    }).pipe(
      tap(user => this._currentUser.set(user))
    );
  }

  // ── Mot de passe oublié ───────────────────────────────────────────────────

  forgotPassword(email: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.base}/forgot-password`, { email });
  }

  resetPassword(data: { email: string; token?: string; newPassword: string }): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.base}/reset-password`, data);
  }

  // ── Logout ────────────────────────────────────────────────────────────────

  logout(): void {
    this.http.post(`${this.base}/logout`, {}, { withCredentials: true })
      .subscribe({
        complete: () => {
          this._currentUser.set(null);
          this.router.navigate(['/login']);
        },
        error: () => {
          // Même en cas d'erreur réseau, on nettoie le state local et on redirige
          this._currentUser.set(null);
          this.router.navigate(['/login']);
        }
      });
  }

  // ── Vérification de session ───────────────────────────────────────────────

  /**
   * Vérifie si la session est encore valide en appelant /auth/me.
   *
   * Utilisé par APP_INITIALIZER au démarrage de l'application.
   * Si le cookie est valide, Spring retourne le profil → on stocke l'utilisateur.
   * Si le cookie est expiré/absent, Spring retourne 401 → on laisse null.
   *
   * Note : on retourne une Promise car APP_INITIALIZER attend une Promise.
   */
  checkSession(): Promise<void> {
    return firstValueFrom(
      this.http.get<AuthUser>(`${this.base}/me`, { withCredentials: true }).pipe(
        tap(user => this._currentUser.set(user)),
        catchError(() => {
          // 401 = pas de cookie ou session expirée → utilisateur non connecté
          this._currentUser.set(null);
          return of(null);
        })
      )
    ).then(() => void 0);
  }

  /**
   * Appelé par l'AuthInterceptor quand Spring retourne 401.
   * Nettoie le state et redirige vers /login sans appeler logout (le cookie est déjà mort).
   */
  handleUnauthorized(): void {
    this._currentUser.set(null);
    this.router.navigate(['/login'], {
      queryParams: { reason: 'session_expired' }
    });
  }
}
