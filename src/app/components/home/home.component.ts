import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { IUser } from '../../interfaces';
import { UsersService } from '../../services/users.service';
import { environment } from '../../../environments/environment';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';


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
    

  trackByUserId(index: number, u: IUser): number {
    return u.userID;
  }
  imageUrl = computed(() => {
    const rand = Math.floor(Math.random() * 1_000_000);
    return (u: IUser) => `${this.apiBase}/images/${u.userID}?id=${rand}`;
  });

  ngOnInit(): void {
    this.usersSvc.users$.subscribe( (users) => {
        this.users.set(users)
    });
  }    
}

