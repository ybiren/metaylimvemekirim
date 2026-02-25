import { CommonModule } from '@angular/common';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Component, OnDestroy, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AgGridAngular } from 'ag-grid-angular';
import { ColDef, GridReadyEvent } from 'ag-grid-community';
import { environment } from '../../environments/environment';

type BannerPage = 'main' | 'about' | 'contact';

type AdminBanner = {
  id: number;
  page: BannerPage;
  title?: string | null;
  link_url: string;
  image_url: string; // served by backend: /api/admin/banners/{id}/image
  is_active?: boolean | null;
  sort_order?: number | null;
  created_at?: string | null;
  updated_at?: string | null;
};

@Component({
  selector: 'admin-banners',
  standalone: true,
  imports: [CommonModule, FormsModule, AgGridAngular],
  template: `
    <section class="admin admin--full" dir="rtl">
      <header class="hdr">
        <div>
          <h2>Admin - Banners</h2>
          <p>Manage banners (CRUD + image upload on Save).</p>
        </div>

        <div class="actions">
          <input
            class="inp"
            placeholder="חיפוש לפי כותרת / לינק"
            [value]="q()"
            (input)="onSearch($any($event.target).value)"
          />

          <select class="sel" [ngModel]="pageKey()" (ngModelChange)="onPageKey($event)">
            <option value="">כל הדפים</option>
            <option value="main">Main</option>
            <option value="about">About</option>
            <option value="contact">Contact</option>
          </select>

          <button class="btn" (click)="addNew()">+ חדש</button>
          <button class="btn" (click)="load()">רענן</button>
        </div>
      </header>

      <ag-grid-angular
        class="ag-theme-quartz grid"
        [rowData]="rowData()"
        [columnDefs]="colDefs"
        [defaultColDef]="defaultColDef"
        [pagination]="true"
        [paginationPageSize]="pageSize()"
        (gridReady)="onGridReady($event)"
      >
      </ag-grid-angular>

      <!-- Editor drawer -->
      <div class="drawer" *ngIf="editing() as b">
        <div class="drawer__panel">
          <div class="drawer__hdr">
            <div>
              <div class="drawer__title">
                {{ b.id ? ('עריכת באנר #' + b.id) : 'באנר חדש' }}
              </div>
              <div class="drawer__sub">שמירה אחת (כולל תמונה) באמצעות Save</div>
            </div>
            <button class="iconbtn" (click)="closeEditor()" [disabled]="saving()">✕</button>
          </div>

          <div class="form">
            <label class="lbl">Page</label>
            <select class="inp2" [(ngModel)]="b.page">
              <option value="main">Main</option>
              <option value="about">About</option>
              <option value="contact">Contact</option>
            </select>

            <label class="lbl">כותרת (אופציונלי)</label>
            <input class="inp2" [(ngModel)]="b.title" />

            <label class="lbl">Link URL</label>
            <input class="inp2" [(ngModel)]="b.link_url" placeholder="https://..." />
            <div class="err" *ngIf="b.link_url && !isValidHttpUrl(b.link_url)">
              לינק חייב להתחיל ב־http:// או https:// ולהיות תקין
            </div>

            <label class="lbl">Image</label>

            <div class="fileRow">
              <label class="btn btn--ghost fileBtn" [class.btn--disabled]="saving()">
                בחר תמונה
                <input type="file" accept="image/*" (change)="onFileSelected($event)" [disabled]="saving()" hidden />
              </label>

              <span class="fileName" *ngIf="selectedFile() as f">{{ f.name }}</span>
              <span class="fileName" *ngIf="!selectedFile()">לא נבחר קובץ</span>
            </div>

            <div class="err" *ngIf="fileError()">{{ fileError() }}</div>

            <div class="hint" *ngIf="isCreate(b) && !selectedFile()">
              לבאנר חדש חובה לבחור תמונה
            </div>

            <div class="row">
              <label class="chk2">
                <input type="checkbox" [(ngModel)]="b.is_active" />
                פעיל
              </label>

              <div class="grow"></div>

              <label class="lbl2">סדר</label>
              <input class="inp3" type="number" [(ngModel)]="b.sort_order" />
            </div>

            <div class="preview" *ngIf="previewUrl() || b.image_url">
              <div class="preview__lbl">תצוגה מקדימה</div>

              <img *ngIf="previewUrl(); else existingImg" [src]="previewUrl()" alt="banner preview" />
              <ng-template #existingImg>
                <img [src]="api(b.image_url)" alt="banner preview" (error)="onImgError($event)" />
              </ng-template>
            </div>

            <div class="drawer__actions">
              <button class="btn" (click)="saveEditing()" [disabled]="saving() || !canSave()">
                {{ saving() ? 'שומר...' : 'שמור' }}
              </button>

              <button
                class="btn btn--danger"
                *ngIf="b.id"
                (click)="deleteBanner(b)"
                [disabled]="saving()"
              >
                מחק
              </button>

              <div class="grow"></div>

              <button class="btn btn--ghost" (click)="closeEditor()" [disabled]="saving()">סגור</button>
            </div>
          </div>
        </div>
      </div>
    </section>
  `,
  styles: [
    `
      .admin--full {
        width: 95vw;
        margin-left: calc(50% - 50vw);
        margin-right: calc(50% - 50vw);
      }
      .admin {
        padding: 16px 24px;
      }

      .hdr {
        display: flex;
        justify-content: space-between;
        align-items: flex-end;
        gap: 12px;
        margin-bottom: 12px;
        flex-wrap: wrap;
      }
      .hdr h2 {
        margin: 0;
      }
      .hdr p {
        margin: 4px 0 0;
        opacity: 0.7;
      }

      .actions {
        display: flex;
        align-items: center;
        gap: 12px;
        flex-wrap: wrap;
      }

      .inp {
        min-width: 260px;
        padding: 8px 10px;
        border: 1px solid #ddd;
        border-radius: 10px;
        outline: none;
      }

      .sel {
        padding: 8px 10px;
        border: 1px solid #ddd;
        border-radius: 10px;
        outline: none;
        background: #fff;
      }

      .btn {
        padding: 8px 12px;
        border-radius: 10px;
        border: 1px solid #ddd;
        background: #fff;
        cursor: pointer;
      }
      .btn:hover {
        background: #f5f5f5;
      }

      .btn--danger {
        border-color: #f1b0b7;
        background: #fff5f5;
      }
      .btn--danger:hover {
        background: #ffe8ea;
      }

      .btn--ghost {
        background: #fff;
        opacity: 0.95;
      }

      .btn--disabled {
        opacity: 0.6;
        pointer-events: none;
      }

      .grid {
        width: 100%;
        height: calc(100vh - 220px);
        border-radius: 12px;
        overflow: hidden;
      }

      /* Drawer */
      .drawer {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.35);
        display: flex;
        justify-content: flex-end;
        z-index: 9999;
      }
      .drawer__panel {
        width: min(540px, 95vw);
        height: 100%;
        background: #fff;
        box-shadow: -10px 0 25px rgba(0, 0, 0, 0.2);
        padding: 16px;
        overflow: auto;
      }
      .drawer__hdr {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 12px;
        margin-bottom: 14px;
      }
      .drawer__title {
        font-weight: 800;
        font-size: 18px;
      }
      .drawer__sub {
        opacity: 0.7;
        margin-top: 4px;
      }
      .iconbtn {
        border: 1px solid #ddd;
        background: #fff;
        border-radius: 10px;
        width: 36px;
        height: 36px;
        cursor: pointer;
      }
      .iconbtn:hover {
        background: #f5f5f5;
      }

      .form {
        display: grid;
        gap: 10px;
      }
      .lbl {
        font-weight: 700;
        margin-top: 8px;
      }
      .lbl2 {
        font-weight: 700;
        margin-inline-start: 10px;
      }
      .inp2 {
        padding: 10px 12px;
        border: 1px solid #ddd;
        border-radius: 12px;
        outline: none;
        width: 100%;
        background: #fff;
      }
      .inp3 {
        width: 110px;
        padding: 10px 12px;
        border: 1px solid #ddd;
        border-radius: 12px;
        outline: none;
      }

      .row {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-top: 6px;
      }
      .chk2 {
        display: flex;
        align-items: center;
        gap: 8px;
        user-select: none;
      }
      .grow {
        flex: 1;
      }

      .fileRow {
        display: flex;
        align-items: center;
        gap: 10px;
        flex-wrap: wrap;
      }
      .fileBtn {
        white-space: nowrap;
      }
      .fileName {
        opacity: 0.85;
        font-size: 13px;
      }

      .hint {
        opacity: 0.75;
        font-size: 13px;
        margin-top: -2px;
      }

      .err {
        color: #c62828;
        font-size: 13px;
        margin-top: -4px;
      }

      .preview {
        margin-top: 8px;
        padding: 12px;
        border: 1px solid #eee;
        border-radius: 14px;
      }
      .preview__lbl {
        font-weight: 800;
        margin-bottom: 8px;
      }
      .preview img {
        width: 100%;
        height: auto;
        border-radius: 12px;
        border: 1px solid #eee;
        display: block;
      }

      .drawer__actions {
        margin-top: 14px;
        display: flex;
        align-items: center;
        gap: 10px;
      }
    `,
  ],
})
export class AdminBannersComponent implements OnInit, OnDestroy {
  private gridApi: any = null;

  q = signal('');
  pageKey = signal<string>('');

  pageSize = signal(50);
  rowData = signal<AdminBanner[]>([]);

  editing = signal<AdminBanner | null>(null);
  saving = signal(false);

  // file state (upload on save)
  selectedFile = signal<File | null>(null);
  fileError = signal<string>('');
  previewUrl = signal<string>('');

  constructor(private http: HttpClient) {
  
  }

  
  
  defaultColDef: ColDef = {
    sortable: true,
    filter: true,
    resizable: true,
    floatingFilter: true,
    minWidth: 120,
  };

  colDefs: ColDef[] = [
    { field: 'id', headerName: 'Id', width: 90, minWidth: 90, filter: 'agNumberColumnFilter' },
    { field: 'page', headerName: 'Page', width: 120, minWidth: 120 },
    { field: 'title', headerName: 'כותרת', flex: 1, minWidth: 160 },
    {
      field: 'link_url',
      headerName: 'קישור',
      flex: 1.6,
      minWidth: 260,
      cellRenderer: (p: any) => {
        const url = p.value ?? '';
        const a = document.createElement('a');
        a.href = url;
        a.target = '_blank';
        a.rel = 'noopener';
        a.textContent = url ? 'פתח קישור' : '';
        a.style.color = '#1976d2';
        a.style.textDecoration = 'underline';
        return a;
      },
    },
    {
      field: 'image_url',
      headerName: 'תמונה',
      flex: 1.4,
      minWidth: 220,
      cellRenderer: (p: any) => {
        const wrap = document.createElement('div');
        wrap.style.display = 'flex';
        wrap.style.alignItems = 'center';
        wrap.style.gap = '10px';

        const img = document.createElement('img');
        img.src = this.api(p.value) ?? '';
        img.alt = 'banner';
        img.style.width = '120px';
        img.style.height = '44px';
        img.style.objectFit = 'cover';
        img.style.borderRadius = '10px';
        img.style.border = '1px solid #eee';
        img.onerror = () => {
          img.src = '';
          img.style.border = '1px dashed #f1b0b7';
        };

        const txt = document.createElement('span');
        txt.textContent = p.value ? 'תצוגה' : '';
        txt.style.opacity = '0.75';

        wrap.appendChild(img);
        wrap.appendChild(txt);
        return wrap;
      },
    },
    {
      field: 'is_active',
      headerName: 'פעיל',
      width: 110,
      minWidth: 110,
      filter: 'agSetColumnFilter',
      cellRenderer: (p: any) => (p.value ? 'כן' : 'לא'),
    },
    {
      field: 'sort_order',
      headerName: 'סדר',
      width: 110,
      minWidth: 110,
      filter: 'agNumberColumnFilter',
    },
    {
      headerName: 'פעולות',
      field: 'actions',
      width: 190,
      minWidth: 190,
      sortable: false,
      filter: false,
      floatingFilter: false,
      resizable: false,
      cellRenderer: (params: any) => {
        const wrap = document.createElement('div');
        wrap.style.display = 'flex';
        wrap.style.alignItems = 'center';
        wrap.style.justifyContent = 'center';
        wrap.style.gap = '12px';
        wrap.style.height = '100%';
        wrap.style.width = '100%';

        const editBtn = document.createElement('button');
        editBtn.textContent = 'ערוך';
        editBtn.className = 'btn';
        editBtn.addEventListener('click', (ev) => {
          ev.stopPropagation();
          this.openEditor(params.data as AdminBanner);
        });

        const delBtn = document.createElement('button');
        delBtn.textContent = 'מחק';
        delBtn.className = 'btn btn--danger';
        delBtn.addEventListener('click', (ev) => {
          ev.stopPropagation();
          this.deleteBanner(params.data as AdminBanner);
        });

        wrap.appendChild(editBtn);
        wrap.appendChild(delBtn);
        return wrap;
      },
    },
  ];

  ngOnInit(): void {
    this.load();
  }

  onGridReady(e: GridReadyEvent): void {
    this.gridApi = e.api;
    setTimeout(() => this.gridApi?.sizeColumnsToFit(), 0);
    window.addEventListener('resize', this.onResize);
  }

  private onResize = () => this.gridApi?.sizeColumnsToFit();

  ngOnDestroy(): void {
    window.removeEventListener('resize', this.onResize);
    this.cleanupPreviewUrl();
  }

  api(path: string) {
    return `${environment.apibase}${path}`;
  }

  onSearch(v: string) {
    this.q.set(v ?? '');
    this.load();
  }

  onPageKey(v: string) {
    this.pageKey.set(v ?? '');
    this.load();
  }

  load() {
    let params = new HttpParams().set('page', '1').set('page_size', String(this.pageSize()));

    const q = this.q().trim();
    if (q) params = params.set('q', q);

    const pk = (this.pageKey() || '').trim();
    if (pk) params = params.set('page_key', pk);

    this.http.get<{ items: AdminBanner[] }>(this.api(`/api/admin/banners`), { params }).subscribe({
      next: (res) => {
        this.rowData.set(res.items ?? []);
        setTimeout(() => this.gridApi?.sizeColumnsToFit(), 0);
      },
      error: (err) => {
        console.error('admin banners load failed', err);
        this.rowData.set([]);
      },
    });
  }

  // ===== Editor =====

  addNew() {
    this.resetFileState();
    this.editing.set({
      id: 0,
      page: 'main',
      title: '',
      link_url: '',
      image_url: '',
      is_active: true,
      sort_order: 0,
    });
  }

  openEditor(b: AdminBanner) {
    this.resetFileState();
    this.editing.set({ ...b });
  }

  closeEditor() {
    this.editing.set(null);
    this.resetFileState();
  }

  isCreate(b: AdminBanner) {
    return !b.id || b.id === 0;
  }

  // ===== Validators (client-side) =====

  isValidHttpUrl(url: string | null | undefined): boolean {
    const v = (url ?? '').trim();
    if (!v) return false;
    if (!(v.startsWith('http://') || v.startsWith('https://'))) return false;
    try {
      const u = new URL(v);
      return !!u.hostname;
    } catch {
      return false;
    }
  }

  validateFile(file: File | null): string {
    if (!file) return 'חובה לבחור תמונה';
    if (!file.type?.startsWith('image/')) return 'רק קבצי תמונה מותרים (image/*)';

    const maxMb = 5;
    if (file.size === 0) return 'הקובץ ריק';
    if (file.size > maxMb * 1024 * 1024) return `הקובץ גדול מדי (מקסימום ${maxMb}MB)`;

    return '';
  }

  canSave(): boolean {
    const b = this.editing();
    if (!b) return false;
    if (!this.isValidHttpUrl(b.link_url)) return false;
    if (this.fileError()) return false;

    const isCreate = !b.id || b.id === 0;
    if (isCreate && !this.selectedFile()) return false;

    return true;
  }

  // ===== File selection =====

  onFileSelected(ev: Event) {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;

    const err = this.validateFile(file);
    this.fileError.set(err);

    if (err || !file) {
      this.selectedFile.set(null);
      this.cleanupPreviewUrl();
      input.value = '';
      return;
    }

    this.selectedFile.set(file);
    this.cleanupPreviewUrl();
    this.previewUrl.set(URL.createObjectURL(file));
    input.value = '';
  }

  private cleanupPreviewUrl() {
    const url = this.previewUrl();
    if (url) {
      try {
        URL.revokeObjectURL(url);
      } catch {}
    }
    this.previewUrl.set('');
  }

  private resetFileState() {
    this.selectedFile.set(null);
    this.fileError.set('');
    this.cleanupPreviewUrl();
  }

  // ===== Save (multipart on save) =====

  saveEditing() {
    const b = this.editing();
    if (!b) return;

    if (!this.canSave()) {
      return alert('יש לתקן שדות לפני שמירה (לינק תקין + תמונה בבאנר חדש).');
    }

    this.saving.set(true);

    const fd = new FormData();
    fd.append('page', (b.page ?? 'main') as string);
    fd.append('title', b.title ?? '');
    fd.append('link_url', (b.link_url ?? '').trim());
    fd.append('is_active', String(!!b.is_active));
    fd.append('sort_order', String(b.sort_order ?? 0));

    const file = this.selectedFile();
    if (file) fd.append('file', file);

    const req$ =
      b.id && b.id !== 0
        ? this.http.put<AdminBanner>(this.api(`/api/admin/banners/${b.id}`), fd)
        : this.http.post<AdminBanner>(this.api(`/api/admin/banners`), fd);

    req$.subscribe({
      next: () => {
        this.saving.set(false);
        this.editing.set(null);
        this.resetFileState();
        this.load();
      },
      error: (err) => {
        this.saving.set(false);
        console.error('save banner failed', err);
        alert(err?.error?.detail || 'שמירה נכשלה');
      },
    });
  }

  // ===== Delete =====

  deleteBanner(b: AdminBanner) {
    if (!b?.id) return;

    const ok = confirm(`למחוק באנר #${b.id}?`);
    if (!ok) return;

    this.saving.set(true);
    this.http.delete(this.api(`/api/admin/banners/${b.id}`)).subscribe({
      next: () => {
        this.saving.set(false);
        if (this.editing()?.id === b.id) this.closeEditor();
        this.load();
      },
      error: (err) => {
        this.saving.set(false);
        console.error('delete banner failed', err);
        alert('מחיקה נכשלה');
      },
    });
  }

  onImgError(ev: any) {
    try {
      ev.target.style.border = '1px dashed #f1b0b7';
    } catch {}
  }
}