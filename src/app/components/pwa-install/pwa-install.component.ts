import { Component, signal, inject } from '@angular/core';
import { NgIf } from '@angular/common';
import { PushService } from '../../services/push.service';
import { getCurrentUserId } from '../../core/current-user';

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

    <button
      *ngIf="installed()"
      class="notify-btn"
      (click)="enablePush()"
    >
      🔔 הפעלת התראות
    </button>
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

    .notify-btn:hover {
      background: #4f46e5;
      color: #ffffff;
    }
  `],
})
export class PwaInstallComponent {
  private deferred: any = null;

  show = signal(false);
  installed = signal(false);

  private push = inject(PushService);

  constructor() {
    window.addEventListener('beforeinstallprompt', (e: any) => {
      e.preventDefault();
      this.deferred = e;
      this.show.set(true);
    });

    window.addEventListener('appinstalled', () => {
      this.show.set(false);
      this.installed.set(true);
    });
  }

  canInstall() {
    return this.show();
  }

  async install() {
    if (!this.deferred) return;

    this.deferred.prompt();
    await this.deferred.userChoice;

    this.deferred = null;
    this.show.set(false);
  }

  async enablePush() {
    alert("enable push");
    alert(getCurrentUserId());
    await this.push.enableAndRegister(getCurrentUserId());
  }
}
