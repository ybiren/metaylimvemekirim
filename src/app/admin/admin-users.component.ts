import { CommonModule } from '@angular/common';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Component, OnDestroy, OnInit, signal } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { AgGridAngular } from 'ag-grid-angular';
import { ColDef, GridReadyEvent, ValueFormatterParams } from 'ag-grid-community';
import { environment } from '../../environments/environment';

import { DateRangeSetFilter } from './date-range-filter/date-range-filter';
import { DateRangeFloatingFilterComponent } from './date-range-filter/date-range-floating-filter.component';

type AdminUser = {
  id: number;
  username: string;
  email: string;
  display_name?: string | null;
  created_at?: string | null;
  last_seen_at?: string | null;
  status?: string | null;
};

@Component({
  selector: 'admin-users',
  standalone: true,
  imports: [
    CommonModule,
    AgGridAngular,
    RouterModule,
    DateRangeFloatingFilterComponent, // ✅ חשוב: להוסיף כאן
  ],
  template: `
    <section class="admin admin--full" dir="rtl">
      <header class="hdr">
        <div>
          <h2>Admin - Users</h2>
          <p>Search / filter users. (AG Grid)</p>
        </div>

        <div class="actions">
          <input
            class="inp"
            placeholder="חיפוש שם/מייל"
            [value]="q()"
            (input)="onSearch($any($event.target).value)"
          />

          <label class="chk">
            <input
              type="checkbox"
              [checked]="onlineOnly()"
              (change)="onOnlineOnly($any($event.target).checked)"
            />
            רק מחוברים
          </label>

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

      .chk {
        display: flex;
        align-items: center;
        gap: 6px;
        user-select: none;
        white-space: nowrap;
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

      .btn--primary {
        border-color: #bcd7ff;
        background: #eef5ff;
      }
      .btn--primary:hover {
        background: #ddeaff;
      }

      .grid {
        width: 100%;
        height: calc(100vh - 220px);
        border-radius: 12px;
        overflow: hidden;
      }

      
    `,
  ],
})
export class AdminUsersComponent implements OnInit, OnDestroy {
  private gridApi: any = null;

  q = signal('');
  onlineOnly = signal(false);

  pageSize = signal(50);
  rowData = signal<AdminUser[]>([]);

  constructor(private http: HttpClient, private router: Router) {}

  defaultColDef: ColDef = {
    sortable: true,
    filter: true,
    resizable: true,
    floatingFilter: true,
    minWidth: 120,
  };

  colDefs: ColDef[] = [
    {
      field: 'id',
      headerName: 'Id',
      width: 90,
      minWidth: 90,
      filter: 'agNumberColumnFilter',
    },
    {
      field: 'username',
      headerName: 'שם תצוגה',
      flex: 1,
      cellRenderer: (params: any) => {
        const a = document.createElement('a');
        a.textContent = params.value ?? '';
        a.style.cursor = 'pointer';
        a.style.color = '#1976d2';
        a.style.textDecoration = 'underline';

        a.addEventListener('click', (ev) => {
          ev.stopPropagation();
          const id = params?.data?.id;
          if (id != null) this.router.navigate(['/user', id]);
        });

        return a;
      },
    },
    { field: 'email', headerName: 'דוא"ל', flex: 2, minWidth: 220 },

    {
      field: 'last_seen_at',
      headerName: 'נראה לאחרונה',
      flex: 1.2,
      valueFormatter: (p: ValueFormatterParams) => this.formatDate(p.value as any),

      filter: DateRangeSetFilter,
      floatingFilter: true,
      floatingFilterComponent: DateRangeFloatingFilterComponent,
    },
    {
      field: 'created_at',
      headerName: 'נוצר בתאריך',
      flex: 1.2,
      valueFormatter: (p: ValueFormatterParams) => this.formatDate(p.value as any),

      filter: DateRangeSetFilter,
      floatingFilter: true,
      floatingFilterComponent: DateRangeFloatingFilterComponent,
    },

    { field: 'status', headerName: 'סטאטוס', flex: 1.2 },

    // ✅ Actions column (ערוך + מחק)
    {
      headerName: 'פעולות',
      field: 'actions',
      width: 220,
      minWidth: 220,
      sortable: false,
      filter: false,
      floatingFilter: false,
      resizable: false,
      cellRenderer: (params: any) => {
        const wrap = document.createElement('div');
        wrap.style.display = 'flex';
        wrap.style.alignItems = 'center';   // 🔥 ממרכז אנכית
        wrap.style.justifyContent = 'center';
        wrap.style.gap = '12px';            // 🔥 רווח בין כפתורים
        wrap.style.height = '100%';         // 🔥 חשוב מאוד!
        wrap.style.width = '100%';
        
        // ✏️ Edit
        const editBtn = document.createElement('button');
        editBtn.textContent = 'ערוך';
        editBtn.className = 'btn btn--primary';
        editBtn.addEventListener('click', (ev) => {
          ev.stopPropagation();
          const id = params?.data?.id;
          if (id != null) {
            this.router.navigate(['/register'], {
              queryParams: { admin_for_user: id },
            });
          }
        });

        // 🗑️ Delete
        const delBtn = document.createElement('button');
        delBtn.textContent = 'מחק';
        delBtn.className = 'btn btn--danger';
        delBtn.addEventListener('click', (ev) => {
          ev.stopPropagation();
          this.deleteUser(params.data as AdminUser);
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

  private onResize = () => {
    this.gridApi?.sizeColumnsToFit();
  };

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

  onOnlineOnly(v: boolean) {
    this.onlineOnly.set(!!v);
    this.load();
  }

  load() {
    let params = new HttpParams()
      .set('page', '1')
      .set('page_size', String(this.pageSize()));

    const q = this.q().trim();
    if (q) params = params.set('q', q);

    if (this.onlineOnly()) {
      params = params.set('online', 'true');
    }

    this.http
      .get<{ items: AdminUser[] }>(this.api(`/api/admin/users`), { params })
      .subscribe({
        next: (res) => {
          this.rowData.set(res.items ?? []);
          setTimeout(() => this.gridApi?.sizeColumnsToFit(), 0);
        },
        error: (err) => {
          console.error('admin users load failed', err);
          this.rowData.set([]);
        },
      });
  }

  deleteUser(user: AdminUser) {
    if (!user?.id) return;

    const ok = confirm(`למחוק משתמש #${user.id} (${user.username}) ?`);
    if (!ok) return;

    // ⚠️ עדכן את הנתיב אם אצלך הוא שונה
    this.http.delete(this.api(`/api/admin/users/${user.id}`)).subscribe({
      next: () => this.load(),
      error: (err) => {
        console.error('delete user failed', err);
        alert('מחיקה נכשלה');
      },
    });
  }

  private formatDate(value: string | null | undefined): string {
    if (!value) return '';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);

    return d.toLocaleString('he-IL', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
}