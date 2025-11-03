import { Component, inject, OnInit, signal, Signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { JsonPipe } from '@angular/common';

import { IMessage, IUser } from '../../interfaces';
import { MessagesService } from '../../services/messages.service';
import { MessagesStore } from '../../stores/messages.store';

@Component({
  selector: 'app-top-menu',
  standalone: true,
  imports: [RouterLink, RouterLinkActive,JsonPipe],
  templateUrl: './top-menu.component.html',
  styleUrls: ['./top-menu.component.scss']
})
export class TopMenuComponent implements OnInit {
  loggedInUser?: IUser | null = null;
  messagesService = inject(MessagesService);
  messages = signal<IMessage[]>([]);
  messagesStore = inject(MessagesStore);

  constructor(private router: Router) {
  }

  ngOnInit(): void {
    const storedUser = localStorage.getItem('user');
    this.loggedInUser = storedUser ? (JSON.parse(storedUser) as IUser) : null;
    if(this.loggedInUser) {
      this.messagesService.getMessagesByUserId(this.loggedInUser.userID).subscribe({
      next: (res:any) => {
        this.messages.set(res.messages ?? [])
        this.messagesStore.setAll(this.messages());
      },
      error: err => console.error('messages error', err)
    });
    
    }
  }

  logout(): void {
    // 1) Clear local storage
    localStorage.clear();

    // 2) Redirect to default (home) page
    this.router.navigateByUrl('/');
  }

  randomInit(): {} {
    return {"init" : Math.floor(Math.random() * 1000000)}; 
  }
   
}
