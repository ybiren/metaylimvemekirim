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

  onLogin() {
    this.onLogin$.next(true);
  }

  onLogout() {
    this.onLogin$.next(false);
  }

}

