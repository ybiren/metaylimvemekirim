// src/app/core/chat.service.ts
import { Injectable, NgZone } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { getCurrentUserId } from '../core/current-user';
import { environment } from '../../environments/environment';

export type ChatMsg = {
  id: string;
  fromUserId: number;
  toUserId: number;
  content: string;
  sentAt: string;                 // ISO
  deliveredAt?: string | null;
  readAt?: string | null;
};

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
  private reconnectTimer?: any;
  private reconnectDelay = 500;              // ms, exponential backoff up to 5s
  private readonly maxReconnect = 5000;

  private baseApi = environment.apibase;     // e.g. "http://localhost:8000"
  private baseWs  = environment.basews || ''; // e.g. "ws://localhost:8000" or ""

  /** current user + peer (room) */
  private me = getCurrentUserId();
  private peer = 0;

  /** chat streams */
  readonly messages$    = new BehaviorSubject<ChatMsg[]>([]);
  readonly typing$      = new BehaviorSubject<boolean>(false);

  /** threads + unread badge for top menu */
  readonly threads$     = new BehaviorSubject<ThreadRow[]>([]);
  readonly unreadTotal$ = new BehaviorSubject<number>(0);

  /** which peer's chat window is currently open (null = none) */
  readonly activePeer$  = new BehaviorSubject<number | null>(null);

  /** tiny built-in beep (data-URI); will play after first user gesture */
  private beep: HTMLAudioElement | null = null;

  constructor(private zone: NgZone) {
    // prepare a tiny beep; browsers may defer until first gesture
    this.beep = new Audio(
      'data:audio/wav;base64,UklGRmQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABYBQGZkAAAAAAAAPwAAAP8AAAB/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f39/f38='
    );
    this.beep.preload = 'auto';

    // light unlock attempt on first gesture
    const unlock = () => {
      if (!this.beep) return;
      try {
        this.beep.volume = 0.001;
        this.beep.currentTime = 0;
        this.beep.play().then(() => this.beep?.pause()).catch(() => {});
      } catch {}
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
    window.addEventListener('pointerdown', unlock, { passive: true });
    window.addEventListener('keydown', unlock);
  }

  /** Public: set which peer's chat is open (used to mute beeps for the open chat) */
  setActivePeer(peerId: number | null) {
    this.activePeer$.next(peerId);
  }

  // ------------------- Threads (top menu) -------------------

  private refreshThreadsQueued = false;
  async refreshThreads() {
    // coalesce calls that happen in quick succession
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
      if(this.unreadTotal$.value !== prevUnreadTotal) {
        this.playBeep();
      }

    }, 100); // small debounce
  }

  // ------------------- History + WebSocket -------------------

  async loadHistory(peerId: number, limit = 200) {
    this.me = getCurrentUserId();
    if (!this.me) return;
    const r = await fetch(`${this.baseApi}/chat/history?user1=${this.me}&user2=${peerId}&limit=${limit}`);
    const j = await r.json();
    const arr = Array.isArray(j.messages) ? (j.messages as ChatMsg[]) : [];
    // server usually returns DESC → reverse to ASC for rendering
    this.messages$.next([...arr].reverse());
  }

  private buildWsUrl(peerId: number) {
    const query = `?userId=${this.me}&peerId=${peerId}`;
    if (!this.baseWs) {
      // same-origin relative WebSocket; browser picks ws/wss
      return `/ws/chat${query}`;
    }
    // allow "ws://host:port" or "wss://host" in env; avoid double slashes
    const trimmed = this.baseWs.replace(/\/+$/, '');
    return `${trimmed}/ws/chat${query}`;
  }

  connect(peerId: number) {
    this.peer = peerId;
    this.me = getCurrentUserId();
    if (!this.me) {
      console.warn('[Chat] Missing user id. localStorage["user"] must contain userID.');
      return;
    }

    // close previous, if any
    try { this.ws?.close(); } catch {}

    const finalUrl = this.buildWsUrl(peerId);
    this.ws = new WebSocket(finalUrl);

    this.ws.onopen = () => {
      this.reconnectDelay = 500; // reset backoff
    };

    this.ws.onmessage = (ev) => {
      // handle outside Angular to avoid extra CD, then re-enter only for emits
      this.zone.run(() => {
        const data = JSON.parse(ev.data);

        if (data.type === 'message' && data.msg) {
          const msg = data.msg as ChatMsg;
          this.messages$.next([...this.messages$.value, msg]);
          this.refreshThreads();
        } else if (data.type === 'delivered') {
          const ids: string[] = data.ids || [];
          const at: string | undefined = data.deliveredAt; // optional from server
          const set = new Set<string>(ids);
          const list = this.messages$.value.map(m =>
            set.has(m.id) ? { ...m, deliveredAt: at ?? new Date().toISOString() } : m
          );
          this.messages$.next(list);

        } else if (data.type === 'read') {
          const ids: string[] = data.ids || [];
          const at: string | undefined = data.readAt; // optional from server
          const set = new Set<string>(ids);
          const list = this.messages$.value.map(m =>
            set.has(m.id) ? { ...m, readAt: at ?? new Date().toISOString() } : m
          );
          this.messages$.next(list);
          this.refreshThreads();

        } else if (data.type === 'typing') {
          this.typing$.next(true);
          // auto-clear after 1.5s of silence
          setTimeout(() => this.zone.run(() => this.typing$.next(false)), 1500);
        }
      });
    };

    this.ws.onclose = () => {
      this.typing$.next(false);
      this.scheduleReconnect();
    };
    this.ws.onerror = () => this.scheduleReconnect();
  }

  disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }
    try { this.ws?.close(); } catch {}
    this.ws = undefined;
    this.typing$.next(false);
  }

  // ------------------- Client -> Server events -------------------

  send(content: string) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    const payload = { type: 'message', content };
    try {
      this.ws.send(JSON.stringify(payload));
    } catch (e) {
      console.error('[Chat] send error:', e);
    }
  }

  sendTyping() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    try {
      this.ws.send(JSON.stringify({ type: 'typing' }));
    } catch {}
  }

  markReadUpTo(lastIso: string) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    try {
      this.ws.send(JSON.stringify({ type: 'readUpTo', upToIso: lastIso }));
    } catch {}
  }

  /** Convenience: mark all peer messages as read up to the latest one */
  markPeerRead(peerId: number) {
    const msgs = this.messages$.value;
    const lastPeerMsg = [...msgs]
      .reverse()
      .find(m => m.fromUserId === peerId && !m.readAt);
    if (lastPeerMsg) this.markReadUpTo(lastPeerMsg.sentAt);
  }

  // ------------------- Helpers -------------------

  private scheduleReconnect() {
    // Only reconnect if we still have a target peer (i.e., chat intended)
    if (!this.peer) return;
    if (this.reconnectTimer) return;

    const delay = Math.min(this.reconnectDelay, this.maxReconnect);
    this.reconnectDelay = Math.min(this.reconnectDelay * 2, this.maxReconnect);

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = undefined;
      this.connect(this.peer);
    }, delay);
  }

  private playBeep() {
    try {
      this.beep.currentTime = 0;
      void this.beep.play();
    } catch {
    }
  }
}
