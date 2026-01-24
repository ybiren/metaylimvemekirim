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
import { filter, firstValueFrom, of, take } from 'rxjs';
import { ShareProfileDialogComponent, ShareChannel } from './share-profile-dialog.component';
import { ShareUrlService } from '../../services/share-url.service';
import { ChatService } from '../../services/chat.service';


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
  private shareUrlService  = inject(ShareUrlService);
  private chat = inject(ChatService);
    

  apiBase = environment.apibase;

  loading = signal<boolean>(false);
  error = signal<string>('');
  user = signal<IUser | null>(null);
  loggedInUser = signal<IUser | null>(null);
  isLoggedIUserBlockedByPeer = signal<boolean>(null);
  isLoggedIUserBlocksPeer = signal<boolean>(null);
  isShowProfile = signal<boolean>(true);
  isLoggedIUserLikesPeer = signal<boolean>(null);
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
      this.isLoggedIUserLikesPeer.set(await firstValueFrom(this.usersSrv.isLiked(this.loggedInUser().id, this.id))); 
    }
  }

  toggleLike() {
    this.toast.show('הוספת like ✓');
    this.chat.setActivePeer(this.id);
    this.chat.connect(this.id);
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

   openShareDialog(){
    const sharedUrl = `${window.location.origin}/user/${this.id}?shareprofile=1`;
    const sharedUserName = this.user().name;  
    this.shareUrlService.openShareDialog(sharedUrl, sharedUserName);
  }


}
