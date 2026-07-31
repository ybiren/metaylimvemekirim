import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { environment } from '../../environments/environment';

export interface IAlbum {
  id: number;
  title: string;
  description?: string | null;
  is_active: boolean;
  sort_order: number;
  photo_count: number;
  cover_url: string;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface IAlbumPhoto {
  id: number;
  album_id: number;
  filename: string;
  content_type?: string | null;
  size: number;
  sort_order: number;
  image_url: string;
  created_at?: string | null;
}

type AlbumDto = {
  title: string;
  description: string;
  is_active: boolean;
  sort_order: number;
};

@Component({
  selector: 'admin-albums',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <section class="admin admin--full">
      <header class="header">
        <div class="heading">
          <h2>Admin - Albums</h2>
          <p class="sub">Manage site albums and the pictures inside them.</p>
        </div>

        <div class="toolbar">
          <input
            class="search"
            type="search"
            placeholder="Search title…"
            [(ngModel)]="q"
            (keyup.enter)="reload()"
          />
          <button type="button" (click)="startCreate()">➕ Add album</button>
          <button type="button" (click)="reload()" [disabled]="loading()">🔄 Reload</button>
        </div>
      </header>

      <div class="grid" [class.has-editor]="!!editing()">
        <!-- LIST -->
        <div class="card list">
          <div class="card-title">
            <h3>Albums</h3>

            <div class="meta">
              <span *ngIf="loading()">Loading…</span>
              <span class="err" *ngIf="error()">{{ error() }}</span>
              <span *ngIf="!loading() && !error()">Total: {{ albums().length }}</span>
            </div>
          </div>

          <div class="table">
            <div class="row head">
              <div class="c-order">#</div>
              <div class="c-cover">Cover</div>
              <div class="c-title">Title</div>
              <div class="c-count">Photos</div>
              <div class="c-flag">Active</div>
              <div class="c-actions">Actions</div>
            </div>

            <div
              class="row"
              *ngFor="let a of albums(); trackBy: trackById"
              [class.selected]="selectedId() === a.id"
            >
              <div class="c-order">
                <input
                  class="order"
                  type="number"
                  [(ngModel)]="a.sort_order"
                  (change)="quickSortSave(a)"
                  [disabled]="loading()"
                  title="Sort order"
                />
              </div>

              <div class="c-cover">
                <img *ngIf="a.cover_url" class="thumb" [src]="abs(a.cover_url)" [alt]="a.title" />
                <div *ngIf="!a.cover_url" class="thumb thumb--empty">—</div>
              </div>

              <div class="c-title">
                <div class="title" [class.muted]="!a.is_active">{{ a.title }}</div>
                <div class="desc" *ngIf="a.description">{{ a.description }}</div>
                <div class="badges">
                  <span class="badge off" *ngIf="!a.is_active">HIDDEN</span>
                </div>
              </div>

              <div class="c-count">
                <button type="button" class="link-btn" (click)="openPhotos(a)">
                  {{ a.photo_count }} 🖼️
                </button>
              </div>

              <div class="c-flag">{{ a.is_active ? '✅' : '❌' }}</div>

              <div class="c-actions actions">
                <button type="button" (click)="openPhotos(a)" [disabled]="loading()" title="Pictures">🖼️</button>
                <button type="button" (click)="startEdit(a)" [disabled]="loading()" title="Edit">✏️</button>
                <button type="button" class="danger" (click)="remove(a)" [disabled]="loading()" title="Delete">🗑️</button>
              </div>
            </div>

            <div class="empty" *ngIf="!loading() && !error() && albums().length === 0">
              No albums yet. Click “Add album”.
            </div>
          </div>
        </div>

        <!-- EDITOR (only when editing) -->
        <div class="card editor" *ngIf="editing() as e">
          <div class="card-title">
            <h3>{{ e.mode === 'create' ? 'Create album' : 'Edit album' }}</h3>
            <button type="button" class="ghost" (click)="cancel()" title="Close">✖</button>
          </div>

          <form class="form" (ngSubmit)="save()">
            <label>Title</label>
            <input [(ngModel)]="e.model.title" name="title" autocomplete="off" />

            <label>Description</label>
            <textarea [(ngModel)]="e.model.description" name="description" rows="3"></textarea>

            <div class="checks">
              <label><input type="checkbox" [(ngModel)]="e.model.is_active" name="is_active" /> Active</label>
            </div>

            <label>Sort order</label>
            <input type="number" [(ngModel)]="e.model.sort_order" name="sort_order" />

            <div class="buttons">
              <button type="submit" [disabled]="loading()">💾 Save</button>
              <button type="button" class="ghost" (click)="cancel()" [disabled]="loading()">Cancel</button>
            </div>
          </form>
        </div>
      </div>

      <!-- PICTURES of the selected album -->
      <div class="card photos" *ngIf="selected() as sel">
        <div class="card-title">
          <h3>Pictures — {{ sel.title }}</h3>

          <div class="meta">
            <span *ngIf="photosLoading()">Loading…</span>
            <span class="err" *ngIf="photoError()">{{ photoError() }}</span>
            <span *ngIf="!photosLoading()">{{ photos().length }} picture(s)</span>
            <button type="button" class="ghost" (click)="closePhotos()" title="Close">✖</button>
          </div>
        </div>

        <div class="uploader">
          <label class="btn-file">
            📁 Choose pictures
            <input type="file" accept="image/*" multiple (change)="onFilePick($event)" hidden />
          </label>

          <button
            type="button"
            (click)="uploadAll()"
            [disabled]="uploading() || localFiles().length === 0"
          >
            {{ uploading() ? 'Uploading…' : '⬆️ Upload ' + localFiles().length }}
          </button>

          <button
            type="button"
            class="ghost"
            (click)="clearLocal()"
            [disabled]="uploading() || localFiles().length === 0"
          >
            Clear
          </button>
        </div>

        <div class="strip" *ngIf="localPreviews().length">
          <div class="tile pending" *ngFor="let p of localPreviews(); let i = index">
            <img [src]="p" alt="pending" />
            <button type="button" class="tile-x" (click)="removeLocal(i)" [disabled]="uploading()">✖</button>
            <span class="tag">new</span>
          </div>
        </div>

        <div class="strip">
          <div class="tile" *ngFor="let ph of photos(); trackBy: trackByPhotoId">
            <a [href]="abs(ph.image_url)" target="_blank" rel="noopener">
              <img [src]="abs(ph.image_url)" [alt]="ph.filename" />
            </a>
            <button
              type="button"
              class="tile-x danger"
              (click)="deletePhoto(ph)"
              [disabled]="deletingId() === ph.id"
              title="Delete picture"
            >
              🗑️
            </button>
          </div>

          <div class="empty" *ngIf="!photosLoading() && photos().length === 0 && !localPreviews().length">
            No pictures yet. Choose files and upload.
          </div>
        </div>
      </div>
    </section>
  `,
  styles: [`
    /* Break out of centered site container ONLY for this admin page */
    .admin--full{
      width: 95vw;
      margin-left: calc(50% - 50vw);
      margin-right: calc(50% - 50vw);
    }

    .admin{ padding: 16px 24px; }

    .header{
      display:flex;
      align-items:flex-end;
      justify-content:space-between;
      gap:16px;
      margin-bottom:14px;
    }

    .heading h2{ margin:0; }
    .sub{ margin:6px 0 0; opacity:.7; }

    .toolbar{ display:flex; gap:8px; flex-wrap:wrap; }

    .search{
      padding:6px 10px;
      border-radius:10px;
      border:1px solid #ccc;
      min-width:200px;
    }

    .grid{
      display:grid;
      grid-template-columns: 1fr;
      gap:20px;
      align-items:start;
    }
    .grid.has-editor{ grid-template-columns: 5fr 2fr; }

    .card{
      background:#fff;
      border:1px solid #ddd;
      border-radius:12px;
      padding:12px;
      width:100%;
      box-shadow: 0 1px 2px rgba(0,0,0,.04);
    }

    .card.photos{ margin-top:20px; }

    .card-title{
      display:flex;
      align-items:center;
      justify-content:space-between;
      gap:12px;
      margin-bottom:10px;
    }

    .meta{ display:flex; gap:10px; align-items:center; font-size:13px; opacity:.85; }
    .err{ color:#b00020; opacity:1; }

    .table{
      border-top:1px solid #eee;
      overflow-x:auto;
    }

    .row{
      display:grid;
      grid-template-columns:
        90px
        80px
        4fr
        100px
        90px
        minmax(130px, 180px);
      gap:12px;
      align-items:center;
      padding:10px 0;
      border-bottom:1px solid #eee;
      min-width:0;
    }

    .row.head{
      font-weight:700;
      border-bottom:2px solid #ddd;
      padding:12px 0;
      background:#fafafa;
      border-top-left-radius:10px;
      border-top-right-radius:10px;
    }

    .row.selected{ background:#f2f9ff; }

    .c-actions{ min-width:0; }

    .order{
      width:72px;
      padding:6px 8px;
      border-radius:10px;
      border:1px solid #ccc;
      text-align:center;
    }

    .thumb{
      width:64px;
      height:48px;
      object-fit:cover;
      border-radius:8px;
      border:1px solid #ddd;
      background:#fafafa;
    }
    .thumb--empty{
      display:flex;
      align-items:center;
      justify-content:center;
      opacity:.5;
    }

    .title{
      font-weight:600;
      overflow:hidden;
      text-overflow:ellipsis;
      white-space:nowrap;
    }
    .desc{
      font-size:12px;
      opacity:.7;
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
    .badge.off{ border-color:#ffd2d2; background:#fff1f1; }

    .link-btn{
      border:none;
      background:transparent;
      cursor:pointer;
      text-decoration:underline;
      padding:0;
      min-width:0;
    }

    .actions{
      display:flex;
      gap:8px;
      justify-content:flex-end;
      flex-wrap:nowrap;
      overflow:hidden;
    }

    button{
      padding:6px 8px;
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
    .form input, .form textarea{
      width:100%;
      padding:8px;
      border-radius:10px;
      border:1px solid #ccc;
      font-family:inherit;
    }

    .checks{
      display:grid;
      grid-template-columns: 1fr 1fr;
      gap:10px;
      margin:12px 0 6px;
    }

    .buttons{ display:flex; gap:8px; margin-top:12px; }

    .empty{ padding:16px 0; opacity:.7; }

    /* ----- pictures ----- */

    .uploader{
      display:flex;
      gap:8px;
      align-items:center;
      flex-wrap:wrap;
      margin-bottom:12px;
    }

    .btn-file{
      padding:6px 10px;
      border-radius:10px;
      border:1px solid #ccc;
      background:#f7f7f7;
      cursor:pointer;
    }

    .strip{
      display:flex;
      flex-wrap:wrap;
      gap:10px;
    }

    .tile{
      position:relative;
      width:140px;
      height:110px;
      border-radius:10px;
      overflow:hidden;
      border:1px solid #ddd;
      background:#fafafa;
    }
    .tile img{
      width:100%;
      height:100%;
      object-fit:cover;
      display:block;
    }
    .tile.pending{ border-style:dashed; }

    .tile-x{
      position:absolute;
      top:4px;
      inset-inline-end:4px;
      min-width:28px;
      padding:2px 6px;
      border-radius:8px;
      opacity:.92;
    }

    .tag{
      position:absolute;
      bottom:4px;
      inset-inline-start:4px;
      font-size:11px;
      padding:1px 6px;
      border-radius:999px;
      background:rgba(0,0,0,.6);
      color:#fff;
    }

    @media (max-width: 1200px){
      .grid.has-editor{ grid-template-columns: 1fr; }
    }

    @media (max-width: 900px){
      .admin{ padding: 16px; }
      .grid.has-editor{ grid-template-columns: 1fr; }
      .row{ grid-template-columns: 1fr; }
      .row.head{ display:none; }
      .actions{ justify-content:flex-start; }
      .order{ width:110px; }
      .tile{ width:calc(50% - 5px); }
    }
  `]
})
export class AdminAlbumsComponent implements OnInit, OnDestroy {
  private http = inject(HttpClient);

  q = '';

  loading = signal(false);
  error = signal<string | null>(null);
  albums = signal<IAlbum[]>([]);

  editing = signal<null | {
    mode: 'create' | 'edit';
    id?: number;
    model: AlbumDto;
  }>(null);

  // picture manager state
  selectedId = signal<number | null>(null);
  photos = signal<IAlbumPhoto[]>([]);
  photosLoading = signal(false);
  photoError = signal<string | null>(null);
  deletingId = signal<number | null>(null);

  localFiles = signal<File[]>([]);
  localPreviews = signal<string[]>([]);
  uploading = signal(false);

  selected = computed(() => {
    const id = this.selectedId();
    return id == null ? null : this.albums().find(a => a.id === id) ?? null;
  });

  ngOnInit() {
    this.reload();
  }

  ngOnDestroy() {
    this.revokePreviews();
  }

  trackById = (_: number, a: IAlbum) => a.id;
  trackByPhotoId = (_: number, p: IAlbumPhoto) => p.id;

  private api(path: string) {
    return `${environment.apibase}${path}`;
  }

  /** Build a full URL for <img [src]>, same idea as AlbumService.toAbsolute. */
  abs(urlFromApi: string): string {
    if (!urlFromApi) return '';
    if (urlFromApi.startsWith('http')) return urlFromApi;
    return `${environment.apibase}${urlFromApi}`;
  }

  // ---------- albums ----------

  reload() {
    this.loading.set(true);
    this.error.set(null);

    const query = this.q.trim() ? `?q=${encodeURIComponent(this.q.trim())}` : '';

    this.http.get<{ items: IAlbum[] }>(this.api(`/api/admin/albums${query}`)).subscribe({
      next: (res) => {
        this.albums.set(res?.items ?? []);
        this.loading.set(false);

        // the open album may have been deleted elsewhere
        if (this.selectedId() != null && !this.selected()) {
          this.closePhotos();
        }
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
        description: '',
        is_active: true,
        sort_order: this.albums().length + 1,
      }
    });
  }

  startEdit(a: IAlbum) {
    this.editing.set({
      mode: 'edit',
      id: a.id,
      model: {
        title: a.title ?? '',
        description: a.description ?? '',
        is_active: a.is_active ?? true,
        sort_order: a.sort_order ?? 0,
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
    if (!title) { alert('Title required'); return; }

    const dto: AlbumDto = {
      title,
      description: (e.model.description ?? '').trim(),
      is_active: !!e.model.is_active,
      sort_order: Number(e.model.sort_order ?? 0),
    };

    const req = e.mode === 'create'
      ? this.http.post<IAlbum>(this.api('/api/admin/albums'), dto)
      : this.http.put<IAlbum>(this.api(`/api/admin/albums/${e.id}`), dto);

    this.loading.set(true);
    req.subscribe({
      next: () => {
        this.loading.set(false);
        this.editing.set(null);
        this.reload();
      },
      error: (err) => {
        this.loading.set(false);
        alert(err?.error?.detail ?? err?.message ?? 'Save failed');
      }
    });
  }

  remove(a: IAlbum) {
    const msg = a.photo_count
      ? `Delete "${a.title}" and its ${a.photo_count} picture(s)?`
      : `Delete "${a.title}"?`;
    if (!confirm(msg)) return;

    this.loading.set(true);
    this.http.delete(this.api(`/api/admin/albums/${a.id}`)).subscribe({
      next: () => {
        this.loading.set(false);
        if (this.selectedId() === a.id) this.closePhotos();
        this.reload();
      },
      error: (err) => {
        this.loading.set(false);
        alert(err?.error?.detail ?? err?.message ?? 'Delete failed');
      }
    });
  }

  quickSortSave(a: IAlbum) {
    if (a.id == null) return;

    this.http.put<IAlbum>(this.api(`/api/admin/albums/${a.id}`), {
      sort_order: Number(a.sort_order ?? 0),
    }).subscribe({
      next: () => {
        this.albums.update(arr =>
          arr.map(x => x.id === a.id ? { ...x, sort_order: Number(a.sort_order ?? 0) } : x)
        );
      },
      error: () => this.reload()
    });
  }

  // ---------- pictures ----------

  openPhotos(a: IAlbum) {
    this.selectedId.set(a.id);
    this.clearLocal();
    this.refreshPhotos();
  }

  closePhotos() {
    this.selectedId.set(null);
    this.photos.set([]);
    this.photoError.set(null);
    this.clearLocal();
  }

  refreshPhotos() {
    const id = this.selectedId();
    if (id == null) return;

    this.photosLoading.set(true);
    this.photoError.set(null);

    this.http.get<{ items: IAlbumPhoto[] }>(this.api(`/api/admin/albums/${id}/photos`)).subscribe({
      next: (res) => {
        this.photos.set(res?.items ?? []);
        this.photosLoading.set(false);
      },
      error: (err) => {
        this.photos.set([]);
        this.photosLoading.set(false);
        this.photoError.set(err?.error?.detail ?? 'Failed to load pictures');
      }
    });
  }

  onFilePick(event: Event) {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    input.value = '';
    if (!files.length) return;

    this.photoError.set(null);

    const valid = files.filter(f => f.type.startsWith('image/'));
    const tooBig = valid.filter(f => f.size > 5 * 1024 * 1024);
    const usable = valid.filter(f => f.size > 0 && f.size <= 5 * 1024 * 1024);

    this.localFiles.set([...this.localFiles(), ...usable]);
    this.localPreviews.set([
      ...this.localPreviews(),
      ...usable.map(f => URL.createObjectURL(f)),
    ]);

    if (tooBig.length) {
      this.photoError.set(`${tooBig.length} file(s) skipped: over 5MB`);
    } else if (valid.length !== files.length) {
      this.photoError.set(`${files.length - valid.length} file(s) skipped: not images`);
    }
  }

  removeLocal(i: number) {
    const previews = [...this.localPreviews()];
    URL.revokeObjectURL(previews[i]);
    previews.splice(i, 1);

    const files = [...this.localFiles()];
    files.splice(i, 1);

    this.localFiles.set(files);
    this.localPreviews.set(previews);
  }

  clearLocal() {
    this.revokePreviews();
    this.localFiles.set([]);
    this.localPreviews.set([]);
  }

  private revokePreviews() {
    this.localPreviews().forEach(u => {
      try { URL.revokeObjectURL(u); } catch {}
    });
  }

  uploadAll() {
    const id = this.selectedId();
    const files = this.localFiles();
    if (id == null || !files.length) return;

    const fd = new FormData();
    files.forEach(f => fd.append('files', f));

    this.uploading.set(true);
    this.photoError.set(null);

    this.http.post(this.api(`/api/admin/albums/${id}/photos`), fd).subscribe({
      next: () => {
        this.clearLocal();
        this.uploading.set(false);
        this.refreshPhotos();
        this.reload(); // refresh photo_count / cover in the list
      },
      error: (err) => {
        this.uploading.set(false);
        this.photoError.set(err?.error?.detail ?? 'Upload failed');
      }
    });
  }

  deletePhoto(ph: IAlbumPhoto) {
    if (!confirm('Delete this picture?')) return;

    const id = this.selectedId();
    if (id == null) return;

    this.deletingId.set(ph.id);
    this.photoError.set(null);

    this.http.delete(this.api(`/api/admin/albums/${id}/photos/${ph.id}`)).subscribe({
      next: () => {
        this.deletingId.set(null);
        this.photos.update(arr => arr.filter(x => x.id !== ph.id));
        this.reload();
      },
      error: (err) => {
        this.deletingId.set(null);
        this.photoError.set(err?.error?.detail ?? 'Delete failed');
      }
    });
  }
}
