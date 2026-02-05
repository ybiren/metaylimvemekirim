import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { environment } from '../../../environments/environment';
import { RouterModule } from '@angular/router';
import { UsersService } from '../../services/users.service';
import { LoginService } from '../../services/login.service';


@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
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
  usersSvc = inject(UsersService);
  loginService = inject(LoginService);

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

    this.loginService.doLogin(formData).subscribe({
      next: (res: any) => {
        if (res) {
          this.success = 'ברוך הבא!';
          console.log('Login success:', res);
          // Save user in localStorage
          localStorage.setItem('user', JSON.stringify(res));
          this.loginService.onLogin();
          setTimeout(() => {
            this.router.navigate(['/home']);
          }, 500);
        } else {
          this.error = res?.message || 'שגיאה בכניסה';
        }
      },
      error: (err) => {
        console.error('Login error:', err);
        this.error = 'שגיאה בכניסה, בדוק דוא"ל או סיסמה.';
      },
    })
  
  }

  goToRegister() {
    this.router.navigate(['/register']);
  }

}
