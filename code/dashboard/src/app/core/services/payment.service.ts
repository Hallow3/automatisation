import { Injectable, signal, computed, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, delay } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

export interface MobileOperator {
  id: 'orange' | 'mtn';
  name: string;
  color: string;
  badge: string;
  prefix: string;
  logoUrl?: string;
}

export interface PaymentPack {
  id: 'pack_1' | 'pack_3';
  name: string;
  credits: number;
  price: number;
  formattedPrice: string;
  discountBadge?: string;
  popular?: boolean;
  description: string;
}

export interface CountryConfig {
  code: string;
  name: string;
  currency: string;
  symbol: string;
  singlePrice: number;
  formattedSinglePrice: string;
  packs: PaymentPack[];
  operators: MobileOperator[];
}

export interface PaymentInitiateRequest {
  cvId?: string;
  type: 'SINGLE_CV' | 'PRO_PACK';
  packId?: string;
  countryCode: string;
  operatorId: string;
  phoneNumber?: string;
  clientName?: string;
  clientPhone?: string;
}

export interface PaymentInitiateResponse {
  reference: string;
  status: 'PENDING' | 'SUCCESS' | 'FALLBACK_WHATSAPP' | 'FAILED';
  message: string;
  ussdPrompt?: string;
  checkoutUrl?: string;
  fallbackWhatsApp?: boolean;
  whatsAppUrl?: string;
  whatsAppNumber?: string;
}


@Injectable({
  providedIn: 'root'
})
export class PaymentService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/payments`;

  // ── Configuration Cameroun (+237 / FCFA) ──────────────────────────────────
  readonly camerounConfig: CountryConfig = {
    code: 'CM',
    name: 'Cameroun',
    currency: 'XAF',
    symbol: 'FCFA',
    singlePrice: 500,
    formattedSinglePrice: '500 FCFA',
    packs: [
      {
        id: 'pack_1',
        name: '1 Crédit IA',
        credits: 1,
        price: 500,
        formattedPrice: '500 FCFA',
        description: '1 crédit pour les fonctionnalités IA (OCR, Entretien Vocal)'
      },
      {
        id: 'pack_3',
        name: 'Pack 3 Crédits IA',
        credits: 3,
        price: 1200,
        formattedPrice: '1 200 FCFA',
        discountBadge: '-20%',
        popular: true,
        description: '3 crédits pour les fonctionnalités IA (OCR, Entretien Vocal)'
      }
    ],
    operators: [
      {
        id: 'orange',
        name: 'Orange Money',
        color: '#ff7900',
        badge: 'Orange Money',
        prefix: '+237'
      },
      {
        id: 'mtn',
        name: 'MTN Mobile Money',
        color: '#ffcc00',
        badge: 'MTN MoMo',
        prefix: '+237'
      }
    ]
  };

  readonly countries: CountryConfig[] = [this.camerounConfig];

  // ── États Réactifs (Signals) ──────────────────────────────────────────────
  public selectedCountry = signal<CountryConfig>(this.camerounConfig);
  public isProMode = signal<boolean>(this.loadProMode());
  public proCredits = signal<number>(this.loadProCredits());
  public unlockedCvIds = signal<Set<string>>(this.loadUnlockedCvs());
  public isPackModalOpen = signal<boolean>(false);

  // Métadonnées client pour le mode guichet / cybercafé (cvId -> { name, phone })
  public clientTags = signal<Record<string, { name: string; phone?: string }>>(this.loadClientTags());

  constructor() {
    this.syncWithBackend();
  }

  public openPackModal(): void {
    this.isPackModalOpen.set(true);
  }

  public closePackModal(): void {
    this.isPackModalOpen.set(false);
  }

  public syncWithBackend(): void {
    this.fetchProStatus();
    this.fetchUnlockedCvs();
  }

  public fetchUnlockedCvs(): void {
    this.http.get<number[]>(`${this.apiUrl}/unlocked-cvs`)
      .pipe(catchError(() => of([])))
      .subscribe(serverIds => {
        if (serverIds && serverIds.length > 0) {
          const merged = new Set(this.unlockedCvIds());
          serverIds.forEach(id => merged.add(id.toString()));
          this.unlockedCvIds.set(merged);
          this.saveUnlockedCvs(merged);
        }
      });
  }

  public fetchProStatus(): void {
    this.http.get<{ isProAgent: boolean; proCredits: number; agentShopName?: string }>(`${this.apiUrl}/pro-status`)
      .pipe(catchError(() => of(null)))
      .subscribe(res => {
        if (res && res.proCredits !== undefined && res.proCredits !== null) {
          this.proCredits.set(res.proCredits);
          this.saveProCredits(res.proCredits);
          if (res.isProAgent) {
            this.setProMode(true);
          }
        }
      });
  }

  // ── Méthodes Publiques ───────────────────────────────────────────────────

  public setCountry(countryCode: string): void {
    const c = this.countries.find(item => item.code === countryCode);
    if (c) this.selectedCountry.set(c);
  }

  public isCvUnlocked(cvId: string | null | undefined): boolean {
    return true; // La création et le téléchargement des CVs sont 100% gratuits
  }

  public unlockCv(cvId: string): void {
    if (!cvId) return;
    const current = new Set(this.unlockedCvIds());
    current.add(cvId);
    this.unlockedCvIds.set(current);
    this.saveUnlockedCvs(current);
  }

  public toggleProMode(): void {
    const next = !this.isProMode();
    this.isProMode.set(next);
    localStorage.setItem('getjob_pro_mode', next ? 'true' : 'false');
  }

  public setProMode(enabled: boolean): void {
    this.isProMode.set(enabled);
    localStorage.setItem('getjob_pro_mode', enabled ? 'true' : 'false');
  }

  public addCredits(amount: number): void {
    const updated = this.proCredits() + amount;
    this.proCredits.set(updated);
    this.saveProCredits(updated);
  }

  public useProCredit(cvId: string, clientName?: string, clientPhone?: string): boolean {
    // Si le CV est déjà déverrouillé, protection absolue : 0 crédit consommé
    if (this.isCvUnlocked(cvId)) {
      return true;
    }

    if (this.proCredits() <= 0) return false;

    const updated = this.proCredits() - 1;
    this.proCredits.set(updated);
    this.saveProCredits(updated);

    this.unlockCv(cvId);

    if (clientName && clientName.trim()) {
      const tags = { ...this.clientTags() };
      tags[cvId] = { name: clientName.trim(), phone: clientPhone?.trim() };
      this.clientTags.set(tags);
      this.saveClientTags(tags);
    }

    // Appel serveur si cvId numérique
    const numId = parseInt(cvId, 10);
    if (!isNaN(numId)) {
      this.http.post(`${this.apiUrl}/use-pro-credit`, {
        cvId: numId,
        clientName: clientName?.trim(),
        clientPhone: clientPhone?.trim()
      }).pipe(catchError(() => of(null))).subscribe();
    }

    return true;
  }

  public getClientTag(cvId: string): { name: string; phone?: string } | undefined {
    return this.clientTags()[cvId];
  }

  public initiatePayment(request: PaymentInitiateRequest): Observable<PaymentInitiateResponse> {
    const payload = {
      cvId: request.cvId ? parseInt(request.cvId, 10) || null : null,
      type: request.type,
      packId: request.packId,
      countryCode: request.countryCode || 'CM',
      operator: request.operatorId,
      phoneNumber: request.phoneNumber,
      clientName: request.clientName,
      clientPhone: request.clientPhone
    };

    return this.http.post<PaymentInitiateResponse>(`${this.apiUrl}/initiate`, payload);
  }

  public verifyPayment(reference: string): Observable<{ success: boolean; message: string; cvId?: number }> {
    return this.http.get<{ success: boolean; message: string; cvId?: number }>(`${this.apiUrl}/status/${reference}`).pipe(
      catchError(() => of({
        success: false,
        message: 'Transaction en attente de confirmation ou introuvable.'
      }))
    );
  }

  public markFallbackWhatsApp(reference: string): Observable<{ status: string; message: string }> {
    return this.http.post<{ status: string; message: string }>(`${this.apiUrl}/fallback-whatsapp/${reference}`, {})
      .pipe(catchError(() => of({ status: 'FALLBACK_WHATSAPP', message: 'Bascule WhatsApp enregistrée' })));
  }

  // ── Persistance Locale ────────────────────────────────────────────────────
  private loadProCredits(): number {
    const val = localStorage.getItem('getjob_pro_credits');
    return val !== null ? parseInt(val, 10) : 0;
  }


  private saveProCredits(val: number): void {
    localStorage.setItem('getjob_pro_credits', val.toString());
  }

  private loadProMode(): boolean {
    return localStorage.getItem('getjob_pro_mode') === 'true';
  }

  private loadUnlockedCvs(): Set<string> {
    try {
      const raw = localStorage.getItem('getjob_unlocked_cvs');
      return raw ? new Set(JSON.parse(raw)) : new Set();
    } catch {
      return new Set();
    }
  }

  private saveUnlockedCvs(set: Set<string>): void {
    localStorage.setItem('getjob_unlocked_cvs', JSON.stringify(Array.from(set)));
  }

  private loadClientTags(): Record<string, { name: string; phone?: string }> {
    try {
      const raw = localStorage.getItem('getjob_client_tags');
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }

  private saveClientTags(tags: Record<string, { name: string; phone?: string }>): void {
    localStorage.setItem('getjob_client_tags', JSON.stringify(tags));
  }
}
