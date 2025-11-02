import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { IRegisterPayload } from '../interfaces';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class RegisterService {
  
  private baseUrl = environment.apibase;

  constructor(private http: HttpClient) {}

  /** x-www-form-urlencoded (legacy style) */
  registerFormUrlEncoded(payload: IRegisterPayload): Observable<any> {
    let body = new HttpParams();
    Object.entries(payload).forEach(([k, v]) => {
      body = body.set(k, String(v ?? ''));
    });

    const headers = new HttpHeaders({ 'Content-Type': 'application/x-www-form-urlencoded' });
    return this.http.post(`${this.baseUrl}/register`, body, { headers })
      .pipe(catchError(this.handleError));
  }

  /** JSON */
  registerJson(payload: IRegisterPayload): Observable<any> {
    return this.http.post(`${this.baseUrl}/register`, payload)
      .pipe(catchError(this.handleError));
  }

  /** ✅ Multipart: supports file upload (FormData) */
  registerFormData(fd: FormData): Observable<any> {
    // DO NOT set 'Content-Type' here — the browser sets the multipart boundary.
    return this.http.post(`${this.baseUrl}/register`, fd)
      .pipe(catchError(this.handleError));
  }

  private handleError(err: HttpErrorResponse) {
    console.error('Register error:', err);
    return throwError(() => err);
  }
}
