export type OpportunityStatus =
'nouveau' |
'qualifiee' |
'prete' |
'envoyee' |
'entretien' |
'cloturee' |
'ignoree';

export type ApplicationStatus =
'brouillon' |
'qualifiee' |
'prete' |
'envoyee' |
'reponse' |
'entretien' |
'cloturee';

export type Source = 'LinkedIn' | 'Indeed' | 'Welcome to the Jungle' | 'APEC' | 'Site entreprise';

export type Channel = 'Email' | 'ATS' | 'Manuel';

export interface Opportunity {
  id: string;
  title: string;
  company: string;
  city: string;
  remote: string;
  source: Source;
  score: number;
  status: OpportunityStatus;
  publishedAt: string;
  skills: string[];
  explanation: string;
  strengths: string[];
  gaps: string[];
  hasContact: boolean;
  contact?: {name: string;role: string;email: string;};
  hasLetter: boolean;
  salary: string;
  contract: string;
  description: string;
  requirements: string[];
  applyMethod: string;
}

export interface Application {
  id: string;
  opportunityId: string;
  title: string;
  company: string;
  city: string;
  source: Source;
  score: number;
  status: ApplicationStatus;
  preparedAt: string;
  sentAt: string | null;
  cv: string;
  hasLetter: boolean;
  channel: Channel;
  nextStep: string;
}

export interface CvDocument {
  id: string;
  title: string;
  template: string;
  accent: string;
  pages: number;
  createdAt: string;
  updatedAt: string;
  usedIn: number;
  isDefault: boolean;
}

export interface CvTemplate {
  id: string;
  name: string;
  pages: number;
  description: string;
  accent: string;
  layout: 'classic' | 'sidebar' | 'compact' | 'editorial';
}

export interface ActivityItem {
  id: string;
  type: 'opportunite' | 'cv' | 'lettre' | 'candidature' | 'entretien';
  label: string;
  detail: string;
  time: string;
  automated: boolean;
}