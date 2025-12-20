import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { IOption, IUser } from '../../interfaces';
import { UsersService } from '../../services/users.service';
import { environment } from '../../../environments/environment';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { REGIONS_TOKEN } from '../../consts/regions.consts';


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
    return (u: IUser) => `${this.apiBase}/images/${u.userID}?id=${rand}`;
  });

 calcAge(u: IUser): number {
   const year = Number(u.c_birth_year);
   return year ? new Date().getFullYear() - year : 0;
 }
 
 getRandomUsers(): any[] {
   const list = [...this.users()]; // copy (do NOT mutate signal)

   // Fisher–Yates shuffle
   for (let i = list.length - 1; i > 0; i--) {
     const j = Math.floor(Math.random() * (i + 1));
     [list[i], list[j]] = [list[j], list[i]];
   }

   // if more than 2 → return n-1
   return list.length > 2 ? list.slice(0, list.length - 1) : list;
 }

 ngOnInit(): void {
    this.usersSvc.users$.subscribe( (users) => {
        this.users.set(users)
    });
  }    
}

