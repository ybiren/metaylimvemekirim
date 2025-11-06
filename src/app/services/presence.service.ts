import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Subscription, timer } from 'rxjs';
import { switchMap, map, catchError } from 'rxjs/operators';
import { environment } from '../../environments/environment';


@Injectable({ providedIn: 'root' })
export class PresenceService {
  private http = inject(HttpClient);

  /** set of userIds currently online (excluding me if requested) */
  readonly onlineSet$ = new BehaviorSubject<Set<number>>(new Set());
  private sub?: Subscription;
  private baseUrl = environment.apibase;

  /**
   * Start presence heartbeat every `periodMs` (default 30s) for `userId`.
   * Also refreshes /presence/online (excluding me) to keep the set in sync.
   */
  start(periodMs = 30_000, userId: number): Subscription {
    if (this.sub) return this.sub; // prevent duplicates

    this.sub = timer(0, periodMs).pipe(
      // 1) ping (heartbeat)
      switchMap(() =>
        this.http.post<{ ok: boolean; ttl: number }>(`${this.baseUrl}/presence/ping?userId=${userId}`, {})
      ),
      // 2) then fetch online list (exclude me)
      switchMap(() =>
        this.http.get<{ ok: boolean; online: number[] }>(`${this.baseUrl}/presence/online?exclude=${userId}`)
      ),
      map(res => new Set<number>(res.online)),
      catchError(err => {
        console.error('[Presence] cycle failed:', err);
        return [new Set<number>()]; // fallback to empty set
      })
    ).subscribe(set => this.onlineSet$.next(set));

    return this.sub!;
  }

  stop() {
    this.sub?.unsubscribe();
    this.sub = undefined;
    this.onlineSet$.next(new Set());
  }
}
