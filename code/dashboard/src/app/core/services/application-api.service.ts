import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Application } from '../models/application.model';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class ApplicationApiService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/applications`;

  getApplications(): Observable<Application[]> {
    return this.http.get<Application[]>(this.base);
  }

  getApplication(id: string): Observable<Application | null> {
    return this.http.get<Application | null>(`${this.base}/${id}`);
  }
}
