import { Component, DestroyRef, OnInit, inject, input, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AlbumService } from '../../services/album.service';
import { getCurrentUserId } from '../../core/current-user';

type UiImage = {
  apiUrl: string;       // "/images/{id}/extra/..."
  absoluteUrl: string;  // full URL
  filename?: string;
};

@Component({
  selector: 'app-album',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './album.component.html',
  styleUrls: ['./album.component.scss'],
})
export class AlbumComponent implements OnInit {
  private albumSrv = inject(AlbumService);
  private destroyRef = inject(DestroyRef);

  userId = getCurrentUserId()

  loading = signal(false);
  errorMsg = signal('');
  images = signal<UiImage[]>([]);
  index = signal(0);

  count = computed(() => this.images().length);
  hasImages = computed(() => this.count() > 0);

  current = computed(() => {
    const list = this.images();
    if (!list.length) return null;
    const i = this.index();
    if (i < 0 || i >= list.length) return list[0];
    return list[i];
  });

  ngOnInit(): void {
    this.refresh();
  }

  refresh(): void {
    this.loading.set(true);
    this.errorMsg.set('');

    const id = Number(this.userId);
    if (!Number.isFinite(id) || id <= 0) {
      this.loading.set(false);
      this.errorMsg.set('UserId לא תקין');
      return;
    }

    this.albumSrv
      .listExtraImages(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          if (!res?.ok) {
            this.images.set([]);
            this.index.set(0);
            this.errorMsg.set('שגיאה בטעינת אלבום');
            this.loading.set(false);
            return;
          }

          const ui: UiImage[] = (res.urls ?? []).map((apiUrl) => ({
            apiUrl,
            absoluteUrl: this.albumSrv.toAbsolute(apiUrl),
            filename: this.extractFilename(apiUrl),
          }));

          this.images.set(ui);
          this.index.set(0);
          this.loading.set(false);
        },
        error: (err) => {
          console.error(err);
          this.images.set([]);
          this.index.set(0);
          this.errorMsg.set('שגיאה בטעינת אלבום (שרת/רשת)');
          this.loading.set(false);
        },
      });
  }

  next(): void {
    const n = this.count();
    if (n <= 1) return;
    this.index.set((this.index() + 1) % n);
  }

  prev(): void {
    const n = this.count();
    if (n <= 1) return;
    this.index.set((this.index() - 1 + n) % n);
  }

  goTo(i: number): void {
  const n = this.count();
  if (n === 0) return;
  if (i < 0 || i >= n) return;
  this.index.set(i);
}

  private extractFilename(apiUrl: string): string | undefined {
    if (!apiUrl) return undefined;
    const parts = apiUrl.split('/');
    return parts.length ? parts[parts.length - 1] : undefined;
  }
}
