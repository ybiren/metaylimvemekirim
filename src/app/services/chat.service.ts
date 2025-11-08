// chat.service.ts
import { Injectable, NgZone } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { getCurrentUserId } from '../core/current-user';
import { environment } from '../../environments/environment';

export type ChatMsg = {
  id: string;
  fromUserId: number;
  toUserId: number;
  content: string;
  sentAt: string;        // ISO
  deliveredAt?: string | null;
  readAt?: string | null;
};

// ✅ ADD THIS TYPE
export type ThreadRow = {
  roomId: string;
  peerId: number;
  lastAt: string;
  lastFromUserId: number | null;
  lastPreview: string;
  unread: number;
  count: number;
};

@Injectable({ providedIn: 'root' })
export class ChatService {
  private ws?: WebSocket;
  private baseApi = environment.apibase;
  private baseWs  = environment.basews;

  // existing message stream
  readonly messages$ = new BehaviorSubject<ChatMsg[]>([]);
  readonly typing$   = new BehaviorSubject<boolean>(false);

  // ✅ ADD THESE
  readonly threads$ = new BehaviorSubject<ThreadRow[]>([]);
  readonly unreadTotal$ = new BehaviorSubject<number>(0);

  private me = getCurrentUserId();
  private peer = 0;

  constructor(private zone: NgZone) {}

  // ------------- Threads -------------
  // ✅ ADD THIS
  async refreshThreads() {
    this.me = getCurrentUserId();
    if (!this.me) return;
    const r = await fetch(`${this.baseApi}/chat/threads?userId=${this.me}`);
    const j = await r.json();
    const rows = Array.isArray(j.threads) ? (j.threads as ThreadRow[]) : [];
    this.threads$.next(rows);
    this.unreadTotal$.next(rows.reduce((sum, t) => sum + (t.unread || 0), 0));
  }

  // ------------- History + WS (existing) -------------
  async loadHistory(peerId: number, limit = 200) {
    this.me = getCurrentUserId();
    if (!this.me) return;
    const r = await fetch(`${this.baseApi}/chat/history?user1=${this.me}&user2=${peerId}&limit=${limit}`);
    const j = await r.json();
    const arr = Array.isArray(j.messages) ? (j.messages as ChatMsg[]) : [];
    this.messages$.next([...arr].reverse()); // show ASC in UI
  }

  connect(peerId: number) {
    this.peer = peerId;
    this.me = getCurrentUserId();
    if (!this.me) {
      console.warn('[Chat] Missing user id. Make sure localStorage["user"] contains userID.');
      return;
    }
    try { this.ws?.close(); } catch {}
    const url = `${this.baseWs}/ws/chat?userId=${this.me}&peerId=${peerId}`;
    this.ws = new WebSocket(url);

    this.ws.onmessage = (ev) => {
      this.zone.run(() => {
        const data = JSON.parse(ev.data);
        if (data.type === 'message' && data.msg) {
          const list = this.messages$.value;
          this.messages$.next([...list, data.msg as ChatMsg]);
          // optional: keep threads fresh on new messages
          this.refreshThreads();
        } else if (data.type === 'delivered') {
          const set = new Set<string>(data.ids || []);
          const list = this.messages$.value.map(m =>
            set.has(m.id) ? { ...m, deliveredAt: new Date().toISOString() } : m
          );
          this.messages$.next(list);
        } else if (data.type === 'read') {
          const set = new Set<string>(data.ids || []);
          const list = this.messages$.value.map(m =>
            set.has(m.id) ? { ...m, readAt: new Date().toISOString() } : m
          );
          this.messages$.next(list);
          this.refreshThreads();
        } else if (data.type === 'typing') {
          this.typing$.next(true);
          setTimeout(() => this.zone.run(() => this.typing$.next(false)), 1500);
        }
      });
    };
  }

  send(content: string) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify({ type: 'message', content }));
  }

  sendTyping() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify({ type: 'typing' }));
  }

  markReadUpTo(lastIso: string) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify({ type: 'readUpTo', upToIso: lastIso }));
  }
}
