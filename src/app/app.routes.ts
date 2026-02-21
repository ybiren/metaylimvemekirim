import { Route } from '@angular/router';

import {RegisterComponent} from './components/register/register.component';
import {DragImageKupidComponent} from './components/drag_image_kupid/drag_image_kupid.component';
import { UsersComponent } from './components/users/users.component';
import { SearchFiltersComponent } from './components/search-filters/search-filters.component';
import { MessagesStoreViewComponent } from './components/messages/messages.component';
import { HomeComponent } from './components/home/home.component';
import { AboutUsComponent } from './components/about-us/about-us.component';
import { ContactPageComponent } from './components/contact/contact,component';
import { ForgotPasswordComponent } from './components/forgot-password/forgot-password.component';
import { AlbumComponent } from './components/album/album.component';
import { HelpComponent } from './components/help/help.component';
import { ResetPasswordComponent } from './components/reset-password/reset-password.component';
import { SmsUpdatesSignalFormComponent } from './components/sms-updates-signal-form/sms-updates-signal-form.component';
import { ChatSystemRoomsComponent } from './components/chat-system-rooms/chat-system-rooms.component';
import { LikesContainerComponent } from './components/likes-container/likes-container.component';
import { AdminUpdatesComponent } from './admin/admin-updates.component';


export const appRoutes: Route[] = [
  { path: 'home', component: HomeComponent },
  { path: 'users', component: UsersComponent },
  { path: 'user/:userID', loadComponent: () =>
      import('./components/user-details/user-details.component').then(m => m.UserDetailsComponent) },
  { path: 'register', component: RegisterComponent },
  { path: 'kupid', component: DragImageKupidComponent },
  { path: 'search', component: SearchFiltersComponent },
  { path: 'messages', component: MessagesStoreViewComponent },
  { path: 'about-us', component: AboutUsComponent },
  { path: 'contact', component: ContactPageComponent },
  { path: 'forgot-password', component: ForgotPasswordComponent },
  { path: 'album', component: AlbumComponent },
  { path: 'help', component: HelpComponent },
  { path: 'reset-password', component: ResetPasswordComponent },
  { path: 'sms', component: SmsUpdatesSignalFormComponent },
  { path: 'chat-system-rooms', component: ChatSystemRoomsComponent },
  { path: 'likes', component: LikesContainerComponent },


   // ✅ admin area
  {
    path: 'admin',
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      { path: 'dashboard', loadComponent: () => import('./admin/admin-updates.component').then(m => m.AdminUpdatesComponent) },
      { path: 'pages', loadComponent: () => import('./admin/admin-pages.component').then(m => m.AdminPagesComponent) },
      { path: 'users', loadComponent: () => import('./admin/admin-users.component').then(m => m.AdminUsersComponent) },
      { path: 'banners', loadComponent: () => import('./admin/admin-banners.component').then(m => m.AdminBannersComponent) }
    ]
  } 
   

];
