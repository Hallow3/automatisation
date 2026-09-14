import { Component, inject, signal, OnInit, AfterViewInit, NgZone, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators, AbstractControl } from '@angular/forms';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { ButtonComponent } from '../../shared/components/button/button.component';
import { AlertBannerComponent } from '../../shared/components/feedback/alert-banner.component';
import { environment } from '../../../environments/environment';

type AuthMode = 'login' | 'register' | 'forgot-password' | 'verify-email' | 'reset-password';

@Component({
  selector: 'app-auth',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, ButtonComponent, AlertBannerComponent],
  templateUrl: './auth.component.html',
  styleUrl: './auth.component.css'
})
export class AuthComponent implements OnInit, AfterViewInit {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private ngZone = inject(NgZone);

  mode = signal<AuthMode>('login');
  isLoading = signal(false);
  isGoogleLoaded = signal(false);
  errorMessage = signal<string | null>(null);
  forgotSuccessMessage = signal<string | null>(null);
  verificationNotice = signal<string | null>(null);
  resendSuccessMessage = signal<string | null>(null);
  verifyEmailTarget = signal<string>('');
  showPassword = signal(false);

  loginForm: FormGroup = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]]
  });

  registerForm: FormGroup = this.fb.group({
    fullName: ['', [Validators.required, Validators.minLength(2)]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
    confirmPassword: ['', [Validators.required]]
  }, { validators: this.passwordMatchValidator });

  forgotForm: FormGroup = this.fb.group({
    email: ['', [Validators.required, Validators.email]]
  });

  verifyForm: FormGroup = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    code: ['', [Validators.required, Validators.minLength(4), Validators.maxLength(10)]]
  });

  resetPasswordForm: FormGroup = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    code: ['', [Validators.required]],
    newPassword: ['', [Validators.required, Validators.minLength(8)]]
  });

  ngOnInit(): void {
    const params = this.route.snapshot.queryParamMap;
    const modeParam = params.get('mode') as AuthMode;
    const emailParam = params.get('email');
    const codeParam = params.get('code');
    const autoVerify = params.get('autoverify') === 'true';

    if (modeParam === 'verify-email') {
      this.mode.set('verify-email');
      if (emailParam) {
        this.verifyEmailTarget.set(emailParam);
        this.verifyForm.patchValue({ email: emailParam, code: codeParam || '' });
        if (codeParam && autoVerify) {
          // Validation automatique 1-clic depuis le lien de l'email
          this.submitVerifyEmail();
        } else {
          this.verificationNotice.set('Vérification de votre adresse email. Cliquez sur Valider pour continuer.');
        }
      }
    } else if (modeParam === 'reset-password') {
      this.mode.set('reset-password');
      if (emailParam) {
        this.resetPasswordForm.patchValue({ email: emailParam, code: codeParam || '' });
        this.verificationNotice.set('Code de réinitialisation détecté. Veuillez saisir votre nouveau mot de passe.');
      }
    } else if (modeParam === 'register') {
      this.mode.set('register');
    }

    this.initGoogleAuth();
  }

  ngAfterViewInit(): void {
    if (this.isGoogleLoaded()) {
      this.renderGoogleButton();
    }
  }

  @HostListener('window:resize')
  onResize(): void {
    if (this.isGoogleLoaded() && (this.mode() === 'login' || this.mode() === 'register')) {
      this.renderGoogleButton();
    }
  }

  private initGoogleAuth(): void {
    if (typeof window === 'undefined') return;

    const clientId = environment.googleClientId;

    const setupGoogle = () => {
      const g = (window as any).google;
      if (g?.accounts?.id) {
        try {
          g.accounts.id.initialize({
            client_id: clientId,
            callback: (response: any) => {
              this.ngZone.run(() => {
                this.handleGoogleCredential(response);
              });
            },
            auto_select: false,
            cancel_on_tap_outside: true
          });

          this.ngZone.run(() => {
            this.isGoogleLoaded.set(true);
          });

          setTimeout(() => {
            this.renderGoogleButton();
          }, 50);

          // One Tap passif en arrière-plan sans bloquer en cas de refus
          try {
            g.accounts.id.prompt();
          } catch {
            // Silence si le navigateur bloque One Tap
          }
        } catch (e) {
          console.error("Erreur lors de l'initialisation de Google Identity :", e);
        }
      }
    };

    if ((window as any).google?.accounts?.id) {
      setupGoogle();
    } else {
      const checkGoogleInterval = setInterval(() => {
        if ((window as any).google?.accounts?.id) {
          clearInterval(checkGoogleInterval);
          setupGoogle();
        }
      }, 100);

      setTimeout(() => clearInterval(checkGoogleInterval), 6000);

      if (!document.getElementById('google-gsi-client')) {
        const script = document.createElement('script');
        script.id = 'google-gsi-client';
        script.src = 'https://accounts.google.com/gsi/client';
        script.async = true;
        script.defer = true;
        script.onload = () => {
          clearInterval(checkGoogleInterval);
          setupGoogle();
        };
        document.head.appendChild(script);
      }
    }
  }

  renderGoogleButton(): void {
    if (typeof window === 'undefined') return;
    const g = (window as any).google;
    const container = document.getElementById('google-btn-container');

    if (!g?.accounts?.id || !container) return;

    const containerWidth = container.clientWidth || (window.innerWidth < 420 ? Math.max(window.innerWidth - 64, 240) : 380);
    const targetWidth = Math.min(Math.max(Math.round(containerWidth), 200), 400);

    container.innerHTML = '';
    try {
      g.accounts.id.renderButton(container, {
        type: 'standard',
        theme: 'outline',
        size: 'large',
        text: 'continue_with',
        shape: 'rectangular',
        logo_alignment: 'left',
        width: targetWidth,
        locale: 'fr'
      });
    } catch (e) {
      console.warn("Impossible de rendre le bouton Google :", e);
    }
  }

  handleGoogleCredential(response: any): void {
    if (!response?.credential) {
      this.errorMessage.set("Aucun jeton de sécurité reçu de Google.");
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set(null);

    this.authService.loginWithGoogle({
      credential: response.credential
    }).subscribe({
      next: () => this.navigateAfterAuth(),
      error: (err) => this.handleError(err)
    });
  }

  get currentForm(): FormGroup {
    if (this.mode() === 'forgot-password') return this.forgotForm;
    if (this.mode() === 'verify-email') return this.verifyForm;
    if (this.mode() === 'reset-password') return this.resetPasswordForm;
    return this.mode() === 'login' ? this.loginForm : this.registerForm;
  }

  switchMode(mode: AuthMode): void {
    this.mode.set(mode);
    this.errorMessage.set(null);
    this.forgotSuccessMessage.set(null);
    this.verificationNotice.set(null);
    this.resendSuccessMessage.set(null);
    this.loginForm.reset();
    this.registerForm.reset();
    this.forgotForm.reset();

    // Nettoie l'URL des query params de session expirée lors du changement de mode
    if (this.route.snapshot.queryParamMap.get('reason')) {
      this.router.navigate([], { relativeTo: this.route, queryParams: {} });
    }

    if (mode === 'login' || mode === 'register') {
      setTimeout(() => this.renderGoogleButton(), 50);
    }
  }

  loginWithGoogle(): void {
    this.errorMessage.set(null);
    const g = (window as any).google;

    if (g?.accounts?.id) {
      this.renderGoogleButton();
      try {
        g.accounts.id.prompt((notification: any) => {
          if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
            this.errorMessage.set("Veuillez cliquer sur le bouton Google officiel ci-dessus.");
          }
        });
      } catch {
        // Ignorer
      }
    } else {
      this.errorMessage.set("Le service Google Identity est en cours de chargement. Veuillez patienter...");
    }
  }

  submitForgotPassword(): void {
    if (this.forgotForm.invalid || this.isLoading()) return;

    this.isLoading.set(true);
    this.errorMessage.set(null);
    this.forgotSuccessMessage.set(null);

    const email = this.forgotForm.value.email.trim();
    this.authService.forgotPassword(email).subscribe({
      next: (res) => {
        this.isLoading.set(false);
        this.forgotSuccessMessage.set(res?.message || 'Instructions envoyées avec succès.');
        this.resetPasswordForm.patchValue({ email: email, code: '', newPassword: '' });
        this.mode.set('reset-password');
      },
      error: (err) => this.handleError(err)
    });
  }

  submitResetPassword(): void {
    if (this.resetPasswordForm.invalid || this.isLoading()) return;

    this.isLoading.set(true);
    this.errorMessage.set(null);

    this.authService.resetPassword({
      email: this.resetPasswordForm.value.email.trim(),
      token: this.resetPasswordForm.value.code.trim(),
      newPassword: this.resetPasswordForm.value.newPassword
    }).subscribe({
      next: (res) => {
        this.isLoading.set(false);
        this.mode.set('login');
        this.forgotSuccessMessage.set(res?.message || 'Mot de passe modifié avec succès.');
      },
      error: (err) => this.handleError(err)
    });
  }

  submitVerifyEmail(): void {
    if (this.verifyForm.invalid || this.isLoading()) return;

    this.isLoading.set(true);
    this.errorMessage.set(null);

    this.authService.verifyEmail({
      email: this.verifyForm.value.email.trim(),
      code: this.verifyForm.value.code.trim()
    }).subscribe({
      next: () => this.navigateAfterAuth(),
      error: (err) => this.handleError(err)
    });
  }

  resendVerificationCode(): void {
    const email = this.verifyForm.value.email || this.verifyEmailTarget();
    if (!email || this.isLoading()) return;

    this.isLoading.set(true);
    this.errorMessage.set(null);
    this.resendSuccessMessage.set(null);

    this.authService.resendVerification(email.trim()).subscribe({
      next: (res) => {
        this.isLoading.set(false);
        this.resendSuccessMessage.set(res?.message || 'Nouveau code envoyé.');
      },
      error: (err) => this.handleError(err)
    });
  }

  togglePassword(): void {
    this.showPassword.update(v => !v);
  }

  onSubmit(): void {
    const form = this.currentForm;
    if (form.invalid || this.isLoading()) return;

    this.isLoading.set(true);
    this.errorMessage.set(null);

    if (this.mode() === 'login') {
      this.authService.login({
        email: form.value.email,
        password: form.value.password
      }).subscribe({
        next: () => this.navigateAfterAuth(),
        error: (err) => {
          const errorMsg = err?.error?.message || err?.error?.reason || '';
          if (errorMsg.includes('EMAIL_NOT_VERIFIED') || err?.status === 403) {
            this.isLoading.set(false);
            const targetEmail = form.value.email;
            this.verifyEmailTarget.set(targetEmail);
            this.verifyForm.patchValue({ email: targetEmail, code: '' });
            this.mode.set('verify-email');
            this.errorMessage.set(null);
            this.verificationNotice.set('Votre compte n’est pas encore activé. Veuillez saisir le code à 6 chiffres envoyé à votre adresse email.');
          } else {
            this.handleError(err);
          }
        }
      });
    } else if (this.mode() === 'register') {
      const email = form.value.email;
      this.authService.register({
        fullName: form.value.fullName,
        email: email,
        password: form.value.password
      }).subscribe({
        next: (res) => {
          this.isLoading.set(false);
          this.verifyEmailTarget.set(email);
          this.verifyForm.patchValue({ email: email, code: '' });
          this.mode.set('verify-email');
          this.verificationNotice.set(res?.message || 'Un code de confirmation à 6 chiffres vous a été envoyé.');
        },
        error: (err) => this.handleError(err)
      });
    }
  }

  private navigateAfterAuth(): void {
    this.isLoading.set(false);
    const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl') || '/dashboard';
    this.router.navigateByUrl(returnUrl);
  }

  private handleError(err: any): void {
    this.isLoading.set(false);
    const status = err?.status;
    const backendMsg = err?.error?.message || err?.error?.reason;

    if (backendMsg && typeof backendMsg === 'string' && !backendMsg.startsWith('{')) {
      this.errorMessage.set(backendMsg);
      return;
    }

    if (status === 401 || status === 403) {
      if (this.mode() === 'login') {
        this.errorMessage.set('Email ou mot de passe incorrect.');
      } else {
        this.errorMessage.set('Opération non autorisée ou code invalide.');
      }
    } else if (status === 409 || (status === 400 && err?.error?.message?.includes('existe déjà'))) {
      this.errorMessage.set('Un compte existe déjà avec cet email.');
    } else if (status === 400) {
      this.errorMessage.set('Données invalides. Vérifiez les champs.');
    } else if (status === 0) {
      this.errorMessage.set('Impossible de joindre le serveur backend. Vérifiez que le serveur est démarré.');
    } else {
      this.errorMessage.set('Une erreur est survenue. Veuillez réessayer.');
    }
  }

  private passwordMatchValidator(form: AbstractControl) {
    const pw = form.get('password')?.value;
    const cpw = form.get('confirmPassword')?.value;
    if (pw && cpw && pw !== cpw) {
      form.get('confirmPassword')?.setErrors({ mismatch: true });
    } else if (form.get('confirmPassword')?.hasError('mismatch')) {
      form.get('confirmPassword')?.setErrors(null);
    }
    return null;
  }

  hasError(form: FormGroup, field: string, error: string): boolean {
    const ctrl: AbstractControl | null = form.get(field);
    return !!(ctrl && ctrl.hasError(error) && (ctrl.dirty || ctrl.touched));
  }

  isFieldInvalid(form: FormGroup, field: string): boolean {
    const ctrl: AbstractControl | null = form.get(field);
    return !!(ctrl && ctrl.invalid && (ctrl.dirty || ctrl.touched));
  }

  get sessionExpiredMessage(): string | null {
    if (this.mode() !== 'login') return null;
    const reason = this.route.snapshot.queryParamMap.get('reason');
    return reason === 'session_expired' ? 'Votre session a expiré. Reconnectez-vous.' : null;
  }
}
