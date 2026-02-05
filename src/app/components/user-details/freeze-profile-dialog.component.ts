import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DialogRef } from '@angular/cdk/dialog';

export type FreezeProfileResult = 'yes' | 'no';

@Component({
  selector: 'app-freeze-profile-dialog',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="wrap" dir="rtl">
      <h3 class="title">האם אתה בטוח שברצונך להקפיא את הפרופיל?</h3>

      <div class="btns">
        <button type="button" class="btn yes" (click)="close('yes')">
          כן
        </button>

        <button type="button" class="btn no" (click)="close('no')">
          לא
        </button>
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
      margin:0 0 16px;
      font-size:18px;
      font-weight:800;
      text-align:center;
    }

    .btns{
      display:flex;
      gap:12px;
      justify-content:center;
    }

    .btn{
      border:0;
      border-radius:12px;
      padding:12px 24px;
      cursor:pointer;
      font-weight:800;
      color:#fff;
      min-width:100px;
    }

    .yes{
      background:#ef4444; /* red – destructive action */
    }

    .no{
      background:#6b7280; /* gray */
    }
  `]
})
export class FreezeProfileDialogComponent {
  private dialogRef = inject<DialogRef<FreezeProfileResult>>(DialogRef);

  close(result: FreezeProfileResult) {
    this.dialogRef.close(result);
  }
}
