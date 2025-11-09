import { Injectable } from '@angular/core';
import {
  HttpEvent, HttpHandler, HttpInterceptor, HttpRequest
} from '@angular/common/http';
import { Observable } from 'rxjs';
import { finalize } from 'rxjs/operators';
import { NgxSpinnerService } from 'ngx-spinner';

@Injectable()
export class LoadingInterceptor implements HttpInterceptor {
  constructor(private spinner: NgxSpinnerService) {}

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    console.log("message from intercept");
    // Endpoints that should NOT trigger the spinner
    const IGNORE = ['/online', '/presence', '/heartbeat'];
    if (IGNORE.some(p => req.url.includes(p))) {
      return next.handle(req); // ← Skip spinner
    }
    this.spinner.show();

    return next.handle(req).pipe(
      finalize(() => this.spinner.hide())
    );
  }
}
