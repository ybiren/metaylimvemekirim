import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { inject, Injectable, PLATFORM_ID, signal } from '@angular/core';
import { Observable, of } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { LoginService } from './login.service';

export interface AdminSession {
  token: string;
  name: string;
  id: number;
  /** The same shape the ordinary login returns, so the site can store it. */
  user: unknown;
}

/**
 * Where the token lives between page loads. sessionStorage, not localStorage:
 * an admin session ends with the tab, so a shared machine does not keep one
 * lying around for whoever opens the browser next.
 */
const TOKEN_KEY = 'admin-token';

/**
 * Signing in and out of /admin.
 *
 * The token this holds is the only thing that gets an admin request past the
 * server - the rest of the app sends ids the server believes, but the admin
 * endpoints ask for this and check it against the database on every call.
 *
 * Which means the copy here is not the authority on anything. It is a key that
 * may already have been revoked or expired; the guard asks the server whether
 * it still opens the door, and every admin request finds out again.
 */
@Injectable({ providedIn: 'root' })
export class AdminAuthService {
  private http = inject(HttpClient);
  private loginSrv = inject(LoginService);
  private isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  /** The signed-in admin's name, for the bar at the top of /admin. */
  adminName = signal<string>('');

  get token(): string {
    if (!this.isBrowser) return '';
    try {
      return sessionStorage.getItem(TOKEN_KEY) || '';
    } catch {
      // Private mode, or a browser set to block storage.
      return '';
    }
  }

  private set token(value: string) {
    if (!this.isBrowser) return;
    try {
      if (value) sessionStorage.setItem(TOKEN_KEY, value);
      else sessionStorage.removeItem(TOKEN_KEY);
    } catch {
      /* nothing to do - the session simply will not survive a reload */
    }
  }

  login(email: string, password: string): Observable<AdminSession> {
    const body = new FormData();
    body.append('email', email);
    body.append('password', password);

    return this.http
      .post<AdminSession>(`${environment.apibase}/api/admin/login`, body)
      .pipe(
        tap(res => {
          this.token = res.token;
          this.adminName.set(res.name || '');

          // An admin is a member too, so this signs them into the site in the
          // same breath - same localStorage key and the same notification the
          // ordinary login uses, so the header and everything watching it see a
          // normal sign-in and nothing needs to know where it came from.
          if (this.isBrowser && res.user) {
            try {
              localStorage.setItem('user', JSON.stringify(res.user));
            } catch {
              /* storage blocked - the admin session still works */
            }
            this.loginSrv.onLogin();
          }
        })
      );
  }

  /**
   * Is the stored token still good?
   *
   * Asked of the server rather than answered from the token's presence: it may
   * have expired, or the flag may have been taken away in the database since.
   */
  verify(): Observable<boolean> {
    if (!this.token) return of(false);

    return this.http.get<{ ok: boolean; name: string }>(`${environment.apibase}/api/admin/me`).pipe(
      tap(res => this.adminName.set(res?.name || '')),
      map(() => true),
      catchError(() => {
        // 401 means the key no longer opens anything; drop it so the login form
        // starts clean rather than retrying a dead token on every navigation.
        this.clear();
        return of(false);
      })
    );
  }

  logout(): Observable<unknown> {
    if (!this.token) {
      this.clear();
      return of(null);
    }

    return this.http.post(`${environment.apibase}/api/admin/logout`, {}).pipe(
      // Clear locally whatever the server says: a logout that fails to reach it
      // must still end the session in this browser. The token expires there on
      // its own.
      tap({ next: () => this.clear(), error: () => this.clear() }),
      catchError(() => of(null))
    );
  }

  private clear() {
    this.token = '';
    this.adminName.set('');
  }
}
