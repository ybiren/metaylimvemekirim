import {
  Component, OnInit, OnDestroy, ViewChild, ElementRef,
  Input, inject,
  DestroyRef,
  Signal
} from '@angular/core';
import { NgIf, NgFor, DatePipe, NgClass, NgStyle, AsyncPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { ChatService, ChatMsg } from '../../services/chat.service';
import { PresenceService } from '../../services/presence.service';
import { UsersService } from '../../services/users.service';
import { getCurrentUserId } from '../../core/current-user';

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

  /** services via functional inject */
  private chat = inject(ChatService);
  private ref  = inject(DialogRef<unknown>);
  private presence = inject(PresenceService);
  private users    = inject(UsersService);

  /** dialog data (optional) — no decorators needed */
  private dlgData = inject(DIALOG_DATA, { optional: true }) as { peerId?: number, roomName?: string } | null;
  private destroyRef = inject(DestroyRef);

  /** expose typing stream to template */
  typing$ = this.chat.typing$;

  isPeerOnline = false;

  @ViewChild('scrollArea') scrollArea!: ElementRef<HTMLElement>;

  get peerName() { return this.users.getName(this.peerId!); }
  isLoggedIUserBlockedByPeer: Signal<{is_blocked:boolean}>;
 
  roomName = "";

  constructor() {
    // Resolve peerId from @Input or dialog data
    if (this.peerId == null) this.peerId = this.dlgData?.peerId;
    this.roomName =  this.dlgData?.roomName;
    this.isLoggedIUserBlockedByPeer = this.users.is_blockedByPeerSignal(this.me, this.peerId);
  
  }

  async ngOnInit() {
    
    if (this.peerId == null) {
      console.error('[ChatWindow] Missing peerId. Open dialog with { data: { peerId } } or bind [peerId].');
      this.close();
      return;
    }
    this.scrollToEnd();

    // mark active peer (used by service to mute beeps, etc.)
    this.chat.setActivePeer(this.peerId);

    // load chat history
    await this.chat.loadHistory(this.peerId);
    //mark as read
    await this.chat.markAsRead(this.peerId);

    // **IMPORTANT**: actually open the WebSocket
    this.chat.connect(this.peerId);
    console.log('[ChatWindow] connect() called with peerId =', this.peerId);
    // keep messages in sync + autoscroll
    this.chat.messages$.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(list => {
        this.messages = list;
        this.scrollToEnd();
      });

    // quick presence snapshot (adjust if you have an observable in PresenceService)
    this.isPeerOnline = this.presence.isOnline(this.peerId);
  }

  ngOnDestroy() {
    // clear active peer and close socket
    this.chat.setActivePeer(null);
    this.chat.disconnect();
  }

  trackById = (_: number, m: ChatMsg) => m.id;

  send() {
    const text = (this.draft || '').trim();
    if (!text) return;
    this.chat.send(text);
    this.draft = '';
    // scroll to end right after sending (in case server echoes with delay)
    this.scrollToEnd();
  }

  onTyping() {
    this.chat.sendTyping();
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
}
