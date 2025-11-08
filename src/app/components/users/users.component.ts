import { Component, OnInit, inject, signal, WritableSignal, input, effect, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { RouterModule } from '@angular/router';
import { IUser } from '../../interfaces';
import { environment } from '../../../environments/environment';
import { Subscription } from 'rxjs';
import { PresenceService } from '../../services/presence.service';
import { getCurrentUserId } from '../../core/current-user';
import { UsersService } from '../../services/users.service';

@Component({
  selector: 'app-users',
  standalone: true,
  imports: [CommonModule, HttpClientModule, RouterModule],
  templateUrl: './users.component.html',
  styleUrls: ['./users.component.scss']
})
export class UsersComponent implements OnInit {
  inputUsers = input<IUser[] | undefined>(undefined);
  users = signal<IUser[]>([]);
  loading = signal(false);
  onlineUsers = signal<Set<number>>(new Set);  
  private presence = inject(PresenceService);
  private usersSvc = inject(UsersService)
  apiBase = environment.apibase;
  private me = getCurrentUserId();
  
  ngOnInit() {
    if(!this.inputUsers()){
      this.usersSvc.users$.subscribe(users => this.users.set(users))
    }else {
      this.users.set(this.inputUsers().filter(u=>u.userID !== this.me));
    }
  }
    
  

  imageUrl(u: IUser): string {
    const rand = Math.floor(Math.random() * 1_000_000);
    return `${this.apiBase}/images/${u.userID}?id=${rand}`;
  }

  trackByUserId(index: number, u: IUser): number {
    return u.userID;
  }

  toggleLike(u: IUser) {
  }

  isOnline = computed(() => {
    return (userId: number) => this.presence.isOnline(userId);
  });
  
  
}
