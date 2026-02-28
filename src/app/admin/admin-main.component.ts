import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-admin-main',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <nav class="admin-menu">
      <a routerLink="/admin/dashboard" routerLinkActive="active">Admin Updates</a>
      <a routerLink="/admin/pages" routerLinkActive="active">Admin Pages</a>
      <a routerLink="/admin/users" routerLinkActive="active">Admin Users</a>
      <a routerLink="/admin/banners" routerLinkActive="active">Admin Banners</a>
    </nav>

    <router-outlet></router-outlet>
  `,
  styles: [`
    .admin-menu {
      display: flex;
      gap: 1rem;
      padding: 1rem;
      background: #f5f7fa;
      border-radius: 12px;
      margin-bottom: 1rem;
    }

    .admin-menu a {
      text-decoration: none;
      font-weight: 600;
      color: #0b79d0;
    }

    .admin-menu a:hover {
      text-decoration: underline;
    }

    .admin-menu a.active {
      color: #00344e;
      border-bottom: 2px solid #0b79d0;
      padding-bottom: 2px;
    }
  `]
})
export class AdminMainComponent {}