import { Component, inject, OnInit, signal, WritableSignal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  trigger, transition, style, animate, query, group, animateChild
} from '@angular/animations';
import { REGIONS_TOKEN} from '../../consts/regions.consts'
import { GENDER_TOKEN } from '../../consts/gender.consts';
import { FAMILY_STATUS_TOKEN } from '../../consts/family-status.consts';
import { IOption, IUser } from '../../interfaces';
import { SearchService } from '../../services/search.searvice';
import { ageRangeValidator } from '../../validators/form-validators';
import { UsersComponent } from '../users/users.component';
import { ActivatedRoute, Router } from '@angular/router';

@Component({
  selector: 'app-search-filters',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, UsersComponent],
  templateUrl: './search-filters.component.html',
  styleUrls: ['./search-filters.component.scss'],
  animations: [
    // Reusable vertical expand/collapse (auto height)
    trigger('expandCollapse', [
      transition(':enter', [
        style({ height: 0, opacity: 0, overflow: 'hidden' }),
        animate('350ms ease', style({ height: '*', opacity: 1 }))
      ]),
      transition(':leave', [
        style({ overflow: 'hidden' }),
        animate('350ms ease', style({ height: 0, opacity: 0 }))
      ]),
    ]),

    // Orchestrator to run leave→enter in a pleasing sequence
    trigger('swap', [
      transition('search => results', [
        group([
          query('.search-panel', [animateChild()], { optional: true }),
          // slight delay so the grow starts after shrink begins
          query('.results-panel', [
            style({ visibility: 'hidden' })
          ], { optional: true })
        ]),
        query('.results-panel', [
          style({ visibility: 'visible' }),
          animateChild()
        ], { optional: true })
      ]),
      transition('results => search', [
        group([
          query('.results-panel', [animateChild()], { optional: true }),
          query('.search-panel', [
            style({ visibility: 'hidden' })
          ], { optional: true })
        ]),
        query('.search-panel', [
          style({ visibility: 'visible' }),
          animateChild()
        ], { optional: true })
      ]),
    ]),
  ]
})
export class SearchFiltersComponent implements OnInit{
  private fb = inject(FormBuilder);
  private activatedRoute = inject(ActivatedRoute);
  regions:ReadonlyArray<IOption> = inject(REGIONS_TOKEN);
  gender:ReadonlyArray<IOption> = inject(GENDER_TOKEN);  
  familyStatus:ReadonlyArray<IOption> = inject(FAMILY_STATUS_TOKEN);
  searchService = inject(SearchService)

  readonly ages = Array.from({ length: 65 }, (_, i) => i + 16); // 16..80
  readonly heights = [0, 160, 165, 170, 175, 180, 185, 190];   // 0 = הכל

  foundedUsers: WritableSignal<IUser[]> = signal<IUser[]>([]);
  
  // match original semantics:
  // c_gender: 9=הכל, 1=זכר, 0=נקבה
  form = this.fb.group({
    c_gender: [9],
    c_phome: [''],          // עישון: '' | 'מעשן' | 'לא מעשן'
    c_tz: [0],              // גובה: 0=הכל, otherwise CM
    c_ages1: [0],           // מגיל (0 = no min)
    c_ages2: [0],           // עד גיל (0 = no max)
    c_ff: [9],            // מצב משפחתי: 0=מצב משפחתי (לא נבחר), else text
    c_country: [0],
    c_pic: [false],         // חברים בעלי תמונות בלבד
    c_online: [false],      // הצג חברים שבאתר כרגע
    c_name:[''],
    updateOn: 'change'}
    , {validators: [ ageRangeValidator('c_ages1', 'c_ages2') ]});

  get f() { return this.form.controls; }

  ngOnInit(): void {
    this.activatedRoute.queryParams.subscribe(params => {
      const init = params['init'];
      if (init != null) {
        this.foundedUsers.set([]); // clear results if init param is present
      }
    });
  }

  submit() {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;

    this.searchService.search(this.form.value).subscribe({
      next: (res) => {
        this.foundedUsers.set(res.users);
        console.log('Search results:', res.users);
        if(!res.users.length) {
          alert("לא נמצאו חברים");
        }
      },
      error: (err) => {
        console.error('Search failed:', err);
      }
    });
  }

  reset() {
    this.form.reset({
      c_gender: 9,
      c_phome: '',
      c_tz: 0,
      c_ages1: 0,
      c_ages2: 0,
      c_ff: 9,
      c_country: 0,
      c_pic: false,
      c_online: false,
      c_name: ''
    });
  }
}
