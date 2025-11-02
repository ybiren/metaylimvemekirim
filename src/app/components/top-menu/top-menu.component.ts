import { Component, OnInit } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { IUser } from '../../interfaces';

@Component({
  selector: 'app-top-menu',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './top-menu.component.html',
  styleUrls: ['./top-menu.component.scss']
})
export class TopMenuComponent implements OnInit {
  loggedInUser?: IUser | null = null;

  constructor(private router: Router) {
  }

  ngOnInit(): void {
    const storedUser = localStorage.getItem('user');
    this.loggedInUser = storedUser ? (JSON.parse(storedUser) as IUser) : null;
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
