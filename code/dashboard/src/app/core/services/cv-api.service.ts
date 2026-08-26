import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Cv, CvTemplateOption } from '../models/cv.model';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class CvApiService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}`;

  getCvs(): Observable<Cv[]> {
    return this.http.get<Cv[]>(`${this.base}/cvs`);
  }

  getCv(id: string): Observable<Cv | null> {
    return this.http.get<Cv | null>(`${this.base}/cvs/${id}`);
  }

  createCv(cv: Partial<Cv>): Observable<Cv> {
    return this.http.post<Cv>(`${this.base}/cvs`, cv);
  }

  deleteCv(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/cvs/${id}`);
  }

  getTemplates(): Observable<CvTemplateOption[]> {
    return this.http.get<CvTemplateOption[]>(`${this.base}/cv-templates`);
  }

  saveDraft(id: string, draft: any): Observable<Cv> {
    return this.http.put<Cv>(`${this.base}/cvs/${id}/draft`, draft);
  }

  aiEdit(id: string, prompt: string, currentData: any): Observable<Cv> {
    return this.http.post<Cv>(`${this.base}/cvs/${id}/ai-edit`, { prompt, currentData });
  }

  importCv(file: File): Observable<Cv> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<Cv>(`${this.base}/cvs/import`, formData);
  }
}
