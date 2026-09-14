import { CvData } from '../cv-preview/cv-preview.component';

/**
 * Contrat d'interface strict que chaque Dumb Component de template doit implémenter.
 * Le template reçoit les données sérialisées (CvData) et gère sa propre présentation
 * et son CSS scopé sans aucune dépendance métier.
 */
export interface CvTemplateComponent {
  data: CvData;
  accent?: string;
}
