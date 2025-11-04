import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { MessagesStore } from '../../stores/messages.store';
import { RouterLink, RouterLinkActive } from '@angular/router';

@Component({
  selector: 'app-messages-store-view',
  standalone: true,
  imports: [CommonModule, DatePipe, RouterLink, RouterLinkActive],
  templateUrl: './messages.component.html',
  styleUrls: ['./messages.component.scss'],
})
export class MessagesStoreViewComponent {
  store = inject(MessagesStore);

  // Local UI state
  query = signal('');

  // Filter (by body) over the store's inbox (or all, as you prefer)
  // If your store already returns inbox only, you can use store.all() instead.
  private source = computed(() => this.store.all());
  filtered = computed(() => {
    const q = this.query().trim().toLowerCase();
    const list = this.source();
    if (!q) return list;
    return list.filter(m => (m.body || '').toLowerCase().includes(q));
  });

  // Newest-first (store is already newest-first, but keep it robust)
  gridItems = computed(() =>
    [...this.filtered()].sort((a, b) => +new Date(b.sentAt) - +new Date(a.sentAt))
  );

  trackById = (_: number, m: { id: string }) => m.id;

  // Optional hook – if you have a loader elsewhere, you can expose a refresh here.
  // refresh = () => this.externalLoader(); // left as comment on purpose
}
