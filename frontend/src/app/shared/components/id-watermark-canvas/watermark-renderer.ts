export type RedactionMode = 'solid' | 'blur';

export interface NormalizedRect {
  x: number;
  y: number;
  w: number;
  h: number;
  mode: RedactionMode;
}

export interface WatermarkStampConfig {
  organizationName: string;
  picName: string;
  picContact: string;
  fingerprint: string;
  watermarkEnabled: boolean;
}

export function formatWibTimestamp(date = new Date()): string {
  const utcMs = date.getTime() + date.getTimezoneOffset() * 60000;
  const wib = new Date(utcMs + 7 * 3600000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${wib.getFullYear()}-${pad(wib.getMonth() + 1)}-${pad(wib.getDate())} ${pad(wib.getHours())}:${pad(wib.getMinutes())}:${pad(wib.getSeconds())} WIB`;
}

export function generateDocumentFingerprint(): string {
  return `SRG-${Math.random().toString(36).slice(2, 6).toUpperCase()}-${Date.now().toString(36).slice(-4).toUpperCase()}`;
}

export function paintRedactionRect(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  rect: NormalizedRect,
  isDraft: boolean
): void {
  const rx = Math.round(rect.x * w);
  const ry = Math.round(rect.y * h);
  const rw = Math.max(8, Math.round(rect.w * w));
  const rh = Math.max(8, Math.round(rect.h * h));

  if (rect.mode === 'solid') {
    ctx.fillStyle = '#111111';
    ctx.fillRect(rx, ry, rw, rh);
    if (rw >= 52 && rh >= 18) {
      ctx.fillStyle = '#e2e8f0';
      ctx.font = `700 ${Math.max(9, Math.min(13, Math.floor(rh * 0.45)))}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('DISENSOR', rx + rw / 2, ry + rh / 2, rw - 8);
    }
  } else {
    const pixelSize = Math.max(8, Math.round(Math.min(rw, rh) / 4));
    const cols = Math.max(1, Math.ceil(rw / pixelSize));
    const rows = Math.max(1, Math.ceil(rh / pixelSize));
    const sample = document.createElement('canvas');
    sample.width = cols;
    sample.height = rows;
    const sctx = sample.getContext('2d');
    if (sctx) {
      sctx.imageSmoothingEnabled = false;
      sctx.drawImage(ctx.canvas, rx, ry, rw, rh, 0, 0, cols, rows);
      ctx.save();
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(sample, 0, 0, cols, rows, rx, ry, rw, rh);
      ctx.fillStyle = 'rgba(15, 23, 42, 0.25)';
      ctx.fillRect(rx, ry, rw, rh);
      ctx.restore();
    }
  }

  if (isDraft) {
    ctx.save();
    ctx.strokeStyle = '#0f766e';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 4]);
    ctx.strokeRect(rx, ry, rw, rh);
    ctx.restore();
  }
}

export function paintForensicWatermark(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  config: WatermarkStampConfig
): void {
  const timestamp = formatWibTimestamp();
  const banner = `HANYA UNTUK VERIFIKASI KEANGGOTAAN SARGA ${config.organizationName.toUpperCase()}`;

  ctx.save();
  ctx.translate(w / 2, h / 2);
  ctx.rotate(-Math.PI / 7);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const diag = Math.hypot(w, h);
  const stepY = Math.max(76, Math.round(h / 5));
  const fontSize = Math.max(13, Math.round(w / 48));

  for (let y = -diag / 2; y <= diag / 2; y += stepY) {
    ctx.font = `700 ${fontSize}px sans-serif`;
    ctx.fillStyle = 'rgba(15, 118, 110, 0.28)';
    ctx.fillText(banner, 0, y);

    ctx.font = `600 ${Math.max(11, fontSize - 2)}px monospace`;
    ctx.fillStyle = 'rgba(17, 17, 17, 0.24)';
    ctx.fillText(`PJ: ${config.picName} (${config.picContact}) · ${timestamp}`, 0, y + fontSize + 5);
  }
  ctx.restore();

  const boxHeight = Math.max(78, Math.round(h * 0.21));
  const padX = Math.max(14, Math.round(w * 0.025));
  const boxY = h - boxHeight;

  ctx.save();
  ctx.fillStyle = 'rgba(15, 23, 42, 0.78)';
  ctx.fillRect(0, boxY, w, boxHeight);

  ctx.fillStyle = '#5eead4';
  ctx.font = `700 ${Math.max(11, Math.round(w / 62))}px monospace`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';

  const lineGap = Math.max(15, Math.round((boxHeight - 16) / 4));
  const startY = boxY + 10;
  ctx.fillText(banner, padX, startY, w - padX * 2);

  ctx.fillStyle = '#f8fafc';
  ctx.font = `600 ${Math.max(10, Math.round(w / 68))}px monospace`;
  ctx.fillText(`PENANGGUNG JAWAB : ${config.picName}`, padX, startY + lineGap, w - padX * 2);
  ctx.fillText(`KONTAK RESMI     : ${config.picContact}`, padX, startY + lineGap * 2, w - padX * 2);
  ctx.fillText(
    `TANGGAL PENGAJUAN: ${timestamp} | ID: ${config.fingerprint}`,
    padX,
    startY + lineGap * 3,
    w - padX * 2
  );
  ctx.restore();
}

export function renderWatermarkedDocument(
  canvas: HTMLCanvasElement,
  img: HTMLImageElement,
  rects: NormalizedRect[],
  draft: NormalizedRect | null,
  config: WatermarkStampConfig
): void {
  const rawW = img.naturalWidth || 960;
  const rawH = img.naturalHeight || 600;
  const scale = rawW > 1024 ? 1024 / rawW : rawW < 640 ? 800 / rawW : 1;
  const w = Math.max(400, Math.round(rawW * scale));
  const h = Math.max(250, Math.round(rawH * scale));

  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);

  for (const rect of rects) {
    paintRedactionRect(ctx, w, h, rect, false);
  }
  if (draft && draft.w > 0 && draft.h > 0) {
    paintRedactionRect(ctx, w, h, draft, true);
  }
  if (config.watermarkEnabled) {
    paintForensicWatermark(ctx, w, h, config);
  }
}
