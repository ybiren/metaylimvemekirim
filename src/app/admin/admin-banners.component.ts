import { CommonModule } from '@angular/common';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Component, OnDestroy, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AgGridAngular } from 'ag-grid-angular';
import { ColDef, GridReadyEvent } from 'ag-grid-community';
import { environment } from '../../environments/environment';

type AdminBanner = {
  id: number;
  title?: string | null;
  link_url: string;
  image_url: string;
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
          <p>Manage homepage banners (CRUD).</p>
        </div>

        <div class="actions">
          <input
            class="inp"
            placeholder="חיפוש לפי כותרת / לינק"
            [value]="q()"
            (input)="onSearch($any($event.target).value)"
          />

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
        (cellValueChanged)="onCellValueChanged($event)"
      >
      </ag-grid-angular>

      <!-- Simple editor drawer -->
      <div class="drawer" *ngIf="editing() as b">
        <div class="drawer__panel">
          <div class="drawer__hdr">
            <div>
              <div class="drawer__title">{{ b.id ? ('עריכת באנר #' + b.id) : 'באנר חדש' }}</div>
              <div class="drawer__sub">עריכה ידנית של שדות + שמירה</div>
            </div>
            <button class="iconbtn" (click)="closeEditor()">✕</button>
          </div>

          <div class="form">
            <label class="lbl">כותרת (אופציונלי)</label>
            <input class="inp2" [(ngModel)]="b.title" />

            <label class="lbl">Link URL</label>
            <input class="inp2" [(ngModel)]="b.link_url" placeholder="https://..." />

            <label class="lbl">Image URL</label>
            <input class="inp2" [(ngModel)]="b.image_url" placeholder="https://.../banner.jpg" />

            <div class="row">
              <label class="chk2">
                <input type="checkbox" [(ngModel)]="b.is_active" />
                פעיל
              </label>

              <div class="grow"></div>

              <label class="lbl2">סדר</label>
              <input class="inp3" type="number" [(ngModel)]="b.sort_order" />
            </div>

            <div class="preview" *ngIf="b.image_url">
              <div class="preview__lbl">תצוגה מקדימה</div>
              <img [src]="b.image_url" alt="banner preview" (error)="onImgError($event)" />
            </div>

            <div class="drawer__actions">
              <button class="btn" (click)="saveEditing()" [disabled]="saving()">
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

              <button class="btn btn--ghost" (click)="closeEditor()">סגור</button>
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
        opacity: 0.9;
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
        width: min(520px, 95vw);
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
  pageSize = signal(50);
  rowData = signal<AdminBanner[]>([]);

  editing = signal<AdminBanner | null>(null);
  saving = signal(false);

  constructor(private http: HttpClient) {}

  defaultColDef: ColDef = {
    sortable: true,
    filter: true,
    resizable: true,
    floatingFilter: true,
    minWidth: 120,
  };

  colDefs: ColDef[] = [
    { field: 'id', headerName: 'Id', width: 90, minWidth: 90, filter: 'agNumberColumnFilter' },
    { field: 'title', headerName: 'כותרת', flex: 1, minWidth: 160, editable: true },
    {
      field: 'link_url',
      headerName: 'קישור',
      flex: 1.6,
      minWidth: 260,
      editable: true,
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
      editable: true,
      cellRenderer: (p: any) => {
        const wrap = document.createElement('div');
        wrap.style.display = 'flex';
        wrap.style.alignItems = 'center';
        wrap.style.gap = '10px';

        const img = document.createElement('img');
        img.src = p.value ?? '';
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
      editable: true,
      cellRenderer: (p: any) => (p.value ? 'כן' : 'לא'),
      valueParser: (p: any) => {
        // checkbox/typing safety
        const v = p.newValue;
        if (typeof v === 'boolean') return v;
        if (typeof v === 'string') return v.toLowerCase() === 'true' || v === '1' || v === 'כן';
        return !!v;
      },
    },
    {
      field: 'sort_order',
      headerName: 'סדר',
      width: 110,
      minWidth: 110,
      filter: 'agNumberColumnFilter',
      editable: true,
      valueParser: (p: any) => {
        const n = Number(p.newValue);
        return Number.isFinite(n) ? n : null;
      },
    },
    {
      headerName: 'פעולות',
      field: 'actions',
      width: 170,
      minWidth: 170,
      sortable: false,
      filter: false,
      floatingFilter: false,
      resizable: false,
      cellRenderer: (params: any) => {
        const wrap = document.createElement('div');
        wrap.style.display = 'flex';
        wrap.style.gap = '8px';

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
  }

  private api(path: string) {
    return `${environment.apibase}${path}`;
  }

  onSearch(v: string) {
    this.q.set(v ?? '');
    this.load();
  }

  load() {
    let params = new HttpParams()
      .set('page', '1')
      .set('page_size', String(this.pageSize()));

    const q = this.q().trim();
    if (q) params = params.set('q', q);

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

  // ===== CRUD =====

  addNew() {
    // editor creates via POST
    this.editing.set({
      id: 0,
      title: '',
      link_url: '',
      image_url: '',
      is_active: true,
      sort_order: 0,
    });
  }

  openEditor(b: AdminBanner) {
    // clone so you can cancel safely
    this.editing.set({ ...b });
  }

  closeEditor() {
    this.editing.set(null);
  }

  async saveEditing() {
    const b = this.editing();
    if (!b) return;

    const link = (b.link_url ?? '').trim();
    const img = (b.image_url ?? '').trim();

    if (!link) return alert('חובה למלא Link URL');
    if (!img) return alert('חובה למלא Image URL');

    this.saving.set(true);

    const payload = {
      title: b.title ?? '',
      link_url: link,
      image_url: img,
      is_active: !!b.is_active,
      sort_order: b.sort_order ?? 0,
    };

    // id=0 means create
    const req$ =
      b.id && b.id !== 0
        ? this.http.put<AdminBanner>(this.api(`/api/admin/banners/${b.id}`), payload)
        : this.http.post<AdminBanner>(this.api(`/api/admin/banners`), payload);

    req$.subscribe({
      next: () => {
        this.saving.set(false);
        this.editing.set(null);
        this.load();
      },
      error: (err) => {
        this.saving.set(false);
        console.error('save banner failed', err);
        alert('שמירה נכשלה');
      },
    });
  }

  deleteBanner(b: AdminBanner) {
    if (!b?.id) return;

    const ok = confirm(`למחוק באנר #${b.id}?`);
    if (!ok) return;

    this.saving.set(true);
    this.http.delete(this.api(`/api/admin/banners/${b.id}`)).subscribe({
      next: () => {
        this.saving.set(false);
        if (this.editing()?.id === b.id) this.editing.set(null);
        this.load();
      },
      error: (err) => {
        this.saving.set(false);
        console.error('delete banner failed', err);
        alert('מחיקה נכשלה');
      },
    });
  }

  // inline edit in grid -> auto save row (update only)
  onCellValueChanged(e: any) {
    const row = e?.data as AdminBanner | undefined;
    if (!row?.id) return;

    // you can debounce if you want; for now: save immediately
    const payload = {
      title: row.title ?? '',
      link_url: (row.link_url ?? '').trim(),
      image_url: (row.image_url ?? '').trim(),
      is_active: !!row.is_active,
      sort_order: row.sort_order ?? 0,
    };

    // basic validation
    if (!payload.link_url || !payload.image_url) return;

    this.http.put(this.api(`/api/admin/banners/${row.id}`), payload).subscribe({
      next: () => {},
      error: (err) => console.error('inline update banner failed', err),
    });
  }

  onImgError(ev: any) {
    // optional: handle preview error in drawer
    try {
      ev.target.style.border = '1px dashed #f1b0b7';
    } catch {}
  }
}