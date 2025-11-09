import { Component, inject, OnInit } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';
import { IUser } from '../../interfaces';
import { ChatService, ThreadRow } from '../../services/chat.service';
import { PresenceService } from '../../services/presence.service';
import { Dialog } from '@angular/cdk/dialog';
import { ChatWindowComponent } from '../chat-window/chat-window.component';
import { UsersService } from '../../services/users.service';

@Component({
  selector: 'app-top-menu',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, CommonModule],
  templateUrl: './top-menu.component.html',
  styleUrls: ['./top-menu.component.scss']
})
export class TopMenuComponent implements OnInit {
  loggedInUser?: IUser | null = null;

  open = false;
  threads: ThreadRow[] = [];
  unreadTotal = 0;

  private removeOutside?: () => void;
  private users    = inject(UsersService);

  constructor(
    private router: Router,
    private dialog: Dialog,
    public chat: ChatService,
    public presence: PresenceService
  ) {
    this.chat.threads$.subscribe(t => (this.threads = t));
    this.chat.unreadTotal$.subscribe(n => (this.unreadTotal = n));

    // initial load + occasional refresh
    this.chat.refreshThreads();
    window.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') this.chat.refreshThreads();
    });
    setInterval(() => this.chat.refreshThreads(), 60_000);
  }

  ngOnInit(): void {
    const storedUser = localStorage.getItem('user');
    this.loggedInUser = storedUser ? (JSON.parse(storedUser) as IUser) : null;

    // close when clicking anywhere outside
    const outside = (ev: Event) => {
      if (!this.open) return;
      // if the click bubbled from inside panel/button we already stopped it
      this.open = false;
    };
    document.addEventListener('click', outside, true);
    this.removeOutside = () => document.removeEventListener('click', outside, true);
  }

  ngOnDestroy(): void {
    this.removeOutside?.();
  }

  logout(): void {
    localStorage.clear();
    this.router.navigateByUrl('/');
  }

  randomInit(): {} {
    return { init: Math.floor(Math.random() * 1_000_000) };
  }

  onInboxBtn(ev: MouseEvent | TouchEvent) {
    ev.stopPropagation();
    ev.preventDefault();
    this.open = !this.open;
    if (this.open) this.chat.refreshThreads();
  }

  openChat(peerId: number) {
    const isMobile = window.innerWidth < 600;
    this.dialog.open(ChatWindowComponent, {
      data: { peerId },
      panelClass: isMobile ? 'im-dialog-mobile' : 'im-dialog-desktop',
      ...(isMobile
        ? { width: '100vw', height: '100vh' }
        : { width: 'min(420px, 95vw)', height: '80vh' })
    });
    this.open = false;
  }

  isOnline(peerId: number) {
    return this.presence.isOnline(peerId);
  }

  nameFor(peerId: number) {
    // TODO: swap with real user lookup when ready
    return this.users.getName(peerId);
  }
}
