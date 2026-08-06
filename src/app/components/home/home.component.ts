import {
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { IOption, IUser } from '../../interfaces';
import { UsersService } from '../../services/users.service';
import { environment } from '../../../environments/environment';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { RouterModule } from '@angular/router';
import { REGIONS_TOKEN } from '../../consts/regions.consts';
import { toSignal } from '@angular/core/rxjs-interop';
import { PageTemplateService } from '../../services/page-template.service';
import { firstValueFrom } from 'rxjs';

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
  private pageTemplateService = inject(PageTemplateService);
  private sanitizer = inject(DomSanitizer);
  mainPageTemplate = signal<{ html?: string } | null>(null);

  /**
   * Angular sanitises every [innerHTML] binding and drops <iframe> outright,
   * along with <script>, <style>, <object> and <embed> - so an embedded video
   * in the admin page vanished with no error. This content is authored in the
   * admin section, so it is bound as trusted instead.
   */
  mainPageHtml = computed<SafeHtml | null>(() => {
    const html = this.mainPageTemplate()?.html;
    return html ? this.sanitizer.bypassSecurityTrustHtml(html) : null;
  });

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
  

 async ngOnInit() {
  this.usersSvc.users$.subscribe( (users) => {
        this.users.set(users)
    });

    // A missing or inactive "main" page answers 404, which used to reject here
    // and abandon the rest of ngOnInit without a word in the console.
    try {
      const pageTemplate = await firstValueFrom(this.pageTemplateService.load("main"));
      this.mainPageTemplate.set(pageTemplate);
    } catch (err) {
      console.error('[Home] main page content failed to load', err);
      this.mainPageTemplate.set(null);
    }
  }
}

