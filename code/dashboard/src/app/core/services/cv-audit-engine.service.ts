import { Injectable } from '@angular/core';

export interface CvAnomaly {
  id: string;
  type: 'OVERLAP' | 'CHRONOLOGY' | 'DUPLICATE' | 'INCOMPLETE' | 'GAP';
  severity: 'CRITICAL' | 'WARNING' | 'SUGGESTION';
  field: string;
  title: string;
  message: string;
  suggestedQuestion: string;
}

export interface CvAuditReport {
  score: number; // 0 à 100
  totalChecks: number;
  anomaliesCount: number;
  anomalies: CvAnomaly[];
  summary: string;
}

interface ParsedDateRange {
  startYear: number;
  startMonth: number;
  endYear: number;
  endMonth: number;
  isCurrent: boolean;
  rawStart: string;
  rawEnd: string;
}

@Injectable({
  providedIn: 'root'
})
export class CvAuditEngineService {

  /**
   * Analyse l'intégralité du brouillon de CV et produit un rapport d'anomalies
   * assorti de questions orales prêtes à l'emploi pour l'assistant vocal.
   */
  audit(draft: any): CvAuditReport {
    const anomalies: CvAnomaly[] = [];
    let totalChecks = 0;

    if (!draft) {
      return {
        score: 0,
        totalChecks: 1,
        anomaliesCount: 1,
        anomalies: [{
          id: 'empty_cv',
          type: 'INCOMPLETE',
          severity: 'CRITICAL',
          field: 'identity',
          title: 'CV vide',
          message: 'Le CV ne contient pour le moment aucune information.',
          suggestedQuestion: 'Par quoi souhaites-tu commencer : ton métier actuel ou ta dernière expérience marquante ?'
        }],
        summary: 'CV vide'
      };
    }

    // ── 1. Vérification Titre & Résumé ─────────────────────────────────────
    totalChecks += 2;
    if (!draft.headline || draft.headline.trim().length < 3) {
      anomalies.push({
        id: 'missing_headline',
        type: 'INCOMPLETE',
        severity: 'WARNING',
        field: 'headline',
        title: 'Titre professionnel manquant',
        message: 'Le CV n\'a pas encore d\'intitulé de poste ou de métier clair en en-tête.',
        suggestedQuestion: 'Quel est l\'intitulé de poste exact ou le rôle cible que tu souhaites afficher en tête de ton CV ?'
      });
    }

    if (!draft.summary || draft.summary.trim().length < 20) {
      anomalies.push({
        id: 'missing_summary',
        type: 'INCOMPLETE',
        severity: 'SUGGESTION',
        field: 'summary',
        title: 'Accroche / Profil professionnel court ou manquant',
        message: 'Une synthèse de 2 ou 3 phrases valoriserait énormément ton profil auprès des recruteurs.',
        suggestedQuestion: 'Comment résumerais-tu en deux phrases ta valeur ajoutée principale et ce qui te passionne dans ton métier ?'
      });
    }

    // ── 2. Vérification des Compétences & Doublons ─────────────────────────
    totalChecks += 2;
    const rawSkills: string[] = Array.isArray(draft.skills) ? draft.skills : [];
    if (rawSkills.length === 0) {
      anomalies.push({
        id: 'missing_skills',
        type: 'INCOMPLETE',
        severity: 'WARNING',
        field: 'skills',
        title: 'Aucune compétence enregistrée',
        message: 'La liste des compétences techniques ou relationnelles est encore vide.',
        suggestedQuestion: 'Quelles sont les 4 ou 5 compétences ou outils indispensables que tu maîtrises le mieux ?'
      });
    } else {
      // Détection des doublons ou quasi-doublons de compétences
      const seenSkills = new Map<string, string>();
      const skillDuplicates: string[] = [];

      for (const skill of rawSkills) {
        const normalized = this.normalizeSkill(skill);
        if (seenSkills.has(normalized)) {
          skillDuplicates.push(`"${skill}" et "${seenSkills.get(normalized)}"`);
        } else {
          seenSkills.set(normalized, skill);
        }
      }

      if (skillDuplicates.length > 0) {
        anomalies.push({
          id: 'duplicate_skills',
          type: 'DUPLICATE',
          severity: 'SUGGESTION',
          field: 'skills',
          title: 'Doublons détectés dans les compétences',
          message: `Compétences répétées sous différentes formes : ${skillDuplicates.join(', ')}.`,
          suggestedQuestion: `J'ai remarqué des compétences très proches dans ta liste (${skillDuplicates[0]}). Souhaites-tu qu'on les regroupe pour garder un CV percutant ?`
        });
      }
    }

    // ── 3. Analyse approfondie des Expériences Professionnelles ────────────
    const experiences: any[] = Array.isArray(draft.experiences) ? draft.experiences : [];
    const parsedRanges: { index: number; exp: any; range: ParsedDateRange | null }[] = [];

    if (experiences.length === 0) {
      totalChecks += 1;
      anomalies.push({
        id: 'no_experiences',
        type: 'INCOMPLETE',
        severity: 'CRITICAL',
        field: 'experiences',
        title: 'Aucune expérience professionnelle',
        message: 'Le CV ne mentionne encore aucune expérience ou mission.',
        suggestedQuestion: 'Parlons de ton parcours professionnel : quelle est la dernière entreprise ou le dernier projet pour lequel tu as travaillé ?'
      });
    } else {
      // Analyser chaque expérience individuellement
      for (let i = 0; i < experiences.length; i++) {
        const exp = experiences[i];
        const pos = exp.position || 'Poste inconnu';
        const comp = exp.company || 'Entreprise inconnue';
        totalChecks += 4;

        // Incomplétudes : Réalisations concrètes
        const achievements: any[] = Array.isArray(exp.achievements) ? exp.achievements : [];
        if (achievements.length === 0) {
          anomalies.push({
            id: `exp_${i}_no_achievements`,
            type: 'INCOMPLETE',
            severity: 'SUGGESTION',
            field: `experiences[${i}].achievements`,
            title: `Réalisations manquantes (${comp})`,
            message: `L'expérience "${pos}" chez ${comp} ne détaille pas encore de réalisations concrètes ou de résultats obtenus.`,
            suggestedQuestion: `Pour ton expérience chez ${comp}, quelle a été ta plus grande fierté ou une réalisation dont tu as particulièrement mesuré l'impact ?`
          });
        }

        // Incomplétudes : Outils & Technologies
        const technologies: any[] = Array.isArray(exp.technologies) ? exp.technologies : [];
        if (technologies.length === 0) {
          anomalies.push({
            id: `exp_${i}_no_tech`,
            type: 'INCOMPLETE',
            severity: 'SUGGESTION',
            field: `experiences[${i}].technologies`,
            title: `Technologies ou outils manquants (${comp})`,
            message: `Aucun outil, langage ou méthodologie n'est spécifié pour le poste "${pos}" chez ${comp}.`,
            suggestedQuestion: `Quels étaient les principaux outils ou technos que tu utilisais au quotidien chez ${comp} ?`
          });
        }

        // Parsing et validation des dates
        const range = this.parseDateRange(exp.startDate, exp.endDate);
        parsedRanges.push({ index: i, exp, range });

        if (!range) {
          anomalies.push({
            id: `exp_${i}_missing_dates`,
            type: 'INCOMPLETE',
            severity: 'WARNING',
            field: `experiences[${i}].dates`,
            title: `Dates non précisées (${comp})`,
            message: `Les dates de début et de fin pour "${pos}" chez ${comp} ne sont pas clairement définies.`,
            suggestedQuestion: `Pour ton rôle chez ${comp}, sur quelles années ou quelle période exacte étais-tu en poste ?`
          });
        } else {
          // Date inversée : début après fin
          if (range.startYear > range.endYear || (range.startYear === range.endYear && range.startMonth > range.endMonth && !range.isCurrent)) {
            anomalies.push({
              id: `exp_${i}_inverted_dates`,
              type: 'CHRONOLOGY',
              severity: 'CRITICAL',
              field: `experiences[${i}].dates`,
              title: `Dates inversées (${comp})`,
              message: `La date de début (${exp.startDate}) est postérieure à la date de fin (${exp.endDate}) pour "${pos}" chez ${comp}.`,
              suggestedQuestion: `Petite vérification sur ton poste chez ${comp} : la date de début semble après la date de fin. Peux-tu me repréciser les bonnes dates ?`
            });
          }
        }
      }

      // Détection des doublons d'expériences
      totalChecks += experiences.length;
      for (let i = 0; i < experiences.length; i++) {
        for (let j = i + 1; j < experiences.length; j++) {
          const expA = experiences[i];
          const expB = experiences[j];
          const compA = this.normalizeStr(expA.company);
          const compB = this.normalizeStr(expB.company);
          const posA = this.normalizeStr(expA.position);
          const posB = this.normalizeStr(expB.position);

          if (compA && compB && compA === compB && posA === posB) {
            anomalies.push({
              id: `dup_exp_${i}_${j}`,
              type: 'DUPLICATE',
              severity: 'WARNING',
              field: `experiences[${j}]`,
              title: `Expérience en doublon (${expA.company})`,
              message: `Le poste "${expA.position}" chez ${expA.company} apparaît deux fois dans le CV.`,
              suggestedQuestion: `J'ai le poste de ${expA.position} chez ${expA.company} mentionné deux fois. S'agissait-il de deux contrats différents ou d'une répétition ?`
            });
          }
        }
      }

      // Détection des chevauchements d'expériences (Overlaps)
      totalChecks += parsedRanges.length;
      for (let i = 0; i < parsedRanges.length; i++) {
        for (let j = i + 1; j < parsedRanges.length; j++) {
          const rA = parsedRanges[i].range;
          const rB = parsedRanges[j].range;
          if (!rA || !rB) continue;

          // Vérifier si chevauchement significatif (> 2 mois)
          if (this.rangesOverlap(rA, rB)) {
            const expA = parsedRanges[i].exp;
            const expB = parsedRanges[j].exp;
            const periodA = `${expA.startDate || ''} - ${expA.endDate || 'Présent'}`;
            const periodB = `${expB.startDate || ''} - ${expB.endDate || 'Présent'}`;

            anomalies.push({
              id: `overlap_${i}_${j}`,
              type: 'OVERLAP',
              severity: 'WARNING',
              field: `experiences[${i},${j}]`,
              title: `Expériences qui se chevauchent`,
              message: `"${expA.position}" chez ${expA.company} (${periodA}) et "${expB.position}" chez ${expB.company} (${periodB}) se déroulent simultanément.`,
              suggestedQuestion: `J'ai remarqué que tes postes chez ${expA.company} et ${expB.company} se chevauchent dans le temps. Était-ce un cumul en freelance / temps partiel, ou s'agit-il d'un décalage de dates ?`
            });
          }
        }
      }
    }

    // ── 4. Analyse des Formations & Études (Education) ─────────────────────
    const education: any[] = Array.isArray(draft.education) ? draft.education : [];
    totalChecks += 2;
    if (education.length === 0) {
      anomalies.push({
        id: 'no_education',
        type: 'INCOMPLETE',
        severity: 'SUGGESTION',
        field: 'education',
        title: 'Formations académiques non renseignées',
        message: 'Le CV ne comporte pas encore de diplôme ou de formation.',
        suggestedQuestion: 'Quel est ton dernier diplôme ou la formation qui a lancé ta carrière ?'
      });
    } else {
      for (let i = 0; i < education.length; i++) {
        const edu = education[i];
        totalChecks += 2;
        if (!edu.year && !edu.startDate && !edu.endDate) {
          anomalies.push({
            id: `edu_${i}_no_year`,
            type: 'INCOMPLETE',
            severity: 'WARNING',
            field: `education[${i}].year`,
            title: `Année manquante pour le diplôme (${edu.school || 'École'})`,
            message: `La formation "${edu.degree || 'Diplôme'}" chez ${edu.school || 'l\'établissement'} n'a pas d'année d'obtention.`,
            suggestedQuestion: `En quelle année as-tu obtenu ton diplôme chez ${edu.school || 'cette école'} ?`
          });
        }
      }
    }

    // ── Calcul du score global de cohérence (0 à 100) ──────────────────────
    let penalty = 0;
    for (const anom of anomalies) {
      if (anom.severity === 'CRITICAL') penalty += 30;
      else if (anom.severity === 'WARNING') penalty += 15;
      else if (anom.severity === 'SUGGESTION') penalty += 5;
    }
    const score = Math.max(20, Math.min(100, 100 - penalty));

    let summary = 'Le CV est parfaitement cohérent et prêt à être finalisé.';
    if (anomalies.length > 0) {
      const topIssue = anomalies[0];
      summary = `${anomalies.length} point(s) d'attention détecté(s). Point principal : ${topIssue.title}.`;
    }

    return {
      score,
      totalChecks,
      anomaliesCount: anomalies.length,
      anomalies,
      summary
    };
  }

  // ── Helpers Privés ────────────────────────────────────────────────────────

  private parseDateRange(startRaw?: string, endRaw?: string): ParsedDateRange | null {
    if (!startRaw && !endRaw) return null;

    const startYear = this.extractYear(startRaw);
    if (!startYear) return null;

    const startMonth = this.extractMonth(startRaw) || 1;

    let endYear = this.extractYear(endRaw);
    let endMonth = this.extractMonth(endRaw) || 12;
    const isCurrent = this.isCurrentIndicator(endRaw);

    if (isCurrent || !endYear) {
      const currentYear = new Date().getFullYear();
      endYear = currentYear;
      endMonth = new Date().getMonth() + 1;
    }

    return {
      startYear,
      startMonth,
      endYear,
      endMonth,
      isCurrent,
      rawStart: startRaw || '',
      rawEnd: endRaw || ''
    };
  }

  private extractYear(str?: string): number | null {
    if (!str) return null;
    const match = str.match(/\b(19\d{2}|20\d{2})\b/);
    return match ? parseInt(match[1], 10) : null;
  }

  private extractMonth(str?: string): number | null {
    if (!str) return null;
    const lower = str.toLowerCase();

    // Mois en chiffres : 01/2022 ou 2022-05
    const numMatch = lower.match(/(?:^|[^\d])(0?[1-9]|1[0-2])[\/\-.](?:19\d{2}|20\d{2})/);
    if (numMatch) return parseInt(numMatch[1], 10);

    const monthNames = [
      ['jan', 'janv', 'janvier'],
      ['fev', 'fév', 'fevr', 'février', 'feb'],
      ['mar', 'mars', 'march'],
      ['avr', 'avril', 'apr', 'april'],
      ['mai', 'may'],
      ['juin', 'june'],
      ['juil', 'juill', 'juillet', 'july'],
      ['aou', 'août', 'aout', 'aug', 'august'],
      ['sep', 'sept', 'septembre', 'september'],
      ['oct', 'octobre', 'october'],
      ['nov', 'novembre', 'november'],
      ['dec', 'déc', 'décembre', 'december']
    ];

    for (let i = 0; i < monthNames.length; i++) {
      for (const prefix of monthNames[i]) {
        if (lower.includes(prefix)) {
          return i + 1;
        }
      }
    }

    return null;
  }

  private isCurrentIndicator(str?: string): boolean {
    if (!str) return false;
    const s = str.toLowerCase();
    return s.includes('présent') || s.includes('present') || s.includes('actuel') || s.includes('cours') || s.includes('today') || s.includes('now');
  }

  private rangesOverlap(a: ParsedDateRange, b: ParsedDateRange): boolean {
    const startA = a.startYear * 12 + a.startMonth;
    const endA = a.endYear * 12 + a.endMonth;
    const startB = b.startYear * 12 + b.startMonth;
    const endB = b.endYear * 12 + b.endMonth;

    // Détection d'intersection d'intervalles [startA, endA] et [startB, endB]
    const overlapStart = Math.max(startA, startB);
    const overlapEnd = Math.min(endA, endB);

    // Chevauchement significatif si au moins 2 mois d'intersection
    return overlapEnd - overlapStart >= 2;
  }

  private normalizeStr(str?: string): string {
    if (!str) return '';
    return str.toLowerCase().replace(/[^a-z0-9]/g, '').trim();
  }

  private normalizeSkill(skill: string): string {
    const s = skill.toLowerCase().trim();
    return s
      .replace(/\.js$/, '')
      .replace(/js$/, '')
      .replace(/[\s\-_.]/g, '');
  }
}
