import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpHeaders, HttpParams } from '@angular/common/http';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })

export class UsersService {
 
 private baseUrl = environment.apibase;
 
  constructor(private http: HttpClient) {}
  block(userId: number, blocked_userid: number) {
    const fd = new FormData();
    //fd.append('userId', String(userId));
    //fd.append('blocked_userid', String(blocked_userId));
    return this.http.patch(`${this.baseUrl}/block`, {userId, blocked_userid});
  }
}