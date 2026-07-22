import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';

export type ShareChannel = 'native' | 'whatsapp' | 'facebook' | 'messenger' | 'email' | 'copy' | 'cancel';

export interface ShareProfileDialogData {
  profileUrl: string;
  title?: string;
  subject?: string;
  name?: string;
  isMobile?: boolean;
}

@Component({
  selector: 'app-share-profile-dialog',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="wrap" dir="rtl" [class.mobile]="data.isMobile">
      <div class="handle" *ngIf="data.isMobile"></div>

      <h3 class="title">{{data.title}}</h3>
      <p class="sub" *ngIf="data?.name">של {{ data.name }}</p>

      <div class="link">
        <input #linkInput type="text" readonly [value]="data.profileUrl" (click)="linkInput.select()" />
        <button type="button" class="btn cp" (click)="close('copy')" aria-label="העתק קישור" title="העתק קישור">
          העתק
        </button>
      </div>

      <div class="btns">
      <!--
      <button
          *ngIf="canNativeShare"
          type="button"
          class="btn native"
          (click)="close('native')"
        >
          שיתוף (טלפון)
        </button>
      -->
        <button type="button" class="btn wa" (click)="close('whatsapp')">
          WhatsApp
        </button>

        <button type="button" class="btn fb" (click)="close('facebook')">
          Facebook
        </button>

        <button type="button" class="btn ms" *ngIf="data.isMobile" (click)="close('messenger')">
          Messenger
        </button>

        <button type="button" class="btn em" (click)="close('email')">
          Email
        </button>
      </div>
      <div class="actions">
        <button type="button" class="cancel" (click)="close('cancel')">סגור</button>
      </div>
    </div>
  `,
  styles: [`
    .wrap{ 
  font-family: Arial, Helvetica, sans-serif;
  padding:16px; 
  width:min(360px, 92vw); 
  background: rgba(0, 0, 0, 0.30);
  backdrop-filter: blur(2px);
}

.title{ 
  margin:0 0 4px; 
  font-size:18px; 
  font-weight:800; 
}

.sub{ 
  margin:0 0 12px; 
  color:#0B3C5D; 
  font-size:13px;
  font-weight:600; 
}

.btns{ 
  display:grid; 
  gap:10px; 
  margin:12px 0; 
}

.btn{
  border:0; 
  border-radius:12px; 
  padding:12px 12px; 
  cursor:pointer;
  font-weight:800; 
  color:#fff;
}

.native{ background:#111827; }
.wa{ background:#22c55e; }
.fb{ background:#1877f2; }
.ms{ background:#00b2ff; }
.em{ background:#3b82f6; }
.cp{ background:#6b7280; }

.link{
  display:flex;
  align-items:center;
  gap:8px;
  margin:0 0 4px;
}

.link input{
  flex:1 1 auto;
  min-width:0;
  width:auto;
  padding:10px 12px;
  border:1px solid #e5e7eb;
  border-radius:12px;
  direction:ltr;
  font-size:12px;
  font-family: Arial, Helvetica, sans-serif; /* explicit for inputs */
  background:#fff;
  color:#111827;
}

.link .btn{
  flex:0 0 auto;
  padding:10px 14px;
}

.actions{ 
  display:flex; 
  justify-content:center; 
  margin-top:12px; 
}

.cancel{
  border:1px solid #e5e7eb; 
  background:#fff; 
  border-radius:12px;
  padding:10px 20px; 
  cursor:pointer; 
  font-weight:800;
}

.wrap.mobile{
  width:100vw;
  max-width:100vw;
  padding:14px 16px 16px;
}

.handle{
  width:48px; 
  height:5px; 
  border-radius:999px;
  background:#e5e7eb;
  margin:4px auto 10px;
}`]
})
export class ShareProfileDialogComponent {
  private dialogRef = inject<DialogRef<ShareChannel>>(DialogRef);
  data = inject<ShareProfileDialogData>(DIALOG_DATA);

  canNativeShare = typeof navigator !== 'undefined' && !!(navigator as any).share;

  close(ch: ShareChannel) {
    this.dialogRef.close(ch);
  }
}

