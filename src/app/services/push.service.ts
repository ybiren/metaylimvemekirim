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

  async enableAndRegister(userId?: number): Promise<void> {
    if (!this.swPush.isEnabled) return;

    const sub = await this.swPush.requestSubscription({
      serverPublicKey: this.VAPID_PUBLIC_KEY,
    });

    await firstValueFrom(
      this.http.post('/api/push/subscribe', {
        userId,
        subscription: sub,
        userAgent: navigator.userAgent,
      })
    );
  }

  async disable(userId?: number): Promise<void> {
    if (!this.swPush.isEnabled) return;

    // ✅ force correct type
    const sub = (await firstValueFrom(this.swPush.subscription)) as PushSubscription | null;
    if (!sub) return;

    await sub.unsubscribe();

    await firstValueFrom(
      this.http.post('/api/push/unsubscribe', {
        userId,
        endpoint: sub.endpoint,
      })
    );
  }


  



}
