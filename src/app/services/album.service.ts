import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';

export interface ExtraImageItem {
  path?: string;
  content_type?: string;
  size?: number;
  filename?: string;
  id?: string; // <-- add this if your server returns GUID as id
}

export interface ListExtraImagesResponse {
  ok: boolean;
  count: number;
  items: ExtraImageItem[];
  urls: string[]; // like "/images/12/extra/<filename>"
}

@Injectable({ providedIn: 'root' })
export class AlbumService {
  private http = inject(HttpClient);
  private baseUrl = environment.apibase; // e.g. http://194.36.90.119:8000

  listExtraImages(userId: number) {
    return this.http.get<ListExtraImagesResponse>(`${this.baseUrl}/images/${userId}/extra`);
  }

  /** DELETE extra image by guid (recommended). */
  deleteExtraImage(userId: number, guid: string) {
    return this.http.delete<{ ok: boolean }>(
      `${this.baseUrl}/images/${userId}/extra/${encodeURIComponent(guid)}`
    );
  }

  /** Build a full URL for <img [src]> */
  toAbsolute(urlFromApi: string): string {
    if (!urlFromApi) return '';
    if (urlFromApi.startsWith('http')) return urlFromApi;
    return `${this.baseUrl}${urlFromApi}`;
  }
}
