import {
  Component,
  OnInit,
  OnDestroy,
  inject,
  signal,
  input,
  effect,
  computed,
  DestroyRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClientModule } from '@angular/common/http';
import { RouterModule } from '@angular/router';
import { IUser } from '../../interfaces';
import { environment } from '../../../environments/environment';
import { PresenceService } from '../../services/presence.service';
import { getCurrentUserId } from '../../core/current-user';
import { UsersService } from '../../services/users.service';
import { DeviceDetectorService } from 'ngx-device-detector';
import { ToastService } from '../../services/toast.service';
import { ChatService } from '../../services/chat.service';
import { filter, take, takeWhile } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';


@Component({
  selector: 'app-users',
  standalone: true,
  imports: [CommonModule, HttpClientModule, RouterModule],
  templateUrl: './users.component.html',
  styleUrls: ['./users.component.scss'],
})
export class UsersComponent implements OnInit, OnDestroy {
  // -------- inputs & state --------
  inputUsers = input<IUser[] | undefined>(undefined);
  users = signal<IUser[]>([]);
  loading = signal(false);

  // index of currently shown user in mobile/tablet mode
  currentIndex = signal(0);

  // swipe animation direction (used in template)
  swipeDirection = signal<'left' | 'right' | null>(null);
  private swipeTimeoutId: any;

  // track viewport width so DevTools responsive also behaves like mobile
  private screenWidth = signal(window.innerWidth);

  // -------- services & env --------
  private presence = inject(PresenceService);
  private usersSvc = inject(UsersService);
  private device = inject(DeviceDetectorService);
  private toast = inject(ToastService);
  private chat = inject(ChatService);
  private destroyRef = inject(DestroyRef);
    
  apiBase = environment.apibase;
  private me = getCurrentUserId();
  loggedInUser = signal<IUser | null>(null);
  


  private resizeHandler = () => {
    this.screenWidth.set(window.innerWidth);
  };

  constructor() {
    this.loggedInUser.set(JSON.parse(localStorage.getItem('user')) as IUser)
    window.addEventListener('resize', this.resizeHandler);
  }

  ngOnDestroy(): void {
    window.removeEventListener('resize', this.resizeHandler);
    if (this.swipeTimeoutId) {
      clearTimeout(this.swipeTimeoutId);
    }
  }

  // mobile / tablet layout? (real device OR narrow viewport)
  isMobileOrTablet = computed(() => {
    const deviceMobile = this.device.isMobile();
    const deviceTablet = this.device.isTablet();
    const narrowViewport = this.screenWidth() < 900;
    return deviceMobile || deviceTablet || narrowViewport;
  });

  // keep currentIndex in range when users list changes
  private usersIndexGuardEffect = effect(() => {
    const list = this.users();
    const len = list.length;
    if (!len) {
      this.currentIndex.set(0);
      return;
    }
    const idx = this.currentIndex();
    if (idx < 0 || idx >= len) {
      this.currentIndex.set(0);
    }
  });

  ngOnInit(): void {
    if (!this.inputUsers()) {
      // main users page: subscribe to service
      this.usersSvc.getAllUsers().subscribe((users) => this.users.set(users));
    } else {
      // embedded mode: exclude myself
      this.users.set(this.inputUsers()!.filter((u) => u.id !== this.me));
    }
  }

  // -------- derived values --------

  // single user for mobile/tablet view
  currentUser = computed(() => {
    const list = this.users();
    const idx = this.currentIndex();
    if (!list.length) return null;
    if (idx < 0 || idx >= list.length) return list[0];
    return list[idx];
  });

  imageUrl = computed(() => {
    const rand = Math.floor(Math.random() * 1_000_000);
    return (u: IUser) => `${this.apiBase}/images/${u.id}?id=${rand}`;
  });

  isOnline = computed(() => {
    return (userId: number) => this.presence.isOnline(userId);
  });

  isLiked = computed(() => {
    return (userId: number) => this.loggedInUser().like?.includes(userId);
  });


  // -------- utils / actions --------

  trackByUserId(index: number, u: IUser): number {
    return u.id;
  }

  toggleLike(u: IUser) {
    const userId = this.loggedInUser().id;
    this.usersSvc.like(userId, u.id).subscribe({
      next: (res: any) => {
         this.toast.show('הוספת like ✓');
         localStorage.setItem('user', JSON.stringify({...this.loggedInUser(),"like": [...res.like_list]}));
         this.loggedInUser.set(JSON.parse(localStorage.getItem('user')) as IUser);
         if(this.loggedInUser().like?.includes(u.id)) {
           this.chat.setActivePeer(u.id);
           this.chat.connect(u.id);
           this.chat.statusChanged$
          .pipe(
            filter(stat => stat === WebSocket.OPEN),
            take(1),
            takeUntilDestroyed(this.destroyRef)
          )
          .subscribe(() => {
            this.chat.send(`קבלת לייק מ ${this.loggedInUser().c_name}`);
            this.chat.setActivePeer(null);
            this.chat.disconnect();
          });
         }
      },
      error: () => alert("אירעה שגיאה")
    });
  }

  // -------- swipe logic --------

  private startX = 0;
  private startY = 0;

  onTouchStart(ev: TouchEvent) {
    if (!this.isMobileOrTablet()) return;
    const t = ev.touches[0];
    this.startX = t.clientX;
    this.startY = t.clientY;
  }

  onTouchMove(ev: TouchEvent) {
    if (!this.isMobileOrTablet()) return;
    // prevent scroll while swiping
    ev.preventDefault();
  }

  onTouchEnd(ev: TouchEvent) {
    if (!this.isMobileOrTablet()) return;
    const t = ev.changedTouches[0];
    const dx = t.clientX - this.startX;
    const dy = t.clientY - this.startY;

    const minDist = 30;
    if (Math.abs(dx) < minDist || Math.abs(dx) <= Math.abs(dy)) {
      return;
    }

    if (dx < 0) {
      this.nextUser();
    } else {
      this.prevUser();
    }
  }

  private startSwipeAnimation(dir: 'left' | 'right') {
    this.swipeDirection.set(dir);

    if (this.swipeTimeoutId) {
      clearTimeout(this.swipeTimeoutId);
    }
    this.swipeTimeoutId = setTimeout(() => {
      this.swipeDirection.set(null);
    }, 250); // same as CSS animation duration
  }

  private nextUser() {
    const list = this.users();
    const len = list.length;
    if (!len) return;
    const idx = this.currentIndex();
    this.currentIndex.set((idx + 1) % len);
    this.startSwipeAnimation('left');
  }

  private prevUser() {
    const list = this.users();
    const len = list.length;
    if (!len) return;
    const idx = this.currentIndex();
    this.currentIndex.set((idx - 1 + len) % len);
    this.startSwipeAnimation('right');
  }
}
