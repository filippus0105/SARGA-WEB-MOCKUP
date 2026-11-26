import { Component, inject, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../shared/toast/toast.service';
import { VerificationStatus } from '../../core/models';

@Component({
  selector: 'app-status-akun',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="page page-narrow">
      <!-- Jika Belum Masuk -->
      <div *ngIf="!currentUser(); else loggedInView">
        <header class="page-head">
          <p class="kicker">Status akun</p>
          <h1>Masuk untuk melihat status</h1>
          <p class="lede">Status pendaftaran terikat pada akun Anda.</p>
        </header>

        <div class="panel panel-pad">
          <p class="small">
            Silakan <a class="link" routerLink="/auth/login">masuk ke akun</a> terlebih dahulu.
          </p>
          <p class="hint" style="margin-top: 0.75rem;">
            Belum mendaftar? <a class="link" routerLink="/auth/register">Daftar dengan kode undangan pengurus</a>.
          </p>
        </div>
      </div>

      <!-- Jika Sudah Masuk -->
      <ng-template #loggedInView>
        <header class="page-head">
          <p class="kicker">Status akun</p>
          <h1>{{ currentUser()?.fullName || currentUser()?.name }}</h1>
          <p class="lede">
            {{ activeOrg() ? ('Keanggotaan di ' + activeOrg()?.name + '.') : 'Belum ada organisasi aktif.' }}
          </p>
        </header>

        <div class="panel panel-pad">
          <div class="status-hero">
            <div class="item-head">
              <div>
                <span class="cell-main">{{ roleLabel() }}</span>
                <span class="cell-sub">
                  {{ activeOrg() ? activeOrg()?.name : 'Belum ada organisasi' }} · {{ statusLabel() }}
                </span>
              </div>
              <span [class]="tagClass()">{{ statusLabel() }}</span>
            </div>

            <!-- Banner Kuning: Status Menunggu Verifikasi -->
            <div *ngIf="isWaiting()" class="alert alert-warn" role="status">
              <strong>Menunggu verifikasi pengurus</strong>
              <p>
                Pendaftaran Anda sudah masuk. Pengurus akan memeriksa berkas dan menghubungi nomor WhatsApp
                <strong>{{ currentUser()?.waNumber }}</strong> setelah pemeriksaan selesai.
              </p>
            </div>

            <!-- Banner Merah: Status Ditolak -->
            <div *ngIf="isRejected()" class="alert alert-danger" role="alert">
              <strong>Pendaftaran ditolak</strong>
              <p>{{ rejectionReason() }}</p>
            </div>

            <!-- Banner Hijau: Status Aktif (Terverifikasi) -->
            <div *ngIf="isActive()" class="alert alert-success" role="status">
              <strong>Akun aktif</strong>
              <p>
                Anda terdaftar sebagai {{ activeMembership()?.position || roleLabel() }} di
                {{ activeOrg()?.name }}. Anda bisa meminjam alat dan menayangkan barang sendiri.
              </p>
            </div>

            <!-- Linimasa 3 Tahap -->
            <ol class="timeline" aria-label="Linimasa verifikasi pendaftaran">
              <!-- Tahap 1: Pendaftaran diterima -->
              <li class="timeline-item done">
                <span class="timeline-dot" aria-hidden="true"></span>
                <div>
                  <strong>Pendaftaran diterima</strong>
                  <p>Akun dan keanggotaan sudah tercatat.</p>
                </div>
              </li>

              <!-- Tahap 2: Pemeriksaan pengurus -->
              <li
                class="timeline-item"
                [ngClass]="{
                  'done': isActive(),
                  'current': isWaiting(),
                  'rejected': isRejected()
                }"
              >
                <span class="timeline-dot" aria-hidden="true"></span>
                <div>
                  <strong>Pemeriksaan pengurus</strong>
                  <p *ngIf="isActive()">Pengurus menyetujui keanggotaan.</p>
                  <p *ngIf="isWaiting()">Nomor WhatsApp dan dokumen sedang diperiksa pengurus.</p>
                  <p *ngIf="isRejected()">Pengurus menolak pendaftaran ini. Alasan tercantum pada informasi di atas.</p>
                </div>
              </li>

              <!-- Tahap 3: Akun aktif -->
              <li class="timeline-item" [ngClass]="{ 'done': isActive() }">
                <span class="timeline-dot" aria-hidden="true"></span>
                <div>
                  <strong>Akun aktif</strong>
                  <p>
                    {{ isActive() ? 'Akun siap dipakai untuk meminjam dan menayangkan alat.' : 'Aktif setelah pengurus menyetujui pendaftaran.' }}
                  </p>
                </div>
              </li>
            </ol>

            <!-- Aksi Tombol untuk Status Aktif -->
            <div *ngIf="isActive()" class="btn-row">
              <a class="btn-primary" routerLink="/katalog">Buka katalog</a>
              <a class="btn-secondary" routerLink="/barang/tambah">Tambah barang</a>
            </div>

            <!-- Aksi Tombol untuk Status Ditolak: Ajukan Ulang -->
            <div *ngIf="isRejected()" class="btn-row">
              <button class="btn-primary" type="button" (click)="onResubmit()">
                Ajukan ulang
              </button>
              <button class="btn-secondary" type="button" (click)="onLogout()">
                Keluar dari akun
              </button>
            </div>

            <!-- Catatan Kontak Pengurus saat Menunggu -->
            <p *ngIf="isWaiting()" class="small muted contact-note">
              Pengurus organisasi:
              <a
                *ngIf="activeOrg()?.contact"
                [href]="'https://wa.me/' + cleanWa(activeOrg()?.contact)"
                target="_blank"
                rel="noopener"
                class="link"
              >
                {{ activeOrg()?.contact }}
              </a>
              <span *ngIf="!activeOrg()?.contact">—</span>
            </p>
          </div>

          <!-- Dokumen Acuan Verifikasi Pendaftaran -->
          <div *ngIf="hasDocument()" class="doc-submitted-card">
            <hr class="divider" />
            <h2 class="section-title">Dokumen Acuan Verifikasi Pendaftaran</h2>
            <p class="small muted">Dokumen identitas ini diperiksa oleh pengurus organisasi.</p>
            <div class="doc-submitted-flex">
              <div
                class="doc-thumb-preview"
                role="button"
                tabindex="0"
                (click)="openDocModal()"
                (keydown.enter)="openDocModal()"
                (keydown.space)="openDocModal()"
                aria-label="Buka pratinjau dokumen verifikasi"
              >
                <img
                  [src]="documentImage()"
                  [alt]="'Dokumen verifikasi ' + (currentUser()?.fullName || 'anggota')"
                  class="doc-thumb-img"
                  (error)="handleDocImageError($event)"
                />
              </div>
              <div class="pending-card-content">
                <p class="small">
                  <strong>Jenis Dokumen:</strong>
                  {{ activeMembership()?.documentType || 'KTP / Dokumen Identitas' }}
                </p>
                <p class="small mono tiny muted">
                  <strong>Berkas:</strong>
                  {{ activeMembership()?.documentName || 'Dokumen_Keanggotaan.svg' }}
                </p>
                <p *ngIf="activeMembership()?.documentNote" class="tiny muted doc-note">
                  {{ activeMembership()?.documentNote }}
                </p>
                <div class="doc-actions">
                  <button class="btn-secondary btn-sm" type="button" (click)="openDocModal()">
                    👁️ Buka Pop-Up Pratinjau Dokumen
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- Keanggotaan di Organisasi Lain (Multi-Organisasi) -->
          <div *ngIf="(currentUser()?.memberships?.length || 0) > 1" class="other-orgs">
            <hr class="divider" />
            <h2 class="section-title">Keanggotaan lain</h2>
            <div class="list">
              <div *ngFor="let m of otherMemberships()" class="list-item row">
                <div>
                  <span class="cell-main">
                    {{ m.organization?.name || ('Organisasi ' + m.orgId) }}
                  </span>
                  <span class="cell-sub">
                    {{ m.role === 'ADMIN' ? 'Pengurus' : 'Anggota' }} · {{ formatStatus(m.status) }}
                  </span>
                </div>
                <div class="actions">
                  <button class="btn-secondary btn-sm" type="button" (click)="switchOrg(m.orgId)">
                    Buka
                  </button>
                </div>
              </div>
            </div>
          </div>

          <hr class="divider" />
          <div class="btn-row">
            <button class="btn-secondary" type="button" (click)="onLogout()">
              Keluar dari akun
            </button>
          </div>
        </div>
      </ng-template>

      <!-- Modal Pratinjau Dokumen -->
      <div
        *ngIf="showDocModal"
        class="modal-overlay"
        (click)="closeDocModal()"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-doc-title"
      >
        <div class="modal-box" (click)="$event.stopPropagation()">
          <div class="modal-head">
            <h3 id="modal-doc-title">Pratinjau Dokumen Verifikasi</h3>
            <button
              type="button"
              class="btn-close"
              (click)="closeDocModal()"
              aria-label="Tutup pratinjau dokumen"
            >
              ✕
            </button>
          </div>
          <div class="modal-body">
            <img
              [src]="documentImage()"
              [alt]="'Dokumen lengkap ' + (currentUser()?.fullName || 'anggota')"
              class="modal-img"
              (error)="handleDocImageError($event)"
            />
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .status-hero {
      border: 0;
      padding: 0;
    }

    .item-head {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 1rem;
      margin-bottom: 1.25rem;
    }
    .cell-main {
      display: block;
      font-weight: 700;
      font-size: 1.05rem;
      color: var(--color-ink);
    }
    .cell-sub {
      display: block;
      color: var(--color-muted);
      font-size: 0.85rem;
      margin-top: 0.15rem;
    }

    /* Alerts */
    .alert {
      padding: 1rem 1.15rem;
      border: 1px solid;
      border-left-width: 4px;
      border-radius: var(--radius-input);
      margin-bottom: 1.25rem;
    }
    .alert strong {
      display: block;
      font-size: 0.92rem;
      margin-bottom: 0.25rem;
    }
    .alert p {
      margin: 0;
      font-size: 0.88rem;
      line-height: 1.5;
    }
    .alert-warn {
      border-color: var(--color-amber-border);
      border-left-color: var(--color-amber-ink);
      background: var(--color-amber-soft);
      color: var(--color-amber-ink);
    }
    .alert-danger {
      border-color: var(--color-rose-border);
      border-left-color: var(--color-rose-ink);
      background: var(--color-rose-soft);
      color: var(--color-rose-ink);
    }
    .alert-success {
      border-color: var(--color-success-border);
      border-left-color: var(--color-success-ink);
      background: var(--color-success-soft);
      color: var(--color-success-ink);
    }

    .contact-note {
      margin-top: 1rem;
    }

    /* Dokumen Acuan Verifikasi */
    .doc-submitted-card {
      margin-top: 1rem;
    }
    .section-title {
      font-size: 0.98rem;
      font-weight: 700;
      margin: 0 0 0.35rem 0;
      color: var(--color-ink);
    }
    .doc-submitted-flex {
      display: flex;
      flex-direction: column;
      gap: 1rem;
      margin-top: 0.85rem;
    }
    @media (min-width: 560px) {
      .doc-submitted-flex {
        flex-direction: row;
        align-items: flex-start;
      }
    }
    .doc-thumb-preview {
      width: 140px;
      height: 95px;
      flex: 0 0 140px;
      border: 1px solid var(--color-rule);
      border-radius: 8px;
      overflow: hidden;
      background: var(--color-paper-2);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: transform 0.1s ease, border-color 0.15s ease;
    }
    .doc-thumb-preview:hover {
      border-color: var(--color-accent);
      transform: scale(1.02);
    }
    .doc-thumb-img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .pending-card-content {
      flex: 1;
    }
    .pending-card-content p {
      margin: 0 0 0.35rem 0;
    }
    .doc-note {
      font-style: italic;
    }
    .doc-actions {
      margin-top: 0.5rem;
    }

    /* Keanggotaan Lain */
    .other-orgs {
      margin-top: 1rem;
    }
    .list {
      display: flex;
      flex-direction: column;
      margin-top: 0.75rem;
      border: 1px solid var(--color-rule);
      border-radius: var(--radius-input);
      overflow: hidden;
    }
    .list-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      padding: 0.75rem 1rem;
      background: var(--color-paper);
    }
    .list-item + .list-item {
      border-top: 1px solid var(--color-rule);
    }

    /* Modal */
    .modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: rgba(17, 17, 17, 0.65);
      backdrop-filter: blur(2px);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      padding: 1rem;
    }
    .modal-box {
      background: #ffffff;
      border-radius: var(--radius-card);
      box-shadow: var(--shadow-floating);
      max-width: 600px;
      width: 100%;
      overflow: hidden;
      border: 1px solid var(--color-rule);
    }
    .modal-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0.85rem 1.25rem;
      border-bottom: 1px solid var(--color-rule);
      background: var(--color-paper-2);
    }
    .modal-head h3 {
      margin: 0;
      font-size: 0.95rem;
      font-weight: 700;
    }
    .btn-close {
      background: transparent;
      border: none;
      font-size: 1.1rem;
      cursor: pointer;
      padding: 0.25rem 0.5rem;
      border-radius: 4px;
      color: var(--color-muted);
    }
    .btn-close:hover {
      color: var(--color-ink);
      background: var(--color-paper-3);
    }
    .modal-body {
      padding: 1.25rem;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--color-paper);
    }
    .modal-img {
      max-width: 100%;
      max-height: 70vh;
      object-fit: contain;
      border-radius: 6px;
      border: 1px solid var(--color-rule);
    }
  `]
})
export class StatusAkunComponent {
  private readonly authService = inject(AuthService);
  private readonly toastService = inject(ToastService);
  private readonly router = inject(Router);

  currentUser = this.authService.currentUser;
  activeMembership = this.authService.activeMembership;

  showDocModal = false;

  activeOrg = computed(() => {
    return this.activeMembership()?.organization || null;
  });

  statusText = computed(() => {
    const status = this.activeMembership()?.status;
    if (status === 'TERVERIFIKASI') return 'Aktif';
    if (status === 'DITOLAK') return 'Ditolak';
    return 'Menunggu Verifikasi';
  });

  statusLabel = computed(() => {
    return this.statusText();
  });

  roleLabel = computed(() => {
    return this.activeMembership()?.role === 'ADMIN' ? 'Pengurus' : 'Anggota';
  });

  isWaiting = computed(() => {
    const status = this.activeMembership()?.status;
    return !status || status === 'MENUNGGU_VERIFIKASI';
  });

  isActive = computed(() => {
    return this.activeMembership()?.status === 'TERVERIFIKASI';
  });

  isRejected = computed(() => {
    return this.activeMembership()?.status === 'DITOLAK';
  });

  tagClass = computed(() => {
    if (this.isActive()) return 'tag tag-ok';
    if (this.isRejected()) return 'tag tag-danger';
    return 'tag tag-waiting';
  });

  rejectionReason = computed(() => {
    return (
      this.activeMembership()?.rejectionReason ||
      'Pengurus belum menuliskan alasan. Hubungi pengurus organisasi untuk keterangan lebih lanjut.'
    );
  });

  hasDocument = computed(() => {
    const m = this.activeMembership();
    return !!(m?.documentUrl || m?.documentName || m?.documentType);
  });

  documentImage = computed(() => {
    const url = this.activeMembership()?.documentUrl;
    if (url && url.startsWith('http')) return url;
    if (url && url.startsWith('assets/')) return '/' + url.slice('assets/'.length);
    if (url && url.startsWith('img/')) return '/' + url;
    if (url) return url;
    return '/img/sample-ktp.svg';
  });

  otherMemberships = computed(() => {
    const user = this.currentUser();
    const active = this.activeMembership();
    if (!user || !user.memberships) return [];
    return user.memberships.filter(m => m.id !== active?.id);
  });

  formatStatus(status: VerificationStatus): string {
    if (status === 'TERVERIFIKASI') return 'Aktif';
    if (status === 'DITOLAK') return 'Ditolak';
    return 'Menunggu Verifikasi';
  }

  cleanWa(contact?: string): string {
    if (!contact) return '';
    return contact.replace(/[^0-9]/g, '');
  }

  onResubmit(): void {
    this.authService.updateActiveMembershipStatus('MENUNGGU_VERIFIKASI', null);
    this.toastService.show(
      'Pengajuan ulang terkirim: Pengurus akan memeriksa kembali pendaftaran Anda.',
      'success'
    );
  }

  onLogout(): void {
    this.authService.logout();
    this.router.navigate(['/auth/login']);
  }

  switchOrg(orgId: string): void {
    this.authService.setActiveOrg(orgId);
  }

  openDocModal(): void {
    this.showDocModal = true;
  }

  closeDocModal(): void {
    this.showDocModal = false;
  }

  handleDocImageError(event: Event): void {
    const img = event.target as HTMLImageElement;
    if (img && !img.src.includes('sample-ktp.svg')) {
      img.src = '/img/sample-ktp.svg';
    }
  }
}
