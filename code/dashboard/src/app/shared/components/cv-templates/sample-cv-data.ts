import { CvData } from '../cv-preview/cv-preview.component';

/**
 * Jeu de données de démonstration riche et réaliste : Ingénieur en Génie Civil & BTP.
 * Utilisé pour alimenter les prévisualisations de la galerie et garantir que les templates
 * s'affichent toujours avec une structure A4 complète, vivante et professionnelle.
 */
export const SAMPLE_CIVIL_ENGINEER_CV: CvData = {
  name: 'Alexandre Mendy',
  title: 'Ingénieur Génie Civil & Chef de Projet BTP',
  email: 'alexandre.mendy@email.fr',
  phone: '+33 6 42 18 90 35',
  city: 'Lyon, France',
  summary: 'Ingénieur en génie civil avec 6 années d’expérience dans le pilotage de chantiers d’infrastructures et d’ouvrages d’art complexes. Expert en calcul de structures béton armé et métallique aux Eurocodes, coordination tout corps d’état et modélisation BIM. Reconnu pour sa rigueur technique, le respect des plannings et la sécurité.',
  experiences: [
    {
      role: 'Ingénieur Travaux Principal',
      company: 'Eiffage Génie Civil',
      period: '2021 — Présent',
      city: 'Lyon',
      description: 'Pilotage de la construction d’un viaduc autoroutier et d’aménagements urbains (budget : 14 M€).',
      bullets: [
        'Supervision quotidienne des équipes travaux (35 compagnons, 4 chefs de chantier)',
        'Contrôle de la conformité des ferraillages, coulage du béton et validation des essais géotechniques',
        'Optimisation du phasage de chantier réduisant les délais de livraison de 3 semaines',
        'Garant du respect strict des protocoles HSE (zéro accident avec arrêt sur 18 mois)'
      ]
    },
    {
      role: 'Ingénieur d’Études Structures',
      company: 'Setec TPI',
      period: '2018 — 2021',
      city: 'Paris',
      description: 'Conception et calculs d’ouvrages d’art et de bâtiments tertiaires de grande hauteur.',
      bullets: [
        'Dimensionnement aux Eurocodes (EC2, EC3, EC8) sur Robot Structural Analysis',
        'Modélisation de maquettes numériques 3D sous Revit et coordination BIM',
        'Rédaction des notices techniques, CCTP et bordereaux quantitatifs prévisionnels'
      ]
    }
  ],
  education: [
    {
      degree: 'Diplôme d’Ingénieur en Génie Civil (Master 2)',
      school: 'INSA Lyon — Département Génie Civil & Urbanisme',
      year: '2018'
    },
    {
      degree: 'Classe Préparatoire aux Grandes Écoles (PSI*)',
      school: 'Lycée La Martinière Monplaisir',
      year: '2015'
    }
  ],
  skills: [
    'Calcul de structures (Eurocodes EC2/EC3/EC8)',
    'Robot Structural Analysis',
    'Revit BIM & AutoCAD 2D/3D',
    'Gestion de chantier & Sécurité HSE',
    'Planification MS Project & Primavera',
    'Béton armé & Construction métallique',
    'Suivi budgétaire & Marchés publics'
  ],
  languages: [
    { name: 'Français', level: 'Langue maternelle' },
    { name: 'Anglais', level: 'Courant professionnel (TOEIC 910)' }
  ],
  projects: [
    {
      name: 'Grand Paris Express — Ligne 15 Sud',
      detail: 'Étude d’exécution des parois moulées et boîtes de gare souterraine.'
    },
    {
      name: 'Ouvrage d’Art Franchissement Rhône',
      detail: 'Coordination technique et recalage structurel en phase exécution.'
    }
  ],
  accent: '#2563eb'
};
