// src/app/core/chat.service.ts
import { inject, Injectable, NgZone } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { getCurrentUserId } from '../core/current-user';
import { environment } from '../../environments/environment';
import { HttpClient } from '@angular/common/http';

export type ChatMsg = {
  id: string;
  fromUserId: number;
  fromUserName: string;
  toUserId: number;
  content: string;
  sentAt: string;
  deliveredAt?: string | null;
  readAt?: string | null;
  type: string;
  date: string
};

export type ThreadRow = {
  roomId: string;
  peerId: number;
  peerName: string;
  lastAt: string;
  lastFromUserId: number | null;
  lastPreview: string;
  unread: number;
  count: number;
};

// ✅ NEW: minimal user row for the UI
export type ChatUserRow = {
  userId: number;
  name: string;
};

@Injectable({ providedIn: 'root' })
export class ChatService {
  private ws?: WebSocket;
  private reconnectTimer?: any;
  private reconnectDelay = 500;
  private readonly maxReconnect = 5000;

  private baseApi = environment.apibase;
  private baseWs  = environment.basews || '';

  private me = getCurrentUserId();
  private peer = 0;

  readonly messages$    = new BehaviorSubject<ChatMsg[]>([]);
  readonly typing$      = new BehaviorSubject<boolean>(false);
  readonly threads$     = new BehaviorSubject<ThreadRow[]>([]);
  readonly unreadTotal$ = new BehaviorSubject<number>(0);
  readonly activePeer$  = new BehaviorSubject<number | null>(null);

  readonly statusChanged$  = new BehaviorSubject<number>(0);

  // ✅ NEW: users observable
  readonly users$ = new BehaviorSubject<ChatUserRow[]>([]);

  http = inject(HttpClient);

  // ==== NEW: Web Audio fallback (reliable beep) ====
  private audioCtx?: AudioContext;
  private audioUnlocked = false;

  constructor(private zone: NgZone) {
    const unlock = async () => {
      try {
        if (!this.audioCtx) this.audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        if (this.audioCtx.state === 'suspended') await this.audioCtx.resume();
        this.audioUnlocked = (this.audioCtx.state === 'running');
      } catch {
        this.audioUnlocked = false;
      }
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
      window.removeEventListener('touchstart', unlock);
    };
    window.addEventListener('pointerdown', unlock, { passive: true });
    window.addEventListener('keydown', unlock);
    window.addEventListener('touchstart', unlock, { passive: true });
  }

  setActivePeer(peerId: number | null) {
    this.activePeer$.next(peerId);
  }

  // ------------------- Users (top / sidebar) -------------------
  async refreshUsers() {
    this.me = getCurrentUserId();
    if (!this.me) return;

    try {
      // ✅ pick ONE endpoint style that matches your backend:
      // Option A (recommended): /users?me=123
      const r = await fetch(`${this.baseApi}/users?me=${this.me}`);

      // Option B: /presence/users?userId=123  (if you already have presence)
      // const r = await fetch(`${this.baseApi}/presence/users?userId=${this.me}`);

      const j = await r.json();

      // Accept either {users:[...]} or just [...]
      const rows = Array.isArray(j) ? j : (Array.isArray(j.users) ? j.users : []);
      this.users$.next(rows as ChatUserRow[]);
    } catch (e) {
      console.warn('[Chat] refreshUsers failed', e);
      this.users$.next([]);
    }
  }

  // ------------------- Threads (top menu) -------------------
  private refreshThreadsQueued = false;
  async refreshThreads() {
    if (this.refreshThreadsQueued) return;
    this.refreshThreadsQueued = true;
    setTimeout(async () => {
      this.refreshThreadsQueued = false;
      this.me = getCurrentUserId();
      if (!this.me) return;

      const r = await fetch(`${this.baseApi}/chat/threads?userId=${this.me}`);
      const j = await r.json();
      const rows = Array.isArray(j.threads) ? (j.threads as ThreadRow[]) : [];
      this.threads$.next(rows);

      const prevUnreadTotal = this.unreadTotal$.value;
      this.unreadTotal$.next(rows.reduce((sum, t) => sum + (t.unread || 0), 0));

      if (this.unreadTotal$.value !== prevUnreadTotal) {
        this.playBeep();
      }
    }, 100);
  }

  async loadHistory(peerId: number, limit = 200) {
    this.me = getCurrentUserId();
    if (!this.me) return;
    const r = await fetch(`${this.baseApi}/chat/history?user1=${this.me}&user2=${peerId}&limit=${limit}`);
    const j = await r.json();
    const arr = Array.isArray(j.messages) ? (j.messages as ChatMsg[]) : [];
    this.messages$.next([...arr].reverse());
  }

  async markAsRead(peerId: number) {
    this.me = getCurrentUserId();
    if (!this.me) return;
    await fetch(`${this.baseApi}/chat/mark-read?userId=${this.me}&peerId=${peerId}`);
  }

  private buildWsUrl(peerId: number) {
    const query = `?userId=${this.me}&peerId=${peerId}`;
    if (!this.baseWs) return `/ws/chat${query}`;
    const trimmed = this.baseWs.replace(/\/+$/, '');
    return `${trimmed}/ws/chat${query}`;
  }

  connect(peerId: number) {
    console.log("connect");
    this.peer = peerId;
    this.me = getCurrentUserId();
    if (!this.me) {
      console.warn('[Chat] Missing user id. localStorage["user"] must contain userID.');
      return;
    }

    // ✅ update users list when connecting (and also threads if you want)
    ////this.refreshUsers();
    this.refreshThreads();

    try { this.ws?.close(); } catch {}

    const finalUrl = this.buildWsUrl(peerId);
    this.ws = new WebSocket(finalUrl);

    this.ws.onopen = () => {
      this.reconnectDelay = 500;
      this.statusChanged$.next(WebSocket.OPEN);
      console.log("open");

      // ✅ after socket opens (useful after reconnect)
      ////this.refreshUsers();
    };

    this.ws.onmessage = (ev) => {
      this.zone.run(() => {
        const data = JSON.parse(ev.data);

        if (data.type === 'message' && data.msg) {
          const msg = data.msg as ChatMsg;
          this.messages$.next([...this.messages$.value, msg]);
          this.refreshThreads();

        } else if (data.type === 'delivered') {
          const ids: string[] = data.ids || [];
          const at: string | undefined = data.deliveredAt;
          const set = new Set<string>(ids);
          const list = this.messages$.value.map(m =>
            set.has(m.id) ? { ...m, deliveredAt: at ?? new Date().toISOString() } : m
          );
          this.messages$.next(list);

        } else if (data.type === 'read') {
          const ids: string[] = data.ids || [];
          const at: string | undefined = data.readAt;
          const set = new Set<string>(ids);
          const list = this.messages$.value.map(m =>
            set.has(m.id) ? { ...m, readAt: at ?? new Date().toISOString() } : m
          );
          this.messages$.next(list);
          this.refreshThreads();

        } else if (data.type === 'typing') {
          this.typing$.next(true);
          setTimeout(() => this.zone.run(() => this.typing$.next(false)), 1500);

        // ✅ OPTIONAL: if your backend ever sends presence updates
        } else if (data.type === 'presence' && Array.isArray(data.users)) {
          this.users$.next(data.users as ChatUserRow[]);
        }
      });
    };

    this.ws.onclose = () => {
      this.typing$.next(false);
      this.statusChanged$.next(WebSocket.CLOSED);

      // ✅ refresh users to reflect "me offline"/others state (or clear)
      //this.refreshUsers().catch(() => {});
      this.scheduleReconnect();
    };

    this.ws.onerror = () => this.scheduleReconnect();
  }

  disconnect() {
    console.log("disconnect");
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }
    try { this.ws?.close(); } catch {}
    this.ws = undefined;
    this.typing$.next(false);

    // ✅ clear users list on disconnect (as you requested)
    this.users$.next([]);
    this.statusChanged$.next(WebSocket.CLOSED);
  }

  send(content: string) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    const payload = { type: 'message', content };
    try { this.ws.send(JSON.stringify(payload)); } catch (e) {
      console.error('[Chat] send error:', e);
    }
  }

  sendTyping() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    try { this.ws.send(JSON.stringify({ type: 'typing' })); } catch {}
  }

  markReadUpTo(lastIso: string) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    try { this.ws.send(JSON.stringify({ type: 'readUpTo', upToIso: lastIso })); } catch {}
  }

  markPeerRead(peerId: number) {
    const msgs = this.messages$.value;
    const lastPeerMsg = [...msgs].reverse().find(m => m.fromUserId === peerId && !m.readAt);
    if (lastPeerMsg) this.markReadUpTo(lastPeerMsg.sentAt);
  }

  private scheduleReconnect() {
    console.log("scheduleReconnect");
    if (!this.peer) return;
    if (this.reconnectTimer) return;

    const delay = Math.min(this.reconnectDelay, this.maxReconnect);
    this.reconnectDelay = Math.min(this.reconnectDelay * 2, this.maxReconnect);

    console.log("scheduleReconnect2");

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = undefined;
      // this.connect(this.peer);
    }, delay);
  }

  async playBeep() {
    try {
      if (!this.audioCtx) {
        this.audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      if (this.audioCtx.state === 'suspended') {
        await this.audioCtx.resume().catch(() => {});
      }

      const ctx = this.audioCtx;
      const now = ctx.currentTime;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, now);
      gain.gain.setValueAtTime(0.0, now);
      gain.gain.linearRampToValueAtTime(0.15, now + 0.005);
      gain.gain.linearRampToValueAtTime(0.0,  now + 0.15);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.16);
    } catch (e) {
      console.warn('[Chat] beep failed:', e);
    }
  }

  getChatRooms(): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseApi}/chat_rooms`);
  }
}
