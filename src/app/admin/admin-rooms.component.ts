import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { environment } from '../../environments/environment';

interface AdminRoom {
  id: number;
  room_id: string;
  user_id: number | null;
  admin_name: string | null;
}

interface UserHit {
  id: number;
  username: string;
  email: string;
}

/**
 * Says which member looks after each system chat room.
 *
 * The rooms themselves are not managed here - they are inserted by hand in
 * sql/chat_rooms.sql, and a room is "system" purely by having a negative id.
 * This screen only assigns a name to one.
 *
 * Assigning somebody grants them nothing; the name is shown at the top of the
 * room and checked nowhere.
 */
@Component({
  selector: 'app-admin-rooms',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <section class="rooms" dir="rtl">
      <h2>אחראי חדרי צ'אט</h2>

      @if (loading()) {
        <p class="muted">טוען…</p>
      }

      @if (error()) {
        <p class="err">{{ error() }}</p>
      }

      @for (r of rooms(); track r.id) {
        <div class="room">
          <div class="room__name">{{ r.room_id }}</div>

          <div class="room__admin">
            @if (r.admin_name) {
              <span class="badge">{{ r.admin_name }}</span>
            } @else {
              <span class="muted">אין אחראי</span>
            }
          </div>

          <div class="room__actions">
            <button type="button" (click)="startPick(r)">
              {{ r.admin_name ? 'החלפה' : 'בחירת אחראי' }}
            </button>
            @if (r.user_id) {
              <button type="button" class="danger" (click)="assign(r, null)">הסרה</button>
            }
          </div>

          @if (picking()?.id === r.id) {
            <div class="picker">
              <input
                type="search"
                [(ngModel)]="query"
                (ngModelChange)="search()"
                placeholder="חיפוש לפי שם או דוא&quot;ל…" />

              @if (searching()) {
                <p class="muted">מחפש…</p>
              }

              @for (u of hits(); track u.id) {
                <button type="button" class="hit" (click)="assign(r, u.id)">
                  {{ u.username }} <span class="muted">{{ u.email }}</span>
                </button>
              }

              @if (!searching() && query.length > 1 && !hits().length) {
                <p class="muted">לא נמצאו משתמשים.</p>
              }

              <button type="button" class="cancel" (click)="picking.set(null)">ביטול</button>
            </div>
          }
        </div>
      }

      @if (!loading() && !rooms().length) {
        <p class="muted">אין חדרי מערכת.</p>
      }
    </section>
  `,
  styles: [`
    .rooms { display: flex; flex-direction: column; gap: 0.75rem; }
    h2 { margin: 0 0 0.5rem; font-size: 1.25rem; }

    .room {
      display: grid;
      grid-template-columns: 1fr auto auto;
      align-items: center;
      gap: 0.75rem;
      padding: 0.75rem;
      background: #fff;
      border: 1px solid #e5e7eb;
      border-radius: 0.75rem;
    }

    .room__name { font-weight: 700; }
    .room__actions { display: flex; gap: 0.5rem; }

    .badge {
      background: #e8f5ee;
      color: #0b6b43;
      border-radius: 999px;
      padding: 0.15rem 0.6rem;
      font-size: 0.875rem;
      font-weight: 600;
    }

    .muted { color: #6b7280; font-size: 0.875rem; }
    .err { color: #c62828; }

    button {
      border: 1px solid #cbd5e1;
      border-radius: 0.5rem;
      background: #fff;
      padding: 0.3rem 0.7rem;
      cursor: pointer;
      font-size: 0.875rem;
    }
    button.danger { color: #c62828; }

    /* Spans the whole row: the picker belongs to the room above it, not to a
       column of it. */
    .picker {
      grid-column: 1 / -1;
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
      padding-top: 0.5rem;
      border-top: 1px solid #e5e7eb;
    }

    .picker input {
      padding: 0.45rem 0.6rem;
      border: 1px solid #cbd5e1;
      border-radius: 0.5rem;
    }

    .hit { text-align: right; }
    .hit:hover { background: #f1f5f9; }
    .cancel { align-self: flex-start; }
  `],
})
export class AdminRoomsComponent {
  private http = inject(HttpClient);
  private base = environment.apibase;

  rooms = signal<AdminRoom[]>([]);
  loading = signal(true);
  error = signal('');

  picking = signal<AdminRoom | null>(null);
  query = '';
  hits = signal<UserHit[]>([]);
  searching = signal(false);

  /** Cancels a search whose answer is no longer wanted. */
  private searchToken = 0;

  ngOnInit() {
    this.load();
  }

  private load() {
    this.loading.set(true);
    this.http.get<AdminRoom[]>(`${this.base}/api/admin/rooms`).subscribe({
      next: rooms => {
        this.rooms.set(rooms || []);
        this.loading.set(false);
      },
      error: err => {
        console.error('Failed to load rooms', err);
        this.error.set('לא הצלחנו לטעון את החדרים.');
        this.loading.set(false);
      },
    });
  }

  startPick(room: AdminRoom) {
    this.picking.set(room);
    this.query = '';
    this.hits.set([]);
  }

  search() {
    const q = this.query.trim();
    // One letter matches most of the site; wait for something worth sending.
    if (q.length < 2) {
      this.hits.set([]);
      return;
    }

    const token = ++this.searchToken;
    this.searching.set(true);

    this.http
      .get<{ items: UserHit[] }>(`${this.base}/api/admin/users`, {
        params: { q, page: 1, page_size: 10 },
      })
      .subscribe({
        next: res => {
          // A slower earlier search must not overwrite a later one's results.
          if (token !== this.searchToken) return;
          this.hits.set(res?.items || []);
          this.searching.set(false);
        },
        error: err => {
          if (token !== this.searchToken) return;
          console.error('User search failed', err);
          this.searching.set(false);
        },
      });
  }

  assign(room: AdminRoom, userId: number | null) {
    this.error.set('');

    this.http
      .patch<AdminRoom>(`${this.base}/api/admin/rooms/${room.id}`, { user_id: userId })
      .subscribe({
        next: updated => {
          // Patch the row in place rather than reloading: the list is short and
          // the server has already told us what it now holds.
          this.rooms.update(rows =>
            rows.map(r => (r.id === updated.id ? { ...r, ...updated } : r))
          );
          this.picking.set(null);
        },
        error: err => {
          console.error('Failed to assign room admin', err);
          this.error.set(err?.error?.detail || 'לא הצלחנו לשמור את השינוי.');
        },
      });
  }
}
