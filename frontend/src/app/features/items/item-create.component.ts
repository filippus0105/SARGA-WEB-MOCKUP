import { HttpErrorResponse } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Item } from '../../core/models';
import { AuthService } from '../../core/services/auth.service';
import { ITEM_IMAGE_OPTIONS, ItemService } from '../../core/services/item.service';
import { MembershipService } from '../../core/services/membership.service';
import { AlertComponent } from '../../shared/alert/alert.component';

interface ItemCreateForm {
  name: string;
  description: string;
  location: string;
  maxDays: number | null;
  contents: string;
  instructions: string;
  imagePreset: string;
  isSafeAndReady: boolean;
}

@Component({
  selector: 'app-item-create',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, AlertComponent],
  template: `
    <div class="page page-mid">
      <div class="page-head split">
        <div>
          <p class="kicker">Pemilik · UC-PM-01</p>
          <h1>Daftar barang baru</h1>
          <p class="lede">Barang yang disimpan akan langsung tayang di katalog organisasi aktif dengan kode otomatis.</p>
        </div>
        <div class="head-actions">
          <a class="btn-secondary" routerLink="/katalog">Kembali ke katalog</a>
        </div>
      </div>

      <app-alert
        *ngIf="!canCreateItems"
        kind="warning"
        title="Keanggotaan terverifikasi diperlukan"
        [message]="membershipMessage"
      />
      <app-alert
        *ngIf="errorMessage"
        kind="error"
        title="Barang gagal disimpan"
        [message]="errorMessage"
        style="display:block;margin-bottom:1rem"
      />
      <app-alert
        *ngIf="successMessage"
        kind="success"
        title="Barang berhasil disimpan"
        [message]="successMessage"
        style="display:block;margin-bottom:1rem"
      />

      <p *ngIf="saving" class="small" role="status" aria-live="polite" style="margin-bottom:1rem">
        Menyimpan barang ke katalog...
      </p>

      <div class="panel panel-pad" *ngIf="canCreateItems && !createdItem">
        <form (ngSubmit)="onSubmit()" [attr.aria-busy]="saving" novalidate>
          <div class="field">
            <label class="label" for="item-name">Nama barang</label>
            <input
              id="item-name"
              name="name"
              type="text"
              class="form-input"
              placeholder='Contoh: "Bor listrik impact 13 mm"'
              required
              [(ngModel)]="form.name"
            />
          </div>

          <div class="form-grid two">
            <div class="field">
              <label class="label" for="item-max-days">Maksimal masa pinjam (1–14 hari)</label>
              <input
                id="item-max-days"
                name="maxDays"
                type="number"
                class="form-input"
                min="1"
                max="14"
                step="1"
                inputmode="numeric"
                required
                [(ngModel)]="form.maxDays"
              />
            </div>

            <div class="field">
              <label class="label" for="item-location">Lokasi penyimpanan atau pengambilan</label>
              <input
                id="item-location"
                name="location"
                type="text"
                class="form-input"
                required
                [(ngModel)]="form.location"
              />
            </div>
          </div>

          <div class="field">
            <label class="label" for="item-description">Deskripsi singkat</label>
            <textarea
              id="item-description"
              name="description"
              class="form-input"
              rows="3"
              required
              [(ngModel)]="form.description"
            ></textarea>
          </div>

          <div class="field">
            <label class="label" for="item-contents">Kelengkapan barang (opsional, satu per baris)</label>
            <textarea
              id="item-contents"
              name="contents"
              class="form-input"
              rows="3"
              placeholder='Contoh: "1 kabel pengisi daya"'
              [(ngModel)]="form.contents"
            ></textarea>
          </div>

          <div class="field">
            <label class="label" for="item-instructions">Catatan kondisi &amp; petunjuk penggunaan (maks. 250 karakter)</label>
            <textarea
              id="item-instructions"
              name="instructions"
              class="form-input"
              rows="3"
              maxlength="250"
              required
              [(ngModel)]="form.instructions"
            ></textarea>
            <p class="hint">{{ form.instructions.length }}/250 karakter</p>
          </div>

          <div class="form-grid two">
            <div class="field">
              <label class="label" for="item-image-file">Unggah foto barang (JPG/PNG, maks. 5 MB)</label>
              <input
                id="item-image-file"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                class="form-input"
                style="padding:.45rem .65rem"
                (change)="onFileSelected($event)"
              />
              <p class="hint" *ngIf="selectedFile">{{ selectedFile.name }}</p>
            </div>

            <div class="field">
              <label class="label" for="item-image-preset">Atau pilih foto contoh</label>
              <select
                id="item-image-preset"
                name="imagePreset"
                class="form-input"
                [(ngModel)]="form.imagePreset"
              >
                <option *ngFor="let opt of imageOptions" [value]="opt[0]">{{ opt[1] }}</option>
              </select>
            </div>
          </div>

          <label class="safety-check">
            <input name="isSafeAndReady" type="checkbox" required [(ngModel)]="form.isSafeAndReady" />
            <span>Saya menyatakan barang aman dan layak digunakan.</span>
          </label>

          <button type="submit" class="btn-primary form-submit" [disabled]="saving">
            {{ saving ? 'Menyimpan barang...' : 'Simpan ke katalog' }}
          </button>
        </form>
      </div>

      <div *ngIf="createdItem" class="btn-row" style="margin-top:.75rem">
        <a class="btn-primary" [routerLink]="['/katalog', createdItem.id]">Lihat barang di katalog</a>
        <button type="button" class="btn-secondary" (click)="resetForm()">Daftarkan barang lagi</button>
      </div>
    </div>
  `,
  styles: [`
    .safety-check {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      min-height: 44px;
      margin-top: 1rem;
      color: var(--color-ink);
      cursor: pointer;
    }
    .safety-check input[type='checkbox'] {
      width: 1.2rem;
      height: 1.2rem;
      flex: 0 0 auto;
      accent-color: var(--color-accent);
    }
  `]
})
export class ItemCreateComponent {
  private readonly authService = inject(AuthService);
  private readonly itemService = inject(ItemService);
  private readonly membershipService = inject(MembershipService);

  readonly imageOptions = ITEM_IMAGE_OPTIONS;

  form: ItemCreateForm = {
    name: '',
    description: '',
    location: '',
    maxDays: 3,
    contents: '',
    instructions: '',
    imagePreset: '/img/placeholder-item.svg',
    isSafeAndReady: false
  };
  selectedFile: File | null = null;
  saving = false;
  errorMessage = '';
  successMessage = '';
  createdItem: Item | null = null;

  get canCreateItems(): boolean {
    return this.authService.activeMembership()?.status === 'TERVERIFIKASI';
  }

  get membershipMessage(): string {
    const membership = this.authService.activeMembership();
    if (!membership) return 'Pilih organisasi tempat Anda menjadi anggota terverifikasi melalui menu organisasi.';
    if (membership.status === 'MENUNGGU_VERIFIKASI') return 'Keanggotaan Anda masih menunggu verifikasi pengurus.';
    if (membership.status === 'DITOLAK') return 'Keanggotaan Anda ditolak. Hubungi pengurus organisasi untuk informasi lebih lanjut.';
    return 'Pilih organisasi aktif yang keanggotaannya sudah terverifikasi.';
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    this.selectedFile = null;
    if (!file) return;

    const validMime = ['image/jpeg', 'image/png', 'image/webp'].includes(file.type);
    if (!validMime) {
      this.errorMessage = 'Format foto harus JPG, PNG, atau WebP.';
      input.value = '';
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      this.errorMessage = 'Ukuran foto maksimal 5 MB.';
      input.value = '';
      return;
    }
    this.errorMessage = '';
    this.selectedFile = file;
  }

  onSubmit(): void {
    if (this.saving) return;

    const membership = this.authService.activeMembership();
    if (!membership || membership.status !== 'TERVERIFIKASI') {
      this.errorMessage = 'Keanggotaan terverifikasi diperlukan untuk mendaftarkan barang.';
      return;
    }

    const maxDays = Number(this.form.maxDays);
    if (!Number.isInteger(maxDays) || maxDays < 1 || maxDays > 14) {
      this.errorMessage = 'Maksimal masa pinjam harus bilangan bulat antara 1 sampai 14 hari.';
      return;
    }

    const name = this.form.name.trim();
    const description = this.form.description.trim();
    const location = this.form.location.trim();
    const instructions = this.form.instructions.trim();

    if (!name || !description || !location || !instructions) {
      this.errorMessage = 'Lengkapi seluruh field wajib sebelum menyimpan barang.';
      return;
    }
    if (instructions.length > 250) {
      this.errorMessage = 'Catatan kondisi dan instruksi pengambilan maksimal 250 karakter.';
      return;
    }
    if (!this.form.isSafeAndReady) {
      this.errorMessage = 'Pernyataan barang aman dan layak digunakan harus disetujui.';
      return;
    }

    this.saving = true;
    this.errorMessage = '';

    if (this.selectedFile) {
      this.membershipService.uploadForensicDocument(this.selectedFile, this.selectedFile.name).subscribe({
        next: uploadRes => this.submitItemPayload(membership.orgId, uploadRes.image.url),
        error: () => this.submitItemPayload(membership.orgId, this.form.imagePreset)
      });
    } else {
      this.submitItemPayload(membership.orgId, this.form.imagePreset);
    }
  }

  resetForm(): void {
    this.createdItem = null;
    this.successMessage = '';
    this.errorMessage = '';
    this.selectedFile = null;
    this.form = {
      name: '',
      description: '',
      location: '',
      maxDays: 3,
      contents: '',
      instructions: '',
      imagePreset: '/img/placeholder-item.svg',
      isSafeAndReady: false
    };
  }

  private submitItemPayload(orgId: string, imagePath: string): void {
    const itemData: Partial<Item> = {
      orgId,
      name: this.form.name.trim(),
      description: this.form.description.trim(),
      location: this.form.location.trim(),
      maxDays: Number(this.form.maxDays),
      contents: this.form.contents.split(/\r?\n/).map(entry => entry.trim()).filter(Boolean),
      instructions: this.form.instructions.trim(),
      image: imagePath,
      isSafeAndReady: this.form.isSafeAndReady
    };

    this.itemService.createItem(itemData).subscribe({
      next: response => {
        this.saving = false;
        this.createdItem = response.item;
        this.successMessage = response.message || 'Barang berhasil disimpan ke katalog.';
      },
      error: (error: HttpErrorResponse) => {
        this.saving = false;
        this.errorMessage = error.error?.message || 'Barang gagal disimpan. Coba lagi.';
      }
    });
  }
}
