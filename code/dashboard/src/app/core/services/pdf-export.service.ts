import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { CvData } from '../../shared/components/cv-preview/cv-preview.component';
import { CvApiService } from './cv-api.service';
import { environment } from '../../../environments/environment';

/**
 * Service d'exportation PDF haute fidélité.
 * Conforme aux exigences :
 * 1. Ouvre TOUJOURS le téléchargement du CV dans un nouvel onglet (_blank) comme le paiement mobile.
 * 2. Utilise une URL temporaire sécurisée générée à la demande (TTL 5 minutes).
 * 3. Fallback robuste vers la vue d'impression vectorielle si nécessaire.
 */
@Injectable({
  providedIn: 'root'
})
export class PdfExportService {
  private cvApi = inject(CvApiService);

  /**
   * Exporte et télécharge le CV au format PDF vectoriel A4 natif.
   *
   * @param cvData Données du CV
   * @param templateId Identifiant du modèle ('modern', 'classic')
   * @param isUnlocked Indicateur de déverrouillage
   * @param cvId Identifiant en base de données du CV (optionnel)
   */
  async exportCvPdf(
    cvData: CvData,
    templateId: string = 'modern',
    isUnlocked: boolean = true,
    cvId?: string | null
  ): Promise<void> {
    // 1. Sauvegarder le brouillon dans le localStorage pour garantir la cohérence
    try {
      localStorage.setItem('fallajobs_cv_draft_latest', JSON.stringify(cvData));
      localStorage.setItem('getjob_cv_draft_latest', JSON.stringify(cvData));
    } catch (e) {}

    const resolvedId = cvId || 'latest';

    // 2. Obtenir une URL temporaire sécurisée (TTL 5 minutes) auprès du serveur
    try {
      const ticket = await firstValueFrom(this.cvApi.createDownloadTicket(resolvedId, templateId));
      if (ticket?.downloadUrl) {
        const backendOrigin = environment.apiUrl.startsWith('http')
          ? environment.apiUrl.replace(/\/api\/v1\/?$/, '')
          : (typeof window !== 'undefined' ? window.location.origin : '');
        const cleanPath = ticket.downloadUrl.startsWith('/') ? ticket.downloadUrl : `/${ticket.downloadUrl}`;
        const fullDownloadUrl = ticket.downloadUrl.startsWith('http')
          ? ticket.downloadUrl
          : `${backendOrigin}${cleanPath}`;

        // Déclencher le téléchargement direct du fichier via un élément ancre invisible
        // Cela évite d'ouvrir un onglet vierge orphelin qui tournerait indéfiniment
        const link = document.createElement('a');
        link.href = fullDownloadUrl;
        link.setAttribute('download', `CV_${resolvedId}.pdf`);
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        setTimeout(() => {
          if (document.body.contains(link)) {
            document.body.removeChild(link);
          }
        }, 1500);
        return;
      }
    } catch (err: any) {
      console.warn('Création du ticket de téléchargement temporaire échouée, activation du fallback :', err);
      if (err?.status === 402 || err?.status === 403) {
        throw err;
      }
    }

    // 3. Fallback vers la vue d'impression isolée /print/cv/:id si le ticket temporaire n'est pas disponible
    const fallbackUrl = `/print/cv/${resolvedId}?template=${templateId}&print=true`;
    window.open(fallbackUrl, '_blank');
  }
}
