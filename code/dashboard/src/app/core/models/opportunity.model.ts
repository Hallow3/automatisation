export enum OpportunityStatus {
  NEW = 'NEW',
  QUALIFIED = 'QUALIFIED',
  PREPARING = 'PREPARING',
  READY_TO_APPLY = 'READY_TO_APPLY',
  APPLIED = 'APPLIED',
  REJECTED = 'REJECTED',
  IGNORED = 'IGNORED'
}

export enum ApplicationChannel {
  EMAIL = 'EMAIL',
  ATS_URL = 'ATS_URL',
  MANUAL = 'MANUAL'
}

export interface Opportunity {
  id: string;
  jobOfferId: string;
  title: string;
  company: string | null;
  city: string | null;
  source: string;
  score: number | null;
  status: OpportunityStatus;
  publishedAt?: string | null;
  deadline?: string | null;
  applicationChannel?: ApplicationChannel;
  coverLetterAvailable: boolean;
  coverLetterText?: string;
  matchedSkills: string[];

  matchExplanation?: string | null;
  description?: string;
}
