import { Component, OnInit, inject, signal, WritableSignal, input, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { RouterModule } from '@angular/router';
import { IUser } from '../../interfaces';
import { environment } from '../../../environments/environment';

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

  /** Input from parent:
   *  - undefined  => not provided -> we will fetch
   *  - []         => intentionally provided empty -> DO NOT fetch
   *  - IUser[]    => provided list -> DO NOT fetch
   */
  inputUsers = input<IUser[] | undefined>(undefined);

  /** Internal, writable state used by the template */
  users: WritableSignal<IUser[]> = signal<IUser[]>([]);
  loading = signal(false);

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

  
  
}
