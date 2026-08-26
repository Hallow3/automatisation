export interface Application {
  id: string;
  opportunityId: string;
  company: string;
  title: string;
  status: string;
  channel: string;
  appliedAt: string;
  lastActivityAt?: string;
}
