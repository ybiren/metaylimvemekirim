import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpHeaders, HttpParams } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { IUser } from '../interfaces';
import { BehaviorSubject, firstValueFrom } from 'rxjs';
import { toSignal } from '@angular/core/rxjs-interop';

@Injectable({ providedIn: 'root' })

export class UsersService {
 
  private baseUrl = environment.apibase;
  readonly users$ = new BehaviorSubject<IUser[]>([]); 

  constructor(private http: HttpClient) {}

  async load() {
    try {
      const res = await firstValueFrom(this.http.get<{ users: IUser[] }>(`${this.baseUrl}/users`));
      this.users$.next((res.users ?? []));
    } catch (err) {
      console.error('[UsersService] Failed to load users:', err);
    }
  }
    
  
  block(userId: number, blocked_userid: number) {
    //const fd = new FormData();
    //fd.append('userId', String(userId));
    //fd.append('blocked_userid', String(blocked_userId));
    return this.http.patch(`${this.baseUrl}/block`, {userId, blocked_userid});
  }

  is_blockedByPeerSignal(userId: number, peerId: number) {
    return toSignal(
      this.http.post<{ is_blocked: boolean }>(`${this.baseUrl}/is_blocked_by_peer`, { userId, peerId }),
      { initialValue: null }
    );
  }  
  
  getName(userId: number): string {
    return this.users$.value.find(u => u.userID === userId)?.c_name ?? `משתמש #${userId}`;
  }
  
  



}