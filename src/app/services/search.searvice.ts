// src/app/services/search.service.ts
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class SearchService {
  private http = inject(HttpClient);
  private baseUrl = environment.apibase;

  search(filters: any): Observable<any> {
    return this.http.post(`${this.baseUrl}/search`, filters);
  }
}
