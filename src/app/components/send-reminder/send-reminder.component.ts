import {
  Component,
  Input,
  Output,
  EventEmitter,
  signal,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormGroup,
  Validators,
  ReactiveFormsModule,
  AbstractControl,
} from '@angular/forms';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { DialogRef, DIALOG_DATA } from '@angular/cdk/dialog';

export interface SendReminderDialogData {
  endpoint?: string;
  cId?: string;
  cName?: string;
}

@Component({
  selector: 'send-reminder',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, HttpClientModule],
  template: `
    <div class="reminder-card" dir="rtl">
      <header class="reminder-card__header">
        <button class="close-btn" type="button" (click)="close()">✕</button>
        <div class="reminder-card__title">שליחת תזכורת</div>
      </header>

      <form
        class="reminder-form"
        [formGroup]="form"
        (ngSubmit)="onSubmit()"
        novalidate
      >
        <!-- Email -->
        <label for="Email1">כתובת אימייל של החבר</label>
        <input
          id="Email1"
          type="email"
          formControlName="Email1"
          placeholder="name@example.com"
          inputmode="email"
        />
        <div class="err" *ngIf="touchedInvalid('Email1')">
          <span *ngIf="form.get('Email1')?.errors?.['required']">
            נדרש להזין אימייל
          </span>
          <span *ngIf="form.get('Email1')?.errors?.['email']">
            פורמט אימייל לא תקין
          </span>
        </div>

        <!-- Sender name -->
        <label for="MyName">שם השולח</label>
        <input
          id="MyName"
          type="text"
          dir="rtl"
          formControlName="MyName"
          placeholder="השם שלך"
        />
        <div class="err" *ngIf="touchedInvalid('MyName')">
          <span *ngIf="form.get('MyName')?.errors?.['required']">
            נדרש להזין שם
          </span>
          <span *ngIf="form.get('MyName')?.errors?.['maxlength']">
            שם ארוך מדי
          </span>
        </div>

        <!-- Message body -->
        <label for="body">הודעת טקסט מצורפת</label>
        <textarea
          id="body"
          rows="6"
          dir="rtl"
          formControlName="body"
        ></textarea>
        <div class="err" *ngIf="touchedInvalid('body')">
          <span *ngIf="form.get('body')?.errors?.['required']">
            נדרש להזין הודעה
          </span>
          <span *ngIf="form.get('body')?.errors?.['maxlength']">
            ההודעה ארוכה מדי
          </span>
        </div>

        <!-- Hidden fields kept for backend parity -->
        <input type="hidden" formControlName="c_id" />
        <input type="hidden" formControlName="c_name" />

        <div class="actions">
          <button type="submit" [disabled]="form.invalid || sending()">
            {{ sending() ? 'שולח…' : 'שלח תזכורת' }}
          </button>
        </div>
      </form>
    </div>
  `,
  styles: [
    `
      :host {
        /* Center the card inside the CDK dialog */
        display: flex;
        justify-content: center;
        align-items: center;
        height: 100%;
        padding: 16px;
        box-sizing: border-box;
        background: transparent;
      }

      .reminder-card {
        width: min(380px, 100%);
        display: flex;
        flex-direction: column;
        background: #e7f0ea; /* WA-like light tint */
        border-radius: 16px;
        box-shadow: 0 3px 10px rgba(0, 0, 0, 0.15);
        overflow: hidden;
      }

      /* Header */
      .reminder-card__header {
        background: #075e54; /* WhatsApp green */
        color: #ffffff;
        padding: 10px 16px;
        position: relative;
        text-align: center;
      }

      .reminder-card__title {
        font-weight: 700;
        font-size: 15px;
      }

      /* Close (X) button — currently top-right */
      .close-btn {
        position: absolute;
        top: 6px;
        right: 8px; /* change to left: 8px if you want top-left */
        background: transparent;
        border: none;
        color: #ffffff;
        font-size: 20px;
        line-height: 1;
        cursor: pointer;
        padding: 4px;
      }

      .reminder-form {
        padding: 16px 24px;
        display: flex;
        flex-direction: column;
        gap: 6px;
      }

      label {
        font-weight: 600;
        font-size: 13px;
      }

      input,
      textarea {
        width: 100%;
        padding: 6px 10px;
        border: 1px solid #c9d6cf;
        border-radius: 10px;
        background: #ffffff;
        font: inherit;
      }

      textarea {
        min-height: 120px;
        resize: vertical;
      }

      .err {
        color: #b00020;
        font-size: 11px;
      }

      .actions {
        margin-top: 12px;
        display: flex;
        justify-content: center;
      }

      button[type='submit'] {
        padding: 8px 20px;
        border: 0;
        border-radius: 999px;
        background: #24a859;
        color: #fff;
        font-weight: 700;
        cursor: pointer;
        min-width: 140px;
      }

      button[disabled] {
        opacity: 0.6;
        cursor: default;
      }

      @media (max-width: 480px) {
        .reminder-card {
          width: 100%;
          border-radius: 0;
        }
      }
    `,
  ],
})
export class SendReminderComponent {
  /** API endpoint to POST the form to (can be overridden via dialog data or @Input) */
  @Input() endpoint = '/api/send2friend';
  /** Optional default values for hidden fields or prefill */
  @Input() cId: string | null = null;
  @Input() cName: string | null = null;

  /** Emit payload after successful submission (for non-dialog usage) */
  @Output() submitted = new EventEmitter<any>();

  sending = signal(false);

  form: FormGroup;

  // CDK dialog injections (optional – present only when opened via Dialog)
  private readonly dialogRef =
    inject<DialogRef<SendReminderComponent> | null>(DialogRef, {
      optional: true,
    });

  private readonly dialogData =
    inject<SendReminderDialogData | null>(DIALOG_DATA, {
      optional: true,
    });

  private readonly fb = inject(FormBuilder);
  private readonly http = inject(HttpClient);

  constructor() {
    // If opened as dialog, override inputs with provided data
    if (this.dialogData) {
      if (this.dialogData.endpoint) this.endpoint = this.dialogData.endpoint;
      if (this.dialogData.cId !== undefined) this.cId = this.dialogData.cId!;
      if (this.dialogData.cName !== undefined)
        this.cName = this.dialogData.cName!;
    }

    this.form = this.fb.group({
      Email1: ['', [Validators.required, Validators.email]],
      MyName: ['', [Validators.required, Validators.maxLength(50)]],
      body: [
        'החלטתי לשלוח לך משהו בקשר ל..',
        [Validators.required, Validators.maxLength(1000)],
      ],
      c_id: [this.cId ?? ''],
      c_name: [this.cName ?? ''],
    });
  }

  touchedInvalid(ctrlName: string): boolean {
    const c: AbstractControl | null = this.form.get(ctrlName);
    return !!c && c.touched && c.invalid;
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.sending.set(true);

    this.http.post(this.endpoint, this.form.value).subscribe({
      next: (res) => {
        this.sending.set(false);
        const payload = res ?? this.form.value;

        // Emit for normal usage
        this.submitted.emit(payload);

        // Close dialog if we are inside one
        if (this.dialogRef) {
          this.dialogRef.close(payload);
        } else {
          // Reset if used standalone
          this.form.reset({
            Email1: '',
            MyName: '',
            body: 'החלטתי לשלוח לך משהו בקשר ל..',
            c_id: this.cId ?? '',
            c_name: this.cName ?? '',
          });
        }
      },
      error: (err) => {
        this.sending.set(false);
        console.error('Send failed', err);
        this.dialogRef.close();
      },
    });
  }

  /** Close when clicking the X button */
  close(): void {
    if (this.dialogRef) {
      this.dialogRef.close();
    }
  }
}
