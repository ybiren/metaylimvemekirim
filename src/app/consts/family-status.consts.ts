import { eFamilyStatus } from "../enums/family-status.enums";
import { InjectionToken } from '@angular/core';
import { IOption } from "../interfaces";

export const familyStatus:IOption[] = [
    {"txt" : 'רווק\\רווקה',"val": eFamilyStatus.Bachelor},
    {"txt": 'גרוש\\גרושה', "val": eFamilyStatus.Divorced},
    {"txt": 'פרוד\\פרודה', "val": eFamilyStatus.Seperated},
    {"txt": 'אלמן\\אלמנה', "val": eFamilyStatus.Widow},
    {"txt": 'נשוי\\נשואה', "val": eFamilyStatus.Married}    
];

  export const FAMILY_STATUS_TOKEN = new InjectionToken<readonly IOption[]>(
  'FAMILY_STATUS_TOKEN'
);
