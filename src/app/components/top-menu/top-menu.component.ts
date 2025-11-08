import { Component, inject, OnInit, signal, Signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule, JsonPipe } from '@angular/common';
import { IUser } from '../../interfaces';
import { ChatService, ThreadRow } from '../../services/chat.service';
import { PresenceService } from '../../services/presence.service';
import { Dialog } from '@angular/cdk/dialog';
import { ChatWindowComponent } from '../chat-window/chat-window.component';

@Component({
  selector: 'app-top-menu',
  standalone: true,
  imports: [RouterLink, RouterLinkActive,JsonPipe, CommonModule],
  templateUrl: './top-menu.component.html',
  styleUrls: ['./top-menu.component.scss']
})
export class TopMenuComponent implements OnInit {
  loggedInUser?: IUser | null = null;
  
  open = false;
  threads: ThreadRow[] = [];
  unreadTotal = 0;

  constructor(private router: Router,
    private dialog: Dialog,
    public chat: ChatService,
    public presence: PresenceService) {
  
    this.chat.threads$.subscribe(t => this.threads = t);
    this.chat.unreadTotal$.subscribe(n => this.unreadTotal = n);

    // initial load + occasional refresh
    this.chat.refreshThreads();
    window.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') this.chat.refreshThreads();
    });
    setInterval(() => this.chat.refreshThreads(), 60000);
  }

  ngOnInit(): void {
    
    const storedUser = localStorage.getItem('user');
    this.loggedInUser = storedUser ? (JSON.parse(storedUser) as IUser) : null;
  }

  logout(): void {
    // 1) Clear local storage
    localStorage.clear();

    // 2) Redirect to default (home) page
    this.router.navigateByUrl('/');
  }

  randomInit(): {} {
    return {"init" : Math.floor(Math.random() * 1000000)}; 
  }
   
  toggleInbox() {
    this.open = !this.open;
    if (this.open) this.chat.refreshThreads();
  }

  openChat(peerId: number) {
    const isMobile = window.innerWidth < 600;
    this.dialog.open(ChatWindowComponent, {
      data: { peerId },
      panelClass: isMobile ? 'im-dialog-mobile' : 'im-dialog-desktop',
      ...(isMobile ? { width: '100vw', height: '100vh' } : { width: 'min(420px, 95vw)', height:'80vh' }),
    });
    this.open = false; // close dropdown
  }

  isOnline(peerId: number) {
    return this.presence.isOnline(peerId);
  }

  nameFor(peerId: number) {
    // TODO: replace with your real user lookup
    return `משתמש #${peerId}`;
  }

}
