import { Injectable, WritableSignal, computed, signal } from '@angular/core';
import {IMessage} from '../interfaces'

@Injectable({ providedIn: 'root' })
export class MessagesStore {
  // the single user this store is for
  private meId: number | null = null;

  // state (inbox only)
  private _byId: WritableSignal<Record<string, IMessage>> = signal({});
  private _order: WritableSignal<string[]> = signal([]); // newest-first ids

  // selectors
  all = computed<IMessage[]>(() => this._order().map(id => this._byId()[id]).filter(Boolean));
  unreadCount = computed(() => this.all().filter(m => !m.readAt).length);

  /** Call once when you know the user */
  init(meId: number) { this.meId = meId; }

  /** Replace all messages (expects only messages to me) */
  setAll(list: IMessage[]) {
    const onlyMine = this.meId == null ? list : list.filter(m => m.toId === this.meId);
    const byId: Record<string, IMessage> = {};
    for (const m of onlyMine) byId[m.id] = m;
    const order = [...onlyMine]
      .sort((a,b) => +new Date(b.sentAt) - +new Date(a.sentAt))
      .map(m => m.id);
    this._byId.set(byId);
    this._order.set(order);
  }

  /** Merge/append many (de-dupes by id, keeps newest-first) */
  addMany(list: IMessage[]) {
    const byId = { ...this._byId() };
    for (const m of list) {
      if (this.meId != null && m.toId !== this.meId) continue; // ignore others
      byId[m.id] = m;
    }
    const order = Object.keys(byId)
      .map(id => byId[id]!)
      .sort((a,b) => +new Date(b.sentAt) - +new Date(a.sentAt))
      .map(m => m.id);
    this._byId.set(byId);
    this._order.set(order);
  }

  /** Add one message (to me) */
  add(m: IMessage) {
    if (this.meId != null && m.toId !== this.meId) return; // ignore others
    const byId = { ...this._byId(), [m.id]: m };
    const order = this._order().slice();
    const insertAt = order.findIndex(id => new Date(this._byId()[id]?.sentAt ?? 0).getTime() < new Date(m.sentAt).getTime());
    if (insertAt === -1) order.push(m.id); else order.splice(insertAt, 0, m.id);
    this._byId.set(byId);
    this._order.set(order);
  }

  /** Mark one message as read */
  markRead(id: string, at: string = new Date().toISOString()) {
    const m = this._byId()[id]; if (!m) return;
    this._byId.set({ ...this._byId(), [id]: { ...m, readAt: at } });
  }

  /** Clear everything */
  clear() { this._byId.set({}); this._order.set([]); }
}
