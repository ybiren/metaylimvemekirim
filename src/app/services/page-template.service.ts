import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';


@Injectable({ providedIn: 'root' })
export class PageTemplateService {
  private http = inject(HttpClient);
  private baseUrl = environment.apibase;
  
  load(path: string)  {
    return this.http.get(`${this.baseUrl}/api/pages/content?path=${path}`);
  }
 
}