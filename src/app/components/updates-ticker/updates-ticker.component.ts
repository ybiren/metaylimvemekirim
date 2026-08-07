import {
  AfterViewInit,
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { PageTemplateService } from '../../services/page-template.service';

interface ISiteUpdate {
  id?: number;
  title?: string;
  href?: string;
  isPromo?: boolean;
  underline?: boolean;
  bold?: boolean;
  targetBlank?: boolean;
  sortOrder?: number;
  isActive?: boolean;
}

/** px per second the strip travels, so speed stays the same whatever the length */
const SPEED = 55;

@Component({
  selector: 'app-updates-ticker',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (items().length) {
    <div
      class="ticker"
      dir="rtl"
      role="region"
      aria-label="עידכונים מהאתר"
      [class.paused]="paused()"
      (mouseenter)="hoverPaused.set(true)"
      (mouseleave)="hoverPaused.set(false)"
      (focusin)="hoverPaused.set(true)"
      (focusout)="hoverPaused.set(false)"
      (touchstart)="onTouchStart($event)"
      (touchend)="onTouchEnd($event)"
      (touchcancel)="onTouchCancel()"
      (click)="onClick($event)"
    >
      <div class="ticker__viewport">
        <div
          class="ticker__track"
          #track
          [style.animation-duration.s]="durationSec()"
        >
          <!-- two identical runs: the animation shifts by exactly one, so the
               seam never shows -->
          @for (run of [0, 1]; track run) {
          <div class="ticker__run" [attr.aria-hidden]="run === 1 ? 'true' : null">
            @for (u of items(); track u.id ?? $index) {
            <a
              class="ticker__item"
              [class.is-promo]="u.isPromo"
              [class.is-bold]="u.bold"
              [class.is-underline]="u.underline"
              [href]="u.href || '#'"
              [attr.target]="u.targetBlank ? '_blank' : null"
              [attr.rel]="u.targetBlank ? 'noopener noreferrer' : null"
              [attr.tabindex]="run === 1 ? -1 : null"
              >{{ u.title }}</a
            >
            <span class="ticker__dot" aria-hidden="true">•</span>
            }
          </div>
          }
        </div>
      </div>
    </div>
    }
  `,
  styles: [
    `
      :host {
        display: block;
      }

      .ticker {
        display: flex;
        align-items: stretch;
        min-height: 38px;

        background: linear-gradient(#ffffff, #f3f7fb);
        border-bottom: 1px solid #d8e2ec;
        box-shadow: 0 1px 2px rgba(11, 41, 72, 0.06);

        font-family: Arial, Helvetica, sans-serif;
        overflow: hidden;
      }

      .ticker__viewport {
        position: relative;
        flex: 1 1 auto;
        min-width: 0;
        overflow: hidden;
        display: flex;
        align-items: center;
      }

      /* let items fade at the edges instead of being cut off mid-word */
      .ticker__viewport::before,
      .ticker__viewport::after {
        content: '';
        position: absolute;
        top: 0;
        bottom: 0;
        width: 28px;
        z-index: 1;
        pointer-events: none;
      }
      .ticker__viewport::before {
        right: 0;
        background: linear-gradient(to left, #f5f9fc, rgba(245, 249, 252, 0));
      }
      .ticker__viewport::after {
        left: 0;
        background: linear-gradient(to right, #f5f9fc, rgba(245, 249, 252, 0));
      }

      .ticker__track {
        display: flex;
        flex: 0 0 auto;
        width: max-content;
        animation-name: ticker-scroll;
        animation-timing-function: linear;
        animation-iteration-count: infinite;
        will-change: transform;
      }

      .ticker.paused .ticker__track {
        animation-play-state: paused;
      }

      .ticker__run {
        display: flex;
        align-items: center;
        flex: 0 0 auto;
      }

      .ticker__item {
        padding: 0 10px;
        font-size: 13.5px;
        color: #0b2948;
        text-decoration: none;
        white-space: nowrap;
      }
      .ticker__item:hover,
      .ticker__item:focus-visible {
        color: #0b79d0;
        text-decoration: underline;
      }

      .ticker__item.is-bold {
        font-weight: 700;
      }
      .ticker__item.is-underline {
        text-decoration: underline;
      }
      .ticker__item.is-promo {
        color: #c2410c;
        font-weight: 700;
      }

      .ticker__dot {
        color: #9db4c8;
        font-size: 12px;
      }

      /* RTL: the run starts at the right, so it has to travel rightwards for
         the items to arrive in reading order */
      @keyframes ticker-scroll {
        from {
          transform: translateX(0);
        }
        to {
          transform: translateX(50%);
        }
      }

      /* Phones: the strip is short, so every pixel of it has to carry text.
         The fades are trimmed rather than the updates. */
      @media (max-width: 520px) {
        .ticker {
          min-height: 36px;
        }
        .ticker__item {
          padding: 0 8px;
          font-size: 12.5px;
        }
        .ticker__viewport::before,
        .ticker__viewport::after {
          width: 14px;
        }
      }

      @media (max-width: 340px) {
        .ticker__item {
          padding: 0 7px;
          font-size: 12px;
        }
      }

      /* Touch: no hover to pause, so the whole strip is the target and it must
         not feel cramped. */
      @media (hover: none) {
        .ticker {
          min-height: 40px;
        }
      }

      /* Someone who asked for less motion gets a plain scrollable strip. */
      @media (prefers-reduced-motion: reduce) {
        .ticker__track {
          animation: none;
        }
        .ticker__viewport {
          overflow-x: auto;
        }
        .ticker__run[aria-hidden='true'] {
          display: none;
        }
      }
    `,
  ],
})
export class UpdatesTickerComponent implements AfterViewInit, OnDestroy {
  private pageTemplateService = inject(PageTemplateService);
  private hostEl = inject(ElementRef<HTMLElement>);

  private track = viewChild<ElementRef<HTMLElement>>('track');

  private updates = signal<ISiteUpdate[]>([]);
  durationSec = signal(30);

  // two independent reasons to hold the strip still, so a tap on a phone and a
  // hover on a desktop don't fight each other
  hoverPaused = signal(false);
  private tapPaused = signal(false);
  paused = computed(() => this.hoverPaused() || this.tapPaused());

  private touchStartX = 0;
  private touchStartY = 0;
  private pausedBeforeTouch = false;
  private suppressNextClick = false;

  private resizeObserver?: ResizeObserver;

  items = computed(() =>
    this.updates()
      .filter((u) => u.isActive !== false && !!u.title)
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || (a.id ?? 0) - (b.id ?? 0))
  );

  constructor() {
    this.pageTemplateService.load_updates().subscribe({
      next: (rows) => {
        this.updates.set((rows as ISiteUpdate[]) ?? []);
        // wait for the new items to be laid out before measuring
        setTimeout(() => this.measure());
      },
      error: () => this.updates.set([]),
    });
  }

  ngAfterViewInit(): void {
    this.measure();

    // the strip has to keep its speed when the window is resized
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => this.measure());
      const el = this.track()?.nativeElement;
      if (el) this.resizeObserver.observe(el);
    }
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
  }

  onTouchStart(event: TouchEvent) {
    const t = event.touches[0];
    this.touchStartX = t ? t.clientX : 0;
    this.touchStartY = t ? t.clientY : 0;
    this.pausedBeforeTouch = this.tapPaused();
    // freeze straight away so the finger has something steady to read
    this.tapPaused.set(true);
  }

  onTouchEnd(event: TouchEvent) {
    const t = event.changedTouches[0];
    const dragged =
      !!t &&
      (Math.abs(t.clientX - this.touchStartX) > 10 ||
        Math.abs(t.clientY - this.touchStartY) > 10);

    if (dragged) {
      // the finger scrolled the page rather than tapping the strip
      this.tapPaused.set(this.pausedBeforeTouch);
      this.suppressNextClick = true;
      return;
    }

    // A tap toggles. The tap that freezes the strip must not open an update,
    // because the link was moving when it was aimed at - opening one takes a
    // second, deliberate tap on a strip that is now standing still.
    this.tapPaused.set(!this.pausedBeforeTouch);
    this.suppressNextClick = !this.pausedBeforeTouch;
  }

  onTouchCancel() {
    this.tapPaused.set(this.pausedBeforeTouch);
    this.suppressNextClick = true;
  }

  onClick(event: Event) {
    if (this.suppressNextClick) {
      this.suppressNextClick = false;
      event.preventDefault();
      event.stopPropagation();
    }
  }

  // Touching anywhere else lets the strip run again, so a tap cannot leave it
  // frozen for the rest of the visit.
  @HostListener('document:touchstart', ['$event'])
  @HostListener('document:mousedown', ['$event'])
  onDocumentPress(event: Event) {
    if (!this.tapPaused()) return;

    const host = this.hostEl.nativeElement;
    const target = event.target as Node | null;
    if (host && target && host.contains(target)) return;

    this.tapPaused.set(false);
    this.pausedBeforeTouch = false;
  }

  /** Duration for one run, so the strip moves at a constant speed. */
  private measure() {
    const el = this.track()?.nativeElement;
    if (!el) return;

    const runWidth = el.scrollWidth / 2; // the track holds two identical runs
    if (runWidth > 0) {
      this.durationSec.set(Math.max(12, runWidth / SPEED));
    }
  }
}
