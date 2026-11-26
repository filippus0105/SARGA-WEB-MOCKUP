import { CommonModule } from '@angular/common';
import {
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
  ViewChild
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { WatermarkedDocumentOutput } from '../../../core/models';
import {
  NormalizedRect,
  RedactionMode,
  formatWibTimestamp,
  generateDocumentFingerprint,
  renderWatermarkedDocument
} from './watermark-renderer';

@Component({
  selector: 'app-id-watermark-canvas',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './id-watermark-canvas.component.html',
  styleUrl: './id-watermark-canvas.component.css'
})
export class IdWatermarkCanvasComponent implements OnChanges, OnDestroy {
  @Input() organizationName = 'Organisasi SARGA';
  @Input() picName = '';
  @Input() picContact = '';
  @Input() documentType = 'KTP';
  @Input() initialImageUrl = '';

  @Output() processed = new EventEmitter<WatermarkedDocumentOutput>();
  @Output() documentCleared = new EventEmitter<void>();

  @ViewChild('editorCanvas') private canvasRef?: ElementRef<HTMLCanvasElement>;

  imageLoaded = false;
  errorMessage = '';
  redactionMode: RedactionMode = 'solid';
  watermarkEnabled = true;
  redactions: NormalizedRect[] = [];
  fingerprint = generateDocumentFingerprint();

  private loadedImage: HTMLImageElement | null = null;
  private sourceFileName = 'dokumen_identitas.jpg';
  private activeObjectUrl: string | null = null;
  private dragStart: { x: number; y: number } | null = null;
  private dragDraft: NormalizedRect | null = null;
  private redrawScheduled = false;

  get effectiveOrgName(): string {
    return this.organizationName.trim() || 'Organisasi SARGA';
  }

  get effectivePicName(): string {
    return this.picName.trim() || 'Pengurus Organisasi';
  }

  get effectivePicContact(): string {
    return this.picContact.trim() || 'Kontak Resmi Pengurus';
  }

  get previewStampHeader(): string {
    return `HANYA UNTUK VERIFIKASI KEANGGOTAAN SARGA ${this.effectiveOrgName.toUpperCase()}`;
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['initialImageUrl'] && this.initialImageUrl && !this.imageLoaded) {
      this.loadImageUrl(this.initialImageUrl, 'Dokumen_Keanggotaan.svg');
      return;
    }
    if (
      this.imageLoaded &&
      (changes['organizationName'] || changes['picName'] || changes['picContact'] || changes['documentType'])
    ) {
      this.redrawAndEmit();
    }
  }

  onMetadataChange(): void {
    if (this.imageLoaded) {
      this.redrawAndEmit();
    }
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    this.errorMessage = '';
    if (!file.type.startsWith('image/')) {
      this.errorMessage = 'Berkas harus berupa gambar (JPEG, PNG, atau WebP).';
      input.value = '';
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      this.errorMessage = 'Ukuran gambar maksimal 5 MB.';
      input.value = '';
      return;
    }

    this.revokeObjectUrl();
    this.activeObjectUrl = URL.createObjectURL(file);
    this.loadImageUrl(this.activeObjectUrl, file.name);
  }

  loadImageUrl(url: string, fileName: string): void {
    this.errorMessage = '';
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      this.loadedImage = img;
      this.sourceFileName = fileName;
      this.redactions = [];
      this.fingerprint = generateDocumentFingerprint();
      this.imageLoaded = true;
      setTimeout(() => this.redrawAndEmit(false));
    };
    img.onerror = () => {
      this.errorMessage = 'Gambar tidak dapat dimuat ke kanvas sensor.';
      this.imageLoaded = false;
    };
    img.src = url;
  }

  applyPresetNikRedaction(): void {
    this.redactions = [
      ...this.redactions,
      { x: 0.25, y: 0.24, w: 0.34, h: 0.08, mode: this.redactionMode }
    ];
    this.redrawAndEmit();
  }

  applyPresetSignatureRedaction(): void {
    this.redactions = [
      ...this.redactions,
      { x: 0.68, y: 0.68, w: 0.24, h: 0.16, mode: this.redactionMode }
    ];
    this.redrawAndEmit();
  }

  undoLastRedaction(): void {
    if (!this.redactions.length) return;
    this.redactions = this.redactions.slice(0, -1);
    this.redrawAndEmit();
  }

  clearRedactions(): void {
    this.redactions = [];
    this.redrawAndEmit();
  }

  resetAll(): void {
    this.revokeObjectUrl();
    this.loadedImage = null;
    this.redactions = [];
    this.imageLoaded = false;
    this.errorMessage = '';
    this.documentCleared.emit();
  }

  onPointerDown(event: PointerEvent): void {
    const canvas = this.canvasRef?.nativeElement;
    if (!canvas) return;
    canvas.setPointerCapture(event.pointerId);
    const point = this.toNormalizedPoint(event, canvas);
    this.dragStart = point;
    this.dragDraft = { x: point.x, y: point.y, w: 0, h: 0, mode: this.redactionMode };
  }

  onPointerMove(event: PointerEvent): void {
    if (!this.dragStart) return;
    const canvas = this.canvasRef?.nativeElement;
    if (!canvas) return;
    const current = this.toNormalizedPoint(event, canvas);
    this.dragDraft = {
      x: Math.min(this.dragStart.x, current.x),
      y: Math.min(this.dragStart.y, current.y),
      w: Math.abs(current.x - this.dragStart.x),
      h: Math.abs(current.y - this.dragStart.y),
      mode: this.redactionMode
    };
    this.schedulePreviewDraw();
  }

  onPointerUp(event: PointerEvent): void {
    if (!this.dragStart) return;
    const canvas = this.canvasRef?.nativeElement;
    if (canvas && canvas.hasPointerCapture(event.pointerId)) {
      canvas.releasePointerCapture(event.pointerId);
    }
    const draft = this.dragDraft;
    this.dragStart = null;
    this.dragDraft = null;
    if (draft && draft.w >= 0.02 && draft.h >= 0.015) {
      this.redactions = [...this.redactions, draft];
    }
    this.redrawAndEmit();
  }

  redrawAndEmit(forceConfirm = false): void {
    const canvas = this.canvasRef?.nativeElement;
    const img = this.loadedImage;
    if (!canvas || !img) return;

    renderWatermarkedDocument(canvas, img, this.redactions, this.dragDraft, this.stampConfig);

    if (!forceConfirm && this.dragStart) return;

    const summary = this.buildWatermarkSummary();
    try {
      const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
      canvas.toBlob(
        blob => {
          if (!blob) return;
          const sanitizedBase = this.sourceFileName.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '_');
          const outName = `${sanitizedBase || 'identitas'}_watermarked.jpg`;
          const file = new File([blob], outName, { type: 'image/jpeg' });
          this.processed.emit({
            dataUrl,
            blob,
            file,
            fileName: outName,
            documentType: this.documentType,
            watermarkSummary: summary,
            fingerprint: this.fingerprint,
            redactionCount: this.redactions.length
          });
        },
        'image/jpeg',
        0.82
      );
    } catch {
      this.errorMessage = 'Kanvas tidak dapat mengekspor gambar ini. Gunakan foto JPG atau PNG lokal.';
    }
  }

  private get stampConfig() {
    return {
      organizationName: this.effectiveOrgName,
      picName: this.effectivePicName,
      picContact: this.effectivePicContact,
      fingerprint: this.fingerprint,
      watermarkEnabled: this.watermarkEnabled
    };
  }

  private schedulePreviewDraw(): void {
    if (this.redrawScheduled) return;
    this.redrawScheduled = true;
    requestAnimationFrame(() => {
      this.redrawScheduled = false;
      const canvas = this.canvasRef?.nativeElement;
      const img = this.loadedImage;
      if (canvas && img) {
        renderWatermarkedDocument(canvas, img, this.redactions, this.dragDraft, this.stampConfig);
      }
    });
  }

  private toNormalizedPoint(event: PointerEvent, canvas: HTMLCanvasElement): { x: number; y: number } {
    const rect = canvas.getBoundingClientRect();
    const x = Math.min(1, Math.max(0, (event.clientX - rect.left) / (rect.width || 1)));
    const y = Math.min(1, Math.max(0, (event.clientY - rect.top) / (rect.height || 1)));
    return { x, y };
  }

  private buildWatermarkSummary(): string {
    return `${this.previewStampHeader} | PJ: ${this.effectivePicName} (${this.effectivePicContact}) | ${formatWibTimestamp()} | ID: ${this.fingerprint}`;
  }

  private revokeObjectUrl(): void {
    if (this.activeObjectUrl) {
      URL.revokeObjectURL(this.activeObjectUrl);
      this.activeObjectUrl = null;
    }
  }

  ngOnDestroy(): void {
    this.revokeObjectUrl();
  }
}
