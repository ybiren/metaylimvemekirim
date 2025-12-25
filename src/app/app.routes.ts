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
];
