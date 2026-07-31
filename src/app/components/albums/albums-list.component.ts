import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterModule } from '@angular/router';
import {
  AlbumsService,
  IPublicAlbumDetail,
  IPublicAlbumPhoto,
} from '../../services/albums.service';
import { PhotoViewerComponent } from './photo-viewer.component';

@Component({
  selector: 'app-albums-list',
  standalone: true,
  imports: [CommonModule, RouterModule, PhotoViewerComponent],
  templateUrl: './albums-list.component.html',
  styleUrls: ['./albums-list.component.scss'],
})
export class AlbumsListComponent implements OnInit {
  private albumsSvc = inject(AlbumsService);

  loading = signal(true);
  error = signal('');
  albums = signal<IPublicAlbumDetail[]>([]);

  /** null = viewer closed. */
  viewer = signal<{ photos: IPublicAlbumPhoto[]; index: number; title: string } | null>(null);

  /** Passed to the viewer so it can resolve relative urls. */
  abs = (url: string): string => this.albumsSvc.toAbsolute(url);

  ngOnInit(): void {
    this.albumsSvc.list().subscribe({
      next: (res) => {
        this.albums.set(res?.items ?? []);
        this.loading.set(false);
      },
      error: (err) => {
        console.error(err);
        this.albums.set([]);
        this.error.set('שגיאה בטעינת האלבומים');
        this.loading.set(false);
      },
    });
  }

  openViewer(album: IPublicAlbumDetail, index: number): void {
    this.viewer.set({ photos: album.photos ?? [], index, title: album.title });
  }

  closeViewer(): void {
    this.viewer.set(null);
  }
}
