import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { StructureResponse, Announcement } from '../models';

@Injectable({
  providedIn: 'root'
})
export class OrganizationService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/organizations`;

  getStructure(orgId: string): Observable<StructureResponse> {
    return this.http.get<StructureResponse>(`${this.apiUrl}/${orgId}/structure`);
  }

  getAnnouncements(): Observable<{ success: boolean; count: number; announcements: Announcement[] }> {
    return this.http.get<{ success: boolean; count: number; announcements: Announcement[] }>(`${environment.apiUrl}/announcements`);
  }
}
