import { Component, DestroyRef, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  Validators,
  ReactiveFormsModule,
  FormArray,
  FormControl,
} from '@angular/forms';
import { Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { RegisterService } from '../../services/register.service';
import { AlbumService } from '../../services/album.service';

import { UsersService } from '../../services/users.service';
import { rangeValidator, hebrewNameValidator, passwordMatchValidator } from '../../validators/form-validators';
import { IOption, IUser } from '../../interfaces';
import { getCurrentUserId } from '../../core/current-user';
import { environment } from '../../../environments/environment';

import { REGIONS_TOKEN } from '../../consts/regions.consts';
import { GENDER_TOKEN } from '../../consts/gender.consts';
import { FAMILY_STATUS_TOKEN } from '../../consts/family-status.consts';
import { EDUCATION_TOKEN } from '../../consts/education.consts';
import { WORK_TOKEN } from '../../consts/work.consts';
import { CHILDREN_STATUS_TOKEN } from '../../consts/children-status.consts';
import { SMOKING_STATUS_TOKEN } from '../../consts/smoking-status.consts';

type ServerExtraItem = {
  id: string;         // GUID
  filename?: string;  // GUID.ext (optional)
};

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.scss'],
})
export class RegisterComponent implements OnInit, OnDestroy {
  private fb = inject(FormBuilder);
  private registerSrv = inject(RegisterService);
  private usersSrv = inject(UsersService);
  private albumSrv = inject(AlbumService);
  private destroyRef = inject(DestroyRef);
  router = inject(Router);

  user = signal<IUser | null>(null);

  regions: ReadonlyArray<IOption> = inject(REGIONS_TOKEN);
  gender: ReadonlyArray<IOption> = inject(GENDER_TOKEN);
  familyStatus: ReadonlyArray<IOption> = inject(FAMILY_STATUS_TOKEN);
  education: ReadonlyArray<IOption> = inject(EDUCATION_TOKEN);
  work: ReadonlyArray<IOption> = inject(WORK_TOKEN);
  childrenStatus: ReadonlyArray<IOption> = inject(CHILDREN_STATUS_TOKEN);
  smokingStatus: ReadonlyArray<IOption> = inject(SMOKING_STATUS_TOKEN);

  readonly MAX_EXTRA_IMAGES = 5;

  days = Array.from({ length: 31 }, (_, i) => i + 1);
  months = Array.from({ length: 12 }, (_, i) => i + 1);
  years = [
    1930, 1931, 1932, 1933, 1934, 1935, 1936, 1937, 1938, 1939, 1940, 1941, 1942, 1943, 1944, 1945,
    1946, 1947, 1948, 1949, 1950, 1951, 1952, 1953, 1954, 1955, 1956, 1957, 1958, 1959, 1960, 1961,
    1962, 1963, 1964, 1965, 1966, 1967, 1968, 1969, 1970, 1971, 1972, 1973, 1974, 1975, 1976, 1977,
    1978, 1979, 1980, 1981, 1982, 1983, 1984, 1985, 1986, 1987, 1988, 1989, 1990, 1991, 1992, 1993,
    1994, 1995,
  ];

  sessionID = signal<string>(Math.floor(Math.random() * 1_000_000_000).toString());
  submitting = signal<boolean>(false);
  serverMsg = signal<string>('');

  apiBase = environment.apibase;

  // Profile image preview + errors
  imagePreviewUrl: string | null = null;
  imageError = '';
  private profileObjectUrl?: string;

  // Local extra images (new files) previews + errors
  extraPreviewUrls: string[] = [];
  extraImagesError = '';

  // Server extra images (already uploaded)
  serverExtraItems: ServerExtraItem[] = [];
  serverExtraPreviewUrls: string[] = [];
  deletingExtraId = signal<string | null>(null);

  form = this.fb.group(
    {
      c_name: ['', hebrewNameValidator],
      c_gender: [0],
      c_birth_day: [0, [Validators.min(1), Validators.max(31)]],
      c_birth_month: [0, [Validators.min(1), Validators.max(12)]],
      c_birth_year: [0, [Validators.min(1900)]],
      c_country: [0, Validators.required],
      c_pcell: ['', [Validators.maxLength(13), Validators.pattern(/^[0-9+\-\s]*$/)]],
      c_email: ['', [Validators.required, Validators.email]],
      c_url: ['', [Validators.pattern(/https?:\/\/[\w\-]+(\.[\w\-]+)+[/#?]?.*$/)]],
      c_fb: [''],
      c_ff: [0],
      c_details: [''],
      c_details1: [''],
      password: ['', [Validators.required, Validators.maxLength(9)]],
      password2: ['', [Validators.required, Validators.maxLength(9)]],
      acceptTerms: [false, Validators.requiredTrue],

      // images
      c_image: this.fb.control<File | null>(null, []),
      c_extra_images: this.fb.array<FormControl<File | null>>([]),

      // profile fields
      c_height: [0],
      c_education: [0],
      c_work: [0],
      c_children: [0],
      c_smoking: [0],

      // filters
      filter_height_min: [145],
      filter_height_max: [200],
      filter_age_min: [25],
      filter_age_max: [90],
      filter_family_status: this.buildFilterFamilyStatusArray(),
      filter_smoking_status: [0],
    },
    {
      validators: [passwordMatchValidator,rangeValidator('filter_age_min', 'filter_age_max'), rangeValidator('filter_height_min', 'filter_height_max')],
      updateOn: 'change',
    }
  );

  ngOnInit(): void {
    this.fetchUser();
  }

  ngOnDestroy(): void {
    if (this.profileObjectUrl) URL.revokeObjectURL(this.profileObjectUrl);
    this.extraPreviewUrls.forEach((u) => URL.revokeObjectURL(u));
  }

  get f() {
    return this.form.controls;
  }

  get filterFamilyStatusFA(): FormArray {
    return this.form.get('filter_family_status') as FormArray;
  }

  get extraImages(): FormArray<FormControl<File | null>> {
    return this.form.get('c_extra_images') as FormArray<FormControl<File | null>>;
  }

  private buildFilterFamilyStatusArray(selectedVals: number[] = []): FormArray {
    const controls = this.familyStatus.map((s) => this.fb.control(selectedVals.includes(s.val)));
    return this.fb.array(controls);
  }

  // --------------------
  // Profile image (single)
  // --------------------
  onImageSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;

    this.imageError = '';

    if (this.profileObjectUrl) {
      URL.revokeObjectURL(this.profileObjectUrl);
      this.profileObjectUrl = undefined;
    }
    this.imagePreviewUrl = null;

    if (!file) {
      this.f['c_image'].setValue(null);
      this.f['c_image'].setErrors({ required: true });
      this.f['c_image'].markAsTouched();
      return;
    }

    if (!file.type || !file.type.startsWith('image/')) {
      this.f['c_image'].setValue(null);
      this.f['c_image'].setErrors({ notImage: true });
      this.imageError = 'נא לבחור קובץ תמונה תקין';
      input.value = '';
      return;
    }
    

    this.profileObjectUrl = URL.createObjectURL(file);
    this.imagePreviewUrl = this.profileObjectUrl;

    this.f['c_image'].setErrors(null);
    this.f['c_image'].setValue(file);
    this.f['c_image'].markAsDirty();

    input.value = '';
  }

  // --------------------
  // Extra images (local new files, up to 5 minus server count)
  // --------------------
  onExtraImagesSelected(event: Event): void {
    this.extraImagesError = '';
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    if (!files.length) return;

    // total limit across server + local
    const alreadyOnServer = this.serverExtraItems.length;
    const totalNow = alreadyOnServer + this.extraImages.length;
    const available = this.MAX_EXTRA_IMAGES - totalNow;

    if (available <= 0) {
      this.extraImagesError = 'ניתן להעלות עד 5 תמונות נוספות (כולל תמונות שכבר קיימות בשרת)';
      input.value = '';
      return;
    }

    const toAdd = files.slice(0, available);

    for (const file of toAdd) {
      if (!file.type || !file.type.startsWith('image/')) {
        this.extraImagesError = 'נא לבחור קבצי תמונה בלבד';
        continue;
      }
      this.extraImages.push(this.fb.control<File | null>(file));
      this.extraPreviewUrls.push(URL.createObjectURL(file));
    }

    if (files.length > available) {
      this.extraImagesError = `אפשר עד ${this.MAX_EXTRA_IMAGES} תמונות. נוספו רק ${available}.`;
    }

    input.value = '';
  }

  removeExtraImage(i: number): void {
    const url = this.extraPreviewUrls[i];
    if (url) URL.revokeObjectURL(url);

    this.extraImages.removeAt(i);
    this.extraPreviewUrls.splice(i, 1);
  }

  // --------------------
  // Server extra images
  // --------------------
  private loadServerExtraImages(userId: number): void {
    this.albumSrv.listExtraImages(userId).subscribe({
      next: (res: any) => {
        if (!res?.ok) {
          this.serverExtraItems = [];
          this.serverExtraPreviewUrls = [];
          return;
        }

        this.serverExtraItems = (res.items ?? []) as ServerExtraItem[];
        this.serverExtraPreviewUrls = (res.urls ?? []).map((u: string) => `${this.apiBase}${u}`);
      },
      error: (err: any) => {
        console.error(err);
        this.serverExtraItems = [];
        this.serverExtraPreviewUrls = [];
      },
    });
  }

  deleteServerExtraImage(index: number): void {
    const uid = getCurrentUserId();
    if (!uid) return;
    
    const item = this.serverExtraItems[index];
    const filename = item?.filename;
    if (!filename) return;
     
    this.deletingExtraId.set(filename);
    this.extraImagesError = '';
    
    this.albumSrv.deleteExtraImage(uid, filename).subscribe({
      next: () => {
        // remove from lists
        this.serverExtraItems.splice(index, 1);
        this.serverExtraPreviewUrls.splice(index, 1);

        // force change detection on arrays
        this.serverExtraItems = [...this.serverExtraItems];
        this.serverExtraPreviewUrls = [...this.serverExtraPreviewUrls];

        this.deletingExtraId.set(null);
      },
      error: (err: any) => {
        console.error(err);
        this.deletingExtraId.set(null);
        this.extraImagesError = 'מחיקת תמונה מהשרת נכשלה';
      },
    });
  }

  // --------------------
  // Submit
  // --------------------
  onSubmit(): void {
    this.form.markAllAsTouched();
    this.debugFormErrors();

    if (this.f['c_gender'].value === 0) this.f['c_gender'].setErrors({ required: true });
    if (!this.f['c_birth_day'].value) this.f['c_birth_day'].setErrors({ required: true });
    if (!this.f['c_birth_month'].value) this.f['c_birth_month'].setErrors({ required: true });
    if (!this.f['c_birth_year'].value) this.f['c_birth_year'].setErrors({ required: true });

    if (this.form.invalid) return;

    // Enforce total extras <= 5
    const totalExtras = this.serverExtraItems.length + this.extraImages.length;
    if (totalExtras > this.MAX_EXTRA_IMAGES) {
      this.extraImagesError = `אפשר עד ${this.MAX_EXTRA_IMAGES} תמונות נוספות (כולל קיימות).`;
      return;
    }

    const fd = new FormData();
    fd.append('c_name', String(this.f['c_name'].value ?? ''));
    fd.append('c_gender', String(this.f['c_gender'].value ?? ''));
    fd.append('c_birth_day', String(this.f['c_birth_day'].value ?? ''));
    fd.append('c_birth_month', String(this.f['c_birth_month'].value ?? ''));
    fd.append('c_birth_year', String(this.f['c_birth_year'].value ?? ''));
    fd.append('c_country', String(this.f['c_country'].value ?? ''));
    fd.append('c_pcell', String(this.f['c_pcell'].value ?? ''));
    fd.append('c_email', String(this.f['c_email'].value ?? ''));
    fd.append('c_ff', String(this.f['c_ff'].value ?? ''));
    fd.append('c_details', String(this.f['c_details'].value ?? ''));
    fd.append('c_details1', String(this.f['c_details1'].value ?? ''));
    fd.append('password', String(this.f['password'].value ?? ''));
    fd.append('password2', String(this.f['password2'].value ?? ''));
    fd.append('sessionID', this.sessionID());

    const imageFile = this.f['c_image'].value as File | null;
    if (imageFile) fd.append('c_image', imageFile);

    // Append NEW extras only (server extras already exist)
    this.extraImages.controls.forEach((ctrl) => {
      const f = ctrl.value;
      if (f) fd.append('c_extra_images', f);
    });

    fd.append('c_height', String(this.f['c_height'].value ?? ''));
    fd.append('c_education', String(this.f['c_education'].value ?? ''));
    fd.append('c_work', String(this.f['c_work'].value ?? ''));
    fd.append('c_children', String(this.f['c_children'].value ?? ''));
    fd.append('c_smoking', String(this.f['c_smoking'].value ?? ''));
    fd.append('c_url', String(this.f['c_url'].value ?? ''));
    fd.append('c_fb', String(this.f['c_fb'].value ?? ''));

    fd.append('filter_height_min', String(this.f['filter_height_min'].value ?? ''));
    fd.append('filter_height_max', String(this.f['filter_height_max'].value ?? ''));
    fd.append('filter_age_min', String(this.f['filter_age_min'].value ?? ''));
    fd.append('filter_age_max', String(this.f['filter_age_max'].value ?? ''));

    const selectedStatuses = this.selectedFamilyStatus();
    fd.append('filter_family_status', selectedStatuses.join(','));
    fd.append('filter_smoking_status', String(this.f['filter_smoking_status'].value ?? ''));

    this.submitting.set(true);
    this.serverMsg.set('');

    this.registerSrv.registerFormData(fd).subscribe({
      next: (res) => {
        this.serverMsg.set('נרשמת בהצלחה!');
        this.submitting.set(false);
        localStorage.setItem('user', JSON.stringify(res.user));
        this.usersSrv.users$.next(res.users);
        setTimeout(() => this.router.navigate(['/home']), 500);
      },
      error: (err) => {
        console.error(err);
        this.serverMsg.set('שגיאה בהרשמה. נסה שוב.');
        this.submitting.set(false);
      },
    });
  }

  // --------------------
  // Load user data
  // --------------------
  private fetchUser() {
    this.usersSrv.users$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((users) => {
        const found = JSON.parse(localStorage.getItem('user')) as IUser;
        this.user.set(found);

        if (this.user()) {
          const uid = this.user()!.id;

          // profile image preview
          this.imagePreviewUrl = `${this.apiBase}/images/${uid}`;

          // server extras
          this.loadServerExtraImages(uid);
        } else {
          this.serverExtraItems = [];
          this.serverExtraPreviewUrls = [];
        }

        const current = this.user();
        console.log("current",current);  

        this.form.patchValue({
          c_name: current?.name ?? this.form.value.c_name,
          c_gender: current?.gender ?? this.form.value.c_gender,
          c_birth_day: current?.birth_day ??  (this.form.value.c_birth_day as unknown as number),
          c_birth_month: current?.birth_month ??  (this.form.value.c_birth_month as unknown as number),
          c_birth_year: current?.birth_year ??  (this.form.value.c_birth_year as unknown as number),
          c_country: current?.country ?? this.form.value.c_country,
          c_pcell: current?.pcell ?? this.form.value.c_pcell,
          c_email: current?.email ?? this.form.value.c_email,
          c_ff: current?.ff ?? this.form.value.c_ff,
          c_details: current?.details ?? this.form.value.c_details,
          c_details1: current?.details1 ?? this.form.value.c_details1,
          c_height: current?.height ?? this.form.value.c_height,
          c_education: current?.education ?? this.form.value.c_education,
          c_work: current?.work ?? this.form.value.c_work,
          c_children: current?.children ?? this.form.value.c_children,
          c_smoking: current?.smoking ?? this.form.value.c_smoking,
          c_url: current?.url ?? this.form.value.c_url,
          c_fb: current?.fb ?? this.form.value.c_fb,
          password: current?.password2 ?? this.form.value.password,
          password2: current?.password2 ?? this.form.value.password2,
          filter_height_min: current?.filter_height_min ?? this.form.value.filter_height_min,
          filter_height_max: current?.filter_height_max ?? this.form.value.filter_height_max,
          filter_age_min: current?.filter_age_min ?? this.form.value.filter_age_min,
          filter_age_max: current?.filter_age_max ?? this.form.value.filter_age_max,
          filter_smoking_status: current?.filter_smoking_status ?? this.form.value.filter_smoking_status,
        });

        const saved = (current?.filter_family_status ?? []) as number[];
        this.form.setControl('filter_family_status', this.buildFilterFamilyStatusArray(saved));
      });
  }

  selectedFamilyStatus(): number[] {
    const raw = this.form.value.filter_family_status as boolean[] | null | undefined;
    if (!raw || !Array.isArray(raw)) return [];
    return raw
      .map((checked, i) => (checked ? this.familyStatus[i].val : null))
      .filter((v) => v !== null) as number[];
  }

  private debugFormErrors() {
    if (!this.form.invalid) return;
    console.group('Register form errors');
    Object.entries(this.form.controls).forEach(([key, ctrl]) => {
      if (ctrl.invalid) console.log(key, ctrl.errors);
    });
    console.groupEnd();
  }
}
