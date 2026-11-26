import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { WatermarkedDocumentOutput } from '../../core/models';
import { AuthService } from '../../core/services/auth.service';
import { MembershipService } from '../../core/services/membership.service';
import { AlertComponent } from '../../shared/alert/alert.component';
import { IdWatermarkCanvasComponent } from '../../shared/components/id-watermark-canvas/id-watermark-canvas.component';

interface InvitePreset {
  code: string;
  name: string;
  type: string;
  contact: string;
}

interface InviteStatus {
  kind: 'ok' | 'info' | 'warn';
  title: string;
  message: string;
}

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, AlertComponent, IdWatermarkCanvasComponent],
  templateUrl: './register.component.html',
  styleUrl: './register.component.css'
})
export class RegisterComponent {
  private readonly authService = inject(AuthService);
  private readonly membershipService = inject(MembershipService);

  readonly knownInviteCodes: ReadonlyArray<InvitePreset> = [
    {
      code: 'GRAHA2026',
      name: 'Komunitas Graha Indah',
      type: 'Komunitas',
      contact: 'Pengurus Komunitas'
    },
    {
      code: 'NUSANTARA2026',
      name: 'PT Nusantara Digital',
      type: 'Kantor',
      contact: 'Admin Divisi Umum'
    }
  ];

  form = {
    inviteCode: '',
    fullName: '',
    waNumber: '',
    address: '',
    password: '',
    documentType: 'KTP',
    documentUrl: '/img/sample-ktp.svg',
    documentName: 'KTP_Demo_Sarga.svg',
    documentNote: ''
  };

  stepTwoUnlocked = false;
  resolvedOrgName = 'Organisasi Tujuan';
  inviteStatus: InviteStatus | null = null;
  showWatermarkTool = false;
  preparedDocument: WatermarkedDocumentOutput | null = null;

  loading = false;
  errorMessage = '';
  successMessage = '';

  onInviteCodeChanged(): void {
    const code = this.form.inviteCode.trim().toUpperCase();
    const matched = this.knownInviteCodes.find(entry => entry.code === code);
    if (matched) {
      this.stepTwoUnlocked = true;
      this.resolvedOrgName = matched.name;
      this.inviteStatus = {
        kind: 'ok',
        title: `✓ Organisasi Ditemukan: ${matched.name}`,
        message: `Jenis: ${matched.type}. Formulir data diri pada Langkah 2 telah dibuka.`
      };
      return;
    }

    this.stepTwoUnlocked = false;
    this.resolvedOrgName = code ? `Kode ${code}` : 'Organisasi Tujuan';
    if (code.length >= 4) {
      this.inviteStatus = {
        kind: 'info',
        title: 'Siap divalidasi',
        message: 'Klik "Validasi Kode" untuk membuka formulir data diri (kecocokan kode diverifikasi server saat mengirim).'
      };
    } else {
      this.inviteStatus = null;
    }
  }

  applyPresetInvite(code: string): void {
    this.form.inviteCode = code;
    this.onInviteCodeChanged();
  }

  unlockWithCustomCode(): void {
    const code = this.form.inviteCode.trim().toUpperCase();
    if (code.length < 4) {
      this.stepTwoUnlocked = false;
      this.inviteStatus = {
        kind: 'warn',
        title: 'Kode terlalu pendek',
        message: 'Masukkan kode undangan resmi dari pengurus (minimal 4 karakter).'
      };
      return;
    }

    const matched = this.knownInviteCodes.find(entry => entry.code === code);
    if (matched) {
      this.onInviteCodeChanged();
      return;
    }

    this.stepTwoUnlocked = true;
    this.resolvedOrgName = `Organisasi (${code})`;
    this.inviteStatus = {
      kind: 'info',
      title: `Kode ${code} digunakan`,
      message: 'Formulir Langkah 2 dibuka. Kecocokan kode pada database akan diperiksa server saat pendaftaran dikirim.'
    };
  }

  selectSampleDocument(url: string, name: string, type: string): void {
    this.preparedDocument = null;
    this.form.documentUrl = url;
    this.form.documentName = name;
    this.form.documentType = type;
  }

  onDocumentProcessed(doc: WatermarkedDocumentOutput): void {
    this.preparedDocument = doc;
    this.form.documentType = doc.documentType;
    this.form.documentName = doc.fileName;
    this.form.documentUrl = doc.dataUrl;
  }

  onDocumentCleared(): void {
    this.preparedDocument = null;
    this.form.documentUrl = '/img/sample-ktp.svg';
    this.form.documentName = 'KTP_Demo_Sarga.svg';
  }

  onSubmit(): void {
    if (this.loading || !this.stepTwoUnlocked) return;

    const fullName = this.form.fullName.trim();
    const waNumber = this.form.waNumber.trim();
    const inviteCode = this.form.inviteCode.trim().toUpperCase();

    if (!fullName || !waNumber || !inviteCode) {
      this.errorMessage = 'Nama, nomor WhatsApp, dan kode undangan wajib diisi.';
      return;
    }
    if (this.form.password.length < 6) {
      this.errorMessage = 'Kata sandi minimal 6 karakter.';
      return;
    }

    this.loading = true;
    this.errorMessage = '';

    const safeDocumentUrl =
      this.form.documentUrl.startsWith('data:') && this.form.documentUrl.length > 65000
        ? undefined
        : this.form.documentUrl;

    this.authService
      .register({
        fullName,
        waNumber,
        password: this.form.password,
        address: this.form.address.trim(),
        inviteCode,
        documentType: this.form.documentType,
        documentName: this.form.documentName,
        documentNote: this.form.documentNote.trim() || undefined,
        documentUrl: safeDocumentUrl
      })
      .subscribe({
        next: response => {
          this.membershipService.saveDocumentPreview(`wa:${waNumber}`, {
            documentType: this.form.documentType,
            documentName: this.form.documentName,
            documentUrl: this.form.documentUrl,
            documentNote: this.form.documentNote.trim() || undefined,
            watermarkSummary: this.preparedDocument?.watermarkSummary,
            fingerprint: this.preparedDocument?.fingerprint,
            savedAt: new Date().toISOString()
          });

          this.loading = false;
          this.successMessage = response.message;
        },
        error: (error: HttpErrorResponse) => {
          this.loading = false;
          this.errorMessage =
            error.error?.message || 'Pendaftaran tidak berhasil. Periksa data dan kode undangan.';
        }
      });
  }
}
