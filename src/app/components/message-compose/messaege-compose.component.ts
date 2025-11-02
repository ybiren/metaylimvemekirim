import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormControl, Validators, FormGroup, NonNullableFormBuilder } from '@angular/forms';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ToastService } from '../../services/toast.service'; // adjust path
import { MessageComposeService } from '../../services/send-message.service';
import { firstValueFrom, lastValueFrom } from 'rxjs';
      

type ComposeDialogData = { fromId: number; toId: number; toName?: string };

@Component({
  standalone: true,
  selector: 'app-message-compose',
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="sheet" dir="rtl">
      <header class="hdr">
        <div>
          <h3>שליחת הודעה</h3>
          <small class="muted">אל {{ toName() || ('משתמש #' + data.toId) }}</small>
        </div>
        <button type="button" class="x" (click)="close()">✕</button>
      </header>

      <form [formGroup]="form" (ngSubmit)="onSubmit()" class="body">
        <label class="lbl" for="body">הודעה</label>
        <textarea id="body" rows="7" class="area" formControlName="body"
                  [class.invalid]="invalid()" maxlength="2000"
                  placeholder="כתוב כאן את ההודעה שלך…"></textarea>
        <div class="hint">
          <small class="error" *ngIf="invalid()">תוכן ההודעה נדרש (לפחות 2 תווים)</small>
          <small class="muted">{{ form.controls.body.value?.length || 0 }}/2000</small>
        </div>

        <div class="banner ok" *ngIf="sent()">ההודעה נשלחה בהצלחה ✓</div>
        <div class="banner err" *ngIf="errorMsg()">שגיאה בשליחה: {{ errorMsg() }}</div>

        <footer class="actions">
          <span class="spacer"></span>
          <button type="button" class="btn" (click)="close()">בטל</button>
          <button type="submit" class="btn primary" [disabled]="form.invalid || sending()">
            {{ sending() ? 'שולח…' : 'שלח' }}
          </button>
        </footer>
      </form>
    </div>
  `,
  styles: [`
    .sheet { background:#fff; border-radius:12px; border:1px solid #e5e7eb; }
    .hdr { display:flex; align-items:center; justify-content:space-between; padding:12px 14px; border-bottom:1px solid #f0f0f0; }
    .muted { color:#9aa3af; }
    .x { border:none; background:transparent; font-size:18px; cursor:pointer; }
    .body { padding:14px; display:flex; flex-direction:column; gap:10px; }
    .lbl { font-weight:600; }
    .area { width:100%; border:1px solid #e5e7eb; border-radius:10px; padding:10px 12px; resize:vertical; }
    .area.invalid { border-color:#ef4444; background:#fff7f7; }
    .hint { display:flex; justify-content:space-between; }
    .banner { padding:8px 10px; border-radius:8px; }
    .ok { background:#ecfdf5; color:#065f46; border:1px solid #a7f3d0; }
    .err { background:#fef2f2; color:#991b1b; border:1px solid #fecaca; }
    .actions { display:flex; align-items:center; gap:8px; margin-top:8px; }
    .spacer { flex:1; }
    .btn { padding:8px 14px; border-radius:10px; border:1px solid #e5e7eb; background:#fff; cursor:pointer; }
    .primary { background:#2563eb; border-color:#2563eb; color:#fff; font-weight:600; }
  `]
})
export class MessageComposeComponent {
  // use inject() to avoid decorator issues
  data = inject<ComposeDialogData>(DIALOG_DATA);
  ref  = inject<DialogRef<unknown>>(DialogRef as any);
  fb   = inject(NonNullableFormBuilder);
  toast = inject(ToastService);
  msgComposeService = inject(MessageComposeService)

  toName   = signal(this.data?.toName ?? '');
  sending  = signal(false);
  sent     = signal(false);
  errorMsg = signal<string | null>(null);

  form: FormGroup<{ body: FormControl<string> }> = this.fb.group({
    body: this.fb.control('', { validators: [Validators.required, Validators.minLength(2), Validators.maxLength(2000)] })
  });

  invalid() { const c = this.form.controls.body; return c.invalid && (c.dirty || c.touched); }

  async onSubmit() {
    if (this.form.invalid || this.sending()) return;
    this.sending.set(true);
    this.errorMsg.set(null);
    
    try {
       await firstValueFrom(this.msgComposeService.send({ fromId: this.data.fromId, toId: this.data.toId, body: this.form.value.body!, sentAt: new Date().toISOString() }));
       this.sent.set(true);
       this.toast.show('הודעה נשלחה בהצלחה ✓');
       setTimeout(() => this.close(), 600);
    } catch (e: any) {
       this.errorMsg.set(e?.message || 'אירעה שגיאה בלתי צפויה');
    } finally {
       this.sending.set(false);
    } 

  } 
  close(result?: unknown) { this.ref.close(result); } 
}