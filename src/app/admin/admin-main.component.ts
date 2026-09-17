import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { AdminAuthService } from '../services/admin-auth.service';

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
      <a routerLink="/admin/albums" routerLinkActive="active">Admin Albums</a>
      <a routerLink="/admin/reports" routerLinkActive="active">Admin Reports</a>
      <a routerLink="/admin/rooms" routerLinkActive="active">Chat Rooms</a>

      <span class="admin-menu__who">
        @if (auth.adminName()) { {{ auth.adminName() }} }
      </span>
      <button type="button" class="admin-menu__out" (click)="logout()">יציאה</button>
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

    /* Pushes the name and the way out to the far end of the bar */
    .admin-menu__who {
      margin-inline-start: auto;
      font-size: 0.875rem;
      color: #475569;
      align-self: center;
    }

    .admin-menu__out {
      border: 1px solid #cbd5e1;
      border-radius: 0.5rem;
      background: #fff;
      padding: 0.25rem 0.75rem;
      font-size: 0.875rem;
      font-weight: 600;
      color: #0b79d0;
      cursor: pointer;
    }

    .admin-menu a.active {
      color: #00344e;
      border-bottom: 2px solid #0b79d0;
      padding-bottom: 2px;
    }
  `]
})
export class AdminMainComponent {
  auth = inject(AdminAuthService);
  private router = inject(Router);

  logout() {
    // Navigate whatever the server answers: the token is cleared locally
    // either way, so staying on these screens would only produce failures.
    this.auth.logout().subscribe({
      next: () => this.router.navigate(['/admin/login']),
      error: () => this.router.navigate(['/admin/login']),
    });
  }
}