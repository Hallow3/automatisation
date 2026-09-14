import { Component, Input, Output, EventEmitter, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PaymentService, MobileOperator } from '../../../core/services/payment.service';
import { ModalComponent } from '../modal/modal.component';
import { ButtonComponent } from '../button/button.component';
import { BadgeComponent } from '../badge/badge.component';

export type PackStep = 'select_pack' | 'awaiting_ussd' | 'fallback_whatsapp' | 'success' | 'error';

@Component({
  selector: 'app-agent-pack-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, ModalComponent, ButtonComponent, BadgeComponent],
  templateUrl: './agent-pack-modal.component.html',
  styleUrl: './agent-pack-modal.component.css'
})
export class AgentPackModalComponent {
  public paymentService = inject(PaymentService);

  @Input() open = false;
  @Output() close = new EventEmitter<void>();
  @Output() packPurchased = new EventEmitter<{ credits: number }>();

  readonly packs = this.paymentService.camerounConfig.packs;
  readonly operators = this.paymentService.camerounConfig.operators;

  currentStep = signal<PackStep>('select_pack');
  selectedPackId = signal<string>('pack_3');
  selectedOperatorId = signal<'orange' | 'mtn'>('orange');
  phoneNumber = signal<string>('');
  isLoading = signal<boolean>(false);
  errorMessage = signal<string | null>(null);
  activeTransactionRef = signal<string | null>(null);
  whatsAppUrl = signal<string | null>(null);
  whatsAppNumber = signal<string>('+237 698 76 55 88');

  selectedPack = computed(() => {
    return this.packs.find(p => p.id === this.selectedPackId()) || this.packs[0];
  });

  selectedOperator = computed(() => {
    return this.operators.find(op => op.id === this.selectedOperatorId()) || this.operators[0];
  });

  selectPack(packId: string): void {
    this.selectedPackId.set(packId);
  }

  selectOperator(opId: 'orange' | 'mtn'): void {
    this.selectedOperatorId.set(opId);
  }

  handleClose(): void {
    this.currentStep.set('select_pack');
    this.isLoading.set(false);
    this.errorMessage.set(null);
    this.close.emit();
  }

  purchaseSelectedPack(): void {
    this.errorMessage.set(null);
    this.isLoading.set(true);

    const pack = this.selectedPack();
    const op = this.selectedOperator();

    this.paymentService.initiatePayment({
      type: 'PRO_PACK',
      packId: pack.id,
      countryCode: 'CM',
      operatorId: op.id
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
        if (res.checkoutUrl && (res.checkoutUrl.startsWith('http://') || res.checkoutUrl.startsWith('https://'))) {
          window.location.href = res.checkoutUrl;
          return;
        }

        this.currentStep.set('awaiting_ussd');
      },
      error: (err) => {
        this.isLoading.set(false);
        // Fallback WhatsApp automatique en cas de panne réseau / API
        const ref = this.activeTransactionRef() || 'COMMANDE-PACK';
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
          const pack = this.selectedPack();
          this.paymentService.addCredits(pack.credits);
          this.currentStep.set('success');
          this.packPurchased.emit({ credits: pack.credits });
        } else {
          this.errorMessage.set(res.message || 'La validation a échoué. Veuillez vérifier votre solde Mobile Money et réessayer.');
        }
      },
      error: () => {
        this.isLoading.set(false);
        this.errorMessage.set('La validation a échoué. Veuillez vérifier votre solde Mobile Money et réessayer.');
      }
    });
  }
}
