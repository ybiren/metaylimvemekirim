import { Component, effect, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule, NavigationEnd, ActivatedRoute } from '@angular/router';
import { filter } from 'rxjs/operators';
import { PwaInstallComponent } from './components/pwa-install/pwa-install.component';
import { PwaUpdateComponent } from './components/pwa-install/pwa-update.component';

import { LoginComponent } from './components/login/login.component';
import { TopMenuComponent } from './components/top-menu/top-menu.component';
import { NgxSpinnerModule } from 'ngx-spinner';
import { PresenceService } from './services/presence.service';
import { Subscription } from 'rxjs';
import { UsersService } from './services/users.service';
import { getCurrentUserId } from './core/current-user';
import { LoginService } from './services/login.service';
import { ToastService } from './services/toast.service';


@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    NgxSpinnerModule,
    PwaInstallComponent,
    PwaUpdateComponent,
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
  private loginService = inject(LoginService);
  private toast = inject(ToastService);

  spinnerTplHtml = `
    <div class="lds-dual-ring"></div>
    <div class="loader-text">טוען…</div>
  `;

  // reactive state
  isHome = signal(false);
  isAdminPage = signal(false);
  userID = signal(null);

  constructor() {
    // 🚀 1) Check if user already logged in
    this.userID.set(getCurrentUserId());
      this.loginService.onLogin$.subscribe((isLoggedin) => {
      this.userID.set(isLoggedin || getCurrentUserId() ? getCurrentUserId() : null) ;
    }); 

    const params = new URLSearchParams(window.location.search);
    if (this.userID() && !params.get("shareprofile")) {
      this.presenceSub = this.presence.start(25_000, this.userID()); // match HEARTBEAT_SEC
       // Navigate immediately to /users
      this.router.navigateByUrl('/home');
    } else {
      if(params.get("reset-password-uid")) {
        const uid = params.get("reset-password-uid");
        this.router.navigateByUrl(`/reset-password?uid=${uid}`);
      }
      
      if(params.get("email-verified-uid")) {
        const uid = params.get("email-verified-uid");
        this.usersSvc.setEmailVerified(uid).subscribe((res:any) => {
          if(res?.ok) {
            this.toast.show("אימות הדואל הצליח...יש לבצע הזדהות מחדש") 
            this.router.navigateByUrl('/login');
          }
          
        });      
      }
    


    }

    // 2) Set initial value of isHome
    this.setIsHome(this.router.url);
    this.setIsAdminPage(this.router.url);

    // 3) Update isHome signal on navigation
    this.router.events
      .pipe(filter(e => e instanceof NavigationEnd))
      .subscribe((e: NavigationEnd) =>  {
        this.setIsHome(e.urlAfterRedirects);
        this.setIsAdminPage(e.urlAfterRedirects);
      } 
    );
      
  }

  private setIsHome(url: string) {
    this.isHome.set(url === '/' || url === '');
  }

  private setIsAdminPage(url: string) {
    this.isAdminPage.set(url.indexOf("/admin") !== -1);
  }
    
  ngOnInit() {
    this.usersSvc.load();
  }

  ngOnDestroy() {
    this.presenceSub?.unsubscribe();
  }

}
