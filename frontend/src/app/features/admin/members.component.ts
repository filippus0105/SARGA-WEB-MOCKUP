import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnDestroy, effect, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Subscription, forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { LoanTransaction, Membership, Role, StructureMemberEntry, VerificationStatus } from '../../core/models';
import { AuthService } from '../../core/services/auth.service';
import { LoanService } from '../../core/services/loan.service';
import { MembershipService } from '../../core/services/membership.service';
import { AlertComponent } from '../../shared/alert/alert.component';
import { ToastService } from '../../shared/toast/toast.service';
import { AdminNavComponent } from './admin-nav.component';
import { MemberDetailModalComponent, MemberDirectoryRow } from './member-detail-modal.component';

type StatusFilter = 'ALL' | VerificationStatus;

@Component({
  selector: 'app-admin-members',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    AlertComponent,
    AdminNavComponent,
    MemberDetailModalComponent
  ],
  templateUrl: './members.component.html'
})
export class MembersComponent implements OnDestroy {
  readonly authService = inject(AuthService);
  private readonly membershipService = inject(MembershipService);
  private readonly loanService = inject(LoanService);
  private readonly toastService = inject(ToastService);

  private membersSub?: Subscription;
  private lastLoadedOrgId = '';

  readonly statusTabs: ReadonlyArray<{ key: StatusFilter; label: string }> = [
    { key: 'ALL', label: 'Semua' },
    { key: 'TERVERIFIKASI', label: 'Aktif' },
    { key: 'MENUNGGU_VERIFIKASI', label: 'Menunggu Verifikasi' },
    { key: 'DITOLAK', label: 'Ditolak' }
  ];

  allMembers: MemberDirectoryRow[] = [];
  orgLoans: LoanTransaction[] = [];
  searchQuery = '';
  statusFilter: StatusFilter = 'ALL';
  loading = false;
  saving = false;
  errorMessage = '';

  selectedMember: MemberDirectoryRow | null = null;
  modalError = '';

  constructor() {
    effect(() => {
      const membership = this.authService.activeMembership();
      const orgId = membership?.orgId || '';
      if (orgId && membership?.role === 'ADMIN' && orgId !== this.lastLoadedOrgId) {
        this.lastLoadedOrgId = orgId;
        this.loadMembers(orgId);
      }
    });
  }

  get waitingAuth(): boolean {
    return this.authService.isAuthenticated() && !this.authService.currentUser();
  }

  get orgName(): string {
    return this.authService.activeMembership()?.organization?.name || 'organisasi aktif';
  }

  get verifiedAdminCount(): number {
    return this.allMembers.filter(
      m => !m.isLocalOnly && m.status === 'TERVERIFIKASI' && m.role === 'ADMIN'
    ).length;
  }

  get selectedMemberLoans(): LoanTransaction[] {
    if (!this.selectedMember) return [];
    const uid = this.selectedMember.userId;
    return this.orgLoans.filter(l => l.borrowerId === uid);
  }

  get filteredMembers(): MemberDirectoryRow[] {
    const q = this.searchQuery.trim().toLowerCase();
    return this.allMembers.filter(m => {
      if (this.statusFilter !== 'ALL' && m.status !== this.statusFilter) return false;
      if (!q) return true;
      return `${m.fullName} ${m.waNumber} ${m.position} ${m.role}`.toLowerCase().includes(q);
    });
  }

  countForStatus(filter: StatusFilter): number {
    if (filter === 'ALL') return this.allMembers.length;
    return this.allMembers.filter(m => m.status === filter).length;
  }

  loadMembers(orgId: string): void {
    this.membersSub?.unsubscribe();
    this.loading = true;
    this.errorMessage = '';

    this.membersSub = forkJoin({
      structure: this.membershipService.getOrganizationStructure(orgId).pipe(catchError(() => of(null))),
      pending: this.membershipService.getPendingMemberships().pipe(catchError(() => of(null))),
      loans: this.loanService.getOrganizationLoans().pipe(catchError(() => of(null)))
    }).subscribe(({ structure, pending, loans }) => {
      this.loading = false;
      if (!structure && !pending) {
        this.errorMessage = 'Data anggota belum berhasil dimuat dari server.';
      }

      const verifiedEntries: MemberDirectoryRow[] = [
        ...(structure?.leaders || []),
        ...(structure?.members || [])
      ].map((entry: StructureMemberEntry) => ({
        id: entry.id || entry.userId,
        userId: entry.userId,
        fullName: entry.fullName,
        waNumber: entry.waNumber,
        role: entry.role,
        position: entry.position || 'Anggota',
        status: 'TERVERIFIKASI',
        joinedAt: entry.joinedAt || '',
        isLocalOnly: false
      }));

      const pendingEntries: MemberDirectoryRow[] = (pending?.memberships || []).map((m: Membership) => ({
        id: m.id,
        userId: m.userId,
        fullName: m.user?.fullName || 'Calon Anggota',
        waNumber: m.user?.waNumber || '-',
        role: m.role,
        position: m.position || 'Anggota',
        status: m.status,
        joinedAt: m.joinedAt || m.createdAt || '',
        address: m.address || m.user?.address,
        isLocalOnly: false
      }));

      const localEntries: MemberDirectoryRow[] = this.membershipService.getLocalManualMembers(orgId).map(m => ({
        id: m.id,
        userId: m.userId,
        fullName: m.user?.fullName || 'Anggota Manual',
        waNumber: m.user?.waNumber || '-',
        role: m.role,
        position: m.position || 'Anggota',
        status: m.status,
        joinedAt: m.joinedAt || m.createdAt || '',
        address: m.address || m.user?.address,
        isLocalOnly: true
      }));

      this.allMembers = [...verifiedEntries, ...pendingEntries, ...localEntries];
      this.orgLoans = loans?.loans || [];
    });
  }

  initials(name: string): string {
    const parts = (name || '').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return 'SG';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }

  statusLabel(status: VerificationStatus): string {
    if (status === 'TERVERIFIKASI') return 'Aktif';
    if (status === 'DITOLAK') return 'Ditolak';
    return 'Menunggu Verifikasi';
  }

  statusTagClass(status: VerificationStatus): string {
    if (status === 'TERVERIFIKASI') return 'tag-in';
    if (status === 'DITOLAK') return 'tag-danger';
    return 'tag-waiting';
  }

  formatDate(value?: string): string {
    if (!value) return '—';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;
    return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  openMemberModal(member: MemberDirectoryRow): void {
    this.selectedMember = member;
    this.modalError = '';
  }

  closeMemberModal(): void {
    this.selectedMember = null;
    this.modalError = '';
  }

  saveMemberChanges(payload: { role: Role; position: string }): void {
    if (!this.selectedMember || this.saving) return;
    const target = this.selectedMember;
    const activeOrgId = this.authService.activeMembership()?.orgId || '';

    if (target.isLocalOnly) {
      this.membershipService.updateLocalManualMember(target.id, {
        role: payload.role,
        position: payload.position
      });
      this.toastService.show(`Peran ${target.fullName} diperbarui secara lokal.`, 'success');
      this.closeMemberModal();
      if (activeOrgId) this.loadMembers(activeOrgId);
      return;
    }

    this.saving = true;
    this.modalError = '';
    this.membershipService
      .updateMembershipRolePosition(target.id, payload.role, payload.position)
      .subscribe({
        next: res => {
          this.saving = false;
          const roleText = payload.role === 'ADMIN' ? 'Pengurus' : 'Anggota';
          this.toastService.show(
            res.message || `${target.fullName} sekarang berperan sebagai ${roleText}.`,
            'success'
          );
          this.closeMemberModal();
          if (activeOrgId) this.loadMembers(activeOrgId);
        },
        error: (err: HttpErrorResponse) => {
          this.saving = false;
          this.modalError = err.error?.message || 'Gagal memperbarui peran anggota.';
        }
      });
  }

  ngOnDestroy(): void {
    this.membersSub?.unsubscribe();
  }
}
