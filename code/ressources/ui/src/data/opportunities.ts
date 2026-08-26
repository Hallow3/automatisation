import type { Opportunity } from '../types';

export const opportunities: Opportunity[] = [
{
  id: 'opp-1041',
  title: 'Développeur Front-End Senior',
  company: 'Alvéa Technologies',
  city: 'Paris 9e',
  remote: 'Hybride · 2j / semaine',
  source: 'LinkedIn',
  score: 94,
  status: 'qualifiee',
  publishedAt: '2026-08-21',
  skills: ['React', 'TypeScript', 'Design system', 'Accessibilité'],
  explanation:
  "Votre expérience sur des design systems React et votre maîtrise de TypeScript couvrent l'essentiel des attentes du poste.",
  strengths: [
  '6 ans sur React / TypeScript, exactement le socle demandé',
  'Vous avez déjà piloté un design system multi-équipes',
  'Localisation et rythme hybride compatibles avec vos préférences'],

  gaps: [
  "L'offre mentionne du GraphQL, peu présent dans votre profil",
  'Management d’une équipe de 3 personnes souhaité'],

  hasContact: true,
  contact: { name: 'Camille Rousseau', role: 'Talent Acquisition', email: 'c.rousseau@alvea.io' },
  hasLetter: true,
  salary: '58 – 68 k€',
  contract: 'CDI',
  description:
  "Alvéa Technologies édite une plateforme SaaS de pilotage financier utilisée par 400 entreprises. L'équipe produit recherche un développeur front-end senior pour faire évoluer son design system et accompagner la refonte de l'espace client.",
  requirements: [
  '5 ans minimum en développement front-end',
  'Maîtrise de React, TypeScript et des outils de test',
  'Culture produit et sensibilité design',
  'Expérience sur une bibliothèque de composants partagée'],

  applyMethod: 'Candidature par email au contact recruteur'
},
{
  id: 'opp-1039',
  title: 'Lead Front-End Engineer',
  company: 'Norvia Santé',
  city: 'Lyon',
  remote: 'Full remote France',
  source: 'Welcome to the Jungle',
  score: 88,
  status: 'nouveau',
  publishedAt: '2026-08-21',
  skills: ['React', 'Node.js', 'Leadership', 'Design system'],
  explanation:
  'Bon recouvrement technique et poste ouvert au full remote, en cohérence avec vos critères de recherche.',
  strengths: ['Stack identique à votre poste actuel', 'Full remote conforme à vos préférences'],
  gaps: ['Secteur santé nouveau pour vous', 'Expérience de lead formalisée attendue'],
  hasContact: false,
  hasLetter: false,
  salary: '62 – 72 k€',
  contract: 'CDI',
  description:
  "Norvia Santé développe des outils de coordination pour les établissements de soins. Le poste consiste à encadrer une équipe front de 4 personnes et à structurer les pratiques techniques.",
  requirements: [
  'Expérience de lead technique ou de référent',
  'React, TypeScript, Node.js',
  'Goût pour la qualité et la revue de code'],

  applyMethod: 'Formulaire sur la plateforme d’origine'
},
{
  id: 'opp-1036',
  title: 'Ingénieur Front-End Produit',
  company: 'Kaptio',
  city: 'Bordeaux',
  remote: 'Hybride · 3j / semaine',
  source: 'Indeed',
  score: 81,
  status: 'prete',
  publishedAt: '2026-08-20',
  skills: ['React', 'Tailwind', 'Tests E2E'],
  explanation:
  'Le poste correspond à votre cœur de compétences, avec une exigence supplémentaire sur les tests end-to-end.',
  strengths: ['Environnement produit proche de votre expérience', 'Équipe réduite et autonome'],
  gaps: ['Présence sur site 3 jours par semaine', 'Playwright peu utilisé de votre côté'],
  hasContact: true,
  contact: { name: 'Julien Marchand', role: 'CTO', email: 'julien@kaptio.fr' },
  hasLetter: true,
  salary: '50 – 58 k€',
  contract: 'CDI',
  description:
  'Kaptio construit un outil de gestion de tournées pour les artisans. Vous rejoindrez une équipe de 12 personnes pour reprendre l’interface principale.',
  requirements: ['React et Tailwind au quotidien', 'Autonomie sur la mise en production', 'Tests automatisés'],
  applyMethod: 'Candidature via ATS'
},
{
  id: 'opp-1034',
  title: 'Développeur Full-Stack (React / Node)',
  company: 'Groupe Ternel',
  city: 'Nantes',
  remote: 'Sur site',
  source: 'APEC',
  score: 76,
  status: 'nouveau',
  publishedAt: '2026-08-20',
  skills: ['React', 'Node.js', 'PostgreSQL'],
  explanation:
  'Recouvrement correct côté front, mais la part back-end attendue dépasse votre expérience récente.',
  strengths: ['Stack React connue', 'Entreprise stable, équipe technique établie'],
  gaps: ['Poste sur site uniquement', 'Forte composante back-end'],
  hasContact: false,
  hasLetter: false,
  salary: '45 – 52 k€',
  contract: 'CDI',
  description:
  'Le Groupe Ternel modernise ses applications internes de logistique. Le poste est partagé entre évolutions front et services back.',
  requirements: ['React, Node.js, PostgreSQL', 'Travail en équipe pluridisciplinaire'],
  applyMethod: 'Candidature via ATS'
},
{
  id: 'opp-1031',
  title: 'Front-End Engineer — Design System',
  company: 'Sillage',
  city: 'Paris 2e',
  remote: 'Hybride · 2j / semaine',
  source: 'LinkedIn',
  score: 91,
  status: 'envoyee',
  publishedAt: '2026-08-19',
  skills: ['Design system', 'React', 'Accessibilité', 'Storybook'],
  explanation:
  'Poste centré design system, très proche de votre dernière mission, avec une exigence forte en accessibilité.',
  strengths: ['Spécialisation design system alignée', 'Exigence accessibilité que vous maîtrisez'],
  gaps: ['Processus de recrutement en 4 étapes'],
  hasContact: true,
  contact: { name: 'Awa Diallo', role: 'Engineering Manager', email: 'awa.diallo@sillage.com' },
  hasLetter: true,
  salary: '60 – 70 k€',
  contract: 'CDI',
  description:
  'Sillage accompagne les grands comptes dans la refonte de leurs interfaces. L’équipe plateforme maintient un design system utilisé par 30 développeurs.',
  requirements: ['Expérience design system', 'Storybook, tests visuels', 'RGAA / WCAG'],
  applyMethod: 'Candidature envoyée par email le 19 août'
},
{
  id: 'opp-1028',
  title: 'Développeur React Native',
  company: 'Movio',
  city: 'Lille',
  remote: 'Full remote France',
  source: 'Indeed',
  score: 63,
  status: 'ignoree',
  publishedAt: '2026-08-18',
  skills: ['React Native', 'TypeScript'],
  explanation: 'Le poste est orienté mobile, hors de votre axe de recherche déclaré.',
  strengths: ['Environnement TypeScript'],
  gaps: ['Mobile natif peu présent dans votre parcours', 'Hors de vos rôles cibles'],
  hasContact: false,
  hasLetter: false,
  salary: '45 – 55 k€',
  contract: 'CDI',
  description: 'Movio édite une application de mobilité urbaine disponible dans 12 villes françaises.',
  requirements: ['React Native', 'Publication sur les stores'],
  applyMethod: 'Formulaire sur la plateforme d’origine'
},
{
  id: 'opp-1026',
  title: 'Architecte Front-End',
  company: 'Fidelis Assurance',
  city: 'Paris La Défense',
  remote: 'Hybride · 2j / semaine',
  source: 'Site entreprise',
  score: 84,
  status: 'entretien',
  publishedAt: '2026-08-17',
  skills: ['Architecture', 'React', 'Micro-frontends'],
  explanation:
  'Votre profil couvre l’architecture composants ; le contexte micro-frontends reste à approfondir.',
  strengths: ['Séniorité attendue atteinte', 'Grand compte avec équipe front structurée'],
  gaps: ['Micro-frontends peu pratiqués', 'Environnement très normé'],
  hasContact: true,
  contact: { name: 'Pierre Vasseur', role: 'Responsable recrutement IT', email: 'p.vasseur@fidelis.fr' },
  hasLetter: true,
  salary: '70 – 80 k€',
  contract: 'CDI',
  description:
  'Fidelis Assurance réorganise ses parcours digitaux clients autour d’une architecture front commune à 6 équipes.',
  requirements: ['Vision architecture front', 'Accompagnement des équipes', 'Contexte grand compte'],
  applyMethod: 'Candidature via ATS — entretien planifié le 26 août'
},
{
  id: 'opp-1022',
  title: 'Développeur Front-End',
  company: 'Atelier Vertu',
  city: 'Toulouse',
  remote: 'Hybride · 1j / semaine',
  source: 'Welcome to the Jungle',
  score: 72,
  status: 'cloturee',
  publishedAt: '2026-08-15',
  skills: ['Vue.js', 'React', 'CSS'],
  explanation: 'Stack partiellement différente : l’équipe travaille principalement sous Vue.js.',
  strengths: ['Culture produit forte', 'Équipe à taille humaine'],
  gaps: ['Vue.js majoritaire', 'Niveau de séniorité inférieur à votre profil'],
  hasContact: false,
  hasLetter: false,
  salary: '42 – 48 k€',
  contract: 'CDI',
  description: 'Atelier Vertu conçoit des sites e-commerce pour des marques artisanales.',
  requirements: ['Vue.js ou React', 'Intégration soignée'],
  applyMethod: 'Poste pourvu — offre clôturée'
}];


export const getOpportunity = (id: string): Opportunity | undefined =>
opportunities.find((item) => item.id === id);