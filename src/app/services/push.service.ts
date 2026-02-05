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
    alert(`this.swPush.isEnabled= ${this.swPush.isEnabled}`);
    if (!this.swPush.isEnabled) return;
    alert("after swPush.isEnableddfdfdfsdsds");
    try {
      const sub = await this.swPush.requestSubscription({
        serverPublicKey: this.VAPID_PUBLIC_KEY,
      });

      const res = await firstValueFrom(
        this.http.post('/api/push/subscribe', {
          userId,
          subscription: sub,
          userAgent: navigator.userAgent,
        })
      );

      alert("Subscribed OK: " + JSON.stringify(res));
    } catch (e: any) {
      const msg =
        `requestSubscription FAILED\n` +
        `name: ${e?.name}\n` +
        `message: ${e?.message}\n` +
        `stack: ${e?.stack ?? 'n/a'}\n` +
        `raw: ${JSON.stringify(e)}`;
      alert(msg);
      console.error(e);
    }
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
