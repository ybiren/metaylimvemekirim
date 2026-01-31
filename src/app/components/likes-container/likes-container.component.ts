import { Component, Signal, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { UsersComponent } from '../users/users.component';
import { UsersService } from '../../services/users.service';
import { IUser } from '../../interfaces';
import { toSignal } from '@angular/core/rxjs-interop';


@Component({
  selector: 'app-likes',
  standalone: true,
  imports: [CommonModule, UsersComponent],
  templateUrl: './likes-container.component.html',
  styleUrls: ['./likes-container.component.scss'],
})
export class LikesContainerComponent {
  
  private usersSvc = inject(UsersService);
  isILike = signal<boolean>(true);
  usersThatLikesMe!: Signal<IUser[]>;
  usersThatILike!: Signal<IUser[]>;
  
  constructor() {
    this.usersThatLikesMe = toSignal(this.usersSvc.getAllUsers(true));
    this.usersThatILike = toSignal(this.usersSvc.getAllUsers(false));
  }
    
  showProfile(isILike: boolean) {
    this.isILike.set(!isILike);
  }


}
