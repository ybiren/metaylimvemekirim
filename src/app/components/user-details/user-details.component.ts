// src/app/components/user-details/user-details.component.ts
import { Component, DestroyRef, OnInit, Signal, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { FAMILY_STATUS_TOKEN } from '../../consts/family-status.consts';
import { GENDER_TOKEN } from '../../consts/gender.consts';
import { REGIONS_TOKEN } from '../../consts/regions.consts';
import { IOption, IUser } from '../../interfaces';
import { UsersService } from '../../services/users.service';
import { Dialog, DialogModule } from '@angular/cdk/dialog';
import { ToastService } from '../../services/toast.service';
import { ChatWindowComponent } from '../chat-window/chat-window.component';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { AlbumComponent } from '../album/album.component';
import { firstValueFrom, of } from 'rxjs';
import { ShareProfileDialogComponent, ShareChannel } from './share-profile-dialog.component';


@Component({
  selector: 'app-user-details',
  standalone: true,
  imports: [CommonModule, RouterModule, HttpClientModule, DialogModule, AlbumComponent],
  templateUrl: './user-details.component.html',
  styleUrls: ['./user-details.component.scss'],
})
export class UserDetailsComponent implements OnInit {
  private route = inject(ActivatedRoute);
  regions:ReadonlyArray<IOption> = inject(REGIONS_TOKEN);
  gender:ReadonlyArray<IOption> = inject(GENDER_TOKEN);  
  familyStatus:ReadonlyArray<IOption> = inject(FAMILY_STATUS_TOKEN);
  usersSrv = inject(UsersService);
  dialog = inject(Dialog);
  toast = inject(ToastService);
  private destroyRef = inject(DestroyRef);

  apiBase = environment.apibase;

  loading = signal<boolean>(false);
  error = signal<string>('');
  user = signal<IUser | null>(null);
  loggedInUser = signal<IUser | null>(null);
  isLoggedIUserBlockedByPeer = signal<boolean>(null);
  isLoggedIUserBlocksPeer = signal<boolean>(null);
  isShowProfile = signal<boolean>(true);
  id = 0;
  liked = false;

  constructor() {

    this.loggedInUser.set(JSON.parse(localStorage.getItem('user')) as IUser)
    const idParam = this.route.snapshot.paramMap.get('userID') || this.route.snapshot.paramMap.get('id');
    this.id = Number(idParam);
    if (!this.id) {
      this.error.set('Invalid user id');
      return;
    }
    this.fetchUser(this.id);
  }
  
  async ngOnInit() {
    if(this.loggedInUser()) {
      this.isLoggedIUserBlockedByPeer.set(await firstValueFrom(this.usersSrv.is_blockedByPeerSignal(this.id, this.loggedInUser().id)));
      this.isLoggedIUserBlocksPeer.set(await firstValueFrom(this.usersSrv.is_blockedByPeerSignal(this.loggedInUser().id, this.id )));   
    }
  }


isLiked(): boolean {
  return this.liked;
}

toggleLike(): void {
  this.liked = !this.liked;

  // TODO later:
  // call API to persist like
}
  
  
  fetchUser(id: number) {
    this.loading.set(true);
    this.error.set('');
    

    this.usersSrv
      .getUser(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (user) => {
          this.user.set(user);
          this.loading.set(false);
        },
        error: (err) => {
          console.error('Failed to load user', err);
          this.error.set('לא הצלחתי לטעון משתמש. נסה שוב.');
          this.loading.set(false);
        },
      });


    /*
    // Using existing GET /users and filtering client-side
    this.usersSrv.users$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((users) => {
      const found = (users || []).find(u => u.userID === id) || JSON.parse(localStorage.getItem('user'));
      this.user.set(found);
      this.loading.set(false);
    });
    */
    



    /*this.http.get<{ ok: boolean; users: IUser[] }>(`${this.apiBase}/users`).subscribe({
      next: (res) => {
        const found = (res.users || []).find(u => u.userID === id) || null;
        if (!found) this.error.set('User not found');
        this.user.set(found);
        this.loading.set(false);
      },
      error: (err) => {
        console.error(err);
        this.error.set('Failed to load user');
        this.loading.set(false);
      }
    });*/

    // If you add GET /users/{id} on the server, you can replace the above with:
    // this.http.get<User>(`${this.apiBase}/users/${id}`).subscribe({...});
  }

  
  imageUrl = computed(() => {
    const rand = Math.floor(Math.random() * 1000000);    
    return `${this.apiBase}/images/${this.id}?id=${rand}`;
  });

  

  textByValue(options:ReadonlyArray<IOption>, val) {
    return options.find(item=> item.val == val)?.txt;
  }

  // ✅ Block user function
  blockUser(blocked_userId: number) {
    this.usersSrv.block(this.loggedInUser().id, blocked_userId).subscribe({
      next: async (res: any) => {
        this.toast.show('המשתמש נחסם / שוחרר בהצלחה ✓');
        this.isLoggedIUserBlocksPeer.set(res.blocked);   
      } ,
      error: () => alert("שגיאה בעת חסימת המשתמש")
    });
  }

  
  
  openCompose() {
    const u = this.user();
    const me = this.loggedInUser();
    if (!u || !me) return;

    const isMobile = window.innerWidth < 600;
    this.dialog.open(ChatWindowComponent, {
      data: { peerId: this.id, peerName: this.user().name },
      panelClass: isMobile ? 'im-dialog-mobile' : 'im-dialog-desktop',
      ...(isMobile ? { width: '100vw', height: '100vh' } : { width: 'min(420px, 95vw)', height:'80vh' }),
    });
  }

  showProfile(isShowProfile: boolean) {
    this.isShowProfile.set(isShowProfile);
  }




private isMobile(): boolean {
  return window.matchMedia('(max-width: 600px)').matches;
}

get profileUrl(): string {
  return `${window.location.origin}/user/${this.id}?shareprofile=1`;
}

openShareDialog() {
  const u = this.user();
  const isMobile = this.isMobile();

  const title = 'שיתוף פרופיל:';
  const subject = 'שיתוף פרופיל';

  const ref = this.dialog.open(ShareProfileDialogComponent, {
  data: {
    profileUrl: this.profileUrl,
    title,
    subject,
    name: u?.name ?? '',
    isMobile
  },
  panelClass: isMobile ? 'im-sheet' : 'im-dialog',

  hasBackdrop: true,
  backdropClass: 'share-backdrop',   // ⭐ חשוב
});


  ref.closed.subscribe(async (choice) => {
    if (!choice || choice === 'cancel') return;

    if (choice === 'native') await this.shareNative(title);
    if (choice === 'whatsapp') this.shareWhatsapp(title);
    if (choice === 'email') this.shareEmail(subject, title);
    if (choice === 'copy') this.copyLink();
  });
}

private async shareNative(title: string) {
  const share = (navigator as any).share;
  if (!share) {
    // fallback אם אין תמיכה
    this.shareWhatsapp(title);
    return;
  }

  try {
    await share({
      title: 'פרופיל',
      text: `${title} ${this.profileUrl}`,
      url: this.profileUrl,
    });
  } catch(e) {
    alert(JSON.stringify(e));
    // user canceled / blocked → לא מציגים שגיאה
  }
}

private shareWhatsapp(title: string) {
  const text = `${title}\n${this.profileUrl}`;
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
}

private shareEmail(subject: string, title: string) {
  const body = `${title}\n${this.profileUrl}`;
  window.location.href =
    `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

private async copyLink() {
  try {
    await navigator.clipboard.writeText(this.profileUrl);
    this.toast.show('הקישור הועתק 📋');
  } catch {
    const el = document.createElement('textarea');
    el.value = this.profileUrl;
    document.body.appendChild(el);
    el.select();
    document.execCommand('copy');
    document.body.removeChild(el);
    this.toast.show('הקישור הועתק 📋');
  }
}



}
