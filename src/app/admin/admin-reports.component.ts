import { CommonModule } from '@angular/common';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Component, OnDestroy, OnInit, signal } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { AgGridAngular } from 'ag-grid-angular';
import { ColDef, GridReadyEvent, ValueFormatterParams } from 'ag-grid-community';
import { environment } from '../../environments/environment';

import { DateRangeSetFilter } from './date-range-filter/date-range-filter';
import { DateRangeFloatingFilterComponent } from './date-range-filter/date-range-floating-filter.component';
import { registerAgGridModules } from './ag-grid-setup';

type AdminReport = {
  id: number;
  user_id: number;
  user_name?: string | null;
  subject: string;
  content: string;
  created_at?: string | null;
};

@Component({
  selector: 'admin-reports',
  standalone: true,
  imports: [
    CommonModule,
    AgGridAngular,
    RouterModule,
    DateRangeFloatingFilterComponent,
  ],
  template: `
    <section class="admin admin--full" dir="rtl">
      <header class="hdr">
        <div>
          <h2>Admin - דיווחים על תוכן פוגעני</h2>
          <p>הדיווחים שנשלחו מהאתר, כפי שנשלחו גם במייל.</p>
        </div>

        <div class="actions">
          <input
            class="inp"
            placeholder="חיפוש בסוג הדיווח/תיאור"
            [value]="q()"
            (input)="onSearch($any($event.target).value)"
          />

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

      @if (selected(); as r) {
      <div class="viewer">
        <div class="viewer__hdr">
          <strong>{{ r.subject }}</strong>
          <button class="btn" (click)="selected.set(null)">סגור</button>
        </div>
        <pre class="viewer__body">{{ r.content }}</pre>
      </div>
      }
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

      .grid {
        width: 100%;
        height: calc(100vh - 320px);
        min-height: 320px;
        border-radius: 12px;
        overflow: hidden;
      }

      .viewer {
        margin-top: 12px;
        border: 1px solid #ddd;
        border-radius: 12px;
        background: #fff;
        overflow: hidden;
      }

      .viewer__hdr {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 12px;
        padding: 10px 14px;
        background: #f5f7fa;
        border-bottom: 1px solid #e6e6e6;
      }

      .viewer__body {
        margin: 0;
        padding: 14px;
        white-space: pre-wrap;
        word-break: break-word;
        font-family: inherit;
        font-size: 14px;
        line-height: 1.6;
        max-height: 40vh;
        overflow: auto;
      }
    `,
  ],
})
export class AdminReportsComponent implements OnInit, OnDestroy {
  private gridApi: any = null;

  q = signal('');
  pageSize = signal(50);
  rowData = signal<AdminReport[]>([]);

  // the full report body, shown under the grid when a row is opened
  selected = signal<AdminReport | null>(null);

  constructor(private http: HttpClient, private router: Router) {
    registerAgGridModules();
  }

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
      field: 'user_id',
      headerName: 'פרופיל מדווח',
      width: 150,
      minWidth: 150,
      filter: 'agNumberColumnFilter',
      cellRenderer: (params: any) => {
        const a = document.createElement('a');
        const name = params?.data?.user_name;
        a.textContent = name ? `${name} (#${params.value})` : `#${params.value}`;
        a.style.cursor = 'pointer';
        a.style.color = '#1976d2';
        a.style.textDecoration = 'underline';

        a.addEventListener('click', (ev) => {
          ev.stopPropagation();
          if (params.value != null) this.router.navigate(['/user', params.value]);
        });

        return a;
      },
    },
    { field: 'subject', headerName: 'סוג הדיווח', flex: 1.5, minWidth: 200 },
    {
      field: 'content',
      headerName: 'תיאור',
      flex: 3,
      minWidth: 260,
      // free text that may run over several lines: show them all rather than
      // flattening the description to its first line
      wrapText: true,
      autoHeight: true,
      cellStyle: { whiteSpace: 'pre-wrap', lineHeight: '1.5', padding: '8px 0' },
    },
    {
      field: 'created_at',
      headerName: 'נשלח בתאריך',
      flex: 1.2,
      valueFormatter: (p: ValueFormatterParams) => this.formatDate(p.value as any),

      filter: DateRangeSetFilter,
      floatingFilter: true,
      floatingFilterComponent: DateRangeFloatingFilterComponent,
    },
    {
      headerName: 'פעולות',
      field: 'actions',
      width: 200,
      minWidth: 200,
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

        const openBtn = document.createElement('button');
        openBtn.textContent = 'הצג';
        openBtn.className = 'btn';
        openBtn.addEventListener('click', (ev) => {
          ev.stopPropagation();
          this.selected.set(params.data as AdminReport);
        });

        const delBtn = document.createElement('button');
        delBtn.textContent = 'מחק';
        delBtn.className = 'btn btn--danger';
        delBtn.addEventListener('click', (ev) => {
          ev.stopPropagation();
          this.deleteReport(params.data as AdminReport);
        });

        wrap.appendChild(openBtn);
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

  load() {
    let params = new HttpParams()
      .set('page', '1')
      .set('page_size', String(this.pageSize()));

    const q = this.q().trim();
    if (q) params = params.set('q', q);

    this.http
      .get<{ items: AdminReport[] }>(this.api(`/api/admin/reports`), { params })
      .subscribe({
        next: (res) => {
          this.rowData.set(res.items ?? []);
          setTimeout(() => this.gridApi?.sizeColumnsToFit(), 0);
        },
        error: (err) => {
          console.error('admin reports load failed', err);
          this.rowData.set([]);
        },
      });
  }

  deleteReport(report: AdminReport) {
    if (!report?.id) return;

    const ok = confirm(`למחוק דיווח #${report.id} ?`);
    if (!ok) return;

    this.http.delete(this.api(`/api/admin/reports/${report.id}`)).subscribe({
      next: () => {
        if (this.selected()?.id === report.id) this.selected.set(null);
        this.load();
      },
      error: (err) => {
        console.error('delete report failed', err);
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
