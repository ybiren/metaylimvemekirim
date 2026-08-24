import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export interface BotTurn {
  role: 'user' | 'assistant';
  content: string;
}

export interface BotAnswer {
  answer: string;
}

@Injectable({ providedIn: 'root' })
export class BotService {

  private baseUrl = environment.apibase;
  private http = inject(HttpClient);

  /** Asks the site bot a question. History gives it the earlier turns so
   *  follow-up questions make sense; the server trims it either way. */
  ask(question: string, history: BotTurn[] = []): Observable<BotAnswer> {
    return this.http
      .post<BotAnswer>(`${this.baseUrl}/api/bot/ask`, { question, history })
      .pipe(catchError(this.handleError));
  }

  private handleError(err: HttpErrorResponse) {
    console.error('Bot error:', err);
    return throwError(() => err);
  }
}
