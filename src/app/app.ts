import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { PwaInstallComponent } from './components/pwa-install/pwa-install.component';
import { LoginComponent } from './components/login/login.component';
import { TopMenuComponent } from './components/top-menu/top-menu.component';
import { NgxSpinnerModule } from 'ngx-spinner';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    NgxSpinnerModule,
    PwaInstallComponent,
    LoginComponent,
    TopMenuComponent
  ],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  private router = inject(Router);

  spinnerTplHtml = `
    <div class="lds-dual-ring"></div>
    <div class="loader-text">טוען…</div>
  `;

  // reactive state
  isHome = signal(false);

  constructor() {
    // 🚀 1) Check if user already logged in
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      // Navigate immediately to /users
      this.router.navigateByUrl('/users');
    }

    // 2) Set initial value of isHome
    this.setIsHome(this.router.url);

    // 3) Update isHome signal on navigation
    this.router.events
      .pipe(filter(e => e instanceof NavigationEnd))
      .subscribe((e: NavigationEnd) => this.setIsHome(e.urlAfterRedirects));
  }

  private setIsHome(url: string) {
    this.isHome.set(url === '/' || url === '');
  }
}
