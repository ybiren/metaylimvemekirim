import { Injectable, inject } from '@angular/core';
import {
  HttpEvent, HttpHandler, HttpInterceptor, HttpRequest
} from '@angular/common/http';
import { Observable } from 'rxjs';
import { AdminAuthService } from '../services/admin-auth.service';
import { environment } from '../../environments/environment';

/**
 * Puts the admin token on admin requests, and only on those.
 *
 * Scoped to this site's /api/admin URLs deliberately. An interceptor that
 * attached a credential to everything would hand it to any third party the app
 * ever calls - and this token blocks accounts and rewrites the site's pages.
 *
 * /api/admin/login is excluded: it is the request that has no token yet.
 */
@Injectable()
export class AdminTokenInterceptor implements HttpInterceptor {
  private auth = inject(AdminAuthService);

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    const adminApi = `${environment.apibase}/api/admin`;

    if (!req.url.startsWith(adminApi) || req.url.startsWith(`${adminApi}/login`)) {
      return next.handle(req);
    }

    const token = this.auth.token;
    if (!token) return next.handle(req);

    return next.handle(req.clone({ setHeaders: { 'X-Admin-Token': token } }));
  }
}
