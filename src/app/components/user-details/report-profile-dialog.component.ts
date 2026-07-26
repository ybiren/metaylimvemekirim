import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';

export interface ReportProfileResult {
  category: string;
  reason: string;
}

export interface ReportProfileDialogData {
  reportedUserName?: string;
  isMobile?: boolean;
}

@Component({
  selector: 'app-report-profile-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="wrap" dir="rtl" [class.mobile]="data.isMobile">
      <div class="handle" *ngIf="data.isMobile"></div>

      <h3 class="title">ברצוני לדווח על תכנים פוגעניים</h3>
      <p class="sub" *ngIf="data?.reportedUserName">על הפרופיל של {{ data.reportedUserName }}</p>

      <label class="lbl" for="rep-cat">סוג הדיווח</label>
      <select id="rep-cat" class="select" [(ngModel)]="category">
        <option *ngFor="let c of categories" [value]="c">{{ c }}</option>
      </select>

      <label class="lbl" for="rep-reason">תיאור</label>
      <textarea
        id="rep-reason"
        class="textarea"
        rows="5"
        [(ngModel)]="reason"
        placeholder="פרט/י מהו התוכן הפוגעני…"
      ></textarea>

      <div class="btns">
        <button type="button" class="btn send" [disabled]="!reason.trim()" (click)="submit()">
          שלח דיווח
        </button>
        <button type="button" class="btn cancel" (click)="close()">ביטול</button>
      </div>
    </div>
  `,
  styles: [`
    .wrap{
      font-family: Arial, Helvetica, sans-serif;
      padding:16px;
      width:min(400px, 92vw);
      background:#fff;
      border-radius:16px;
    }
    .title{ margin:0 0 4px; font-size:18px; font-weight:800; color:#111827; }
    .sub{ margin:0 0 12px; color:#0B3C5D; font-size:13px; font-weight:600; }
    .lbl{ display:block; margin:10px 0 4px; font-size:13px; font-weight:700; color:#374151; }
    .select, .textarea{
      width:100%;
      box-sizing:border-box;
      padding:10px 12px;
      border:1px solid #e5e7eb;
      border-radius:12px;
      font-size:14px;
      font-family: Arial, Helvetica, sans-serif;
      background:#fff;
      color:#111827;
    }
    .textarea{ resize:vertical; }
    .btns{ display:flex; gap:10px; margin-top:16px; }
    .btn{ border:0; border-radius:12px; padding:12px; cursor:pointer; font-weight:800; flex:1 1 0; }
    .send{ background:#d9534f; color:#fff; }
    .send:disabled{ opacity:.5; cursor:not-allowed; }
    .cancel{ background:#fff; color:#111827; border:1px solid #e5e7eb; }
    .wrap.mobile{ width:100vw; max-width:100vw; border-radius:0; padding:14px 16px 16px; }
    .handle{ width:48px; height:5px; border-radius:999px; background:#e5e7eb; margin:4px auto 10px; }
  `]
})
export class ReportProfileDialogComponent {
  private dialogRef = inject<DialogRef<ReportProfileResult>>(DialogRef);
  data = inject<ReportProfileDialogData>(DIALOG_DATA);

  readonly categories = [
    'הטרדה / בריונות',
    'תוכן מיני / פוגעני',
    'פרופיל מזויף',
    'ספאם / פרסום',
    'אחר',
  ];

  category = this.categories[0];
  reason = '';

  submit() {
    const reason = this.reason.trim();
    if (!reason) return;
    this.dialogRef.close({ category: this.category, reason });
  }

  close() {
    this.dialogRef.close();
  }
}
