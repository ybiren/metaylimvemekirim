import { Component, DestroyRef, OnInit, inject, input, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AlbumService } from '../../services/album.service';
import { getCurrentUserId } from '../../core/current-user';
import { IUser } from '../../interfaces';
import { UsersService } from '../../services/users.service';
import { ToastService } from '../../services/toast.service';
import { filter, firstValueFrom, take } from 'rxjs';
import { ChatService } from '../../services/chat.service';

type UiImage = {
  apiUrl: string;       // "/images/{id}/extra/..."
  absoluteUrl: string;  // full URL
  filename?: string;
};

@Component({
  selector: 'app-album',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './album.component.html',
  styleUrls: ['./album.component.scss'],
})
export class AlbumComponent implements OnInit {
  private albumSrv = inject(AlbumService);
  private destroyRef = inject(DestroyRef);
  private usersSvc = inject(UsersService);
  private toast = inject(ToastService);
  private chat = inject(ChatService);
     
  userId = input<number>(getCurrentUserId());
  
  loading = signal(false);
  errorMsg = signal('');
  images = signal<UiImage[]>([]);
  index = signal(0);
  loggedInUser = signal<IUser | null>(null);
  isLoggedIUserLikesPeer = signal<boolean>(null);
  
  count = computed(() => this.images().length);
  hasImages = computed(() => this.count() > 0);

  current = computed(() => {
    const list = this.images();
    if (!list.length) return null;
    const i = this.index();
    if (i < 0 || i >= list.length) return list[0];
    return list[i];
  });

  constructor() {
    this.loggedInUser.set(JSON.parse(localStorage.getItem('user')) as IUser)
  }
  
  async ngOnInit() {
    this.refresh();
    this.isLoggedIUserLikesPeer.set(await firstValueFrom(this.usersSvc.isLiked(this.loggedInUser().id, this.userId()))); 
  }

  refresh(): void {
    this.loading.set(true);
    this.errorMsg.set('');

    const id = Number(this.userId());
    if (!Number.isFinite(id) || id <= 0) {
      this.loading.set(false);
      this.errorMsg.set('UserId לא תקין');
      return;
    }

    this.albumSrv
      .listExtraImages(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          if (!res?.ok) {
            this.images.set([]);
            this.index.set(0);
            this.errorMsg.set('שגיאה בטעינת אלבום');
            this.loading.set(false);
            return;
          }

          const ui: UiImage[] = (res.urls ?? []).map((apiUrl) => ({
            apiUrl,
            absoluteUrl: this.albumSrv.toAbsolute(apiUrl),
            filename: this.extractFilename(apiUrl),
          }));

          this.images.set(ui);
          this.index.set(0);
          this.loading.set(false);
        },
        error: (err) => {
          console.error(err);
          this.images.set([]);
          this.index.set(0);
          this.errorMsg.set('שגיאה בטעינת אלבום (שרת/רשת)');
          this.loading.set(false);
        },
      });
  }

  next(): void {
    const n = this.count();
    if (n <= 1) return;
    this.index.set((this.index() + 1) % n);
  }

  prev(): void {
    const n = this.count();
    if (n <= 1) return;
    this.index.set((this.index() - 1 + n) % n);
  }

  goTo(i: number): void {
  const n = this.count();
  if (n === 0) return;
  if (i < 0 || i >= n) return;
  this.index.set(i);
}

  private extractFilename(apiUrl: string): string | undefined {
    if (!apiUrl) return undefined;
    const parts = apiUrl.split('/');
    return parts.length ? parts[parts.length - 1] : undefined;
  }

  toggleLike() {
    this.toast.show('הוספת like ✓');
    this.chat.setActivePeer(this.userId());
    this.chat.connect(this.userId());
    this.chat.statusChanged$
    .pipe(
      filter(stat => stat === WebSocket.OPEN),
      take(1),
      takeUntilDestroyed(this.destroyRef)
    )
    .subscribe(() => {
      this.chat.send(`קבלת לייק מ ${this.loggedInUser().name}`);
      this.chat.setActivePeer(null);
      this.chat.disconnect();
    });
  }

  
  
  private touchStartX = 0;
private touchStartY = 0;

onTouchStart(ev: TouchEvent) {
  const t = ev.changedTouches[0];
  this.touchStartX = t.clientX;
  this.touchStartY = t.clientY;
}

onTouchEnd(ev: TouchEvent) {
  const t = ev.changedTouches[0];
  const dx = t.clientX - this.touchStartX;
  const dy = t.clientY - this.touchStartY;

  // ignore mostly-vertical gestures (so page scroll works)
  if (Math.abs(dy) > Math.abs(dx)) return;

  const THRESHOLD = 40; // px
  if (Math.abs(dx) < THRESHOLD) return;

  // "mobile way": swipe left -> next, swipe right -> prev
  if (dx < 0) this.next();
  else this.prev();
}




}
