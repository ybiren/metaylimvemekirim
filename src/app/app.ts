import { Component, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { PwaInstallComponent } from './components/pwa-install/pwa-install.component';
import { LoginComponent } from './components/login/login.component';
import { TopMenuComponent } from './components/top-menu/top-menu.component';
import { NgxSpinnerModule } from 'ngx-spinner';
import { PresenceService } from './services/presence.service';
import { Subscription } from 'rxjs';
import { IUser } from './interfaces';
import { UsersService } from './services/users.service';

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
export class App implements OnInit, OnDestroy{
  
  private router = inject(Router);
  private presence = inject(PresenceService);
  private presenceSub?: Subscription;
  private usersSvc = inject(UsersService);

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
       this.presenceSub = this.presence.start(25_000, (<IUser>JSON.parse(storedUser)).userID); // match HEARTBEAT_SEC
       // Navigate immediately to /users
      this.router.navigateByUrl('/home');
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

  ngOnInit() {
    this.usersSvc.load();
  }

  ngOnDestroy() {
    this.presenceSub?.unsubscribe();
  }

}
