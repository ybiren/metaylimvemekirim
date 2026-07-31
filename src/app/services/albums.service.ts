import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';

export interface IPublicAlbumPhoto {
  id: number;
  album_id: number;
  filename: string;
  image_url: string;
  sort_order: number;
}

export interface IPublicAlbum {
  id: number;
  title: string;
  description?: string | null;
  photo_count: number;
  cover_url: string;
  /** First few pictures, so a card can show the album holds more than one. */
  preview_urls: string[];
}

export interface IPublicAlbumDetail extends IPublicAlbum {
  photos: IPublicAlbumPhoto[];
}

/** Read-only access to the site albums (only active ones are served). */
@Injectable({ providedIn: 'root' })
export class AlbumsService {
  private http = inject(HttpClient);
  private baseUrl = environment.apibase;

  /** Albums with all of their pictures — the albums page shows them up front. */
  list() {
    return this.http.get<{ items: IPublicAlbumDetail[]; total: number }>(
      `${this.baseUrl}/api/albums`
    );
  }

  get(albumId: number) {
    return this.http.get<IPublicAlbumDetail>(`${this.baseUrl}/api/albums/${albumId}`);
  }

  /** Build a full URL for <img [src]>, like AlbumService.toAbsolute. */
  toAbsolute(urlFromApi: string): string {
    if (!urlFromApi) return '';
    if (urlFromApi.startsWith('http')) return urlFromApi;
    return `${this.baseUrl}${urlFromApi}`;
  }
}
