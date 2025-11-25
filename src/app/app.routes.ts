import { Route } from '@angular/router';

import {RegisterComponent} from './components/register/register.component';
import {DragImageKupidComponent} from './components/drag_image_kupid/drag_image_kupid.component';
import { UsersComponent } from './components/users/users.component';
import { SearchFiltersComponent } from './components/search-filters/search-filters.component';
import { MessagesStoreViewComponent } from './components/messages/messages.component';
import { HomeComponent } from './components/home/home.component';

export const appRoutes: Route[] = [
  { path: 'home', component: HomeComponent },
  { path: 'users', component: UsersComponent },
  { path: 'user/:userID', loadComponent: () =>
      import('./components/user-details/user-details.component').then(m => m.UserDetailsComponent) },
  { path: 'register', component: RegisterComponent },
  { path: 'kupid', component: DragImageKupidComponent },
  { path: 'search', component: SearchFiltersComponent },
  { path: 'messages', component: MessagesStoreViewComponent }

];
