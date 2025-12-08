import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  Validators,
  AbstractControl,
  ValidationErrors,
  ReactiveFormsModule,
  FormArray,
  FormControl,
} from '@angular/forms';
import { RegisterService } from '../../services/register.service';
import { fileMaxSizeValidator, fileMimeTypeValidator } from '../../validators/file-validators';
import { hebrewNameValidator, passwordMatchValidator } from '../../validators/form-validators';
import { IOption, IUser } from '../../interfaces';
import { Router } from '@angular/router';
import { REGIONS_TOKEN } from '../../consts/regions.consts';
import { GENDER_TOKEN } from '../../consts/gender.consts';
import { FAMILY_STATUS_TOKEN } from '../../consts/family-status.consts';
import { UsersService } from '../../services/users.service';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { getCurrentUserId } from '../../core/current-user';
import { environment } from '../../../environments/environment';
import { EDUCATION_TOKEN } from '../../consts/education.consts';
import { WORK_TOKEN } from '../../consts/work.consts';
import { CHILDREN_STATUS_TOKEN } from '../../consts/children-status.consts';
import { SMOKING_STATUS_TOKEN } from '../../consts/smoking-status.consts';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.scss'],
})
export class RegisterComponent implements OnInit {
  private fb = inject(FormBuilder);
  private registerSrv = inject(RegisterService);
  private usersSrv = inject(UsersService);
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

  readonly MAX_IMAGE_BYTES = 256 * 1024; // 256KB

  days = Array.from({ length: 31 }, (_, i) => i + 1);
  months = Array.from({ length: 12 }, (_, i) => i + 1);
  years = [
    1930, 1931, 1932, 1933, 1934, 1935, 1936, 1937, 1938, 1939, 1940, 1941, 1942, 1943, 1944, 1945,
    1946, 1947, 1948, 1949, 1950, 1951, 1952, 1953, 1954, 1955, 1956, 1957, 1958, 1959, 1960, 1961,
    1962, 1963, 1964, 1965, 1966, 1967, 1968, 1969, 1970, 1971, 1972, 1973, 1974, 1975, 1976, 1977,
    1978, 1979, 1980, 1981, 1982, 1983, 1984, 1985, 1986, 1987, 1988, 1989, 1990, 1991, 1992, 1993,
    1994, 1995,
  ];

  // mimic the original hidden field
  sessionID = signal<string>(Math.floor(Math.random() * 1_000_000_000).toString());

  submitting = signal<boolean>(false);
  serverMsg = signal<string>('');

  // Preview + error helpers for image
  imagePreviewUrl: string | null = null;
  imageError = '';

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

      // image + profile extras
      c_image: this.fb.control<File | null>(null, []),
      c_height: [0],
      c_education: [0],
      c_work: [0],
      c_children: [0],
      c_smoking: [0],

      // 🔽 NEW: filters for incoming contacts
      filter_height_min: [null],
      filter_height_max: [null],
      filter_age_min: [null],
      filter_age_max: [null],
      filter_family_status: this.buildFilterFamilyStatusArray(),
      filter_smoking_status:[0] 
    },
    {
      validators: passwordMatchValidator,
      updateOn: 'change',
    }
  );

  private objectUrl?: string;
  apiBase = environment.apibase;

  ngOnInit(): void {
    this.fetchUser();
  }

  get f() {
    return this.form.controls;
  }

  get filterFamilyStatusFA(): FormArray {
    return this.form.get('filter_family_status') as FormArray;
  }

  private buildFilterFamilyStatusArray(selectedVals: number[] = []): FormArray {
    const controls = this.familyStatus.map((s) =>
      this.fb.control(selectedVals.includes(s.val))
    );
    return this.fb.array(controls);
  }

  onImageSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;

    // reset previous state
    this.imageError = '';
    if (this.objectUrl) {
      URL.revokeObjectURL(this.objectUrl);
      this.objectUrl = undefined;
    }
    this.imagePreviewUrl = null;

    // if nothing picked
    if (!file) {
      this.f['c_image'].setValue(null);
      this.f['c_image'].setErrors({ required: true });
      this.f['c_image'].markAsTouched();
      this.f['c_image'].updateValueAndValidity({ onlySelf: true, emitEvent: false });
      return;
    }

    // mime type validation (you can also use fileMimeTypeValidator if you want on control)
    if (!file.type || !file.type.startsWith('image/')) {
      this.f['c_image'].setValue(null);
      this.f['c_image'].setErrors({ notImage: true });
      this.imageError = 'נא לבחור קובץ תמונה תקין';
      return;
    }

    // size validation (if you want it here as well)
    if (file.size > this.MAX_IMAGE_BYTES) {
      this.f['c_image'].setValue(null);
      this.f['c_image'].setErrors({ tooLarge: true });
      this.imageError = 'גודל התמונה לא יכול לעלות על ‎256KB‎';
      return;
    }

    // Preview
    this.objectUrl = URL.createObjectURL(file);
    this.imagePreviewUrl = this.objectUrl;

    // All good
    this.f['c_image'].setErrors(null);
    this.f['c_image'].setValue(file);
    this.f['c_image'].markAsDirty();
  }

  onSubmit(): void {
    this.form.markAllAsTouched();
    this.debugFormErrors();
    if (this.form.invalid) return;

    // validate selects which have "0" default
    if (
      this.f['c_gender'].value === 0 ||
      !this.f['c_birth_day'].value ||
      !this.f['c_birth_month'].value ||
      !this.f['c_birth_year'].value
    ) {
      if (this.f['c_gender'].value === 0) this.f['c_gender'].setErrors({ required: true });
      if (!this.f['c_birth_day'].value) this.f['c_birth_day'].setErrors({ required: true });
      if (!this.f['c_birth_month'].value) this.f['c_birth_month'].setErrors({ required: true });
      if (!this.f['c_birth_year'].value) this.f['c_birth_year'].setErrors({ required: true });
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
    if (imageFile) {
      fd.append('c_image', imageFile);
    }
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

    // take the selected family-status values (array of numbers) and send as comma-separated string
    const selectedStatuses = this.selectedFamilyStatus(); // e.g. [1,4,5]
    fd.append('filter_family_status', selectedStatuses.join(',')); // "1,4,5"
    fd.append('filter_smoking_status', String(this.f['filter_smoking_status'].value ?? ''));
    this.submitting.set(true);
    this.serverMsg.set('');

    this.registerSrv.registerFormData(fd).subscribe({
      next: (res) => {
        this.serverMsg.set('נרשמת בהצלחה!');
        this.submitting.set(false);
        console.log('Server response:', res);
        localStorage.setItem('user', JSON.stringify(res.user));
        this.usersSrv.load();
        setTimeout(() => {
          this.router.navigate(['/home']);
        }, 500);
      },
      error: (err) => {
        console.error(err);
        this.serverMsg.set('שגיאה בהרשמה. נסה שוב.');
        this.submitting.set(false);
      },
    });
  }

  /** Load partial user data */
  private fetchUser() {
    this.usersSrv.users$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((users) => {
        const found = (users || []).find((u) => u.userID === getCurrentUserId());
        this.user.set(found);

        if (this.user()) {
          this.imagePreviewUrl = `${this.apiBase}/images/${this.user()!.userID}`;
        }

        const current = this.user();

        this.form.patchValue({
          c_name: current?.c_name ?? this.form.value.c_name,
          c_gender: current?.c_gender ?? this.form.value.c_gender,
          c_birth_day: current?.c_birth_day
            ? current.c_birth_day
            : (this.form.value.c_birth_day as unknown as number),
          c_birth_month: current?.c_birth_month
            ? current.c_birth_month
            : (this.form.value.c_birth_month as unknown as number),
          c_birth_year: current?.c_birth_year
            ? current.c_birth_year
            : (this.form.value.c_birth_year as unknown as number),
          c_country: current?.c_country ?? this.form.value.c_country,
          c_pcell: current?.c_pcell ?? this.form.value.c_pcell,
          c_email: current?.c_email ?? this.form.value.c_email,
          c_ff: current?.c_ff ?? this.form.value.c_ff,
          c_details: current?.c_details ?? this.form.value.c_details,
          c_details1: current?.c_details1 ?? this.form.value.c_details1,
          c_height: current?.c_height ?? this.form.value.c_height,
          c_education: current?.c_education ?? this.form.value.c_education,
          c_work: current?.c_work ?? this.form.value.c_work,
          c_children: current?.c_children ?? this.form.value.c_children,
          c_smoking: current?.c_smoking ?? this.form.value.c_smoking,
          c_url: current?.c_url ?? this.form.value.c_url,
          c_fb: current?.c_fb ?? this.form.value.c_fb,
          password: current?.password2 ?? this.form.value.password,
          password2: current?.password2 ?? this.form.value.password2,
          filter_height_min: current?.filter_height_min ?? this.form.value.filter_height_min,
          filter_height_max: current?.filter_height_max ?? this.form.value.filter_height_max,
          filter_age_min: current?.filter_age_min ?? this.form.value.filter_age_min,
          filter_age_max: current?.filter_age_max ?? this.form.value.filter_age_max,
          filter_smoking_status: current?.filter_smoking_status ?? this.form.value.filter_smoking_status
        });

        // build the FormArray from saved values (if any)
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
      if (ctrl.invalid) {
        console.log(key, ctrl.errors);
      }
    });
    console.groupEnd();
  }
}
