import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Item } from '../models';

export interface ItemListResponse {
  success: boolean;
  count: number;
  items: Item[];
  message?: string;
}

export interface ItemResponse {
  success: boolean;
  item: Item & {
    loans?: Array<{
      id: string;
      orgId: string;
      itemId: string;
      borrowerId: string;
      ownerId?: string | null;
      startDate: string;
      endDate: string;
      status: string;
      purpose: string;
      rejectionReason?: string;
      returnConfirmedAt?: string;
      createdAt?: string;
      updatedAt?: string;
      borrower?: { id: string; fullName: string; waNumber?: string };
    }>;
  };
  message?: string;
}

export interface ItemFilterParams {
  search?: string;
}

export interface LocalItemOverride {
  name?: string;
  description?: string;
  location?: string;
  maxDays?: number;
  contents?: string[];
  instructions?: string;
  image?: string;
  status?: Item['status'];
  updatedAt?: string;
}

export const ITEM_IMAGE_OPTIONS: ReadonlyArray<readonly [string, string]> = [
  ['/img/placeholder-item.svg', 'Belum ada foto'],
  ['/img/obeng.jpg', 'Obeng dan mata obeng'],
  ['/img/tangga.jpg', 'Tangga aluminium'],
  ['/img/tenda.jpg', 'Tenda kemping'],
  ['/img/ketam.jpg', 'Ketam kayu'],
  ['/img/bubut.jpg', 'Mesin bubut kayu'],
  ['/img/perkakas.jpg', 'Perkakas tangan'],
  ['/img/mower.jpg', 'Mesin pemotong rumput'],
  ['/img/projector.jpg', 'Proyektor portabel']
];

export function normalizeItemImagePath(source?: string | null): string {
  if (!source || source === 'assets/placeholder-item.svg' || source === 'img/placeholder-item.svg') {
    return '/img/placeholder-item.svg';
  }
  if (source.startsWith('/uploads/')) {
    const apiOrigin = environment.apiUrl.replace(/\/api\/v1\/?$/, '');
    return `${apiOrigin}${source}`;
  }
  if (source.startsWith('assets/')) return `/${source.slice('assets/'.length)}`;
  if (source.startsWith('img/')) return `/${source}`;
  return source;
}

@Injectable({
  providedIn: 'root'
})
export class ItemService {
  private http = inject(HttpClient);
  private baseUrl = `${environment.apiUrl}/items`;
  private readonly archivedKey = 'sarga_archived_item_ids';
  private readonly editedItemsKey = 'sarga_edited_items_map';

  getItems(params?: ItemFilterParams): Observable<ItemListResponse> {
    let httpParams = new HttpParams();
    if (params?.search) httpParams = httpParams.set('q', params.search);

    return this.http.get<ItemListResponse>(this.baseUrl, { params: httpParams });
  }

  getItemById(id: string): Observable<ItemResponse> {
    return this.http.get<ItemResponse>(`${this.baseUrl}/${id}`);
  }

  createItem(itemData: Partial<Item>): Observable<ItemResponse> {
    return this.http.post<ItemResponse>(this.baseUrl, itemData);
  }

  getLocalItemOverrides(): Record<string, LocalItemOverride> {
    try {
      const raw = localStorage.getItem(this.editedItemsKey);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }

  getLocalItemOverride(itemId: string): LocalItemOverride | null {
    return this.getLocalItemOverrides()[itemId] ?? null;
  }

  updateItemLocally(itemId: string, patch: LocalItemOverride): void {
    const all = this.getLocalItemOverrides();
    all[itemId] = {
      ...(all[itemId] ?? {}),
      ...patch,
      updatedAt: new Date().toISOString()
    };
    try {
      localStorage.setItem(this.editedItemsKey, JSON.stringify(all));
    } catch {
      // Ignore storage quota errors
    }
  }

  getEffectiveItem<T extends Item>(item: T): T {
    const override = this.getLocalItemOverride(item.id);
    const locallyArchived = this.isLocallyArchived(item.id);
    const merged: T = {
      ...item,
      ...(override ?? {})
    };
    if (locallyArchived) {
      merged.status = 'DIARSIPKAN';
    }
    return merged;
  }

  getArchivedIds(): string[] {
    try {
      const raw = localStorage.getItem(this.archivedKey);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  isLocallyArchived(itemId: string): boolean {
    return this.getArchivedIds().includes(itemId);
  }

  archiveItemLocally(itemId: string): void {
    const ids = this.getArchivedIds();
    if (!ids.includes(itemId)) {
      this.saveArchivedIds([...ids, itemId]);
    }
    this.updateItemLocally(itemId, { status: 'DIARSIPKAN' });
  }

  restoreItemLocally(itemId: string, nextStatus: Item['status'] = 'TERSEDIA'): void {
    const ids = this.getArchivedIds().filter(id => id !== itemId);
    this.saveArchivedIds(ids);
    this.updateItemLocally(itemId, { status: nextStatus });
  }

  private saveArchivedIds(ids: string[]): void {
    try {
      localStorage.setItem(this.archivedKey, JSON.stringify(ids));
    } catch {
      // Ignore storage quota errors
    }
  }
}
