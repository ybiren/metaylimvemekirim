import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { IOption, IUser } from '../../interfaces';
import { UsersService } from '../../services/users.service';
import { environment } from '../../../environments/environment';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { REGIONS_TOKEN } from '../../consts/regions.consts';
import { firstValueFrom } from 'rxjs';
import { toSignal } from '@angular/core/rxjs-interop';


@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterModule], 
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss']
})
export class HomeComponent implements OnInit{
  users = signal<IUser[]>([]);
  private usersSvc = inject(UsersService)
  apiBase = environment.apibase;
  regions: ReadonlyArray<IOption> = inject(REGIONS_TOKEN);
      

  trackByUserId(index: number, u: IUser): number {
    return u.userID;
  }
  imageUrl = computed(() => {
    const rand = Math.floor(Math.random() * 1_000_000);
    return (u: IUser) => `${this.apiBase}/images/${u.id}?id=${rand}`;
  });

 calcAge(u: IUser): number {
   const year = Number(u.birth_year);
   return year ? new Date().getFullYear() - year : 0;
 }
 
 private allUsers = toSignal(this.usersSvc.getAllUsers(), { initialValue: [] as IUser[] });
 randomUsers = computed(() => {
    const list = this.allUsers();
    const arr = [...list];

    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  });

  

 ngOnInit(): void {
    this.usersSvc.users$.subscribe( (users) => {
        this.users.set(users)
    });
  }    
}

