import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { environment } from '../../../environments/environment';


function passwordMatchValidator(group: any) {
  const p1 = group.get('password')?.value;
  const p2 = group.get('confirm')?.value;
  return p1 && p2 && p1 !== p2 ? { passwordMismatch: true } : null;
}

function toInt(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : null;
}

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './reset-password.component.html',
  styleUrls: ['./reset-password.component.scss'],
})
export class ResetPasswordComponent {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private fb = inject(FormBuilder);
  private http = inject(HttpClient);

  // query: ?userId=123 (או ?uid=123)
  readonly userId = signal<number | null>(null);

  readonly loading = signal(false);
  readonly msg = signal<string>('');
  readonly error = signal<string>('');

  readonly form = this.fb.group(
    {
      password: ['', [Validators.required, Validators.minLength(6)]],
      confirm: ['', [Validators.required]],
    },
    { validators: passwordMatchValidator }
  );

  readonly canSubmit = computed(() => !!this.userId() && this.form.valid );

  constructor() {
    this.route.queryParamMap.subscribe((qp) => {
      const id = toInt(qp.get('userId') ?? qp.get('uid'));
      this.userId.set(id);

      if (!id) {
        this.error.set('קישור לא תקין: חסר userId');
      } else {
        this.error.set('');
      }
    });
  }

  async onSubmit() {
    this.msg.set('');
    this.error.set('');

    const uid = this.userId();
    if (!uid) {
      this.error.set('קישור לא תקין: חסר userId');
      return;
    }

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const password = this.form.value.password ?? '';
    
    this.http.post(`${environment.apibase}/reset-password`, {password, uid}).subscribe({
          next: (res: any) => {
            this.msg.set('הסיסמה עודכנה בהצלחה. אפשר להתחבר מחדש.');
            this.form.reset();
          },
          error: (err) => {
            this.error.set('שגיאה בעדכון הסיסמה. נסה שוב.');
          },
        });
    
    /***
    try {
      this.loading.set(true);

      // TODO: החלף לקריאה לשירות שלך
      // await firstValueFrom(this.authSrv.resetPassword({ userId: uid, newPassword: password }))
      // דוגמה: this.http.post('/api/reset-password', { userId: uid, newPassword: password })

      // דמו:
      await new Promise((r) => setTimeout(r, 300));

      this.msg.set('הסיסמה עודכנה בהצלחה. אפשר להתחבר מחדש.');
      this.form.reset();

      // אופציונלי: ניתוב ללוגין
      // this.router.navigate(['/login']);
    } catch (e: any) {
      this.error.set('שגיאה בעדכון הסיסמה. נסה שוב.');
    } finally {
      this.loading.set(false);
    }
    ***/
  
  }
}
