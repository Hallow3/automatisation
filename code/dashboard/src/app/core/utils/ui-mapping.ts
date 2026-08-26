export type StatusTone = 'neutral' | 'brand' | 'success' | 'warning' | 'danger' | 'info';

export interface StatusBadgeConfig {
  label: string;
  tone: StatusTone;
  dotClass: string;
  badgeClass: string;
}

/**
 * Traduction centralisée de tous les statuts techniques en libellés français clairs
 * avec les styles et couleurs du correct-dashboard.
 */
export function getOpportunityStatusLabel(status: string | null | undefined): string {
  if (!status) return 'À examiner';
  const s = status.toUpperCase().trim();
  switch (s) {
    case 'NEW':
    case 'NOUVEAU':
    case 'TO_REVIEW':
      return 'À examiner';
    case 'QUALIFIED':
    case 'QUALIFIEE':
    case 'QUALIFIÉE':
      return 'Qualifiée';
    case 'PREPARING':
    case 'READY':
    case 'READY_TO_APPLY':
    case 'PRETE':
    case 'PRÊTE':
      return 'Prête';
    case 'APPLIED':
    case 'ENVOYEE':
    case 'ENVOYÉE':
    case 'SUBMITTED':
      return 'Envoyée';
    case 'INTERVIEW':
    case 'ENTRETIEN':
      return 'Entretien';
    case 'DISMISSED':
    case 'IGNORED':
    case 'IGNOREE':
    case 'IGNORÉE':
      return 'Ignorée';
    case 'REJECTED':
    case 'REFUSEE':
    case 'REFUSÉE':
    case 'NON_RETENUE':
      return 'Refusée';
    case 'DRAFT':
    case 'BROUILLON':
      return 'Brouillon';
    case 'DRAFT_READY':
      return 'Prêt à finaliser';
    case 'COMPLETED':
      return 'Finalisé';
    default:
      return status;
  }
}

export function getMatchReasonLabel(reason: string | null | undefined): string {
  if (!reason) return 'Bonne adéquation détectée avec votre profil';
  const r = reason.trim();
  if (r.includes('qualified_score')) return 'Bon potentiel de correspondance';
  if (r.includes('review_strong_role_match')) return 'Profil très proche des exigences du poste';
  return r;
}

export function getStatusBadgeConfig(status: string | null | undefined): StatusBadgeConfig {
  if (!status) {
    return {
      label: 'À examiner',
      tone: 'warning',
      dotClass: 'bg-amber-500',
      badgeClass: 'bg-amber-50 text-amber-700'
    };
  }

  const s = status.toUpperCase().trim();

  switch (s) {
    case 'NEW':
    case 'NOUVEAU':
    case 'TO_REVIEW':
      return {
        label: 'En attente',
        tone: 'warning',
        dotClass: 'bg-amber-500',
        badgeClass: 'bg-amber-50 text-amber-700'
      };

    case 'QUALIFIED':
    case 'QUALIFIEE':
    case 'QUALIFIÉE':
      return {
        label: 'Qualifiée',
        tone: 'info',
        dotClass: 'bg-brand-500',
        badgeClass: 'bg-brand-50 text-brand-600'
      };

    case 'PREPARING':
    case 'READY':
    case 'READY_TO_APPLY':
    case 'PRETE':
    case 'PRÊTE':
      return {
        label: 'Prête',
        tone: 'brand',
        dotClass: 'bg-brand-600',
        badgeClass: 'bg-brand-100 text-brand-700'
      };

    case 'APPLIED':
    case 'ENVOYEE':
    case 'ENVOYÉE':
    case 'SUBMITTED':
      return {
        label: 'Envoyée',
        tone: 'info',
        dotClass: 'bg-brand-500',
        badgeClass: 'bg-brand-50 text-brand-600'
      };

    case 'INTERVIEW':
    case 'ENTRETIEN':
      return {
        label: 'Entretien',
        tone: 'brand',
        dotClass: 'bg-brand-600',
        badgeClass: 'bg-brand-100 text-brand-700'
      };

    case 'DISMISSED':
    case 'IGNORED':
    case 'IGNOREE':
    case 'IGNORÉE':
      return {
        label: 'Ignorée',
        tone: 'neutral',
        dotClass: 'bg-slate-400',
        badgeClass: 'bg-slate-100 text-slate-600'
      };

    case 'REJECTED':
    case 'REFUSEE':
    case 'REFUSÉE':
    case 'NON_RETENUE':
      return {
        label: 'Refusée',
        tone: 'danger',
        dotClass: 'bg-rose-500',
        badgeClass: 'bg-rose-50 text-rose-700'
      };

    case 'DRAFT':
    case 'BROUILLON':
      return {
        label: 'Brouillon',
        tone: 'neutral',
        dotClass: 'bg-slate-400',
        badgeClass: 'bg-slate-100 text-slate-600'
      };

    case 'DRAFT_READY':
      return {
        label: 'Prêt à finaliser',
        tone: 'info',
        dotClass: 'bg-brand-500',
        badgeClass: 'bg-brand-100 text-brand-700'
      };

    case 'COMPLETED':
      return {
        label: 'Finalisé',
        tone: 'brand',
        dotClass: 'bg-brand-600',
        badgeClass: 'bg-brand-100 text-brand-700'
      };

    default:
      return {
        label: getOpportunityStatusLabel(status),
        tone: 'neutral',
        dotClass: 'bg-slate-400',
        badgeClass: 'bg-slate-100 text-slate-600'
      };
  }
}
