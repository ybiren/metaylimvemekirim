import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from '../../environments/environment';
import { BehaviorSubject } from 'rxjs';


// login.service.ts
@Injectable({ providedIn: 'root' })
export class LoginService {

  http = inject(HttpClient);
  readonly onLogin$  = new BehaviorSubject<boolean>(false);
   

  doLogin(formData) {
    return this.http.post(`${environment.apibase}/login`, formData);
  }

  /**
   * Is the session stored in this browser still allowed on the site?
   * Nothing authenticates a request, so a browser that logged in before the
   * account was blocked keeps working until someone asks.
   */
  checkSession(userId: number) {
    return this.http.get<{ ok: boolean; valid: boolean; reason: string | null }>(
      `${environment.apibase}/session/status`,
      { params: { userId } }
    );
  }

  onLogin() {
    this.onLogin$.next(true);
  }

  onLogout() {
    this.onLogin$.next(false);
  }

}

