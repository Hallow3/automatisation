import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface InterviewSessionResponse {
  token: string;
  model: string;
  cvId?: string;
  proCredits?: string;
}

export interface CompleteInterviewResponse {
  cvId: string;
  status: string;
  updatedAt?: string;
}

export interface V2TurnResponse {
  sessionId: string;
  cvId: string;
  currentState: string;
  sectionIndex: number;
  turnsInSection: number;
  sectionStatus: string;
  interviewStatus: string;
  controlMessage: string;
  cvDataSoFar: any;
  completionScore: number;
  missingFields: string[];
  sectionTransitionOccurred: boolean;
}

export interface V2RequestEndResponse {
  approved: boolean;
  reason: string;
  status: string;
  instruction: string;
}

@Injectable({
  providedIn: 'root'
})
export class CvInterviewApiService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/cvs`;

  createSession(cvId: string): Observable<InterviewSessionResponse> {
    return this.http.post<InterviewSessionResponse>(`${this.base}/${cvId}/interview/session`, {});
  }

  initOrResumeV2Session(cvId: string): Observable<V2TurnResponse> {
    return this.http.post<V2TurnResponse>(`${this.base}/${cvId}/interview/v2/session`, {});
  }

  syncTurnV2(cvId: string, payload: { sessionId: string; userTurn?: string; aiTurn?: string }): Observable<V2TurnResponse> {
    return this.http.post<V2TurnResponse>(`${this.base}/${cvId}/interview/v2/turn`, payload);
  }

  requestEndInterviewV2(cvId: string, payload: { sessionId: string; reason: string; userIntentExcerpt: string; lastUserTurn?: string }): Observable<V2RequestEndResponse> {
    return this.http.post<V2RequestEndResponse>(`${this.base}/${cvId}/interview/v2/request-end`, payload);
  }

  saveDraft(cvId: string, draftData: any): Observable<any> {
    return this.http.put<any>(`${this.base}/${cvId}/draft`, draftData);
  }

  completeInterview(cvId: string): Observable<CompleteInterviewResponse> {
    return this.http.post<CompleteInterviewResponse>(`${this.base}/${cvId}/interview/complete`, {});
  }

  synthesize(cvId: string, transcript: string): Observable<any> {
    return this.http.post<any>(`${this.base}/${cvId}/synthesize`, { transcript });
  }

  refundAbortedSession(cvId: string): Observable<{ refunded: boolean }> {
    return this.http.post<{ refunded: boolean }>(`${this.base}/${cvId}/interview/refund-aborted`, {});
  }

  getCv(cvId: string): Observable<any> {
    return this.http.get<any>(`${this.base}/${cvId}`);
  }
}
