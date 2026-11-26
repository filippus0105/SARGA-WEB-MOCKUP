import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { Item, ItemStatus } from '../../core/models';
import { AuthService } from '../../core/services/auth.service';
import {
  ITEM_IMAGE_OPTIONS,
  ItemService,
  normalizeItemImagePath
} from '../../core/services/item.service';
import { AlertComponent } from '../../shared/alert/alert.component';
import { StatusBadgeComponent } from '../../shared/status-badge/status-badge.component';
import { ToastService } from '../../shared/toast/toast.service';

interface ItemEditForm {
  name: string;
  maxDays: number | null;
  location: string;
  status: ItemStatus;
  description: string;
  contents: string;
  instructions: string;
  image: string;
}

@Component({
  selector: 'app-item-edit',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, AlertComponent, StatusBadgeComponent],
  templateUrl: './item-edit.component.html',
  styles: [`
    .image-picker-row {
      display: grid;
      grid-template-columns: minmax(0, 1fr);
      gap: 0.75rem;
      align-items: center;
    }
    @media (min-width: 600px) {
      .image-picker-row {
        grid-template-columns: minmax(0, 1fr) 120px;
      }
    }
    .preview-thumb {
      width: 120px;
      height: 84px;
      border-radius: 10px;
      border: 1px solid var(--color-rule);
      overflow: hidden;
      background: var(--color-paper-2);
    }
    .preview-thumb img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }
  `]
})
export class ItemEditComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly authService = inject(AuthService);
  private readonly itemService = inject(ItemService);
  private readonly toastService = inject(ToastService);

  private routeSub?: Subscription;
  private itemSub?: Subscription;

  readonly imageOptions = ITEM_IMAGE_OPTIONS;
  readonly statusOptions: ReadonlyArray<{ value: ItemStatus; label: string }> = [
    { value: 'TERSEDIA', label: 'Tersedia' },
    { value: 'DIPINJAM', label: 'Sedang Dipinjam' },
    { value: 'PERAWATAN', label: 'Perawatan' },
    { value: 'DIARSIPKAN', label: 'Diarsipkan (disembunyikan)' }
  ];

  item: Item | null = null;
  currentStatus: ItemStatus = 'TERSEDIA';
  loading = false;
  loadError = '';
  errorMessage = '';
  successMessage = '';

  form: ItemEditForm = {
    name: '',
    maxDays: 3,
    location: '',
    status: 'TERSEDIA',
    description: '',
    contents: '',
    instructions: '',
    image: '/img/placeholder-item.svg'
  };

  get canEdit(): boolean {
    if (!this.item) return false;
    const me = this.authService.currentUser();
    const isOwner = !!me && this.item.ownerId === me.id;
    return isOwner || this.authService.isAdmin();
  }

  get previewImage(): string {
    return normalizeItemImagePath(this.form.image);
  }

  ngOnInit(): void {
    this.routeSub = this.route.paramMap.subscribe(paramMap => {
      const paramId = paramMap.get('id');
      const queryId = this.route.snapshot.queryParamMap.get('id');
      this.loadItem(paramId || queryId || '');
    });
  }

  loadItem(id: string): void {
    this.itemSub?.unsubscribe();
    this.errorMessage = '';
    this.successMessage = '';
    this.loadError = '';
    this.item = null;

    if (!id) {
      this.loadError = 'ID barang belum dipilih.';
      return;
    }

    this.loading = true;
    this.itemSub = this.itemService.getItemById(id).subscribe({
      next: res => {
        const effective = this.itemService.getEffectiveItem(res.item);
        this.item = effective;
        this.currentStatus = effective.status;
        this.populateForm(effective);
        this.loading = false;
      },
      error: (err: HttpErrorResponse) => {
        this.loading = false;
        this.loadError =
          err.status === 401
            ? 'Masuk terlebih dahulu untuk mengubah data barang.'
            : err.error?.message || 'Tautan barang tidak valid atau tidak ditemukan.';
      }
    });
  }

  onSave(): void {
    if (!this.item || !this.canEdit) return;
    this.errorMessage = '';
    this.successMessage = '';

    const name = this.form.name.trim();
    const location = this.form.location.trim();
    const description = this.form.description.trim();
    const instructions = this.form.instructions.trim();
    const maxDays = Number(this.form.maxDays);

    if (!name) {
      this.errorMessage = 'Tulis nama barang.';
      return;
    }
    if (!Number.isInteger(maxDays) || maxDays < 1 || maxDays > 14) {
      this.errorMessage = 'Maksimal hari pinjam harus antara 1 sampai 14 hari.';
      return;
    }
    if (!location) {
      this.errorMessage = 'Tulis lokasi pengambilan.';
      return;
    }
    if (!description) {
      this.errorMessage = 'Tulis deskripsi singkat.';
      return;
    }
    if (!instructions || instructions.length > 250) {
      this.errorMessage = 'Tulis catatan pemakaian (maksimal 250 karakter).';
      return;
    }

    const contents = this.form.contents
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(Boolean);

    if (this.form.status === 'DIARSIPKAN') {
      if (this.item.status === 'DIPINJAM') {
        this.errorMessage = 'Barang yang sedang dipinjam tidak bisa diarsipkan.';
        return;
      }
      this.itemService.archiveItemLocally(this.item.id);
    } else if (this.itemService.isLocallyArchived(this.item.id)) {
      this.itemService.restoreItemLocally(this.item.id, this.form.status);
    }

    this.itemService.updateItemLocally(this.item.id, {
      name,
      maxDays,
      location,
      status: this.form.status,
      description,
      contents,
      instructions,
      image: normalizeItemImagePath(this.form.image)
    });

    this.currentStatus = this.form.status;
    this.item = {
      ...this.item,
      name,
      maxDays,
      location,
      status: this.form.status,
      description,
      contents,
      instructions,
      image: normalizeItemImagePath(this.form.image)
    };

    this.successMessage = 'Data barang diperbarui pada penyimpanan lokal peramban.';
    this.toastService.show(`Data "${name}" diperbarui.`, 'success');
  }

  onArchiveItem(): void {
    if (!this.item || !this.canEdit) return;
    if (this.currentStatus === 'DIPINJAM') {
      this.errorMessage = 'Barang yang sedang dipinjam tidak bisa ditarik.';
      return;
    }
    this.itemService.archiveItemLocally(this.item.id);
    this.currentStatus = 'DIARSIPKAN';
    this.form.status = 'DIARSIPKAN';
    this.successMessage = 'Barang ditarik dari katalog aktif pada peramban ini.';
    this.toastService.show(`"${this.item.name}" ditarik dari katalog.`, 'info');
  }

  onRestoreItem(): void {
    if (!this.item || !this.canEdit) return;
    this.itemService.restoreItemLocally(this.item.id, 'TERSEDIA');
    this.currentStatus = 'TERSEDIA';
    this.form.status = 'TERSEDIA';
    this.successMessage = 'Barang ditayangkan kembali ke katalog aktif.';
    this.toastService.show(`"${this.item.name}" ditayangkan kembali.`, 'success');
  }

  private populateForm(item: Item): void {
    const normalizedImg = normalizeItemImagePath(item.image || item.imageUrl);
    const hasMatch = this.imageOptions.some(([val]) => val === normalizedImg);
    this.form = {
      name: item.name || '',
      maxDays: item.maxDays || 3,
      location: item.location || '',
      status: item.status || 'TERSEDIA',
      description: item.description || '',
      contents: this.parseContents(item.contents).join('\n'),
      instructions: item.instructions || '',
      image: hasMatch ? normalizedImg : '/img/placeholder-item.svg'
    };
  }

  private parseContents(raw: string | string[]): string[] {
    if (Array.isArray(raw)) return raw;
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.map(String);
    } catch {
      // Plain text fallback
    }
    return raw.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  }

  ngOnDestroy(): void {
    this.routeSub?.unsubscribe();
    this.itemSub?.unsubscribe();
  }
}
