import { Component, ElementRef, computed, signal, inject, viewChild } from '@angular/core';
import { NgIf } from '@angular/common';
import { SwPush } from '@angular/service-worker';
import { PushService } from '../../services/push.service';
import { getCurrentUserId } from '../../core/current-user';
import { LoginService } from '../../services/login.service';
import { PwaStateService } from '../../services/pwa-state.service';

@Component({
  selector: 'pwa-install',
  standalone: true,
  imports: [NgIf],
  template: `
    <button
      *ngIf="canInstall()"
      class="install-btn"
      (click)="install()"
    >
      📲 לחץ כאן להתקנת האפליקציה
    </button>

    <p *ngIf="justInstalled() && canEnablePush()" class="installed-note">
      האפליקציה הותקנה! נותר רק לאשר קבלת התראות:
    </p>

    <button
      *ngIf="canEnablePush()"
      #notifyBtn
      class="notify-btn"
      [class.highlight]="justInstalled()"
      [disabled]="busy()"
      (click)="enablePush()"
    >
      🔔 {{ busy() ? 'רגע…' : 'הפעלת התראות' }}
    </button>

    <!-- Safari never fires beforeinstallprompt, and iOS only allows push once
         the site is on the home screen - so the steps have to be spelled out. -->
    <div *ngIf="showIosHint()" class="ios-hint">
      <strong>רוצה לקבל התראות?</strong>
      <span>
        יש להוסיף את האתר למסך הבית: לוחצים על
        <span class="ios-share">􀈂</span> שיתוף בסרגל התחתון, ואז
        «הוספה למסך הבית», ופותחים את האתר משם.
      </span>
    </div>

    <p *ngIf="pushBlocked()" class="blocked">
      ההתראות חסומות בהגדרות הדפדפן. יש לאפשר אותן כדי לקבל עדכונים.
    </p>
  `,
  styles: [`
    :host {
      display: block;
      direction: rtl;
      text-align: center;
      margin: 24px 0;
    }

    button {
      font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    }

    /* Install button */
    .install-btn {
      background: linear-gradient(135deg, #4f46e5, #6366f1);
      color: #fff;

      border: none;
      border-radius: 16px;

      padding: 14px 24px;
      font-size: 16px;
      font-weight: 600;

      cursor: pointer;

      display: inline-flex;
      align-items: center;
      gap: 10px;

      box-shadow: 0 10px 25px rgba(79, 70, 229, 0.35);
      transition: transform 0.15s ease, box-shadow 0.15s ease;
    }

    .install-btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 14px 32px rgba(79, 70, 229, 0.45);
    }

    .install-btn:active {
      transform: translateY(0);
      box-shadow: 0 8px 18px rgba(79, 70, 229, 0.3);
    }

    /* Notifications button */
    .notify-btn {
      margin-top: 16px;

      background: #ffffff;
      color: #4f46e5;

      border: 2px solid #4f46e5;
      border-radius: 14px;

      padding: 12px 22px;
      font-size: 15px;
      font-weight: 600;

      cursor: pointer;

      display: inline-flex;
      align-items: center;
      gap: 8px;

      transition: background 0.15s ease, color 0.15s ease;
    }

    .notify-btn:hover:not(:disabled) {
      background: #4f46e5;
      color: #ffffff;
    }

    .notify-btn:disabled {
      opacity: 0.6;
      cursor: default;
    }

    /* Straight after the install the app cannot be launched from here, so the
       next step has to draw the eye by itself. */
    .notify-btn.highlight {
      animation: notify-pulse 1.4s ease-out 3;
    }

    @keyframes notify-pulse {
      0%   { box-shadow: 0 0 0 0 rgba(79, 70, 229, 0.5); }
      70%  { box-shadow: 0 0 0 14px rgba(79, 70, 229, 0); }
      100% { box-shadow: 0 0 0 0 rgba(79, 70, 229, 0); }
    }

    @media (prefers-reduced-motion: reduce) {
      .notify-btn.highlight { animation: none; outline: 3px solid #4f46e5; }
    }

    .installed-note {
      margin: 16px 0 0;
      font-size: 15px;
      font-weight: 600;
      color: #1f2937;
    }

    .ios-hint {
      margin: 16px auto 0;
      max-width: 420px;

      display: flex;
      flex-direction: column;
      gap: 6px;

      background: #f5f7fa;
      border: 1px solid #dbe2ea;
      border-radius: 14px;
      padding: 12px 16px;

      font-size: 14px;
      line-height: 1.6;
      color: #24303f;
    }

    .ios-share {
      font-size: 16px;
    }

    .blocked {
      margin: 12px 0 0;
      font-size: 13.5px;
      color: #b45309;
    }
  `],
})
export class PwaInstallComponent {
  private deferred: any = null;
  private state = inject(PwaStateService);
  private push = inject(PushService);
  private swPush = inject(SwPush);
  private login = inject(LoginService);

  /** a subscription is stored against a user, so there has to be one */
  private userId = signal(getCurrentUserId());

  /** beforeinstallprompt was captured and not yet used */
  private promptReady = signal(false);

  /** already has a push subscription, so there is nothing to enable */
  private subscribed = signal(false);

  /** browser-level permission, re-read after every attempt */
  private permission = signal<NotificationPermission | 'unsupported'>(
    typeof Notification === 'undefined' ? 'unsupported' : Notification.permission
  );

  busy = signal(false);

  /**
   * Installed from this very tab. Kept apart from `standalone`, which means
   * "running as the installed app" - the tab that did the install is still an
   * ordinary browser tab, and conflating the two would mislead the iOS check.
   */
  private installedHere = signal(false);

  /** just installed, so the next step is worth drawing attention to */
  justInstalled = signal(false);

  private notifyBtn = viewChild<ElementRef<HTMLButtonElement>>('notifyBtn');

  /**
   * Running as an installed app. Derived from the actual display mode rather
   * than the appinstalled event: that event fires once, in the tab that did
   * the install, so anything keyed off it is invisible on every later visit.
   */
  private standalone = signal(this.detectStandalone());

  private readonly isIos = this.detectIos();

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeinstallprompt', (e: any) => {
        e.preventDefault();
        this.deferred = e;
        this.promptReady.set(true);
      });

      window.addEventListener('appinstalled', () => {
        this.promptReady.set(false);
        this.deferred = null;
        this.installedHere.set(true);
        this.justInstalled.set(true);

        // The installed app cannot be opened from here, so bring the one
        // remaining step into view instead.
        setTimeout(
          () =>
            this.notifyBtn()?.nativeElement?.scrollIntoView({
              behavior: 'smooth',
              block: 'center',
            }),
          150
        );
        setTimeout(() => this.justInstalled.set(false), 8000);
      });

      // launching the installed app switches display-mode without a reload
      window
        .matchMedia?.('(display-mode: standalone)')
        ?.addEventListener?.('change', (e) => this.standalone.set(e.matches));
    }

    // The one source of truth for "already on": ask the service worker, don't
    // infer it from an event we may have missed.
    if (this.swPush.isEnabled) {
      this.swPush.subscription.subscribe((sub) => this.subscribed.set(!!sub));
    }

    // Logging in mid-visit has to reach the button, otherwise it stays hidden
    // until a reload - which is the window this whole bug lived in.
    this.login.onLogin$.subscribe(() => this.userId.set(getCurrentUserId()));
  }

  canInstall = computed(() => {
    if (this.state.updateAvailable()) return false;
    if (this.standalone() || this.installedHere()) return false;
    return this.promptReady();
  });

  /**
   * Push works in the browser on Android and desktop, but on iOS only once the
   * site has been added to the home screen.
   */
  canEnablePush = computed(() => {
    if (!this.swPush.isEnabled) return false;
    if (!this.userId()) return false;
    if (this.subscribed()) return false;
    if (this.permission() === 'unsupported' || this.permission() === 'denied') return false;
    if (this.isIos && !this.standalone()) return false;

    // Only where it belongs: inside the installed app, or in the tab that has
    // just installed it. It is not meant to sit on the page for the whole of
    // an ordinary browsing session.
    return this.standalone() || this.installedHere();
  });

  showIosHint = computed(
    () => this.isIos && !this.standalone() && !this.subscribed() && this.swPush.isEnabled
  );

  pushBlocked = computed(() => this.permission() === 'denied' && !this.subscribed());

  async install() {
    if (!this.deferred) return;

    this.deferred.prompt();
    await this.deferred.userChoice;

    this.deferred = null;
    this.promptReady.set(false);
  }

  async enablePush() {
    if (this.busy()) return;
    this.busy.set(true);
    try {
      // read it fresh: the user may have logged in since the button rendered
      this.userId.set(getCurrentUserId());
      const ok = await this.push.enableAndRegister(this.userId());
      this.subscribed.set(ok);
    } finally {
      if (typeof Notification !== 'undefined') {
        this.permission.set(Notification.permission);
      }
      this.busy.set(false);
    }
  }

  private detectStandalone(): boolean {
    if (typeof window === 'undefined') return false;
    return (
      window.matchMedia?.('(display-mode: standalone)').matches === true ||
      (window.navigator as any).standalone === true
    );
  }

  private detectIos(): boolean {
    if (typeof navigator === 'undefined') return false;
    const ua = navigator.userAgent;
    // iPadOS reports itself as a Mac, so the touch points are the giveaway
    return (
      /iPad|iPhone|iPod/.test(ua) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
    );
  }
}
