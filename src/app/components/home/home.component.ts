import {
  Component,
  computed,
  ElementRef,
  HostListener,
  inject,
  OnInit,
  signal,
  viewChild,
} from '@angular/core';
import { IOption, IUser } from '../../interfaces';
import { UsersService } from '../../services/users.service';
import { environment } from '../../../environments/environment';
import { CommonModule } from '@angular/common';
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
  mainPageTemplate = signal(null);
  updates = signal([]);

  // Marquee pause-on-touch state
  private updatesBox = viewChild<ElementRef<HTMLElement>>('updatesBox');
  updatesPaused = signal(false);
  private pressStartX = 0;
  private pressStartY = 0;
  private pausedBeforePress = false;
  private suppressNextClick = false;

  onUpdatesPressStart(event: TouchEvent) {
    const touch = event.touches[0];
    this.pressStartX = touch ? touch.clientX : 0;
    this.pressStartY = touch ? touch.clientY : 0;
    this.pausedBeforePress = this.updatesPaused();
    // Freeze right away so the finger has something steady to read.
    this.updatesPaused.set(true);
  }

  onUpdatesPressEnd(event: TouchEvent) {
    const touch = event.changedTouches[0];
    const moved =
      !!touch &&
      (Math.abs(touch.clientX - this.pressStartX) > 10 ||
        Math.abs(touch.clientY - this.pressStartY) > 10);

    if (moved) {
      // The finger dragged (page scroll): not a tap, keep the previous state.
      this.updatesPaused.set(this.pausedBeforePress);
      this.suppressNextClick = true;
      return;
    }

    // Any tap toggles, however long the finger stayed down: the first one stops
    // the marquee, the next one starts it again. The tap that stops it doesn't
    // follow the link, so opening an update takes a second tap.
    this.updatesPaused.set(!this.pausedBeforePress);
    this.suppressNextClick = !this.pausedBeforePress;
  }

  onUpdatesPressCancel() {
    this.updatesPaused.set(this.pausedBeforePress);
    this.suppressNextClick = true;
  }

  onUpdatesClick(event: Event) {
    if (this.suppressNextClick) {
      this.suppressNextClick = false;
      event.preventDefault();
      event.stopPropagation();
    }
  }

  // Touching anywhere else on the page lets the marquee run again.
  @HostListener('document:touchstart', ['$event'])
  @HostListener('document:mousedown', ['$event'])
  onDocumentPress(event: Event) {
    if (!this.updatesPaused()) {
      return;
    }
    const box = this.updatesBox()?.nativeElement;
    const target = event.target as Node | null;
    if (box && target && box.contains(target)) {
      return;
    }
    this.updatesPaused.set(false);
    this.pausedBeforePress = false;
  }

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
    const pageTemplate = await firstValueFrom(this.pageTemplateService.load("main"));
    this.mainPageTemplate.set(pageTemplate);
  
    const updates = await firstValueFrom(this.pageTemplateService.load_updates());
    this.updates.set(updates as any[]);
  }    
}

