import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AdminAuthService } from '../services/admin-auth.service';

/**
 * The sign-in screen for /admin.
 *
 * Admins use their ordinary site account - there is no separate admin password
 * to keep in step with anything. What separates them from everyone else is the
 * is_admin flag, which is granted in the database and nowhere else.
 *
 * Kept outside the guarded part of the route tree, since it is the one admin
 * screen you must be able to reach without being signed in.
 */
@Component({
  selector: 'app-admin-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <form class="admin-login" (ngSubmit)="onSubmit()" #f="ngForm" dir="rtl">
      <h2>כניסת מנהל</h2>

      <label for="admin-email">דוא"ל:</label>
      <input
        id="admin-email"
        type="email"
        name="email"
        autocomplete="username"
        [(ngModel)]="email"
        required />

      <label for="admin-password">סיסמה:</label>
      <input
        id="admin-password"
        type="password"
        name="password"
        autocomplete="current-password"
        [(ngModel)]="password"
        required />

      <button type="submit" [disabled]="!f.valid || busy()">
        {{ busy() ? 'רגע…' : 'כניסה' }}
      </button>

      @if (error()) {
        <p class="admin-login__error">{{ error() }}</p>
      }
    </form>
  `,
  styles: [`
    .admin-login {
      width: min(100%, 22rem);
      margin: 3rem auto;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      padding: 1.5rem;
      background: #fff;
      border-radius: 0.75rem;
      box-shadow: 0 0.5rem 1.5rem rgba(15, 23, 42, 0.12);
    }

    .admin-login h2 {
      margin: 0 0 0.5rem;
      font-size: 1.25rem;
    }

    .admin-login label {
      font-size: 0.875rem;
      font-weight: 600;
    }

    .admin-login input {
      padding: 0.5rem;
      border: 1px solid #cbd5e1;
      border-radius: 0.5rem;
      font-size: 1rem;

      /* The form is RTL for its Hebrew labels, which otherwise puts the caret
         at the right-hand end of these two boxes - and an address and a
         password are Latin text that reads and types from the left. Only the
         contents flip: the boxes and their labels stay where the RTL layout
         puts them. */
      direction: ltr;
      text-align: left;
    }

    .admin-login button {
      margin-top: 0.75rem;
      padding: 0.6rem;
      border: none;
      border-radius: 0.5rem;
      background: #0b79d0;
      color: #fff;
      font-size: 1rem;
      font-weight: 600;
      cursor: pointer;
    }

    .admin-login button:disabled {
      opacity: 0.6;
      cursor: default;
    }

    .admin-login__error {
      margin: 0.5rem 0 0;
      color: #c62828;
      font-size: 0.875rem;
    }
  `],
})
export class AdminLoginComponent {
  private auth = inject(AdminAuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  email = '';
  password = '';
  busy = signal(false);
  error = signal('');

  onSubmit() {
    if (this.busy()) return;

    this.busy.set(true);
    this.error.set('');

    this.auth.login(this.email.trim(), this.password).subscribe({
      next: () => {
        this.busy.set(false);
        const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
        this.router.navigateByUrl(returnUrl || '/admin/dashboard');
      },
      error: err => {
        this.busy.set(false);
        // The server says the same thing for a wrong address, a wrong password
        // and a correct password on an account without the flag - telling them
        // apart here would undo that.
        this.error.set(err?.error?.detail || 'פרטי הכניסה אינם נכונים.');
      },
    });
  }
}
