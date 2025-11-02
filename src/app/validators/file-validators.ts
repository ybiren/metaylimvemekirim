// validators/file-validators.ts (or inside your component file)
import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

export function fileMaxSizeValidator(maxBytes: number): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const file = control.value as File | null;
    if (!file) return null;                // 'required' handles empty
    return file.size > maxBytes
      ? { tooLarge: { maxBytes, actual: file.size } }
      : null;
  };
}

export function fileMimeTypeValidator(rx: RegExp): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const file = control.value as File | null;
    if (!file) return null;
    const t = file.type || '';
    return rx.test(t) ? null : { mimeType: { requiredPattern: rx.source, actual: t } };
  };
}
