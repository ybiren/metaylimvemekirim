import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { SwPush } from '@angular/service-worker';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class PushService {
  private swPush = inject(SwPush);
  private http = inject(HttpClient);

  private readonly VAPID_PUBLIC_KEY = environment.vapidPublicKey;

  // every other service posts through apibase; a relative path only works
  // while Angular and FastAPI share an origin
  private baseUrl = environment.apibase;

  /** @returns whether the browser is now subscribed and the server knows */
  async enableAndRegister(userId?: number): Promise<boolean> {
    if (!this.swPush.isEnabled) return false;
    if (typeof Notification === 'undefined') return false;

    // getCurrentUserId() answers 0 when nobody is logged in, and 0 passes the
    // NOT NULL on push_subscriptions.user_id - so without this the row is
    // saved against a user that does not exist and no push ever arrives.
    if (!userId) {
      console.warn('[Push] not subscribing: no logged-in user');
      return false;
    }

    // Asking again after a block is a no-op, and requestSubscription would
    // only throw, so stop here and let the caller explain it.
    if (Notification.permission === 'denied') return false;

    if (Notification.permission !== 'granted') {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') return false;
    }

    try {
      const sub = await this.swPush.requestSubscription({
        serverPublicKey: this.VAPID_PUBLIC_KEY,
      });

      await firstValueFrom(
        this.http.post(`${this.baseUrl}/api/push/subscribe`, {
          userId,
          subscription: sub,
          userAgent: navigator.userAgent,
        })
      );

      return true;
    } catch (e) {
      console.error('[Push] subscribe failed', e);
      return false;
    }
  }

  async disable(userId?: number): Promise<void> {
    if (!this.swPush.isEnabled) return;

    // ✅ force correct type
    const sub = (await firstValueFrom(this.swPush.subscription)) as PushSubscription | null;
    if (!sub) return;

    await sub.unsubscribe();

    await firstValueFrom(
      this.http.post(`${this.baseUrl}/api/push/unsubscribe`, {
        userId,
        endpoint: sub.endpoint,
      })
    );
  }


  



}
