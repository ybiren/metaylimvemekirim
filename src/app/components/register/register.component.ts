import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, Validators, AbstractControl, ValidationErrors, ReactiveFormsModule } from '@angular/forms';
import { RegisterService } from '../../services/register.service';
import { fileMaxSizeValidator, fileMimeTypeValidator } from '../../validators/file-validators';
import { hebrewNameValidator, passwordMatchValidator } from '../../validators/form-validators';
import { IOption, IRegisterPayload } from '../../interfaces';
import { Router } from '@angular/router';
import { REGIONS_TOKEN } from '../../consts/regions.consts';
import { GENDER_TOKEN } from '../../consts/gender.consts';
import { FAMILY_STATUS_TOKEN } from '../../consts/family-status.consts';

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
  router = inject(Router);
  regions:ReadonlyArray<IOption> = inject(REGIONS_TOKEN);
  gender:ReadonlyArray<IOption> = inject(GENDER_TOKEN);  
  familyStatus:ReadonlyArray<IOption> = inject(FAMILY_STATUS_TOKEN);
    
  readonly MAX_IMAGE_BYTES = 256 * 1024; // 256KB

  days = Array.from({ length: 31 }, (_, i) => i + 1);
  months = Array.from({ length: 12 }, (_, i) => i + 1);
  years = [
    1930,1931,1932,1933,1934,1935,1936,1937,1938,1939,1940,1941,1942,1943,1944,
    1945,1946,1947,1948,1949,1950,1951,1952,1953,1954,1955,1956,1957,1958,1959,
    1960,1961,1962,1963,1964,1965,1966,1967,1968,1969,1970,1971,1972,1973,1974,
    1975,1976,1977,1978,1979,1980,1981,1982,1983,1984,1985,1986,1987,1988,1989,
    1990,1991,1992,1993,1994,1995
  ];
 
  // mimic the original hidden field
  sessionID = signal<string>(Math.floor(Math.random() * 1_000_000_000).toString());

  submitting = signal<boolean>(false);
  serverMsg = signal<string>('');

  // Preview + error helpers for image
  imagePreviewUrl: string | null = null;
  imageError = '';

  form = this.fb.group({
    c_name: ['', hebrewNameValidator],
    c_gender: [0],          // keep original values
    c_birth_day: [0, [Validators.min(1), Validators.max(31)]],
    c_birth_month: [0, [Validators.min(1), Validators.max(12)]],
    c_birth_year: [0, [Validators.min(1900)]],
    c_country: [0, Validators.required],
    c_pcell: ['', [Validators.maxLength(13), Validators.pattern(/^[0-9+\-\s]*$/)]],
    c_email: ['', [Validators.required, Validators.email]],
    c_ff: [0],
    c_details: [''],
    c_details1: [''],
    password: ['', [Validators.required, Validators.maxLength(9)]],   // original maxlength=9
    password2: ['', [Validators.required, Validators.maxLength(9)]],
    acceptTerms: [false, Validators.requiredTrue],

    // NEW: a control to hold the File object; required + custom checks in change handler
    c_image: this.fb.control<File | null>(null, []),
    updateOn: 'change'
  }, { validators: passwordMatchValidator });

  
  ngOnInit(): void {
    this.loadFromLocalStorage();
  }
  
  get f() { return this.form.controls; }
  hasUserInStorage = !!localStorage.getItem('user');

  onImageSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] || null;

    this.imageError = '';
    this.imagePreviewUrl = null;

    if (!file) {
      this.f['c_image'].setValue(null);
      //this.f['c_image'].setErrors({ required: true });
      return;
    }

    // Validate mime type
    if (!file.type || !file.type.startsWith('image/')) {
      this.f['c_image'].setValue(null);
      this.f['c_image'].setErrors({ notImage: true });
      this.imageError = 'נא לבחור קובץ תמונה תקין';
      return;
    }

    // Validate size ≤ 256KB
    if (file.size > this.MAX_IMAGE_BYTES) {
      this.f['c_image'].setValue(null);
      this.f['c_image'].setErrors({ tooLarge: true });
      this.imageError = 'גודל התמונה לא יכול לעלות על ‎256KB‎';
      return;
    }

    // All good → store file in the control and show preview
    this.f['c_image'].setErrors(null);
    this.f['c_image'].setValue(file);
    this.imagePreviewUrl = URL.createObjectURL(file);
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

    // Build multipart form data (so the image can be uploaded)
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

    this.submitting.set(true);
    this.serverMsg.set('');

    // NEW: call a FormData-based endpoint
    this.registerSrv.registerFormData(fd).subscribe({
      next: (res) => {
        this.serverMsg.set('נרשמת בהצלחה!');
        this.submitting.set(false);
        console.log('Server response:', res);
          localStorage.setItem('user', JSON.stringify(res.user));
          setTimeout(() => {
            this.router.navigate(['/users']);
          }, 500);
      },
      error: (err) => {
        console.error(err);
        this.serverMsg.set('שגיאה בהרשמה. נסה שוב.');
        this.submitting.set(false);
      }
    });

    // If you prefer to keep your old endpoints around:
    // - form-url-encoded/JSON cannot carry a File; use FormData when uploading files. :contentReference[oaicite:2]{index=2}
  }

    /** Load partial user data from localStorage['user'] if present and valid JSON. */
  private loadFromLocalStorage(): void {
  const raw = localStorage.getItem('user');

  if (!raw) {
     // localStorage not set → image required
     this.f['c_image'].setValidators([
     Validators.required,
     fileMimeTypeValidator(/^image\//),
     fileMaxSizeValidator(this.MAX_IMAGE_BYTES),
     ]);
    this.f['c_image'].updateValueAndValidity({ emitEvent: false });
    return;
  }

  try {
  const parsed = JSON.parse(raw) as Partial<IRegisterPayload> | null;
  if (!parsed || typeof parsed !== 'object') return;

  // Patch only the fields we allow to pre-fill. Keep passwords & acceptTerms empty for security.
  this.form.patchValue({
    c_name: parsed.c_name ?? this.form.value.c_name,
    c_gender: parsed.c_gender ??  this.form.value.c_gender,
    c_birth_day: parsed.c_birth_day ? parsed.c_birth_day as number: this.form.value.c_birth_day as unknown as number,
    c_birth_month: parsed.c_birth_month ? parsed.c_birth_month as number : this.form.value.c_birth_month as unknown as number,
    c_birth_year: parsed.c_birth_year ? parsed.c_birth_year  as number : this.form.value.c_birth_year as unknown as number,
    c_country: parsed.c_country ?? this.form.value.c_country,
    c_pcell: parsed.c_pcell ?? this.form.value.c_pcell,
    c_email: parsed.c_email ?? this.form.value.c_email,
    c_ff: parsed.c_ff ?? this.form.value.c_ff,
    c_details: parsed.c_details ?? this.form.value.c_details,
    c_details1: parsed.c_details1 ?? this.form.value.c_details1,
    password: parsed.password2 ?? this.form.value.password,
    password2: parsed.password2 ?? this.form.value.password2,
    }, { emitEvent: false });
    } catch (err) {
      console.warn('Invalid JSON in localStorage[\'user\'] — ignoring.', err);
    }
  }


  debugFormErrors() {
  const invalid = Object.keys(this.form.controls)
    .filter(key => this.form.controls[key].invalid)
    .reduce((acc, key) => {
      acc[key] = this.form.controls[key].errors;
      return acc;
    }, {} as Record<string, any>);

  console.log('Invalid controls:', invalid);
}

}
