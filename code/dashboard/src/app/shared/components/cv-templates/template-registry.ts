import { Type } from '@angular/core';
import { CvTemplateComponent } from './cv-template.contract';
import { ModernTemplateComponent } from './modern-template/modern-template.component';
import { ClassicTemplateComponent } from './classic-template/classic-template.component';
import { OnyxTemplateComponent } from './onyx-template/onyx-template.component';

export type TemplateKey = 'modern' | 'classic' | 'onyx';

export interface TemplateDefinition {
  id: TemplateKey;
  name: string;
  badge: string;
  tag: string;
  description: string;
  accent: string;
  component: Type<CvTemplateComponent>;
  features: string[];
}

/**
 * Registre officiel des templates de CV.
 * 1. modern : Modèle 2 colonnes avec en-tête immersif et badges modernes
 * 2. classic : Modèle 1 colonne sobre et élégant, 100% optimisé ATS
 * 3. onyx : Modèle 2 colonnes asymétrique, monogramme + timeline
 */
export const TEMPLATE_REGISTRY: Record<TemplateKey, TemplateDefinition> = {
  modern: {
    id: 'modern',
    name: 'CV Moderne & Dynamique',
    badge: 'Recommandé',
    tag: 'Tech, Produit, Management & Cadres',
    description: 'En-tête immersif bicolore, structure équilibrée à 2 colonnes et mise en valeur percutante des compétences.',
    accent: '#2563eb',
    component: ModernTemplateComponent,
    features: ['En-tête bicolore soigné', '2 colonnes asymétriques', 'Badges de compétences']
  },
  classic: {
    id: 'classic',
    name: 'CV Classique & ATS',
    badge: 'Universel ATS',
    tag: 'Finance, Droit, Ingénierie & Tout profil',
    description: 'Typographie éditoriale intemporelle, agencement monocolonne linéaire et clarté absolue pour les recruteurs et robots ATS.',
    accent: '#0f172a',
    component: ClassicTemplateComponent,
    features: ['100% compatible robots ATS', 'Structure monocolonne aérée', 'Idéal profils confirmés & seniors']
  },
  onyx: {
    id: 'onyx',
    name: 'CV Onyx & Timeline',
    badge: 'Créatif',
    tag: 'Design, Marketing, Direction & Profils hybrides',
    description: 'Monogramme d’initiales, filet d’accent graphique et timeline verticale : une identité forte tout en restant lisible et imprimable.',
    accent: '#7c3aed',
    component: OnyxTemplateComponent,
    features: ['Monogramme & filet d’accent', 'Timeline verticale des expériences', 'Colonne latérale compétences / formation / langues']
  }
};

export const AVAILABLE_TEMPLATES: TemplateDefinition[] = [
  TEMPLATE_REGISTRY.modern,
  TEMPLATE_REGISTRY.classic,
  TEMPLATE_REGISTRY.onyx
];

/**
 * Résout le composant à partir d'un identifiant, avec compatibilité ascendante
 * pour les anciens alias (ex: 'moderne' -> 'modern', 'classique' -> 'classic').
 */
export function resolveTemplateComponent(templateId?: string | null): Type<CvTemplateComponent> {
  const normalized = (templateId || '').toLowerCase().trim();

  // Famille Onyx
  if (
    normalized === 'onyx' ||
    normalized === 'onyx-timeline' ||
    normalized === 'timeline'
  ) {
    return OnyxTemplateComponent;
  }

  // Famille Classique / ATS
  if (
    normalized === 'classic' ||
    normalized === 'classique' ||
    normalized === 'compact-ats' ||
    normalized === 'editorial-slate' ||
    normalized === 'nordic-minimal'
  ) {
    return ClassicTemplateComponent;
  }

  // Famille Moderne (défaut)
  return ModernTemplateComponent;
}

/**
 * Résout la clé de template normalisée ('modern' | 'classic' | 'onyx')
 */
export function normalizeTemplateKey(templateId?: string | null): TemplateKey {
  const normalized = (templateId || '').toLowerCase().trim();

  if (
    normalized === 'onyx' ||
    normalized === 'onyx-timeline' ||
    normalized === 'timeline'
  ) {
    return 'onyx';
  }

  if (
    normalized === 'classic' ||
    normalized === 'classique' ||
    normalized === 'compact-ats' ||
    normalized === 'editorial-slate' ||
    normalized === 'nordic-minimal'
  ) {
    return 'classic';
  }

  return 'modern';
}