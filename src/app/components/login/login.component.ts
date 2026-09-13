import { Component, ElementRef, ViewChild, AfterViewInit, NgZone, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { environment } from '../../../environments/environment';
import { RouterModule } from '@angular/router';
import { UsersService } from '../../services/users.service';
import { LoginService } from '../../services/login.service';
import { SocialAuthService } from '../../services/social-auth.service';
import { firstValueFrom } from 'rxjs';


@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss'],
})
export class LoginComponent implements AfterViewInit {
  email = '';
  password = '';
  error = '';
  success = '';

  http = inject(HttpClient);
  router = inject(Router);
  usersSvc = inject(UsersService);
  loginService = inject(LoginService);
  socialAuth = inject(SocialAuthService);
  zone = inject(NgZone);
  showPassword = false;

  // Both start hidden and appear only once the server says the provider is
  // configured, so a deployment without keys shows no dead buttons.
  showGoogle = false;
  showFacebook = false;
  facebookBusy = false;

  // The token from the sign-in attempt that is still in flight. Kept so that a
  // 404 - a good token with no profile behind it - can hand it to the
  // registration form, which uses it in place of a password.
  private pendingSocial: { provider: string; credential: string } | null = null;

  @ViewChild('googleBtn') googleBtn?: ElementRef<HTMLElement>;

  constructor() {}

  ngAfterViewInit(): void {
    this.socialAuth.loadConfig().subscribe((cfg) => {
      this.showFacebook = cfg.facebook;
      this.showGoogle = cfg.google;

      if (!cfg.google) return;

      // The host div sits behind *ngIf="showGoogle", so it does not exist yet
      // on this line - wait a tick for the view to catch up with the flag.
      setTimeout(() => {
        if (!this.googleBtn) return;
        this.socialAuth
          .renderGoogleButton(this.googleBtn.nativeElement, cfg.googleClientId, (credential) =>
            // Google calls back from outside Angular; without re-entering, the
            // error and success messages would not repaint.
            this.zone.run(() => this.onGoogleCredential(credential))
          )
          .catch(() => (this.showGoogle = false));
      });
    });
  }

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
          this.enterSite(res);
        } else {
          this.error = res?.message || 'שגיאה בכניסה';
        }
      },
      error: (err) => {
        console.error('Login error:', err);
        // A blocked account (403) fails for a reason the user cannot fix by
        // retyping the password, so show what the server said instead of
        // sending them back to check their credentials.
        this.error =
          err?.status === 403 && err?.error?.detail
            ? err.error.detail
            : 'שגיאה בכניסה, בדוק דוא"ל או סיסמה.';
      },
    })

  }

  private onGoogleCredential(credential: string) {
    this.error = '';
    this.success = '';
    this.pendingSocial = { provider: 'google', credential };
    this.socialAuth.loginWithGoogle(credential).subscribe({
      next: (res: any) => this.enterSite(res),
      error: (err) => this.onSocialError(err),
    });
  }

  async onFacebookLogin() {
    this.error = '';
    this.success = '';
    this.facebookBusy = true;

    try {
      const cfg = await firstValueFrom(this.socialAuth.loadConfig());
      const token = await this.socialAuth.facebookSignIn(cfg.facebookAppId);

      // No token means the popup was closed or permission refused. The visitor
      // already knows what they did, so say nothing and let them try again.
      if (!token) {
        this.facebookBusy = false;
        return;
      }

      this.pendingSocial = { provider: 'facebook', credential: token };
      this.socialAuth.loginWithFacebook(token).subscribe({
        next: (res: any) => {
          this.facebookBusy = false;
          this.enterSite(res);
        },
        error: (err) => {
          this.facebookBusy = false;
          this.onSocialError(err);
        },
      });
    } catch (e) {
      console.error('Facebook login error:', e);
      this.facebookBusy = false;
      this.error = 'לא הצלחנו לפתוח את חלון הכניסה של פייסבוק.';
    }
  }

  /**
   * A social login failed. A 404 is the one answer that is not really a
   * failure: the token was good, the address just has no profile here yet, so
   * send them to register with what the provider already told us filled in.
   */
  private onSocialError(err: any) {
    console.error('Social login error:', err);

    const detail = err?.error?.detail;

    if (err?.status === 404) {
      // Facebook's own popup session would otherwise sign them straight back
      // in on the next attempt without asking, which hides account switching.
      this.socialAuth.facebookSignOut();
      this.error = detail?.message || 'עדיין אין חשבון עם הדוא"ל הזה.';

      // State, not query params: the token is a credential and has no business
      // sitting in a URL, where it would reach the browser history, the
      // address bar and any referrer header. The email travels with it so the
      // form can show which address is being registered, but the server reads
      // the address out of the token rather than out of the request.
      const state = {
        socialProvider: this.pendingSocial?.provider || '',
        socialCredential: this.pendingSocial?.credential || '',
        socialEmail: detail?.email || '',
        socialName: detail?.name || '',
      };

      setTimeout(() => this.router.navigate(['/register'], { state }), 1500);
      return;
    }

    // Every other failure carries a plain string; only the 404 is structured.
    this.error = (typeof detail === 'string' && detail) || 'שגיאה בכניסה, נסה שוב.';
  }

  /** Shared tail of every successful login, whatever proved who they are. */
  private enterSite(user: any) {
    this.success = 'ברוך הבא!';
    localStorage.setItem('user', JSON.stringify(user));
    this.loginService.onLogin();
    setTimeout(() => {
      this.router.navigate(['/home']);
    }, 500);
  }

  goToRegister() {
    this.router.navigate(['/register']);
  }

}
