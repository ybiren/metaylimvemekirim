import { Component, Input, Inject, OnInit, OnDestroy, ViewChild, ElementRef, inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DialogRef, DIALOG_DATA } from '@angular/cdk/dialog';
import { ChatService, ChatMsg } from '../../services/chat.service';
import { IUser } from '../../interfaces';
import { UsersService } from '../../services/users.service';

@Component({
  selector: 'app-chat-window',
  standalone: true,
  imports: [CommonModule, FormsModule],
  providers: [DatePipe],
  templateUrl: './chat-window.component.html',
  styleUrls: ['./chat-window.component.scss']
})
export class ChatWindowComponent implements OnInit, OnDestroy {
  /** The other participant’s userID (injected by parent or dialog data) */
  @Input() peerId!: number;

  /** Scroll container */
  @ViewChild('scroller') scroller!: ElementRef<HTMLDivElement>;

  me = Number(<IUser>JSON.parse(localStorage.getItem("user")).userID || 0);
  text = '';
  msgs: ChatMsg[] = [];
  typing = false;

  private messagesSub?: any;
  private typingSub?: any;
  data = inject(DIALOG_DATA);
  private usersSvc = inject(UsersService)
    
  constructor(
    private chat: ChatService,
    private date: DatePipe,
    public dialogRef: DialogRef<ChatWindowComponent>,
  ) {
    if (this.data?.peerId != null) {
      this.peerId = Number(this.data.peerId);
    }
  }

  async ngOnInit() {
    if (!this.peerId) throw new Error('ChatWindowComponent requires peerId');

    // 1) Load history (server returns DESC; service reverses to ASC for scrolling)
    await this.chat.loadHistory(this.peerId);

    // 2) Open WS to this DM room
    this.chat.connect(this.peerId);

    // 3) Subscribe to live updates
    this.messagesSub = this.chat.messages$.subscribe(list => {
      this.msgs = list;
      // scroll to bottom on new messages
      queueMicrotask(() => this.scrollToBottom());

      // mark as read: last message from peer
      const lastFromPeer = [...list].reverse().find(m => m.fromUserId === this.peerId);
      if (lastFromPeer) {
        this.chat.markReadUpTo(lastFromPeer.sentAt);
      }
    });

    this.typingSub = this.chat.typing$.subscribe(v => (this.typing = v));
  }

  ngOnDestroy() {
    try {
      // Optional: if you want to close the socket when modal closes,
      // add a `disconnect()` method to ChatService and call it here.
      // this.chat.disconnect();
    } catch {}
    this.messagesSub?.unsubscribe?.();
    this.typingSub?.unsubscribe?.();
  }

  close() {
    this.dialogRef.close();
  }

  send() {
    const content = this.text.trim();
    if (!content) return;
    this.chat.send(content);
    this.text = '';
    // keep input focused UX: handled by browser; no need to refocus explicitly
  }

  onTyping() {
    this.chat.sendTyping();
  }

  ticks(m: ChatMsg): 'single' | 'double' | 'double-blue' {
    if (m.readAt) return 'double-blue';   // ✓✓ blue
    if (m.deliveredAt) return 'double';   // ✓✓
    return 'single';                      // ✓
  }

  trackById(_i: number, m: ChatMsg) { return m.id; }

  timeStr(iso: string) {
    return this.date.transform(iso, 'shortTime');
  }

  private scrollToBottom() {
    if (!this.scroller) return;
    const el = this.scroller.nativeElement;
    el.scrollTop = el.scrollHeight;
  }

  get peerName() {
    return this.usersSvc.getName(this.peerId);
  }

}
