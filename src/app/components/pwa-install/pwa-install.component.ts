import { Component, signal, inject } from '@angular/core';
import { NgIf } from '@angular/common';
import { PushService } from '../../services/push.service';
import { IUser } from '../../interfaces';

@Component({
  selector: 'pwa-install',
  standalone: true,
  imports: [NgIf],
  template: `
    <button *ngIf="canInstall()" (click)="install()">Install app</button>

    <!-- optional: show after install -->
    <button *ngIf="installed()" (click)="enablePush()">
      Enable notifications
    </button>
  `,
})
export class PwaInstallComponent {
  private deferred: any = null;
  show = signal(false);
  installed = signal(false);

  private push = inject(PushService);
  loggedInUser = signal<IUser | null>(null);
    
  constructor() {
    this.loggedInUser.set(JSON.parse(localStorage.getItem('user')) as IUser)
        
    window.addEventListener('beforeinstallprompt', (e: any) => {
      e.preventDefault();
      this.deferred = e;
      this.show.set(true);
    });

    window.addEventListener('appinstalled', async () => {
      this.show.set(false);
      this.installed.set(true);
      console.log("installed");
      // OPTION A: auto-prompt for notifications right after install
      // (Some people prefer a button instead)
      try {
        console.log("AAAAA");
        await this.push.enableAndRegister(this.loggedInUser().id);
        console.log("BBBBB");
      } catch (err) {
        alert(JSON.stringify(err));
        console.warn('Push enable failed:', err);
      }
    });
  }

  canInstall() { return this.show(); }

  async install() {
    if (!this.deferred) return;
    this.deferred.prompt();
    await this.deferred.userChoice;
    this.deferred = null;
    this.show.set(false);
  }

  async enablePush() {
    await this.push.enableAndRegister(this.loggedInUser().id);
  }
}
