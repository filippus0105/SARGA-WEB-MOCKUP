import { CommonModule } from '@angular/common';
import {
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  ViewChild
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AlertComponent } from '../../shared/alert/alert.component';

@Component({
  selector: 'app-reject-reason-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, AlertComponent],
  template: `
    <div *ngIf="open" class="modal-backdrop" (click)="onBackdropClick($event)">
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="reject-modal-title">
        <div class="modal-head">
          <h2 id="reject-modal-title">{{ title }}</h2>
          <button type="button" class="modal-close" aria-label="Tutup dialog" (click)="close()">✕</button>
        </div>

        <form (ngSubmit)="submit()" novalidate>
          <div class="modal-body">
            <p class="small">{{ description }}</p>

            <app-alert
              *ngIf="errorText"
              kind="error"
              title="Alasan belum valid"
              [message]="errorText"
              style="display:block;margin-top:.75rem"
            />

            <div class="field" style="margin-top:.9rem">
              <label class="label" for="verification-reject-reason">
                Alasan penolakan (minimal 5 karakter)
              </label>
              <textarea
                #reasonBox
                class="form-input"
                id="verification-reject-reason"
                name="reason"
                rows="4"
                required
                [placeholder]="placeholder"
                [(ngModel)]="reason"
              ></textarea>
            </div>
          </div>

          <div class="modal-actions">
            <button type="button" class="btn-secondary" [disabled]="busy" (click)="close()">Batal</button>
            <button type="submit" class="btn-danger" [disabled]="busy">
              {{ busy ? 'Mengirim...' : submitLabel }}
            </button>
          </div>
        </form>
      </div>
    </div>
  `
})
export class RejectReasonModalComponent implements OnChanges {
  @Input() open = false;
  @Input() title = 'Tolak pengajuan';
  @Input() description = '';
  @Input() placeholder = 'Tuliskan alasan penolakan.';
  @Input() submitLabel = 'Tolak';
  @Input() busy = false;
  @Input() serverError = '';

  @Output() closed = new EventEmitter<void>();
  @Output() confirmed = new EventEmitter<string>();

  @ViewChild('reasonBox') private reasonBox?: ElementRef<HTMLTextAreaElement>;

  reason = '';
  localError = '';
  private returnFocusEl: HTMLElement | null = null;

  get errorText(): string {
    return this.localError || this.serverError;
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['open']) {
      if (this.open) {
        this.reason = '';
        this.localError = '';
        this.returnFocusEl = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        setTimeout(() => this.reasonBox?.nativeElement.focus());
      } else if (this.returnFocusEl) {
        const el = this.returnFocusEl;
        this.returnFocusEl = null;
        setTimeout(() => el.focus());
      }
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.open && !this.busy) {
      this.close();
    }
  }

  onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget && !this.busy) {
      this.close();
    }
  }

  close(): void {
    if (this.busy) return;
    this.closed.emit();
  }

  submit(): void {
    if (this.busy) return;
    const trimmed = this.reason.trim();
    if (trimmed.length < 5) {
      this.localError = 'Alasan penolakan minimal 5 karakter.';
      return;
    }
    this.localError = '';
    this.confirmed.emit(trimmed);
  }
}
