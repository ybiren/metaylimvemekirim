import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { IUser } from '../interfaces';
import { BehaviorSubject, firstValueFrom, Observable, of } from 'rxjs';
import { getCurrentUserId } from '../core/current-user';
import { Dialog } from '@angular/cdk/dialog';


@Injectable({ providedIn: 'root' })

export class UsersService {
 
  private baseUrl = environment.apibase;
  readonly users$ = new BehaviorSubject<IUser[]>([]); 
  private baseApi = environment.apibase;
  dialog = inject(Dialog);  

  constructor(private http: HttpClient) {}

  async load() {
     /*
    if(getCurrentUserId()) {
      try {
        const res = await firstValueFrom();
        this.users$.next((res.users ?? []));
      } catch (err) {
        console.error('[UsersService] Failed to load users:', err);
      }
    }
    */
  }
  
  
    
  
  block(userId: number, blocked_userid: number) {
    //const fd = new FormData();
    //fd.append('userId', String(userId));
    //fd.append('blocked_userid', String(blocked_userId));
    return this.http.patch(`${this.baseUrl}/block`, {userId, blocked_userid});
  }

  is_blockedByPeerSignal(userId: number, peerId: number) {
    
    if(peerId < 0 || userId < 0) {
      return of(false);
    } else {
      return this.http.post<boolean>(`${this.baseUrl}/is_blocked_by_peer`, { userId, peerId });
    }
    
    
  }  
  
  getName(userId: number): string {
    return userId!==-1000 ? this.users$.value.find(u => u.userID === userId)?.c_name ?? `משתמש #${userId}` : "חברים";
  }
  
  
  like(userId: number, liked_userid: number) {
    //const fd = new FormData();
    //fd.append('userId', String(userId));
    //fd.append('blocked_userid', String(blocked_userId));
    return this.http.patch(`${this.baseUrl}/like`, {userId, liked_userid});
  }


  isLiked(from_user_id: number,to_user_id: number) {
    return this.http.post<boolean>(`${this.baseUrl}/isLiked`, {from_user_id, to_user_id});
  }

  getUser(userId: number): Observable<any> {
    return this.http.post<any[]>(`${this.baseApi}/user/${userId}`,{});
  }

  getAllUsers(onlyUsersThatLikedMe = null) {
     return getCurrentUserId() ? this.http.post<IUser[]>(`${this.baseUrl}/users`,{userId: getCurrentUserId(), onlyUsersThatLikedMe}): of([]);
  }

  freezeProfile() {
      return this.http.post<boolean>(`${this.baseUrl}/freeze_user`, {userId: getCurrentUserId()});
  }
  

}