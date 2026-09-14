import { Component, Input, Output, EventEmitter, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PaymentService, MobileOperator, PaymentPack } from '../../../core/services/payment.service';
import { ModalComponent } from '../modal/modal.component';
import { ButtonComponent } from '../button/button.component';
import { BadgeComponent } from '../badge/badge.component';

export type PaymentStep = 'select_method' | 'awaiting_ussd' | 'fallback_whatsapp' | 'success' | 'error';

@Component({
  selector: 'app-payment-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, ModalComponent, ButtonComponent, BadgeComponent],
  templateUrl: './payment-modal.component.html',
  styleUrl: './payment-modal.component.css'
})
export class PaymentModalComponent {
  public paymentService = inject(PaymentService);

  @Input() open = false;
  @Input() cvId: string | null = null;
  @Input() cvTitle = 'Mon CV Professionnel';

  @Output() close = new EventEmitter<void>();
  @Output() paymentSuccess = new EventEmitter<{ cvId: string; packId: string }>();

  // Forfaits disponibles (Cameroun)
  readonly packs = this.paymentService.camerounConfig.packs;
  readonly operators = this.paymentService.camerounConfig.operators;

  // États locaux
  currentStep = signal<PaymentStep>('select_method');
  selectedPackId = signal<'pack_1' | 'pack_3'>('pack_1');
  selectedOperatorId = signal<'orange' | 'mtn'>('orange');
  errorMessage = signal<string | null>(null);
  isLoading = signal<boolean>(false);
  activeTransactionRef = signal<string | null>(null);
  whatsAppUrl = signal<string | null>(null);
  whatsAppNumber = signal<string>('+237 698 76 55 88');

  // Sélections calculées
  selectedPack = computed(() => this.packs.find(p => p.id === this.selectedPackId()) || this.packs[0]);
  selectedOperator = computed(() => this.operators.find(op => op.id === this.selectedOperatorId()) || this.operators[0]);

  selectPack(packId: 'pack_1' | 'pack_3'): void {
    this.selectedPackId.set(packId);
  }

  handleClose(): void {
    if (this.currentStep() === 'awaiting_ussd') {
      if (!confirm('Votre paiement est en attente de validation sur votre téléphone. Souhaitez-vous vraiment annuler ?')) {
        return;
      }
    }
    this.currentStep.set('select_method');
    this.errorMessage.set(null);
    this.close.emit();
  }

  submitPayment(operatorId: 'orange' | 'mtn'): void {
    this.selectedOperatorId.set(operatorId);
    this.errorMessage.set(null);
    this.isLoading.set(true);

    const pack = this.selectedPack();

    this.paymentService.initiatePayment({
      cvId: this.cvId || 'latest',
      type: pack.id === 'pack_3' ? 'PRO_PACK' : 'SINGLE_CV',
      packId: pack.id,
      countryCode: 'CM',
      operatorId,
      phoneNumber: ''
    }).subscribe({
      next: (res) => {
        this.isLoading.set(false);
        this.activeTransactionRef.set(res.reference);

        // Si bascule défensive vers WhatsApp proposée (instabilité API NotchPay / Circuit breaker)
        if (res.fallbackWhatsApp) {
          this.whatsAppUrl.set(res.whatsAppUrl || null);
          if (res.whatsAppNumber) this.whatsAppNumber.set(res.whatsAppNumber);
          this.currentStep.set('fallback_whatsapp');
          return;
        }

        // Si une URL de paiement NotchPay est fournie, redirection sécurisée
        if (res.checkoutUrl) {
          window.location.href = res.checkoutUrl;
          return;
        }

        this.currentStep.set('awaiting_ussd');
      },
      error: (err) => {
        this.isLoading.set(false);
        // Fallback WhatsApp automatique en cas de panne réseau / API
        const ref = this.activeTransactionRef() || 'COMMANDE-DIRECT';
        const msg = encodeURIComponent(`Bonjour FallaJobs, je souhaite finaliser ma commande : Forfait ${pack.name} (${pack.formattedPrice}) - Réf : ${ref}`);
        this.whatsAppUrl.set(`https://wa.me/237698765588?text=${msg}`);
        this.whatsAppNumber.set('+237 698 76 55 88');
        this.currentStep.set('fallback_whatsapp');
      }
    });
  }

  acceptWhatsAppFallback(): void {
    const ref = this.activeTransactionRef();
    if (ref) {
      this.paymentService.markFallbackWhatsApp(ref).subscribe();
    }
    const url = this.whatsAppUrl();
    if (url) {
      window.open(url, '_blank');
    }
    this.handleClose();
  }

  confirmValidation(): void {
    const ref = this.activeTransactionRef();
    if (!ref) return;

    this.isLoading.set(true);
    this.paymentService.verifyPayment(ref).subscribe({
      next: (res) => {
        this.isLoading.set(false);
        if (res.success) {
          if (this.cvId) {
            this.paymentService.unlockCv(this.cvId);
          }
          if (this.selectedPackId() === 'pack_3') {
            this.paymentService.addCredits(2);
          }
          this.currentStep.set('success');
          this.paymentSuccess.emit({
            cvId: this.cvId || 'latest',
            packId: this.selectedPackId()
          });
        } else {
          this.errorMessage.set(res.message || 'Paiement en attente de confirmation.');
        }
      },
      error: () => {
        this.isLoading.set(false);
        this.errorMessage.set('Impossible de vérifier la transaction.');
      }
    });
  }
}
