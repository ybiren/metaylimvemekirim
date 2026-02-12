//SSS
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { environment } from '../../../environments/environment';

export interface IUpdateLink {
  id: number;
  title: string;
  href: string;
  isPromo: boolean;
  underline?: boolean;
  bold?: boolean;
  targetBlank?: boolean;
  sortOrder: number;
  isActive: boolean;
}

type UpsertDto = Omit<IUpdateLink, 'id'>;

@Component({
  selector: 'admin-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <section class="admin admin--full">
      <header class="header">
        <div class="heading">
          <h2>Admin - Updates Links</h2>
          <p class="sub">Manage the updates links shown on the site.</p>
        </div>

        <div class="toolbar">
          <button type="button" (click)="startCreate()">➕ Add link</button>
          <button type="button" (click)="reload()" [disabled]="loading()">🔄 Reload</button>
        </div>
      </header>

      <div class="grid" [class.has-editor]="!!editing()">
        <!-- LIST -->
        <div class="card list">
          <div class="card-title">
            <h3>Items</h3>

            <div class="meta">
              <span *ngIf="loading()">Loading…</span>
              <span class="err" *ngIf="error()">{{ error() }}</span>
              <span *ngIf="!loading() && !error()">Total: {{ items().length }}</span>
            </div>
          </div>

          <div class="table">
            <div class="row head">
              <div class="c-order">#</div>
              <div class="c-title">Title</div>
              <div class="c-href">Href</div>
              <div class="c-flag">Promo</div>
              <div class="c-flag">Active</div>
              <div class="c-actions">Actions</div>
            </div>

            <div class="row" *ngFor="let it of itemsSorted(); trackBy: trackById">
              <div class="c-order">
                <input
                  class="order"
                  type="number"
                  [(ngModel)]="it.sortOrder"
                  (change)="quickSortSave(it)"
                  [disabled]="loading()"
                  title="Sort order"
                />
              </div>

              <div class="c-title">
                <div class="title" [class.muted]="!it.isActive">{{ it.title }}</div>
                <div class="badges">
                  <span class="badge promo" *ngIf="it.isPromo">PROMO</span>
                  <span class="badge off" *ngIf="!it.isActive">HIDDEN</span>
                </div>
              </div>

              <div class="c-href">
                <a
                  class="link"
                  [href]="it.href"
                  [target]="it.targetBlank ? '_blank' : '_self'"
                  [title]="it.href"
                >
                  {{ it.href }}
                </a>
              </div>

              <div class="c-flag">{{ it.isPromo ? '✅' : '' }}</div>
              <div class="c-flag">{{ it.isActive ? '✅' : '❌' }}</div>

              <div class="c-actions actions">
                <button type="button" (click)="startEdit(it)" [disabled]="loading()" title="Edit">✏️</button>
                <button type="button" class="danger" (click)="remove(it)" [disabled]="loading()" title="Delete">🗑️</button>
              </div>
            </div>

            <div class="empty" *ngIf="!loading() && !error() && items().length === 0">
              No links yet. Click “Add link”.
            </div>
          </div>
        </div>

        <!-- EDITOR (only when editing) -->
        <div class="card editor" *ngIf="editing() as e">
          <div class="card-title">
            <h3>{{ e.mode === 'create' ? 'Create link' : 'Edit link' }}</h3>
            <button type="button" class="ghost" (click)="cancel()" title="Close">✖</button>
          </div>

          <form class="form" (ngSubmit)="save()">
            <label>Title</label>
            <input [(ngModel)]="e.model.title" name="title" autocomplete="off" />

            <label>Href</label>
            <input [(ngModel)]="e.model.href" name="href" autocomplete="off" />

            <div class="checks">
              <label><input type="checkbox" [(ngModel)]="e.model.isPromo" name="isPromo" /> Promo</label>
              <label><input type="checkbox" [(ngModel)]="e.model.isActive" name="isActive" /> Active</label>
              <label><input type="checkbox" [(ngModel)]="e.model.targetBlank" name="targetBlank" /> target="_blank"</label>
              <label><input type="checkbox" [(ngModel)]="e.model.bold" name="bold" /> Bold</label>
              <label><input type="checkbox" [(ngModel)]="e.model.underline" name="underline" /> Underline</label>
            </div>

            <label>Sort order</label>
            <input type="number" [(ngModel)]="e.model.sortOrder" name="sortOrder" />

            <div class="buttons">
              <button type="submit" [disabled]="loading()">💾 Save</button>
              <button type="button" class="ghost" (click)="cancel()" [disabled]="loading()">Cancel</button>
            </div>
          </form>
        </div>
      </div>
    </section>
  `,
  styles: [`
    /* ✅ Break out of centered site container ONLY for this admin page */
    .admin--full{
      width: 95vw;
      margin-left: calc(50% - 50vw);
      margin-right: calc(50% - 50vw);
    }

    .admin{
      padding: 16px 24px;
    }

    .header{
      display:flex;
      align-items:flex-end;
      justify-content:space-between;
      gap:16px;
      margin-bottom:14px;
    }

    .heading h2{ margin:0; }
    .sub{ margin:6px 0 0; opacity:.7; }

    .toolbar{ display:flex; gap:8px; }

    /* ✅ Table becomes full-width when editor is closed */
    .grid{
      display:grid;
      grid-template-columns: 1fr;
      gap:20px;
      align-items:start;
    }
    .grid.has-editor{
      grid-template-columns: 5fr 2fr;
    }

    .card{
      background:#fff;
      border:1px solid #ddd;
      border-radius:12px;
      padding:12px;
      width:100%;
      box-shadow: 0 1px 2px rgba(0,0,0,.04);
    }

    .card-title{
      display:flex;
      align-items:center;
      justify-content:space-between;
      gap:12px;
      margin-bottom:10px;
    }

    .meta{ display:flex; gap:10px; font-size:13px; opacity:.85; }
    .err{ color:#b00020; opacity:1; }

    .table{
      border-top:1px solid #eee;
      overflow-x:auto; /* ✅ prevents any overflow */
    }

    .row{
      display:grid;
      grid-template-columns:
        90px
        3fr
        4fr
        110px
        110px
        minmax(110px, 160px); /* ✅ actions won't overflow */
      gap:12px;
      align-items:center;
      padding:10px 0;
      border-bottom:1px solid #eee;
      min-width:0; /* ✅ allow grid items to shrink */
    }

    .row.head{
      font-weight:700;
      border-bottom:2px solid #ddd;
      padding:12px 0;
      background:#fafafa;
      border-top-left-radius:10px;
      border-top-right-radius:10px;
    }

    .c-actions{ min-width:0; } /* ✅ important */

    .order{
      width:72px;
      padding:6px 8px;
      border-radius:10px;
      border:1px solid #ccc;
      text-align:center;
    }

    .title{
      font-weight:600;
      overflow:hidden;
      text-overflow:ellipsis;
      white-space:nowrap;
    }
    .muted{ opacity:.55; }

    .badges{ display:flex; gap:6px; margin-top:4px; }

    .badge{
      font-size:11px;
      padding:2px 8px;
      border-radius:999px;
      border:1px solid #ddd;
      background:#f7f7f7;
    }
    .badge.promo{ border-color:#c7e6ff; background:#eaf6ff; }
    .badge.off{ border-color:#ffd2d2; background:#fff1f1; }

    /* ✅ Keep rows short: show URL with ellipsis, full URL on hover via title */
    .link{
      display:block;
      max-width:100%;
      white-space:nowrap;
      overflow:hidden;
      text-overflow:ellipsis;
      text-decoration: underline;
    }

    .actions{
      display:flex;
      gap:8px;
      justify-content:flex-end;
      flex-wrap:nowrap;
      overflow:hidden; /* ✅ prevents spill */
    }

    button{
      padding:6px 8px; /* ✅ smaller so it fits */
      min-width:36px;
      border-radius:10px;
      border:1px solid #ccc;
      background:#f7f7f7;
      cursor:pointer;
    }
    button:disabled{ opacity:.6; cursor:not-allowed; }
    button.danger{ border-color:#ffb3b3; background:#ffecec; }
    button.ghost{ background:transparent; }

    .form label{ display:block; font-weight:600; margin:10px 0 6px; }
    .form input{
      width:100%;
      padding:8px;
      border-radius:10px;
      border:1px solid #ccc;
    }

    .checks{
      display:grid;
      grid-template-columns: 1fr 1fr;
      gap:10px;
      margin:12px 0 6px;
    }

    .buttons{ display:flex; gap:8px; margin-top:12px; }

    .empty{ padding:16px 0; opacity:.7; }

    @media (max-width: 1200px){
      .grid.has-editor{ grid-template-columns: 1fr; }
      .row{
        grid-template-columns:
          90px
          2fr
          3fr
          100px
          100px
          minmax(110px, 150px);
      }
    }

    @media (max-width: 900px){
      .admin{ padding: 16px; }
      .grid.has-editor{ grid-template-columns: 1fr; }
      .row{ grid-template-columns: 1fr; }
      .row.head{ display:none; }
      .actions{ justify-content:flex-start; }
      .order{ width:110px; }
      .link{ white-space:normal; }
    }
  `]
})
export class AdminDashboardComponent {
  private http = inject(HttpClient);

  loading = signal(false);
  error = signal<string | null>(null);
  items = signal<IUpdateLink[]>([]);

  itemsSorted = computed(() =>
    [...this.items()].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
  );

  editing = signal<null | {
    mode: 'create' | 'edit';
    id?: number;
    model: UpsertDto;
  }>(null);

  ngOnInit() {
    this.reload();
  }

  trackById = (_: number, it: IUpdateLink) => it.id;

  private api(path: string) {
    return `${environment.apibase}${path}`;
  }

  reload() {
    this.loading.set(true);
    this.error.set(null);

    this.http.get<IUpdateLink[]>(this.api('/api/admin/updates')).subscribe({
      next: (res) => {
        this.items.set(res ?? []);
        this.loading.set(false);
      },
      error: (e) => {
        this.error.set(e?.message ?? 'Failed to load');
        this.loading.set(false);
      }
    });
  }

  startCreate() {
    this.editing.set({
      mode: 'create',
      model: {
        title: '',
        href: '',
        isPromo: false,
        underline: false,
        bold: false,
        targetBlank: true,
        sortOrder: (this.items().length + 1),
        isActive: true,
      }
    });
  }

  startEdit(it: IUpdateLink) {
    this.editing.set({
      mode: 'edit',
      id: it.id,
      model: {
        title: it.title ?? '',
        href: it.href ?? '',
        isPromo: !!it.isPromo,
        underline: it.underline ?? false,
        bold: it.bold ?? false,
        targetBlank: it.targetBlank ?? true,
        sortOrder: it.sortOrder ?? 0,
        isActive: it.isActive ?? true,
      }
    });
  }

  cancel() {
    this.editing.set(null);
  }

  save() {
    const e = this.editing();
    if (!e) return;

    const title = (e.model.title ?? '').trim();
    const href = (e.model.href ?? '').trim();

    if (!title) { alert('Title required'); return; }
    if (!href) { alert('Href required'); return; }

    e.model.title = title;
    e.model.href = href;

    const req = e.mode === 'create'
      ? this.http.post<IUpdateLink>(this.api('/api/admin/updates'), e.model)
      : this.http.put<IUpdateLink>(this.api(`/api/admin/updates/${e.id}`), e.model);

    this.loading.set(true);
    req.subscribe({
      next: () => {
        this.loading.set(false);
        this.editing.set(null);
        this.reload();
      },
      error: (err) => {
        this.loading.set(false);
        alert(err?.message ?? 'Save failed');
      }
    });
  }

  remove(it: IUpdateLink) {
    if (!confirm(`Delete "${it.title}"?`)) return;

    this.loading.set(true);
    this.http.delete(this.api(`/api/admin/updates/${it.id}`)).subscribe({
      next: () => {
        this.loading.set(false);
        this.reload();
      },
      error: (err) => {
        this.loading.set(false);
        alert(err?.message ?? 'Delete failed');
      }
    });
  }

  quickSortSave(it: IUpdateLink) {
    if (it.id == null) return;

    const dto: UpsertDto = {
      title: it.title,
      href: it.href,
      isPromo: it.isPromo,
      underline: it.underline ?? false,
      bold: it.bold ?? false,
      targetBlank: it.targetBlank ?? true,
      sortOrder: Number(it.sortOrder ?? 0),
      isActive: it.isActive,
    };

    this.http.put<IUpdateLink>(this.api(`/api/admin/updates/${it.id}`), dto).subscribe({
      next: () => {
        this.items.update(arr =>
          arr.map(x => x.id === it.id ? { ...x, sortOrder: dto.sortOrder } : x)
        );
      },
      error: () => this.reload()
    });
  }
}
