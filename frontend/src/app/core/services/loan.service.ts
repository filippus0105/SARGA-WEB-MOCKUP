import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { LoanStatus, LoanTransaction } from '../models';

export interface CreateLoanPayload {
  itemId: string;
  expectedReturnDate: string;
  purpose: string;
}

export interface LoanListResponse {
  success: boolean;
  count: number;
  loans: LoanTransaction[];
  message?: string;
}

export interface LoanResponse {
  success: boolean;
  loan: LoanTransaction;
  message?: string;
}

@Injectable({
  providedIn: 'root'
})
export class LoanService {
  private http = inject(HttpClient);
  private baseUrl = `${environment.apiUrl}/loans`;

  getMyLoans(status?: LoanStatus): Observable<LoanListResponse> {
    let params = new HttpParams();
    if (status) params = params.set('status', status);
    return this.http.get<LoanListResponse>(`${this.baseUrl}/me`, { params });
  }

  getOrganizationLoans(status?: LoanStatus, q?: string): Observable<LoanListResponse> {
    let params = new HttpParams();
    if (status) params = params.set('status', status);
    if (q) params = params.set('q', q);
    return this.http.get<LoanListResponse>(this.baseUrl, { params });
  }

  requestLoan(payload: CreateLoanPayload): Observable<LoanResponse> {
    return this.http.post<LoanResponse>(this.baseUrl, payload);
  }

  approveLoan(loanId: string): Observable<LoanResponse> {
    return this.http.patch<LoanResponse>(`${this.baseUrl}/${loanId}/approve`, {});
  }

  rejectLoan(loanId: string, rejectionReason: string): Observable<LoanResponse> {
    return this.http.patch<LoanResponse>(`${this.baseUrl}/${loanId}/reject`, { rejectionReason });
  }

  cancelLoan(loanId: string): Observable<LoanResponse> {
    return this.http.patch<LoanResponse>(`${this.baseUrl}/${loanId}/cancel`, {});
  }

  returnLoan(loanId: string, conditionNote?: string): Observable<LoanResponse> {
    const body = conditionNote?.trim() ? { conditionNote: conditionNote.trim() } : {};
    return this.http.patch<LoanResponse>(`${this.baseUrl}/${loanId}/return`, body);
  }
}
