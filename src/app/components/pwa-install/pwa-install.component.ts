// pwa-install.component.ts (standalone)
import { Component, signal } from '@angular/core';
import { NgIf } from '@angular/common';

@Component({
  selector: 'pwa-install',
  standalone: true,
  imports: [NgIf],
  template: `
    <button *ngIf="canInstall()" (click)="install()">
      Install app
    </button>
  `,
})
export class PwaInstallComponent {
  private deferred: any = null;
  show = signal(false);

  constructor() {
    window.addEventListener('beforeinstallprompt', (e: any) => {
      e.preventDefault();          // don’t let Chrome auto-prompt
      this.deferred = e;           // stash the event
      this.show.set(true);         // show the button
    });
    window.addEventListener('appinstalled', () => { this.show.set(false); });
  }

  canInstall() { return this.show(); }

  async install() {
    if (!this.deferred) return;
    this.deferred.prompt();
    await this.deferred.userChoice; // { outcome: 'accepted' | 'dismissed' }
    this.deferred = null;
    this.show.set(false);
  }
}
