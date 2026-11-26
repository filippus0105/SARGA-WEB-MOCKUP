import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Role } from '../../core/models';
import { AuthService } from '../../core/services/auth.service';
import { MembershipService } from '../../core/services/membership.service';
import { AlertComponent } from '../../shared/alert/alert.component';
import { ToastService } from '../../shared/toast/toast.service';
import { AdminNavComponent } from './admin-nav.component';

@Component({
  selector: 'app-member-add',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, AlertComponent, AdminNavComponent],
  template: `
    <div class="page page-mid">
      <ng-container *ngIf="waitingAuth">
        <div class="panel panel-pad">
          <p class="small" role="status" aria-live="polite">Memeriksa sesi pengurus...</p>
        </div>
      </ng-container>

      <ng-container *ngIf="!waitingAuth && !authService.isAdmin()">
        <div class="page-head">
          <div>
            <p class="kicker">Pengurus · anggota</p>
            <h1>Tambah anggota manual</h1>
          </div>
        </div>
        <app-alert
          kind="warning"
          title="Halaman khusus pengurus"
          message="Halaman ini hanya untuk pengurus organisasi aktif."
        />
        <div class="btn-row" style="margin-top:1rem">
          <a class="btn-primary" routerLink="/katalog">Kembali ke katalog</a>
        </div>
      </ng-container>

      <ng-container *ngIf="!waitingAuth && authService.isAdmin()">
        <div class="page-head split">
          <div>
            <p class="kicker">Pengurus · anggota</p>
            <h1>Tambah anggota manual</h1>
            <p class="lede">
              Dipakai untuk anggota yang didaftarkan pengurus, misalnya warga tanpa ponsel atau staf baru.
            </p>
          </div>
          <div class="head-actions">
            <a class="btn-secondary" routerLink="/admin-anggota">Kembali ke daftar</a>
          </div>
        </div>

        <app-admin-nav active="tambah-anggota" />

        <app-alert
          kind="info"
          title="Penyimpanan anggota manual di peramban"
          message="Endpoint server untuk menambahkan anggota manual tanpa registrasi mandiri (POST /api/v1/memberships) belum tersedia saat ini. Anggota yang ditambahkan di sini disimpan sementara di daftar anggota lokal organisasi ini pada peramban."
          style="display:block;margin-bottom:1rem"
        />

        <app-alert
          *ngIf="errorMessage"
          kind="error"
          title="Gagal menambahkan anggota"
          [message]="errorMessage"
          style="display:block;margin-bottom:1rem"
        />

        <div class="grid-2">
          <div class="panel panel-pad">
            <form (ngSubmit)="onSubmit()" novalidate>
              <div class="field">
                <label class="label" for="add-member-name">Nama lengkap</label>
                <input
                  class="form-input"
                  id="add-member-name"
                  name="fullName"
                  type="text"
                  required
                  [(ngModel)]="form.fullName"
                />
              </div>

              <div class="field">
                <label class="label" for="add-member-wa">Nomor WhatsApp</label>
                <input
                  class="form-input"
                  id="add-member-wa"
                  name="waNumber"
                  type="tel"
                  inputmode="tel"
                  placeholder="081234567890"
                  required
                  [(ngModel)]="form.waNumber"
                />
                <p class="hint">Gunakan format nomor WhatsApp Indonesia yang valid (misal 0812...).</p>
              </div>

              <div class="field">
                <label class="label" for="add-member-address">Alamat atau unit</label>
                <input
                  class="form-input"
                  id="add-member-address"
                  name="address"
                  type="text"
                  [(ngModel)]="form.address"
                />
              </div>

              <div class="form-grid two">
                <div class="field">
                  <label class="label" for="add-member-role">Peran</label>
                  <select class="form-input" id="add-member-role" name="role" [(ngModel)]="form.role">
                    <option value="ANGGOTA">Anggota</option>
                    <option value="ADMIN">Pengurus</option>
                  </select>
                </div>

                <div class="field">
                  <label class="label" for="add-member-position">Posisi</label>
                  <input
                    class="form-input"
                    id="add-member-position"
                    name="position"
                    type="text"
                    required
                    [(ngModel)]="form.position"
                  />
                </div>
              </div>

              <button class="btn-primary btn-block form-submit" type="submit">
                Tambahkan ke organisasi
              </button>
            </form>
          </div>

          <div class="well">
            <p class="small strong" style="margin:0">Kata sandi awal</p>
            <p class="small muted" style="margin:.35rem 0 0">
              Pada alur penuh sistem, akun baru memakai kata sandi <span class="mono">sarga123</span> dan langsung
              berstatus aktif. Minta anggota menggantinya setelah masuk.
            </p>
            <hr class="divider" />
            <p class="small strong" style="margin:0">Berbeda dari pendaftaran mandiri</p>
            <p class="small muted" style="margin:.35rem 0 0">
              Pendaftaran mandiri memakai kode undangan dan menunggu verifikasi. Penambahan manual adalah keputusan
              pengurus, jadi langsung berstatus aktif.
            </p>
          </div>
        </div>
      </ng-container>
    </div>
  `
})
export class MemberAddComponent {
  readonly authService = inject(AuthService);
  private readonly membershipService = inject(MembershipService);
  private readonly toastService = inject(ToastService);
  private readonly router = inject(Router);

  form = {
    fullName: '',
    waNumber: '',
    address: '',
    role: 'ANGGOTA' as Role,
    position: 'Anggota'
  };
  errorMessage = '';

  get waitingAuth(): boolean {
    return this.authService.isAuthenticated() && !this.authService.currentUser();
  }

  onSubmit(): void {
    this.errorMessage = '';
    const membership = this.authService.activeMembership();
    if (!membership || membership.role !== 'ADMIN') {
      this.errorMessage = 'Hanya pengurus organisasi aktif yang dapat menambah anggota.';
      return;
    }

    const fullName = this.form.fullName.trim();
    const waDigits = this.form.waNumber.replace(/\D/g, '');
    const position = this.form.position.trim() || 'Anggota';

    if (!fullName) {
      this.errorMessage = 'Tulis nama lengkap anggota.';
      return;
    }
    if (waDigits.length < 9 || waDigits.length > 15) {
      this.errorMessage = 'Masukkan nomor WhatsApp yang valid (9–15 digit).';
      return;
    }
    if (position.length > 50) {
      this.errorMessage = 'Nama posisi maksimal 50 karakter.';
      return;
    }

    const existing = this.membershipService
      .getLocalManualMembers(membership.orgId)
      .some(m => m.user?.waNumber.replace(/\D/g, '') === waDigits);
    if (existing) {
      this.errorMessage = 'Nomor WhatsApp ini sudah ditambahkan ke daftar anggota manual.';
      return;
    }

    this.membershipService.addLocalManualMember({
      orgId: membership.orgId,
      fullName,
      waNumber: this.form.waNumber.trim(),
      address: this.form.address.trim(),
      role: this.form.role,
      position
    });

    this.toastService.show(`${fullName} ditambahkan ke organisasi.`, 'success');
    this.router.navigate(['/admin-anggota']);
  }
}
