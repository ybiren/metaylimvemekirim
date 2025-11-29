// src/app/consts/smoking-status.consts.ts

import { eSmokingStatus } from "../enums/smoking-status.enums";
import { InjectionToken } from "@angular/core";
import { IOption } from "../interfaces";

export const smokingStatus: IOption[] = [
  { txt: 'לא מעשן',             val: eSmokingStatus.NonSmoker },
  { txt: 'מעשן',                val: eSmokingStatus.Smoker },
  { txt: 'רק באירועים מיוחדים', val: eSmokingStatus.Occasional },
  { txt: 'מנסה להפסיק',         val: eSmokingStatus.TryingToQuit }
];

export const SMOKING_STATUS_TOKEN =
  new InjectionToken<readonly IOption[]>('SMOKING_STATUS_TOKEN');
