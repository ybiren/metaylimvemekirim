import { Component, inject } from '@angular/core';
import { NgIf } from '@angular/common';
import { SwUpdate, VersionEvent } from '@angular/service-worker';
import { PwaStateService } from '../../services/pwa-state.service';

@Component({
  selector: 'pwa-update',
  standalone: true,
  imports: [NgIf],
  template: `
    <button
      *ngIf="state.updateAvailable()"
      class="update-btn"
      (click)="applyUpdate()"
    >
      ⬆️ קיימת גרסה חדשה — עדכן עכשיו
    </button>
  `,
  styles: [`
    :host{ display:block; direction:rtl; text-align:center; margin: 16px 0; }
    .update-btn{
      background: #0ea5e9;
      color:#fff;
      border:none;
      border-radius:16px;
      padding:14px 24px;
      font-size:16px;
      font-weight:700;
      cursor:pointer;
    }
    .update-btn:hover{ filter: brightness(0.95); }
  `],
})
export class PwaUpdateComponent {
  private sw = inject(SwUpdate);
  state = inject(PwaStateService); // 👈 חשוב: לא private, כדי שה-template יראה

  private intervalId: any;

  constructor() {
    if (!this.sw.isEnabled) return;

    this.sw.versionUpdates.subscribe((e: VersionEvent) => {
      if (e.type === 'VERSION_READY') {
        this.state.updateAvailable.set(true);
      }
    });

    this.intervalId = setInterval(() => {
      this.sw.checkForUpdate().catch(() => {});
    }, 2 * 60 * 1000);
  }

  async applyUpdate() {
    await this.sw.activateUpdate();
    location.reload();
  }
}