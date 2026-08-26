import type { CvDocument, CvTemplate } from '../types';

export const cvs: CvDocument[] = [
{
  id: 'cv-01',
  title: 'CV Design System — 2026',
  template: 'Rigueur',
  accent: '#2563eb',
  pages: 2,
  createdAt: '4 juillet 2026',
  updatedAt: '20 août 2026',
  usedIn: 4,
  isDefault: true
},
{
  id: 'cv-02',
  title: 'CV Senior — Architecture',
  template: 'Colonne',
  accent: '#0f766e',
  pages: 2,
  createdAt: '28 juin 2026',
  updatedAt: '16 août 2026',
  usedIn: 2,
  isDefault: false
},
{
  id: 'cv-03',
  title: 'CV Produit — Startup',
  template: 'Compact',
  accent: '#b45309',
  pages: 1,
  createdAt: '12 juin 2026',
  updatedAt: '9 août 2026',
  usedIn: 3,
  isDefault: false
},
{
  id: 'cv-04',
  title: 'CV Polyvalent — Full-Stack',
  template: 'Éditorial',
  accent: '#4f46e5',
  pages: 2,
  createdAt: '2 mai 2026',
  updatedAt: '14 août 2026',
  usedIn: 1,
  isDefault: false
}];


export const cvTemplates: CvTemplate[] = [
{
  id: 'tpl-rigueur',
  name: 'Rigueur',
  pages: 2,
  description: 'Mise en page sobre sur une colonne, adaptée aux candidatures grands comptes et aux ATS.',
  accent: '#2563eb',
  layout: 'classic'
},
{
  id: 'tpl-colonne',
  name: 'Colonne',
  pages: 2,
  description: 'Bandeau latéral pour les compétences et les langues, contenu principal à droite.',
  accent: '#0f766e',
  layout: 'sidebar'
},
{
  id: 'tpl-compact',
  name: 'Compact',
  pages: 1,
  description: 'Une seule page, densité élevée. Recommandé pour les profils très ciblés.',
  accent: '#b45309',
  layout: 'compact'
},
{
  id: 'tpl-editorial',
  name: 'Éditorial',
  pages: 2,
  description: 'Hiérarchie typographique marquée, davantage d’espace pour le résumé et les projets.',
  accent: '#4f46e5',
  layout: 'editorial'
}];