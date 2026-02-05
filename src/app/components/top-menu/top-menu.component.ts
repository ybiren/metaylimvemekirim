import { Component, inject, OnInit, OnDestroy, computed } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Subscription, interval, fromEvent, firstValueFrom } from 'rxjs';
import { IUser } from '../../interfaces';
import { ChatService, ThreadRow } from '../../services/chat.service';
import { PresenceService } from '../../services/presence.service';
import { Dialog } from '@angular/cdk/dialog';
import { ChatWindowComponent } from '../chat-window/chat-window.component';
import { UsersService } from '../../services/users.service';
import { getCurrentUserId } from '../../core/current-user';
import { SendReminderComponent } from '../send-reminder/send-reminder.component';
import { environment } from '../../../environments/environment';
import { ShareUrlService } from '../../services/share-url.service';
import { LoginService } from '../../services/login.service';
import { FreezeProfileDialogComponent, FreezeProfileResult } from '../user-details/freeze-profile-dialog.component';


@Component({
  selector: 'app-top-menu',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, CommonModule],
  templateUrl: './top-menu.component.html',
  styleUrls: ['./top-menu.component.scss'],
})
export class TopMenuComponent implements OnInit, OnDestroy {
  loggedInUser?: IUser | null = null;

  open = false; // inbox panel
  threads: ThreadRow[] = [];
  unreadTotal = 0;

  // mobile nav state
  isMenuOpen = false;

  private usersSrv = inject(UsersService);
  private shareUrlService  = inject(ShareUrlService);

  private subs: Subscription[] = [];
  apiBase = environment.apibase;
  private loginService = inject(LoginService);
     

  constructor(
    private router: Router,
    private dialog: Dialog,
    public chat: ChatService,
    public presence: PresenceService
  ) {
    // Chat threads + unread counter
    this.subs.push(
      this.chat.threads$.subscribe((t) => (this.threads = t)),
      this.chat.unreadTotal$.subscribe((n) => (this.unreadTotal = n))
    );

    // Initial load + periodic refresh
    this.chat.refreshThreads();
    this.subs.push(
      fromEvent(document, 'visibilitychange').subscribe(() => {
        if (document.visibilityState === 'visible') {
          this.chat.refreshThreads();
        }
      }),
      interval(60_000).subscribe(() => this.chat.refreshThreads())
    );
  }

  ngOnInit(): void {
    this.usersSrv.users$.subscribe(() => {
      this.loggedInUser = localStorage.getItem('user') ?  JSON.parse(localStorage.getItem('user')) : null;
    }); 
  }

  ngOnDestroy(): void {
    this.subs.forEach((s) => s.unsubscribe());
    //this.usersSrv.users$.unsubscribe();
  }

  logout(): void {
    localStorage.clear();
    this.isMenuOpen = false;
    this.loginService.onLogout();
    this.router.navigateByUrl('/');
  }

  randomInit(): {} {
    return { init: Math.floor(Math.random() * 1_000_000) };
  }

  // Inbox button (chat)
  onInboxBtn(ev: MouseEvent | TouchEvent) {
    ev.stopPropagation();
    ev.preventDefault();
    this.open = !this.open;
    if (this.open) this.chat.refreshThreads();
  }

  openChat(peerId: number, lastPreview: string, peerName: string) {
    const isMobile = window.innerWidth < 600;
    if(lastPreview.includes("קבלת לייק מ")) {
      this.router.navigate([`/user/${peerId}`]);
    } else {
      this.dialog.open(ChatWindowComponent, {
        data: { peerId, peerName },
        panelClass: isMobile ? 'im-dialog--mobile' : 'im-dialog--desktop',
        ...(isMobile
          ? { width: '100vw', height: '100vh' }
          : { width: 'min(420px, 95vw)', height: '80vh' }),
      });
    } 
    this.open = false;
    this.isMenuOpen = false;
  }

  openReminder(cId: string, cName: string) {
    const isMobile = window.innerWidth < 600;

    this.dialog.open(SendReminderComponent, {
      data: { cId, cName },
      panelClass: isMobile ? 'im-dialog--mobile' : 'im-dialog--desktop',
      ...(isMobile
        ? { width: '100vw', height: '100vh' }
        : { width: 'min(420px, 95vw)', height: '80vh' }),
    });
  }

  isOnline(peerId: number) {
    return this.presence.isOnline(peerId);
  }

  
  // 🔽 Mobile menu helpers
  toggleMenu() {
    this.isMenuOpen = !this.isMenuOpen;
  }

  onNavLinkClick() {
    // close menu after navigation on mobile
    this.isMenuOpen = false;
  }

  imageUrl = computed(() => {
    const rand = Math.floor(Math.random() * 1_000_000);
    return (userID) => `${this.apiBase}/images/${userID}?id=${rand}`;
  });

  openShareDialog() {
    this.shareUrlService.openShareDialog("http://metaylimvemekirim.co.il","");
  }

  openFreezeProfileDialog() {
   this.dialog.open<FreezeProfileResult>(FreezeProfileDialogComponent)
   .closed.subscribe(async (result) => {
     if (result === 'yes') {
       const res:any= await firstValueFrom(this.usersSrv.freezeProfile());
       if(res?.ok) {
          this.logout();
       }
     }
   });
  }

}
