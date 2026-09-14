import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Opportunity } from '../models/opportunity.model';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class OpportunityApiService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/opportunities`;

  getOpportunities(): Observable<Opportunity[]> {
    return this.http.get<Opportunity[]>(this.base);
  }

  getOpportunity(id: string): Observable<Opportunity | null> {
    return this.http.get<Opportunity | null>(`${this.base}/${id}`);
  }

  dismissOpportunity(id: string): Observable<{ success: boolean }> {
    return this.http.post<{ success: boolean }>(`${this.base}/${id}/dismiss`, {});
  }

  prepareApplication(id: string): Observable<{ success: boolean }> {
    return this.http.post<{ success: boolean }>(`${this.base}/${id}/prepare`, {});
  }

  submitApplication(id: string): Observable<{ success: boolean }> {
    return this.http.post<{ success: boolean }>(`${this.base}/${id}/submit`, {});
  }

  getCoverLetter(id: string): Observable<{ content?: string; status?: string; url?: string }> {
    return this.http.get<{ content?: string; status?: string; url?: string }>(`${this.base}/${id}/cover-letter`);
  }
}

