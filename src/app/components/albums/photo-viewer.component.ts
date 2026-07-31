import { CommonModule } from '@angular/common';
import {
  Component,
  HostListener,
  OnDestroy,
  OnInit,
  computed,
  input,
  output,
  signal,
} from '@angular/core';

export interface IViewerPhoto {
  id: number;
  image_url: string;
}

/** Full-screen picture viewer shared by the albums page and a single album. */
@Component({
  selector: 'app-photo-viewer',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div
      class="viewer"
      (click)="close()"
      (touchstart)="onTouchStart($event)"
      (touchend)="onTouchEnd($event)"
    >
      <button type="button" class="viewer__close" (click)="close()" aria-label="סגירה">✕</button>

      <div class="viewer__stage" (click)="$event.stopPropagation()">
        @if (current(); as photo) {
          <img [src]="src(photo)" [alt]="title()" />
        }
      </div>

      @if (count() > 1) {
        <button
          type="button"
          class="viewer__nav viewer__nav--prev"
          (click)="$event.stopPropagation(); prev()"
          aria-label="הקודם"
        >
          ›
        </button>

        <button
          type="button"
          class="viewer__nav viewer__nav--next"
          (click)="$event.stopPropagation(); next()"
          aria-label="הבא"
        >
          ‹
        </button>

        <div class="viewer__counter">{{ index() + 1 }} / {{ count() }}</div>
      }
    </div>
  `,
  styles: [`
    .viewer {
      position: fixed;
      inset: 0;
      z-index: 1000;

      background: rgba(0, 0, 0, 0.9);

      display: flex;
      align-items: center;
      justify-content: center;

      /* let the browser handle vertical gestures, we only read horizontal swipes */
      touch-action: pan-y;
    }

    .viewer__stage {
      max-width: 100vw;
      max-height: 100vh;
      padding: 48px 12px;
      box-sizing: border-box;

      display: flex;
      align-items: center;
      justify-content: center;
    }

    .viewer__stage img {
      max-width: 100%;
      max-height: calc(100vh - 96px);
      object-fit: contain;
      border-radius: 6px;
      display: block;
    }

    .viewer__close {
      position: absolute;
      top: 10px;
      inset-inline-end: 12px;

      width: 40px;
      height: 40px;
      border-radius: 50%;
      border: none;

      background: rgba(255, 255, 255, 0.15);
      color: #fff;
      font-size: 20px;
      line-height: 1;
      cursor: pointer;
    }

    .viewer__nav {
      position: absolute;
      top: 50%;
      transform: translateY(-50%);

      width: 44px;
      height: 64px;
      border: none;
      border-radius: 8px;

      background: rgba(255, 255, 255, 0.15);
      color: #fff;
      font-size: 34px;
      line-height: 1;
      cursor: pointer;
    }

    .viewer__nav--prev { inset-inline-end: 8px; }
    .viewer__nav--next { inset-inline-start: 8px; }

    .viewer__counter {
      position: absolute;
      bottom: 14px;
      inset-inline-start: 50%;
      transform: translateX(50%);

      color: #fff;
      font-size: 13px;
      background: rgba(255, 255, 255, 0.15);
      padding: 4px 12px;
      border-radius: 999px;
    }

    @media (max-width: 600px) {
      .viewer__stage {
        padding: 56px 6px;
      }

      .viewer__stage img {
        max-height: calc(100vh - 112px);
      }

      /* on phones the swipe is the primary control — keep the arrows small */
      .viewer__nav {
        width: 36px;
        height: 52px;
        font-size: 26px;
        opacity: 0.75;
      }
    }
  `]
})
export class PhotoViewerComponent implements OnInit, OnDestroy {
  photos = input.required<IViewerPhoto[]>();
  startIndex = input<number>(0);
  title = input<string>('');
  /** Turns an API url into an absolute one; supplied by the host page. */
  toAbsolute = input<(url: string) => string>((u) => u);

  closed = output<void>();

  index = signal(0);

  count = computed(() => this.photos().length);
  current = computed(() => this.photos()[this.index()] ?? null);

  ngOnInit(): void {
    const i = this.startIndex();
    this.index.set(i >= 0 && i < this.count() ? i : 0);
    // stop the page behind the overlay from scrolling on mobile
    document.body.style.overflow = 'hidden';
  }

  ngOnDestroy(): void {
    document.body.style.overflow = '';
  }

  src(photo: IViewerPhoto): string {
    return this.toAbsolute()(photo.image_url);
  }

  close(): void {
    this.closed.emit();
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

  @HostListener('document:keydown', ['$event'])
  onKey(ev: KeyboardEvent): void {
    if (ev.key === 'Escape') {
      this.close();
    } else if (ev.key === 'ArrowRight') {
      // RTL page: right arrow moves to the previous picture
      this.prev();
    } else if (ev.key === 'ArrowLeft') {
      this.next();
    }
  }

  // ---------- swipe (same approach as the profile album) ----------

  private touchStartX = 0;
  private touchStartY = 0;

  onTouchStart(ev: TouchEvent): void {
    const t = ev.changedTouches[0];
    this.touchStartX = t.clientX;
    this.touchStartY = t.clientY;
  }

  onTouchEnd(ev: TouchEvent): void {
    const t = ev.changedTouches[0];
    const dx = t.clientX - this.touchStartX;
    const dy = t.clientY - this.touchStartY;

    // ignore mostly-vertical gestures
    if (Math.abs(dy) > Math.abs(dx)) return;

    const THRESHOLD = 40; // px
    if (Math.abs(dx) < THRESHOLD) return;

    if (dx < 0) this.next();
    else this.prev();
  }
}
