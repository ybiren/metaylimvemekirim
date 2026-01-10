import { CommonModule } from '@angular/common';
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { ChatService } from '../../services/chat.service';
import { Dialog } from '@angular/cdk/dialog';
import { ChatWindowComponent } from '../chat-window/chat-window.component';

export interface ChatRoom {
  id: number;
  room_id: string;
  from_user_id: number;
  to_user_id: number;
}

@Component({
  selector: 'app-chat-system-rooms',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './chat-system-rooms.component.html',
  styleUrls: ['./chat-system-rooms.component.scss'],
})
export class ChatSystemRoomsComponent {
  private readonly chatService = inject(ChatService);
  private readonly destroyRef = inject(DestroyRef);
  private dialog = inject(Dialog);

  rooms = signal<ChatRoom[]>([]);
  loading = signal<boolean>(true);
  error = signal<string | null>(null);

  ngOnInit(): void {
    this.loadRooms();
  }

  loadRooms(): void {
    this.loading.set(true);
    this.error.set(null);

    this.chatService
      .getChatRooms()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (rooms) => {
          // (Optional) ensure system rooms only, in case server returns more
          const systemRooms = (rooms || []).filter((r) => r.id < 0);
          this.rooms.set(systemRooms);
          this.loading.set(false);
        },
        error: (err) => {
          console.error('Failed to load chat rooms', err);
          this.error.set('לא הצלחתי לטעון חדרים. נסה שוב.');
          this.loading.set(false);
        },
      });
  }

  openChat(chatId: number, roomName: string) {
    const isMobile = window.innerWidth < 600;
    this.dialog.open(ChatWindowComponent, {
          data: { peerId: chatId , roomName },
          panelClass: isMobile ? 'im-dialog--mobile' : 'im-dialog--desktop',
          ...(isMobile
            ? { width: '100vw', height: '100vh' }
            : { width: 'min(420px, 95vw)', height: '80vh' }),
        });
 
  }
 
  reload(): void {
    this.loadRooms();
  }
 
  trackById = (_: number, r: ChatRoom) => r.id;
}
