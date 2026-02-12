import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, inject, signal, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { QuillModule } from 'ngx-quill';
import type Quill from 'quill';
import { environment } from '../../environments/environment';

type PageDto = { path: string; title: string };
type PageContentDto = { path: string; title: string; html: string };

@Component({
  selector: 'admin-pages',
  standalone: true,
  imports: [CommonModule, FormsModule, QuillModule],
  template: `
    <section class="admin admin--full" dir="rtl">
      <header class="hdr">
        <div>
          <h2>Admin - Pages</h2>
          <p>Edit HTML pages shown on the site.</p>
        </div>
        <div class="actions">
          <button (click)="save()" [disabled]="loading()">Save</button>
        </div>
      </header>

      <div class="layout">
        <aside class="card left">
          <h3>Pages</h3>
          <button class="item"
                  *ngFor="let p of pages()"
                  (click)="open(p.path)"
                  [class.active]="p.path === currentPath()">
            {{ p.title }}
            <small>{{ p.path }}</small>
          </button>
        </aside>

        <main class="card right" *ngIf="currentPath(); else pick">
          <div class="top">
            <strong>{{ currentTitle() }}</strong>
            <span class="muted">{{ currentPath() }}</span>
          </div>

          <quill-editor
            class="qwrap"
            [(ngModel)]="html"
            [modules]="modules"
            [placeholder]="'כתוב כאן…'"
            (onEditorCreated)="onEditorCreated($event)">
          </quill-editor>
        </main>

        <ng-template #pick>
          <main class="card right muted">Pick a page to edit.</main>
        </ng-template>
      </div>
    </section>
  `,
  styles: [`
    .admin--full{ width:95vw; margin-left:calc(50% - 50vw); margin-right:calc(50% - 50vw); }
    .admin{ padding:16px 24px; }
    .hdr{ display:flex; justify-content:space-between; align-items:flex-end; gap:12px; }
    .layout{ display:grid; grid-template-columns: 320px 1fr; gap:16px; margin-top:12px; }
    .card{ background:#fff; border:1px solid #ddd; border-radius:12px; padding:12px; }
    .left .item{ width:100%; text-align:right; padding:10px; margin:6px 0; border-radius:10px; border:1px solid #eee; background:#fafafa; cursor:pointer; }
    .left .item.active{ border-color:#c7e6ff; background:#eaf6ff; }
    .left small{ display:block; opacity:.7; }
    .top{ display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; }
    .muted{ opacity:.7; }

    /* Quill sizing + RTL */
    :host ::ng-deep .qwrap .ql-container{
      min-height: 520px;
    }
    :host ::ng-deep .qwrap .ql-editor{
      direction: rtl;
      text-align: right;
      min-height: 520px;
      font-size: 16px;
      line-height: 1.6;
    }
    :host ::ng-deep .qwrap .ql-toolbar{
      direction: rtl;
      text-align: right;
    }

    @media (max-width: 900px){ .layout{ grid-template-columns: 1fr; } }
  `]
})
export class AdminPagesComponent {
  private http = inject(HttpClient);

  pages = signal<PageDto[]>([]);
  loading = signal(false);

  currentPath = signal<string | null>(null);
  currentTitle = signal<string>('');
  html = '';

  private quill: Quill | null = null;

  // Quill toolbar: headings, bold/italic/underline, alignment, lists, link, colors, image, undo/redo
  modules: any = {
    toolbar: [
      [{ header: [1, 2, 3, false] }],
      ['bold', 'italic', 'underline'],
      [{ align: [] }],
      [{ color: [] }, { background: [] }],
      [{ list: 'ordered' }, { list: 'bullet' }],
      ['link', 'image'],
      ['clean']
    ]
  };

  ngOnInit() {
    this.loadList();
  }

  private api(path: string) {
    return `${environment.apibase}${path}`;
  }

  loadList() {
    this.http.get<PageDto[]>(this.api('/api/admin/pages')).subscribe(res => {
      this.pages.set(res ?? []);
      if (!this.currentPath() && res?.length) this.open(res[0].path);
    });
  }

  open(path: string) {
    this.loading.set(true);
    const url = this.api(`/api/admin/pages/one?path=${encodeURIComponent(path)}`);

    this.http.get<PageContentDto>(url).subscribe({
      next: (p) => {
        this.currentPath.set(p.path);
        this.currentTitle.set(p.title);
        this.html = p.html ?? '';
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  onEditorCreated(editor: Quill) {
    this.quill = editor;

    // ensure RTL on root (helps in some cases)
    const root = editor.root as HTMLElement;
    root.setAttribute('dir', 'rtl');
    root.style.textAlign = 'right';
  }

  save() {
    const path = this.currentPath();
    if (!path) return;

    this.loading.set(true);
    const url = this.api(`/api/admin/pages`);

    this.http.put(url, { path, title: this.currentTitle(), html: this.html }).subscribe({
      next: () => this.loading.set(false),
      error: () => this.loading.set(false),
    });
  }
}
