import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class SmsUpdatesService {
  
  private baseUrl = environment.apibase;
  private http  = inject(HttpClient)
  constructor() {}


  /** ✅ Multipart: supports file upload (FormData) */
  setFormData(payload): Observable<any> {
    return this.http.post(`${this.baseUrl}/sms_updates`, payload)
      .pipe(catchError(this.handleError));
  }

  private handleError(err: HttpErrorResponse) {
    console.error('Register error:', err);
    return throwError(() => err);
  }
}
