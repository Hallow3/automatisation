import { HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { of, delay } from 'rxjs';
import { Opportunity, OpportunityStatus, ApplicationChannel } from '../models/opportunity.model';

const MOCK_OPPORTUNITIES: Opportunity[] = [
  {
    id: 'opt_1',
    jobOfferId: 'job_101',
    title: 'Senior Frontend Engineer (Angular)',
    company: 'TechCorp SaaS',
    city: 'Paris (Hybride)',
    source: 'LinkedIn',
    score: 92,
    status: OpportunityStatus.READY_TO_APPLY,
    publishedAt: '2026-08-08T10:00:00Z',
    applicationChannel: ApplicationChannel.ATS_URL,
    coverLetterAvailable: true,
    matchedSkills: ['Angular 18', 'TypeScript', 'Tailwind CSS', 'RxJS'],
    matchExplanation: 'Correspondance excellente avec votre expertise Lead Angular et votre maîtrise des architectures front-end.',
    description: 'Nous recherchons un Senior Frontend Engineer pour mener à bien la refonte de notre Dashboard client.'
  },
  {
    id: 'opt_2',
    jobOfferId: 'job_102',
    title: 'Développeur Fullstack TS',
    company: 'InnovStartup',
    city: 'Remote',
    source: 'Welcome to the Jungle',
    score: 85,
    status: OpportunityStatus.QUALIFIED,
    publishedAt: '2026-08-07T14:30:00Z',
    applicationChannel: ApplicationChannel.EMAIL,
    coverLetterAvailable: false,
    matchedSkills: ['TypeScript', 'Node.js', 'Angular'],
    matchExplanation: 'Très bon fit technique sur la stack TypeScript. Expérience cloud AWS appréciée.',
    description: 'Rejoignez notre équipe produit pour développer de nouvelles fonctionnalités.'
  },
  {
    id: 'opt_3',
    jobOfferId: 'job_103',
    title: 'Lead Dev UI',
    company: null,
    city: 'Lyon',
    source: 'Indeed',
    score: 75,
    status: OpportunityStatus.NEW,
    publishedAt: '2026-08-09T08:00:00Z',
    applicationChannel: ApplicationChannel.MANUAL,
    coverLetterAvailable: false,
    matchedSkills: ['Design System', 'UI/UX', 'Tailwind'],
    matchExplanation: "L'offre correspond à vos compétences en design system, bien que le rôle semble plus orienté intégration pure.",
    description: "Vous serez en charge de l'intégration de nos maquettes et du maintien de notre UI kit."
  }
];

// Mutable copy for state changes during the session
let mockData = MOCK_OPPORTUNITIES.map(o => ({ ...o }));

function respond<T>(body: T, latency = 600) {
  return of(new HttpResponse({ status: 200, body })).pipe(delay(latency));
}

export const mockApiInterceptor: HttpInterceptorFn = (req, next) => {
  const url = req.url;

  // GET /api/v1/opportunities
  if (req.method === 'GET' && url.match(/\/api\/v1\/opportunities$/)) {
    return respond([...mockData], 800);
  }

  // GET /api/v1/opportunities/:id
  if (req.method === 'GET' && url.match(/\/api\/v1\/opportunities\/[^/]+$/)) {
    const id = url.split('/').pop()!;
    const opp = mockData.find(o => o.id === id);
    return respond(opp ?? null);
  }

  // POST /api/v1/opportunities/:id/dismiss
  if (req.method === 'POST' && url.match(/\/api\/v1\/opportunities\/[^/]+\/dismiss$/)) {
    const id = url.split('/').at(-2)!;
    mockData = mockData.filter(o => o.id !== id);
    return respond({ success: true }, 400);
  }

  // POST /api/v1/opportunities/:id/prepare
  if (req.method === 'POST' && url.match(/\/api\/v1\/opportunities\/[^/]+\/prepare$/)) {
    const id = url.split('/').at(-2)!;
    const idx = mockData.findIndex(o => o.id === id);
    if (idx !== -1) {
      mockData[idx] = { ...mockData[idx], status: OpportunityStatus.PREPARING };
      // Simulate async preparation completing after 3s
      setTimeout(() => {
        const i = mockData.findIndex(o => o.id === id);
        if (i !== -1) {
          mockData[i] = { ...mockData[i], status: OpportunityStatus.READY_TO_APPLY, coverLetterAvailable: true };
        }
      }, 3000);
    }
    return respond({ success: true }, 400);
  }

  // POST /api/v1/opportunities/:id/submit
  if (req.method === 'POST' && url.match(/\/api\/v1\/opportunities\/[^/]+\/submit$/)) {
    const id = url.split('/').at(-2)!;
    const idx = mockData.findIndex(o => o.id === id);
    if (idx !== -1) {
      mockData[idx] = { ...mockData[idx], status: OpportunityStatus.APPLIED };
    }
    return respond({ success: true }, 800);
  }

  return next(req);
};
