import {
  Component, OnInit, OnDestroy, ViewChild, ElementRef,
  Input, inject,
  DestroyRef,
  Signal,
  computed
} from '@angular/core';
import { NgIf, NgFor, DatePipe, NgClass, NgStyle, AsyncPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { ChatService, ChatMsg } from '../../services/chat.service';
import { PresenceService } from '../../services/presence.service';
import { UsersService } from '../../services/users.service';
import { getCurrentUserId } from '../../core/current-user';
import { environment } from '../../../environments/environment';
import { Router } from '@angular/router';

@Component({
  standalone: true,
  selector: 'app-chat-window',
  imports: [NgIf, NgFor, DatePipe, FormsModule, NgClass, NgStyle, AsyncPipe],
  templateUrl: './chat-window.component.html',
  styleUrls: ['./chat-window.component.scss']
})
export class ChatWindowComponent implements OnInit, OnDestroy {
  /** allow using the component directly with [peerId] OR via dialog data */
  @Input() peerId?: number;

  me = getCurrentUserId();
  draft = '';
  messages: ChatMsg[] = [];
  roomUsers: any[] = [];

  /** services via functional inject */
  private chatSvc = inject(ChatService);
  private ref  = inject(DialogRef<unknown>);
  private presenceSvc = inject(PresenceService);
  private usersSvc    = inject(UsersService);
  private router = inject(Router);

  /** dialog data (optional) — no decorators needed */
  private dlgData = inject(DIALOG_DATA, { optional: true }) as { peerId?: number, roomName?: string } | null;
  private destroyRef = inject(DestroyRef);

  /** expose typing stream to template */
  typing$ = this.chatSvc.typing$;

  isPeerOnline = false;

  @ViewChild('scrollArea') scrollArea!: ElementRef<HTMLElement>;

  get peerName() { return this.usersSvc.getName(this.peerId!); }
  isLoggedIUserBlockedByPeer: Signal<{is_blocked:boolean}>;
 
  roomName = "";

  menuOpen = false;
  apiBase = environment.apibase;
    

  constructor() {
    // Resolve peerId from @Input or dialog data
    if (this.peerId == null) this.peerId = this.dlgData?.peerId;
    this.roomName =  this.dlgData?.roomName;
    this.isLoggedIUserBlockedByPeer = this.usersSvc.is_blockedByPeerSignal(this.me, this.peerId);
  
  }

  async ngOnInit() {
    
    if (this.peerId == null) {
      console.error('[ChatWindow] Missing peerId. Open dialog with { data: { peerId } } or bind [peerId].');
      this.close();
      return;
    }
    this.scrollToEnd();

    // mark active peer (used by service to mute beeps, etc.)
    this.chatSvc.setActivePeer(this.peerId);

    // load chat history
    await this.chatSvc.loadHistory(this.peerId);
    //mark as read
    await this.chatSvc.markAsRead(this.peerId);

    // **IMPORTANT**: actually open the WebSocket
    this.chatSvc.connect(this.peerId);
    console.log('[ChatWindow] connect() called with peerId =', this.peerId);
    // keep messages in sync + autoscroll
    this.chatSvc.messages$.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(list => {
        this.messages = list;
        this.scrollToEnd();
      });

    this.chatSvc.users$
  .pipe(takeUntilDestroyed(this.destroyRef))
  .subscribe(list => {
    this.roomUsers = list;
  });

    // quick presence snapshot (adjust if you have an observable in PresenceService)
    this.isPeerOnline = this.presenceSvc.isOnline(this.peerId);
  }


  ngOnDestroy() {
    // clear active peer and close socket
    this.chatSvc.setActivePeer(null);
    this.chatSvc.disconnect();
  }

  trackById = (_: number, m: ChatMsg) => m.id;

  
  send() {
    const text = (this.draft || '').trim();
    if (!text) return;
    this.chatSvc.send(text);
    this.draft = '';
    // scroll to end right after sending (in case server echoes with delay)
    this.scrollToEnd();
  }

  onTyping() {
    this.chatSvc.sendTyping();
  }

  close() {
    this.ref.close();
  }

  private scrollToEnd() {
    queueMicrotask(() => {
      const el = this.scrollArea?.nativeElement;
      if (!el) return;
      el.scrollTop = el.scrollHeight;
    });
  }

  trackByUserId = (_: number, u: { userId: number }) => u.userId;

  toggleMenu() {
    this.menuOpen = !this.menuOpen;
  }

  openUserFromMenu(u: { userId: number }) {
    // decide what click does (optional)
    this.menuOpen = false;
  }

  imageUrl = computed(() => {
    const rand = Math.floor(Math.random() * 1_000_000);
    return (userId) => `${this.apiBase}/images/${userId}?id=${rand}`;
  });

  goToProfile(userId: number, ev: MouseEvent) {
    ev.preventDefault();
    ev.stopPropagation();

    // 1️⃣ close the chat dialog
    this.menuOpen = false;
    this.close(); // <-- your existing close() method

    // 2️⃣ navigate AFTER close (next tick)
    setTimeout(() => {
      this.router.navigate(['/user', userId]);
    }, 0);
}

}
