import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { AlbumsService, IPublicAlbumDetail } from '../../services/albums.service';
import { PhotoViewerComponent } from './photo-viewer.component';

@Component({
  selector: 'app-album-gallery',
  standalone: true,
  imports: [CommonModule, RouterModule, PhotoViewerComponent],
  templateUrl: './album-gallery.component.html',
  styleUrls: ['./album-gallery.component.scss'],
})
export class AlbumGalleryComponent implements OnInit {
  private albumsSvc = inject(AlbumsService);
  private route = inject(ActivatedRoute);

  loading = signal(true);
  error = signal('');
  album = signal<IPublicAlbumDetail | null>(null);

  photos = computed(() => this.album()?.photos ?? []);
  count = computed(() => this.photos().length);

  /** null = viewer closed, otherwise the index being viewed. */
  viewerIndex = signal<number | null>(null);

  /** Passed to the viewer so it can resolve relative urls. */
  abs = (url: string): string => this.albumsSvc.toAbsolute(url);

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('albumId'));
    if (!Number.isFinite(id) || id <= 0) {
      this.loading.set(false);
      this.error.set('אלבום לא תקין');
      return;
    }

    this.albumsSvc.get(id).subscribe({
      next: (res) => {
        this.album.set(res);
        this.loading.set(false);
      },
      error: (err) => {
        console.error(err);
        this.album.set(null);
        this.error.set(err?.status === 404 ? 'האלבום לא נמצא' : 'שגיאה בטעינת האלבום');
        this.loading.set(false);
      },
    });
  }

  open(i: number): void {
    if (i < 0 || i >= this.count()) return;
    this.viewerIndex.set(i);
  }

  close(): void {
    this.viewerIndex.set(null);
  }
}
