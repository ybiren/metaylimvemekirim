import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Subscription, timer, of } from 'rxjs';
import { switchMap, map, catchError } from 'rxjs/operators';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class PresenceService {
  private http = inject(HttpClient);
  private baseUrl = environment.apibase;

  /** Set of userIds currently online (excluding me) */
  readonly onlineSet = signal<Set<number>>(new Set());

  /** If you also want an array, use this: */
  readonly online = computed(() => [...this.onlineSet()]);

  private sub?: Subscription;

  /**
   * Start presence heartbeat every `periodMs` (default 30s) for `userId`.
   * Also refreshes /presence/online (excluding me) to keep the set in sync.
   */
  start(periodMs = 30_000, userId: number): Subscription {
    if (this.sub) return this.sub; // prevent duplicates

    this.sub = timer(0, periodMs).pipe(
      // 1) ping (heartbeat)
      switchMap(() =>
        this.http.post<{ ok: boolean; ttl: number }>(
          `${this.baseUrl}/presence/ping?userId=${userId}`, {}
        )
      ),
      // 2) then fetch online list (exclude me)
      switchMap(() =>
        this.http.get<{ ok: boolean; online: number[] }>(
          `${this.baseUrl}/presence/online?exclude=${userId}`
        )
      ),
      map(res => new Set<number>(res.online ?? [])),
      catchError(err => {
        console.error('[Presence] cycle failed:', err);
        return of(new Set<number>()); // fallback to empty set
      })
    ).subscribe(set => this.onlineSet.set(set));

    return this.sub!;
  }

  /** Instant check */
  isOnline(userId: number): boolean {
    return this.onlineSet().has(Number(userId));
  }

  /** Optional helpers */
  getOnlineList(): number[] {
    return [...this.onlineSet()];
  }

  stop() {
    this.sub?.unsubscribe();
    this.sub = undefined;
    this.onlineSet.set(new Set());
  }
}
