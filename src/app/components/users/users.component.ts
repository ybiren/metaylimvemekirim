import { Component, OnInit, inject, signal, WritableSignal, input, effect, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { RouterModule } from '@angular/router';
import { IUser } from '../../interfaces';
import { environment } from '../../../environments/environment';
import { Subscription } from 'rxjs';
import { PresenceService } from '../../services/presence.service';

@Component({
  selector: 'app-users',
  standalone: true,
  imports: [CommonModule, HttpClientModule, RouterModule],
  templateUrl: './users.component.html',
  styleUrls: ['./users.component.scss']
})
export class UsersComponent implements OnInit {
  private http = inject(HttpClient);

  apiBase = environment.apibase;

  inputUsers = input<IUser[] | undefined>(undefined);

  /** Internal, writable state used by the template */
  users: WritableSignal<IUser[]> = signal<IUser[]>([]);
  loading = signal(false);

  private presenceSub?: Subscription;
  private presence = inject(PresenceService);
  onlineUsers = signal<Set<number>>(new Set);  


  private didAttemptFetch = false; // guard so we fetch at most once

  /** React to input changes or lack thereof */
  private reactToInput = effect(() => {
    const incoming = this.inputUsers();

    if (incoming !== undefined) {
      // Parent provided something (possibly empty array) -> use it, no fetch
      this.users.set(incoming);
    } else if (!this.didAttemptFetch) {
      // Not provided -> fetch exactly once
      this.didAttemptFetch = true;
      this.fetchUsers();
    }
  }, { allowSignalWrites: true });

  ngOnInit() {
    this.presence.onlineSet$.subscribe(set => this.onlineUsers.set(set));
  }
  

  fetchUsers() {
    this.loading.set(true);
    this.http.get<{ users: IUser[] }>(`${this.apiBase}/users`).subscribe({
      next: (res) => {
        this.users.set(res.users ?? []);
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Failed to load users', err);
        this.loading.set(false);
      }
    });
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
    const set = this.onlineUsers(); // track
    return (userId: number) => set.has(userId);
  });
  
  
}
