import type { ActivityItem } from '../types';

export const activity: ActivityItem[] = [
{
  id: 'act-1',
  type: 'opportunite',
  label: '7 nouvelles opportunités détectées',
  detail: 'Recherche « Front-End Senior · Île-de-France »',
  time: 'Il y a 12 min',
  automated: true
},
{
  id: 'act-2',
  type: 'lettre',
  label: 'Lettre de motivation générée',
  detail: 'Alvéa Technologies — Développeur Front-End Senior',
  time: 'Il y a 48 min',
  automated: true
},
{
  id: 'act-3',
  type: 'candidature',
  label: 'Candidature envoyée',
  detail: 'Sillage — Front-End Engineer, envoyée par email',
  time: 'Hier, 17:24',
  automated: false
},
{
  id: 'act-4',
  type: 'entretien',
  label: 'Entretien confirmé',
  detail: 'Fidelis Assurance — visio le 26 août à 14h00',
  time: 'Hier, 11:03',
  automated: false
},
{
  id: 'act-5',
  type: 'cv',
  label: 'CV mis à jour',
  detail: 'CV Design System — 2026, section expériences',
  time: '20 août',
  automated: false
},
{
  id: 'act-6',
  type: 'opportunite',
  label: '3 opportunités qualifiées',
  detail: 'Score supérieur à 80 % sur vos critères',
  time: '20 août',
  automated: true
}];


export const automations = {
  activeWorkflows: 3,
  workflows: [
  { name: 'Front-End Senior · Île-de-France', sources: 'LinkedIn, APEC', frequency: 'Toutes les 4 h', active: true },
  { name: 'Lead / Architecte · Full remote', sources: 'WTTJ, Indeed', frequency: 'Quotidien', active: true },
  { name: 'Design System · France', sources: 'LinkedIn', frequency: 'Quotidien', active: false }],

  lastScan: 'Aujourd’hui à 09:42',
  importedToday: 14,
  documentQueue: { label: '1 lettre en cours de génération', progress: 62 }
};

export const profile = {
  firstName: 'Léa',
  lastName: 'Bertrand',
  title: 'Développeuse Front-End Senior',
  email: 'lea.bertrand@email.fr',
  phone: '+33 6 21 44 87 03',
  city: 'Paris',
  seniority: '6 – 8 ans',
  targetRoles: ['Développeur Front-End Senior', 'Lead Front-End', 'Ingénieur Design System'],
  locations: ['Paris', 'Île-de-France', 'Full remote France'],
  skills: ['React', 'TypeScript', 'Design system', 'Tailwind CSS', 'Accessibilité', 'Tests', 'Node.js', 'Figma'],
  languages: [
  { name: 'Français', level: 'Langue maternelle' },
  { name: 'Anglais', level: 'Courant — C1' },
  { name: 'Espagnol', level: 'Intermédiaire — B1' }],

  links: [
  { label: 'LinkedIn', value: 'linkedin.com/in/leabertrand' },
  { label: 'GitHub', value: 'github.com/leabertrand' },
  { label: 'Portfolio', value: 'lea-bertrand.fr' }],

  experiences: [
  {
    role: 'Développeuse Front-End Senior',
    company: 'Orlin Software',
    period: '2022 — aujourd’hui',
    city: 'Paris',
    description:
    'Pilotage du design system utilisé par 5 équipes produit. Refonte de l’espace client (React, TypeScript), amélioration des performances et de l’accessibilité.'
  },
  {
    role: 'Développeuse Front-End',
    company: 'Maelis Digital',
    period: '2019 — 2022',
    city: 'Paris',
    description:
    'Développement d’applications métier pour le secteur de l’assurance. Mise en place des tests end-to-end et de la chaîne de déploiement front.'
  },
  {
    role: 'Développeuse Web',
    company: 'Studio Ravel',
    period: '2018 — 2019',
    city: 'Nantes',
    description: 'Intégration et développement de sites clients, accompagnement des équipes design.'
  }],

  education: [
  { degree: 'Master Informatique — Génie logiciel', school: 'Université de Nantes', period: '2016 — 2018' },
  { degree: 'Licence Informatique', school: 'Université de Nantes', period: '2013 — 2016' }],

  projects: [
  { name: 'Kit UI open source', detail: '32 composants React accessibles, 1 200 étoiles sur GitHub' },
  { name: 'Conférence Paris Web', detail: 'Intervention sur la maintenance des design systems' }],

  preferences: {
    contract: 'CDI',
    rhythm: 'Hybride ou full remote',
    salary: '60 – 70 k€',
    availability: 'Sous 2 mois'
  }
};