import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';


@Injectable({ providedIn: 'root' })
export class MessagesService {
  private http = inject(HttpClient);
  private baseUrl = environment.apibase;
  
  getMessagesByUserId(userId: number) {
    return this.http.get<{ok: boolean; count: number; messages: any[]}>(`${this.baseUrl}/messages`, { params: { userId }});
  }
 
}