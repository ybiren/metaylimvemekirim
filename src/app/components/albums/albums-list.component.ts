import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
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
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  loading = signal(true);
  error = signal('');
  albums = signal<IPublicAlbumDetail[]>([]);

  /** null = viewer closed. */
  viewer = signal<{ photos: IPublicAlbumPhoto[]; index: number; title: string } | null>(null);

  /** Passed to the viewer so it can resolve relative urls. */
  abs = (url: string): string => this.albumsSvc.toAbsolute(url);

  ngOnInit(): void {
    // A link can name a single album: /albums?q=12 is the same page as
    // /albums/12, so hand over to the gallery instead of keeping a second
    // way of showing one album. replaceUrl keeps the redirect out of the
    // history, so Back goes where the visitor came from.
    const q = Number(this.route.snapshot.queryParamMap.get('q'));
    if (Number.isInteger(q) && q > 0) {
      this.router.navigate(['/albums', q], { replaceUrl: true });
      return;
    }

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
