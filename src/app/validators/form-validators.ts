import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

export function hebrewNameValidator(ctrl: AbstractControl): ValidationErrors | null {
  const v = (ctrl.value ?? '').trim();
  if (!v) return { required: true };
  // Hebrew letters + spaces and hyphens
  return /^[א-ת\s'-]+$/.test(v) ? null : { hebrewOnly: true };
}

export function passwordMatchValidator(group: AbstractControl): ValidationErrors | null {
  const p1 = group.get('password')?.value ?? '';
  const p2 = group.get('password2')?.value ?? '';
  return p1 === p2 ? null : { passwordMismatch: true };
}


/**
 * Ensures that if both min and max ages are provided,
 * then min <= max. Expects controls named 'c_ages1' & 'c_ages2'.
 */
export function rangeValidator(minCtl: string = 'c_ages1', maxCtl: string = 'c_ages2'): ValidatorFn {
  return (group: AbstractControl): ValidationErrors | null => {
    const min = group.get(minCtl)?.value ?? 0;
    const max = group.get(maxCtl)?.value ?? 0;

    // If both non-zero and min > max → invalid
    if (min && max && min > max) {
      if(minCtl.indexOf("age")!==-1 && maxCtl.indexOf("age")!==-1)
        return { ageRangeInvalid: true };
      else
        return { heightRangeInvalid: true }; 
    }
    return null;
  };
}
