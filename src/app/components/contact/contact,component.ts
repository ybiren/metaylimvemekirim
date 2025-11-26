import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  Validators,
  ReactiveFormsModule,
} from '@angular/forms';

@Component({
  selector: 'contact-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <section class="contact-shell" dir="rtl">
      <!-- Header -->
      <header class="contact-header">
        <div class="contact-header__text">
          <h1>צרו קשר</h1>
          <p>
            נשמח לשמוע מכם בכל שאלה, הצעה לשיפור, דיווח על תקלה או רעיון לשיתוף
            פעולה.
          </p>
        </div>

        <div class="contact-header__info">
          <div class="pill">
            שעות פעילות: <strong>10:30 – 22:30</strong>
          </div>
          <div class="pill pill--soft">
            מענה בדוא"ל בדרך כלל תוך 24 שעות.
          </div>
        </div>
      </header>

      <!-- Main layout -->
      <div class="contact-layout">
        <!-- Contact form -->
        <form
          class="contact-form"
          [formGroup]="form"
          (ngSubmit)="onSubmit()"
          novalidate
        >
          <h2>טופס יצירת קשר</h2>

          <div class="field">
            <label for="name">שם מלא</label>
            <input
              id="name"
              type="text"
              formControlName="name"
              placeholder="השם שלך"
            />
            <div class="err" *ngIf="touchedInvalid('name')">
              נדרש להזין שם
            </div>
          </div>

          <div class="field">
            <label for="email">כתובת אימייל</label>
            <input
              id="email"
              type="email"
              formControlName="email"
              placeholder="name@example.com"
              inputmode="email"
            />
            <div class="err" *ngIf="touchedInvalid('email')">
              <span *ngIf="form.get('email')?.errors?.['required']">
                נדרש להזין אימייל
              </span>
              <span *ngIf="form.get('email')?.errors?.['email']">
                פורמט אימייל לא תקין
              </span>
            </div>
          </div>

          <div class="field">
            <label for="subject">נושא הפנייה</label>
            <input
              id="subject"
              type="text"
              formControlName="subject"
              placeholder="על מה תרצו לדבר?"
            />
            <div class="err" *ngIf="touchedInvalid('subject')">
              נדרש להזין נושא
            </div>
          </div>

          <div class="field">
            <label for="message">הודעה</label>
            <textarea
              id="message"
              rows="6"
              formControlName="message"
              placeholder="כתבו כאן את ההודעה שלכם…"
            ></textarea>
            <div class="err" *ngIf="touchedInvalid('message')">
              ההודעה קצרה מדי (לפחות 10 תווים)
            </div>
          </div>

          <div class="contact-form__actions">
            <button type="submit" [disabled]="form.invalid || sending">
              {{ sending ? 'שולח…' : 'שלח הודעה' }}
            </button>
          </div>

          <p class="contact-form__note">
            על ידי שליחת ההודעה אתם מאשרים שניצור אתכם קשר בחזרה באמצעות הדוא"ל
            שהזנתם.
          </p>
        </form>

        <!-- Info cards -->
        <aside class="contact-info">
          <div class="info-grid">
            <article class="info-card">
              <h3>שעות פעילות</h3>
              <p class="info-card__hours">10:30 – 22:30</p>
              <p>בדרך כלל נענה לכם באותו היום, במיוחד בשעות הערב.</p>
            </article>

            <article class="info-card">
              <h3>דוא"ל כללי</h3>
              <p>
                <a href="mailto:Admin@pgoshoti.co.il">
                  Admin@pgoshoti.co.il
                </a>
                <br />
                <a href="mailto:Info@pgoshoti.co.il">
                  Info@pgoshoti.co.il
                </a>
              </p>
              <p>לשאלות כלליות, תמיכה טכנית ועדכונים.</p>
            </article>

            <article class="info-card">
              <h3>הנהלה</h3>
              <p>
                <a href="mailto:info@pgoshoti.co.il">
                  info@pgoshoti.co.il
                </a>
              </p>
              <p>לשיתופי פעולה, פרסום והצעות עסקיות.</p>
            </article>

            <article class="info-card info-card--soft">
              <h3>עוד דרכים ליצור קשר</h3>
              <p>
                ניתן לפנות אלינו גם דרך מערכת ההודעות באתר, או דרך טופס המשוב
                האישי.
              </p>
              <a routerLink="/feedback" class="info-link">
                מעבר לטופס משוב »
              </a>
            </article>
          </div>
        </aside>
      </div>
    </section>
  `,
  styles: [
    `
      .contact-shell {
        max-width: 960px;
        margin: 0 auto;
        padding: 24px 16px 40px;
        display: flex;
        flex-direction: column;
        gap: 24px;
      }

      .contact-header {
        display: grid;
        grid-template-columns: minmax(0, 2fr) minmax(0, 1.2fr);
        gap: 16px;
        padding: 16px 20px;
        background: #e7f4ff;
        border-radius: 16px;
        box-shadow: 0 4px 12px rgba(15, 23, 42, 0.06);
        align-items: center;
      }

      .contact-header__text h1 {
        margin: 0 0 6px;
        font-size: 1.6rem;
        font-weight: 700;
      }

      .contact-header__text p {
        margin: 0;
        font-size: 0.95rem;
        color: #444;
        line-height: 1.5;
      }

      .contact-header__info {
        justify-self: flex-start;
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .pill {
        display: inline-flex;
        align-items: center;
        padding: 6px 12px;
        border-radius: 999px;
        background: #1d4ed8;
        color: #fff;
        font-size: 0.85rem;
      }

      .pill--soft {
        background: #ffffff;
        color: #1e3a8a;
        border: 1px solid #bfdbfe;
      }

      .contact-layout {
        display: grid;
        grid-template-columns: minmax(0, 2fr) minmax(0, 1.4fr);
        gap: 24px;
        align-items: flex-start;
      }

      .contact-form {
        background: #ffffff;
        border-radius: 16px;
        padding: 18px 20px 20px;
        box-shadow: 0 4px 18px rgba(15, 23, 42, 0.08);
        display: flex;
        flex-direction: column;
        gap: 10px;
      }

      .contact-form h2 {
        margin: 0 0 4px;
        font-size: 1.25rem;
      }

      .field {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      label {
        font-weight: 600;
        font-size: 0.9rem;
      }

      input,
      textarea {
        width: 100%;
        padding: 8px 10px;
        border-radius: 8px;
        border: 1px solid #cbd5e1;
        background: #ffffff;
        font-size: 0.9rem;
      }

      textarea {
        resize: vertical;
        min-height: 120px;
      }

      input:focus,
      textarea:focus {
        outline: none;
        border-color: #2563eb;
        box-shadow: 0 0 0 1px #2563eb22;
      }

      .err {
        font-size: 0.8rem;
        color: #b00020;
      }

      .contact-form__actions {
        margin-top: 4px;
      }

      button {
        padding: 8px 18px;
        border-radius: 999px;
        border: none;
        font-size: 0.95rem;
        font-weight: 700;
        background: #24a859;
        color: #ffffff;
        cursor: pointer;
      }

      button[disabled] {
        opacity: 0.6;
        cursor: default;
      }

      button:not([disabled]):hover {
        background: #1d8b4a;
      }

      .contact-form__note {
        margin: 4px 0 0;
        font-size: 0.8rem;
        color: #64748b;
      }

      .contact-info {
        width: 100%;
      }

      .info-grid {
        display: grid;
        grid-template-columns: 1fr;
        gap: 12px;
      }

      .info-card {
        background: #ffffff;
        border-radius: 14px;
        padding: 12px 14px;
        box-shadow: 0 3px 10px rgba(15, 23, 42, 0.06);
        font-size: 0.9rem;
      }

      .info-card--soft {
        background: #f1f5f9;
      }

      .info-card h3 {
        margin: 0 0 4px;
        font-size: 1.02rem;
      }

      .info-card__hours {
        margin: 0 0 4px;
        font-weight: 600;
      }

      .info-card p {
        margin: 0 0 4px;
        color: #444;
      }

      .info-card a {
        color: #1d4ed8;
        text-decoration: none;
      }

      .info-card a:hover {
        text-decoration: underline;
      }

      .info-link {
        font-size: 0.85rem;
      }

      @media (max-width: 900px) {
        .contact-header {
          grid-template-columns: minmax(0, 1fr);
        }

        .contact-header__info {
          justify-self: flex-start;
        }

        .contact-layout {
          grid-template-columns: minmax(0, 1fr);
        }
      }

      @media (max-width: 600px) {
        .contact-shell {
          padding-inline: 12px;
        }

        .contact-form {
          padding-inline: 14px;
        }
      }
    `,
  ],
})
export class ContactPageComponent {
  sending = false;

  // ✅ Safe: no "property used before initialization" issue
  form = new FormBuilder().group({
    name: ['', [Validators.required]],
    email: ['', [Validators.required, Validators.email]],
    subject: ['', [Validators.required]],
    message: ['', [Validators.required, Validators.minLength(10)]],
  });

  constructor() {}

  touchedInvalid(ctrl: string): boolean {
    const c = this.form.get(ctrl);
    return !!c && c.touched && c.invalid;
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.sending = true;

    // TODO: replace with real HTTP call
    setTimeout(() => {
      this.sending = false;
      alert('ההודעה נשלחה בהצלחה (סימולציה)');
      this.form.reset();
    }, 600);
  }
}
