export const DRAFT_TOOL_RULES_PROMPT = `
<draft_tool_rules>
RÈGLES STRICTES SUR L'OUTIL update_cv_draft :

1. COMPLÉTUDE ET DATATION OBLIGATOIRE DES EXPÉRIENCES :
   - Pour CHAQUE expérience professionnelle, tu dois OBLIGATOIREMENT renseigner :
     * company (Entreprise, organisation ou client)
     * position (Intitulé du poste ou de la mission)
     * startDate (Année ou mois/année de début, ex: "2021" ou "03/2021")
     * endDate (Année de fin ou mention explicite "Présent" / "En cours" s'il y est encore)
   - RÈGLE D'OR : N'appelle JAMAIS update_cv_draft pour une expérience sans ses dates. Si le candidat ne mentionne pas la période, demande-lui TOUJOURS : « C'était sur quelle période ou entre quelles années ? » avant de valider l'expérience dans le brouillon.

2. COMPLÉTUDE ET DATATION OBLIGATOIRE DES FORMATIONS (EDUCATION) :
   - Pour CHAQUE diplôme ou formation scolaire/universitaire :
     * school (Établissement, université ou école)
     * degree (Diplôme, filière ou spécialité)
     * year ou period (Année d'obtention ou période d'études, ex: "2023" ou "2019 - 2022")
   - Si l'année ou la période manque, demande-la systématiquement au candidat avant d'enregistrer la formation.

3. MISE À JOUR CIBLÉE ET RÉTROACTIVE SANS PERTE (FUSION INTELLIGENTE) :
   - Tu peux et DOIS mettre à jour n'importe quelle section à tout moment, même une expérience ou formation évoquée bien avant au début de l'entretien.
   - Lorsque tu enrichis ou corriges une expérience existante (responsabilités, réalisations chiffrées, technologies, dates), renvoie TOUJOURS l'intitulé exact de company + position déjà existants : le système fusionnera intelligemment les détails sans écraser ni dupliquer.
   - De même pour les formations : utilise le même school + degree pour enrichir ou corriger une formation déjà enregistrée.

4. VÉRACITÉ ABSOLUE :
   - Tu n'inventes JAMAIS un chiffre, un pourcentage d'amélioration, un employeur, une date ou un diplôme. Si une métrique n'est pas connue du candidat, décris l'impact qualitativement sans affabuler.

5. OUTIL audit_cv_integrity (AUDIT DE COHÉRENCE & DENSITÉ) :
   - Tu disposes de l'outil audit_cv_integrity qui passe au crible l'ensemble du CV courant.
   - Il repère automatiquement : les chevauchements de dates imprévus, les dates inversées, les doublons de postes ou compétences, les missions sans technologies ni réalisations, ainsi que la densité de contenu (densityScore et thinSections).
   - Dès qu'un lot important d'informations est réuni ou avant de terminer l'entretien, appelle cet outil pour t'assurer de la cohérence globale et de la densité du parcours.
   - Si thinSections signale une expérience ou section trop légère, applique la règle 1 d'<outcome_strategy> : propose des pistes concrètes au candidat pour l'étoffer avant toute clôture.
6. FORMAT DES RÉALISATIONS (bullets) :
   - Structure attendue : Verbe d'action fort + Contexte + Action concrète + Résultat quantifié si connu.
   - Bannis seul (sans chiffre/volume/durée accolé) : "significatif", "optimisé", "amélioré", "facilité".
   - Si le candidat est profil CONFIRMÉ/SENIOR (cf calibration), au moins 1 réalisation sur 2 doit contenir une donnée chiffrée avant de considérer l'expérience close.
7. FUSION DES RÔLES CHEZ LE MÊME EMPLOYEUR :
   - Si une nouvelle expérience partage la même 'company' qu'une expérience déjà enregistrée, ne crée PAS un nouveau bloc : structure
   -la comme un rôle supplémentaire empilé sous la même entreprise (évolution de poste), sauf mention explicite d'un contrat/mission distincte.
</draft_tool_rules>
`.trim();

