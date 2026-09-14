import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface CandidateProfile {
  candidateId?: number;
  fullName: string;
  email: string;
  phone: string;
  city: string;
  headline: string;
  availability: string;
  experienceLevel: string;
  salaryExpectations: string;
  contractTypes: string[];
  targetLocations: string[];
  remotePreference: string;
  mobility: string;
  skills: string[];
  aiInstructions: string;
  notifications?: {
    emailNewOpportunities?: boolean;
    emailWeeklyReport?: boolean;
    interviewReminders?: boolean;
  };
  proCredits?: number;
  isProAgent?: boolean;
  agentShopName?: string;
}

@Injectable({
  providedIn: 'root'
})
export class CandidateProfileApiService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/candidate/profile`;

  getProfile(): Observable<CandidateProfile> {
    return this.http.get<CandidateProfile>(this.apiUrl);
  }

  updateProfile(profile: Partial<CandidateProfile>): Observable<CandidateProfile> {
    return this.http.put<CandidateProfile>(this.apiUrl, profile);
  }
}
