import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { SmsUpdatesService } from '../../services/sms-updates.service';
import { firstValueFrom } from 'rxjs';
import { Router } from '@angular/router';

type FormState = {
  fullName: string;
  email: string;
  phone: string;
  personalEmailNote: string;
  ageChecks: boolean[];     // multi checkbox
  consentInfo: boolean;
  consentSignature: boolean;
};

type TouchedState = {
  fullName: boolean;
  email: boolean;
  phone: boolean;
  personalEmailNote: boolean;
  ages: boolean;
  consentInfo: boolean;
  consentSignature: boolean;
};

@Component({
  selector: 'app-sms-updates-signal-form',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './sms-updates-signal-form.component.html',
  styleUrls: ['./sms-updates-signal-form.component.scss'],
})
export class SmsUpdatesSignalFormComponent {
  // ---- options (from your Google Form) ----
  ageOptions = [
    'קבוצת גיל 32-43',
    'קבוצת גיל עד 40',
    'קבוצת גיל עד 49',
    'קבוצת גיל 45-55',
    'קבוצת גיל עד 59',
    'קבוצת גיל עד 67',
    'קבוצת גיל 67 ומעלה',
    'אירועים להורים וילדים גרושים\\יחידנים',
    'טיולים למטיבי לכת (12 ק"מ ומעלה,הרבה טיפוס)',
  ];

  // ---- state ----
  form = signal<FormState>({
    fullName: '',
    email: '',
    phone: '',
    personalEmailNote: '',
    ageChecks: this.ageOptions.map(() => false),
    consentInfo: false,
    consentSignature: false,
  });

  touched = signal<TouchedState>({
    fullName: false,
    email: false,
    phone: false,
    personalEmailNote: false,
    ages: false,
    consentInfo: false,
    consentSignature: false,
  });

  submitting = signal(false);
  sent = signal(false);
  error = signal<string>('');

  smsUpdatesSvc = inject(SmsUpdatesService);
  router= inject(Router);
  
  // ---- helpers ----
  private emailOk(v: string) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
  }

  private phoneOk(v: string) {
    // simple Israeli-like / general phone rule
    return /^[0-9+\-()\s]{8,}$/.test(v.trim());
  }

  selectedAges = computed(() => {
    const s = this.form();
    return this.ageOptions.filter((_, i) => s.ageChecks[i]);
  });

  // ---- validations (computed) ----
  fullNameErr = computed(() => {
    const v = this.form().fullName.trim();
    if (!v) return 'חובה להזין שם מלא';
    if (v.length < 2) return 'שם קצר מדי';
    return '';
  });

  emailErr = computed(() => {
    const v = this.form().email.trim();
    if (!v) return 'חובה להזין מייל';
    if (!this.emailOk(v)) return 'כתובת מייל לא תקינה';
    return '';
  });

  phoneErr = computed(() => {
    const v = this.form().phone.trim();
    if (!v) return 'חובה להזין נייד';
    if (!this.phoneOk(v)) return 'מספר טלפון לא תקין';
    return '';
  });

  agesErr = computed(() => {
    const any = this.form().ageChecks.some(Boolean);
    return any ? '' : 'חובה לבחור לפחות אפשרות אחת';
  });

  personalEmailNoteErr = computed(() => {
    const v = this.form().personalEmailNote.trim();
    if (!v) return 'חובה למלא שדה זה';
    if (v.length < 2) return 'קצר מדי';
    return '';
  });

  consentInfoErr = computed(() => (this.form().consentInfo ? '' : 'חובה לאשר'));
  consentSignatureErr = computed(() => (this.form().consentSignature ? '' : 'חובה לאשר'));

  isValid = computed(() => {
    return (
      !this.fullNameErr() &&
      !this.emailErr() &&
      !this.phoneErr() &&
      !this.agesErr() &&
      !this.personalEmailNoteErr() &&
      !this.consentInfoErr() &&
      !this.consentSignatureErr()
    );
  });

  canSubmit = computed(() => this.isValid() && !this.submitting());

  // ---- setters ----
  setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    this.form.update(s => ({ ...s, [key]: value }));
  }

  markTouched<K extends keyof TouchedState>(key: K) {
    this.touched.update(t => ({ ...t, [key]: true }));
  }

  toggleAge(i: number) {
    this.markTouched('ages');
    this.form.update(s => {
      const next = s.ageChecks.slice();
      next[i] = !next[i];
      return { ...s, ageChecks: next };
    });
  }

  // ---- submit ----
  async submit() {
    this.error.set('');
    this.sent.set(false);

    // mark all touched so errors show
    this.touched.set({
      fullName: true,
      email: true,
      phone: true,
      personalEmailNote: true,
      ages: true,
      consentInfo: true,
      consentSignature: true,
    });

    if (!this.isValid()) return;

    const payload = {
      fullName: this.form().fullName.trim(),
      email: this.form().email.trim(),
      phone: this.form().phone.trim(),
      ageGroups: this.selectedAges(),
      personalEmailNote: this.form().personalEmailNote.trim(),
      consentInfo: true,
      consentSignature: true,
    };

    try {
      this.submitting.set(true);

      await firstValueFrom(this.smsUpdatesSvc.setFormData(payload));
      
      this.sent.set(true);
      // reset
      this.form.set({
        fullName: '',
        email: '',
        phone: '',
        personalEmailNote: '',
        ageChecks: this.ageOptions.map(() => false),
        consentInfo: false,
        consentSignature: false,
      });
      this.touched.set({
        fullName: false,
        email: false,
        phone: false,
        personalEmailNote: false,
        ages: false,
        consentInfo: false,
        consentSignature: false,
      });
      setTimeout(() => this.router.navigate(['/home']), 500);
    } catch (e) {
      this.error.set('שגיאה בשליחה. נסה שוב.');
    } finally {
      this.submitting.set(false);
    }
  }
}
