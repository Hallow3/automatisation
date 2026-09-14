import { Type } from '@angular/core';
import { CvTemplateComponent } from './cv-template.contract';
import { ModernTemplateComponent } from './modern-template/modern-template.component';
import { ClassicTemplateComponent } from './classic-template/classic-template.component';

export type TemplateKey = 'modern' | 'classic';

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
 * Limité strictement à 2 templates d'exception :
 * 1. modern  : Modèle 2 colonnes avec en-tête immersif et badges modernes
 * 2. classic : Modèle 1 colonne sobre et élégant, 100% optimisé ATS
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
  }
};

export const AVAILABLE_TEMPLATES: TemplateDefinition[] = [
  TEMPLATE_REGISTRY.modern,
  TEMPLATE_REGISTRY.classic
];

/**
 * Résout le composant à partir d'un identifiant, avec compatibilité ascendante
 * pour les anciens alias (ex: 'moderne' -> 'modern', 'classique' -> 'classic').
 */
export function resolveTemplateComponent(templateId?: string | null): Type<CvTemplateComponent> {
  const normalized = (templateId || '').toLowerCase().trim();

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
 * Résout la clé de template normalisée ('modern' | 'classic')
 */
export function normalizeTemplateKey(templateId?: string | null): TemplateKey {
  const normalized = (templateId || '').toLowerCase().trim();
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
