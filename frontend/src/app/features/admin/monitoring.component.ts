import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnDestroy, effect, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { LoanTransaction } from '../../core/models';
import { AuthService } from '../../core/services/auth.service';
import { LoanService } from '../../core/services/loan.service';
import { AlertComponent } from '../../shared/alert/alert.component';
import { StatusBadgeComponent } from '../../shared/status-badge/status-badge.component';
import { ToastService } from '../../shared/toast/toast.service';
import { AdminNavComponent } from './admin-nav.component';
import { MonitoringLoanModalComponent } from './monitoring-loan-modal.component';

type MonitoringFilter =
  | 'ALL'
  | 'MENUNGGU'
  | 'AKTIF'
  | 'TERLAMBAT'
  | 'SELESAI'
  | 'DITOLAK'
  | 'DIBATALKAN';

@Component({
  selector: 'app-admin-monitoring',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    AlertComponent,
    StatusBadgeComponent,
    AdminNavComponent,
    MonitoringLoanModalComponent
  ],
  templateUrl: './monitoring.component.html'
})
export class MonitoringComponent implements OnDestroy {
  readonly authService = inject(AuthService);
  private readonly loanService = inject(LoanService);
  private readonly toastService = inject(ToastService);

  private loansSub?: Subscription;
  private lastLoadedOrgId = '';

  readonly statusTabs: ReadonlyArray<{ key: MonitoringFilter; label: string }> = [
    { key: 'ALL', label: 'Semua' },
    { key: 'MENUNGGU', label: 'Menunggu' },
    { key: 'AKTIF', label: 'Berjalan' },
    { key: 'TERLAMBAT', label: 'Terlambat' },
    { key: 'SELESAI', label: 'Selesai' },
    { key: 'DITOLAK', label: 'Ditolak' },
    { key: 'DIBATALKAN', label: 'Dibatalkan' }
  ];

  loans: LoanTransaction[] = [];
  searchQuery = '';
  statusFilter: MonitoringFilter = 'ALL';
  loading = false;
  errorMessage = '';

  selectedLoan: LoanTransaction | null = null;
  actionBusy = false;
  modalError = '';

  constructor() {
    effect(() => {
      const membership = this.authService.activeMembership();
      const orgId = membership?.orgId || '';
      if (orgId && membership?.role === 'ADMIN' && orgId !== this.lastLoadedOrgId) {
        this.lastLoadedOrgId = orgId;
        this.loadLoans();
      }
    });
  }

  get waitingAuth(): boolean {
    return this.authService.isAuthenticated() && !this.authService.currentUser();
  }

  get orgName(): string {
    return this.authService.activeMembership()?.organization?.name || 'organisasi aktif';
  }

  get filteredLoans(): LoanTransaction[] {
    const q = this.searchQuery.trim().toLowerCase();
    return this.loans.filter(loan => {
      if (!this.matchesFilter(loan, this.statusFilter)) return false;
      if (!q) return true;
      const text = [
        loan.item?.name,
        loan.item?.code,
        loan.borrower?.fullName,
        loan.borrower?.waNumber,
        loan.owner?.fullName,
        loan.item?.owner?.fullName,
        loan.owner || loan.item?.owner ? '' : 'aset organisasi'
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return text.includes(q);
    });
  }

  countForFilter(filter: MonitoringFilter): number {
    return this.loans.filter(loan => this.matchesFilter(loan, filter)).length;
  }

  loadLoans(): void {
    this.loansSub?.unsubscribe();
    this.loading = true;
    this.errorMessage = '';
    this.loansSub = this.loanService.getOrganizationLoans().subscribe({
      next: res => {
        this.loans = res.loans || [];
        this.loading = false;
      },
      error: (err: HttpErrorResponse) => {
        this.loading = false;
        this.errorMessage = err.error?.message || 'Daftar transaksi gagal dimuat.';
      }
    });
  }

  isOverdue(loan: LoanTransaction): boolean {
    if (typeof loan.isOverdue === 'boolean') return loan.isOverdue;
    if (loan.status !== 'AKTIF') return false;
    const endDay = String(loan.endDate || '').slice(0, 10);
    const today = new Date().toISOString().slice(0, 10);
    return !!endDay && endDay < today;
  }

  reminderUrl(loan: LoanTransaction): string | null {
    const digits = (loan.borrower?.waNumber || '').replace(/\D/g, '');
    if (!digits) return null;
    const intl = digits.startsWith('62')
      ? digits
      : digits.startsWith('0')
        ? `62${digits.slice(1)}`
        : `62${digits}`;
    const itemName = loan.item?.name || 'barang';
    const text = `Halo ${loan.borrower?.fullName || 'Anggota'}, pengingat pengembalian ${itemName} (jatuh tempo ${this.formatDate(loan.endDate)}) di ${this.orgName}. Terima kasih.`;
    return `https://wa.me/${intl}?text=${encodeURIComponent(text)}`;
  }

  formatDate(value?: string): string {
    if (!value) return '—';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;
    return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  openLoanDetail(loan: LoanTransaction): void {
    this.selectedLoan = loan;
    this.modalError = '';
  }

  closeDetail(): void {
    this.selectedLoan = null;
    this.modalError = '';
  }

  confirmApprove(loanId: string): void {
    if (this.actionBusy) return;
    this.actionBusy = true;
    this.modalError = '';
    this.loanService.approveLoan(loanId).subscribe({
      next: res => {
        this.actionBusy = false;
        this.toastService.show(res.message || 'Pengajuan pinjaman disetujui.', 'success');
        this.closeDetail();
        this.loadLoans();
      },
      error: (err: HttpErrorResponse) => {
        this.actionBusy = false;
        this.modalError = err.error?.message || 'Gagal menyetujui pengajuan.';
      }
    });
  }

  confirmReject(payload: { loanId: string; reason: string }): void {
    if (this.actionBusy) return;
    this.actionBusy = true;
    this.modalError = '';
    this.loanService.rejectLoan(payload.loanId, payload.reason).subscribe({
      next: res => {
        this.actionBusy = false;
        this.toastService.show(res.message || 'Pengajuan pinjaman ditolak.', 'info');
        this.closeDetail();
        this.loadLoans();
      },
      error: (err: HttpErrorResponse) => {
        this.actionBusy = false;
        this.modalError = err.error?.message || 'Gagal menolak pengajuan.';
      }
    });
  }

  confirmReturn(payload: { loanId: string; conditionNote: string }): void {
    if (this.actionBusy) return;
    this.actionBusy = true;
    this.modalError = '';
    this.loanService.returnLoan(payload.loanId, payload.conditionNote).subscribe({
      next: res => {
        this.actionBusy = false;
        this.toastService.show(res.message || 'Pengembalian barang telah dicatat.', 'success');
        this.closeDetail();
        this.loadLoans();
      },
      error: (err: HttpErrorResponse) => {
        this.actionBusy = false;
        this.modalError = err.error?.message || 'Gagal mengonfirmasi pengembalian.';
      }
    });
  }

  private matchesFilter(loan: LoanTransaction, filter: MonitoringFilter): boolean {
    if (filter === 'ALL') return true;
    if (filter === 'TERLAMBAT') return this.isOverdue(loan);
    if (filter === 'AKTIF') return loan.status === 'AKTIF' || loan.status === 'DISETUJUI';
    return loan.status === filter;
  }

  ngOnDestroy(): void {
    this.loansSub?.unsubscribe();
  }
}
