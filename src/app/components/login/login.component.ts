import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss'],
})
export class LoginComponent {
  email = '';
  password = '';
  error = '';
  success = '';

  http = inject(HttpClient);
  router = inject(Router);

  constructor() {}

  onLogin() {
    this.error = '';
    this.success = '';

    if (!this.email || !this.password) {
      this.error = 'נא להזין שם משתמש וסיסמה';
      return;
    }

    // Build FormData (FastAPI expects form fields)
    const formData = new FormData();
    formData.append('c_email', this.email);
    formData.append('password', this.password);

    console.log("apibase", environment.apibase);
    this.http.post(`${environment.apibase}/login`, formData).subscribe({
      next: (res: any) => {
        if (res && res.ok) {
          this.success = 'ברוך הבא!';
          console.log('Login success:', res);

          // Save user in localStorage
          localStorage.setItem('user', JSON.stringify(res.user));

          setTimeout(() => {
            this.router.navigate(['/users']);
          }, 500);
        } else {
          this.error = res?.message || 'שגיאה בכניסה';
        }
      },
      error: (err) => {
        console.error('Login error:', err);
        this.error = 'שגיאה בכניסה, בדוק דוא"ל או סיסמה.';
      },
    });
  }

  goToRegister() {
    this.router.navigate(['/register']);
  }

}
