import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { ISendMessagePayload, ISendMessageResponse } from '../interfaces';
import { Observable } from 'rxjs';


@Injectable({ providedIn: 'root' })
export class MessageComposeService {
  private http = inject(HttpClient);
  private baseUrl = environment.apibase;
   

  send(payload: ISendMessagePayload) {
    return this.http.post<ISendMessageResponse>(`${this.baseUrl}/addMessage`, payload)
  }
 
}