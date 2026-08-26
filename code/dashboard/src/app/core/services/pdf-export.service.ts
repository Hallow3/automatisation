import { Injectable } from '@angular/core';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { CvData } from '../../shared/components/cv-preview/cv-preview.component';

@Injectable({
  providedIn: 'root'
})
export class PdfExportService {

  /**
   * Télécharge directement le fichier PDF A4 (1, 2, 3... pages) sans dépendre de la boîte d'impression du navigateur.
   * Fonctionne de façon autonome sur desktop et mobile.
   */
  async exportCvPdf(cvData: CvData, templateId: string = 'moderne'): Promise<void> {
    const rawName = (cvData.name || 'CV').trim().replace(/\s+/g, '_');
    const rawTitle = (cvData.title || 'Professionnel').trim().replace(/\s+/g, '_');
    const fileName = `${rawName}_${rawTitle}.pdf`;

    // Récupérer toutes les feuilles A4 affichées
    const cvElements = Array.from(document.querySelectorAll('.cv-paper')) as HTMLElement[];
    if (cvElements.length === 0) {
      window.print();
      return;
    }

    try {
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      const pageWidth = 210; // A4 width mm
      const pageHeight = 297; // A4 height mm

      for (let i = 0; i < cvElements.length; i++) {
        const el = cvElements[i];
        const canvas = await html2canvas(el, {
          scale: 2,
          useCORS: true,
          logging: false,
          backgroundColor: '#ffffff'
        });

        const imgData = canvas.toDataURL('image/jpeg', 0.98);

        if (i > 0) {
          pdf.addPage();
        }

        pdf.addImage(imgData, 'JPEG', 0, 0, pageWidth, pageHeight, undefined, 'FAST');
      }

      // Téléchargement direct du fichier
      pdf.save(fileName);
    } catch (err) {
      console.error('Erreur export direct jsPDF:', err);
      window.print();
    }
  }
}
