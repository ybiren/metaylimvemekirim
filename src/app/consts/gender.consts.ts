import { eGender } from "../enums/gender.enums";
import { InjectionToken } from '@angular/core';
import { IOption } from "../interfaces";

export const gender:IOption[] = [
    {"txt" : 'זכר',"val": eGender.Male},
    {"txt": 'נקבה', "val": eGender.Female},
  ];

  export const GENDER_TOKEN = new InjectionToken<readonly IOption[]>(
  'GENDER_TOKEN'
);
