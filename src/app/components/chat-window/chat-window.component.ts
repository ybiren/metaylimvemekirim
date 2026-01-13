import {
  Component,
  OnInit,
  OnDestroy,
  ViewChild,
  ElementRef,
  Input,
  inject,
  DestroyRef,
  computed,
  signal,
} from '@angular/core';
import { NgIf, NgFor, DatePipe, AsyncPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { firstValueFrom } from 'rxjs';
import { Router } from '@angular/router';

import { ChatService, ChatMsg } from '../../services/chat.service';
import { PresenceService } from '../../services/presence.service';
import { UsersService } from '../../services/users.service';
import { getCurrentUserId } from '../../core/current-user';
import { environment } from '../../../environments/environment';

type EmojiItem = { char: string; name: string; keywords: string[] };

@Component({
  standalone: true,
  selector: 'app-chat-window',
  imports: [NgIf, NgFor, DatePipe, FormsModule, AsyncPipe],
  templateUrl: './chat-window.component.html',
  styleUrls: ['./chat-window.component.scss'],
})
export class ChatWindowComponent implements OnInit, OnDestroy {
  /** allow using the component directly with [peerId] OR via dialog data */
  @Input() peerId?: number;

  // -------------------------
  // Basic state
  // -------------------------
  me = getCurrentUserId();
  draft = '';
  messages: ChatMsg[] = [];
  roomUsers: any[] = [];

  roomName = '';
  peerName= '';
  apiBase = environment.apibase;

  // resolved peerId to use safely in template
  peerIdResolved = -1;

  // menu / popups
  menuOpen = false;

  // Emoji
  emojiOpen = false;
  emojiQuery = '';
  readonly emojis: EmojiItem[] = [
    { char: '😀', name: 'חיוך', keywords: ['smile', 'happy', 'שמחה'] },
    { char: '😂', name: 'צחוק', keywords: ['lol', 'funny', 'מצחיק'] },
    { char: '😉', name: 'קריצה', keywords: ['wink', 'קריצה'] },
    { char: '😍', name: 'מאוהב', keywords: ['love', 'heart', 'אהבה'] },
    { char: '😘', name: 'נשיקה', keywords: ['kiss', 'נשיקה'] },
    { char: '😎', name: 'קול', keywords: ['cool', 'מגניב'] },
    { char: '🤔', name: 'חושב', keywords: ['think', 'חושב'] },
    { char: '🙄', name: 'גלגול עיניים', keywords: ['eyeroll', 'די'] },
    { char: '😢', name: 'בוכה', keywords: ['sad', 'cry', 'עצוב'] },
    { char: '😡', name: 'כועס', keywords: ['angry', 'כעס'] },
    { char: '👍', name: 'לייק', keywords: ['ok', 'yes', 'מעולה'] },
    { char: '🙏', name: 'תודה', keywords: ['thanks', 'please', 'תודה'] },
    { char: '👏', name: 'כל הכבוד', keywords: ['clap', 'bravo', 'כל הכבוד'] },
    { char: '🔥', name: 'אש', keywords: ['fire', 'חזק'] },
    { char: '🎉', name: 'חגיגה', keywords: ['party', 'חגיגה'] },
    { char: '❤️', name: 'לב', keywords: ['heart', 'אהבה'] },
  ];

  // -------------------------
  // Services
  // -------------------------
  private chatSvc = inject(ChatService);
  private ref = inject(DialogRef<unknown>);
  private presenceSvc = inject(PresenceService);
  private usersSvc = inject(UsersService);
  private router = inject(Router);
  private destroyRef = inject(DestroyRef);

  private dlgData = inject(DIALOG_DATA, { optional: true }) as
    | { peerId?: number; roomName?: string, peerName?: string }
    | null;

  // -------------------------
  // UI bindings
  // -------------------------
  typing$ = this.chatSvc.typing$;
  isPeerOnline = false;

  // you used this in template: @if (!isLoggedIUserBlockedByPeer())
  // so this must be a FUNCTION returning boolean
  isLoggedIUserBlockedByPeer = () => this.isBlocked();

  private isBlocked = signal<boolean>(false);

  @ViewChild('scrollArea') scrollArea!: ElementRef<HTMLElement>;
  @ViewChild('input') inputEl?: ElementRef<HTMLInputElement>;

  // -------------------------
  // Derived helpers
  // -------------------------
  
  imageUrl = computed(() => {
    const rand = Math.floor(Math.random() * 1_000_000);
    return (userId: number) => `${this.apiBase}/images/${userId}?id=${rand}`;
  });

  // -------------------------
  // Lifecycle
  // -------------------------
  constructor() {
    // Resolve peerId and room name from @Input or dialog data
    if (this.peerId == null) this.peerId = this.dlgData?.peerId;
    this.roomName = this.dlgData?.roomName ?? '';
    this.peerName = this.dlgData?.peerName ?? '';


    this.peerIdResolved = typeof this.peerId === 'number' ? this.peerId : -1;
  }

  async ngOnInit() {
    if (this.peerIdResolved === -1) {
      console.error('[ChatWindow] Missing peerId.');
      this.close();
      return;
    }

    // mark active peer (used by service to mute beeps, etc.)
    this.chatSvc.setActivePeer(this.peerIdResolved);

    // load chat history + mark as read
    await this.chatSvc.loadHistory(this.peerIdResolved);
    await this.chatSvc.markAsRead(this.peerIdResolved);

    // open websocket
    this.chatSvc.connect(this.peerIdResolved);

    // keep messages in sync + autoscroll
    this.chatSvc.messages$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((list) => {
        this.messages = list;
        setTimeout(() => this.scrollToEnd(), 300);
      });

    // room participants stream
    this.chatSvc.users$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((list) => {
        this.roomUsers = list;
      });

    // presence snapshot
    this.isPeerOnline = this.presenceSvc.isOnline(this.peerIdResolved);

    // blocked state
    const blocked = await firstValueFrom(
      this.usersSvc.is_blockedByPeerSignal(this.me, this.peerIdResolved)
    );
    this.isBlocked.set(!!blocked);

    // focus input when opening
    queueMicrotask(() => this.inputEl?.nativeElement?.focus());
  }

  ngOnDestroy() {
    this.chatSvc.setActivePeer(null);
    this.chatSvc.disconnect();
  }

  // -------------------------
  // TrackBy
  // -------------------------
  trackById = (_: number, m: ChatMsg) => m.id;
  trackByUserId = (_: number, u: { userId: number }) => u.userId;
  trackByEmoji = (_: number, e: EmojiItem) => e.char;

  // -------------------------
  // Menu / popup controls
  // -------------------------
  closePopups() {
    this.menuOpen = false;
    this.emojiOpen = false;
  }

  toggleMenu() {
    this.menuOpen = !this.menuOpen;
    if (this.menuOpen) this.emojiOpen = false;
  }

  openUserFromMenu(_u: { userId: number }) {
    this.menuOpen = false;
  }

  // -------------------------
  // Emoji panel
  // -------------------------
  toggleEmoji() {
    this.emojiOpen = !this.emojiOpen;
    if (this.emojiOpen) this.menuOpen = false;
    queueMicrotask(() => this.inputEl?.nativeElement?.focus());
  }

  closeEmoji() {
    this.emojiOpen = false;
    this.emojiQuery = '';
    queueMicrotask(() => this.inputEl?.nativeElement?.focus());
  }

  filteredEmojis(): EmojiItem[] {
    const q = (this.emojiQuery || '').trim().toLowerCase();
    if (!q) return this.emojis;

    return this.emojis.filter((e) => {
      if (e.name.toLowerCase().includes(q)) return true;
      return e.keywords.some((k) => k.toLowerCase().includes(q));
    });
  }

  pickEmoji(e: EmojiItem) {
    this.insertAtCursor(e.char);
    this.closeEmoji();
  }

  private insertAtCursor(text: string) {
    const el = this.inputEl?.nativeElement;
    if (!el) {
      this.draft = (this.draft || '') + text;
      return;
    }

    const value = this.draft || '';
    const start = el.selectionStart ?? value.length;
    const end = el.selectionEnd ?? value.length;

    this.draft = value.slice(0, start) + text + value.slice(end);

    queueMicrotask(() => {
      el.focus();
      const pos = start + text.length;
      el.setSelectionRange(pos, pos);
    });

    this.onTyping();
  }

  // -------------------------
  // Chat actions
  // -------------------------
  send() {
    const text = (this.draft || '').trim();
    if (!text) return;

    this.chatSvc.send(text);
    this.draft = '';
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

  // -------------------------
  // Navigation
  // -------------------------
  goToProfile(userId: number, ev: MouseEvent) {
    ev.preventDefault();
    ev.stopPropagation();

    this.menuOpen = false;
    this.close();

    setTimeout(() => {
      this.router.navigate(['/user', userId]);
    }, 0);
  }

  formatChatDate(isoDate: string): string {
    const d = new Date(isoDate);
    const today = new Date();

    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);

    const sameDay = (a: Date, b: Date) =>
      a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate();

    if (sameDay(d, today)) return 'היום';
    if (sameDay(d, yesterday)) return 'אתמול';

    return d.toLocaleDateString('he-IL', {
      weekday: 'short',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
   }

}
