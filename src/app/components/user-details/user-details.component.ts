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
import { MessageComposeComponent } from '../message-compose/messaege-compose.component';
import { Dialog, DialogModule } from '@angular/cdk/dialog';
import { ToastService } from '../../services/toast.service';
import { Subscription } from 'rxjs';
import { PresenceService } from '../../services/presence.service';
import { ChatWindowComponent } from '../chat-window/chat-window.component';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AlbumComponent } from '../album/album.component';

@Component({
  selector: 'app-user-details',
  standalone: true,
  imports: [CommonModule, RouterModule, HttpClientModule, DialogModule, AlbumComponent],
  templateUrl: './user-details.component.html',
  styleUrls: ['./user-details.component.scss'],
})
export class UserDetailsComponent implements OnInit {
  private http = inject(HttpClient);
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
  isLoggedIUserBlockedByPeer: Signal<{is_blocked:boolean}>;
  isShowProfile = signal<boolean>(true);
  
  constructor() {

    this.loggedInUser.set(JSON.parse(localStorage.getItem('user')) as IUser)
    const idParam = this.route.snapshot.paramMap.get('userID') || this.route.snapshot.paramMap.get('id');
    const id = Number(idParam);
    if (!id) {
      this.error.set('Invalid user id');
      return;
    }
    this.fetchUser(id);
    this.isLoggedIUserBlockedByPeer = this.usersSrv.is_blockedByPeerSignal(this.loggedInUser().userID, id);
  }
  
  ngOnInit(): void {
  }

  fetchUser(id: number) {
    this.loading.set(true);
    this.error.set('');
    // Using existing GET /users and filtering client-side
    this.usersSrv.users$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((users) => {
      const found = (users || []).find(u => u.userID === id);
      if (!found) this.error.set('User not found');
      this.user.set(found);
      this.loading.set(false);
    });
    
    
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
    return `${this.apiBase}/images/${this.user().userID}?id=${rand}`;
  });

  

  textByValue(options:ReadonlyArray<IOption>, val) {
    return options.find(item=> item.val == val).txt;
  }

  // ✅ Block user function
  blockUser(blocked_userId: number) {
    const userId = this.loggedInUser().userID;
    this.usersSrv.block(userId, blocked_userId).subscribe({
      next: (res: any) => {
        this.toast.show('המשתמש נחסם / שוחרר בהצלחה ✓');
        localStorage.setItem('user', JSON.stringify({...this.loggedInUser(),"block": [...res.block_list]}));
        this.loggedInUser.set(JSON.parse(localStorage.getItem('user')) as IUser);
      } ,
      error: () => alert("שגיאה בעת חסימת המשתמש")
    });
  }

  isBlocked = computed(() => {
    const u = this.user();
    const me = this.loggedInUser();
    if (!u || !me) return false;
    return me.block?.includes(u.userID );
  });
  
  
  openCompose() {
    const u = this.user();
    const me = this.loggedInUser();
    if (!u || !me) return;

    const isMobile = window.innerWidth < 600;
    this.dialog.open(ChatWindowComponent, {
      data: { peerId: u.userID },
      panelClass: isMobile ? 'im-dialog-mobile' : 'im-dialog-desktop',
      ...(isMobile ? { width: '100vw', height: '100vh' } : { width: 'min(420px, 95vw)', height:'80vh' }),
    });
  }

  showProfile(isShowProfile: boolean) {
    this.isShowProfile.set(isShowProfile);
  }
}
