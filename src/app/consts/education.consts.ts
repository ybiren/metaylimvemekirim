import { eEducation } from "../enums/education.enums";
import { InjectionToken } from '@angular/core';
import { IOption } from "../interfaces";

export const education:IOption[] = [
    {"txt" : 'תיכונית',"val": eEducation.HighSchool},
    {"txt": 'בגרות מלאה', "val": eEducation.Bagrut},
    {"txt": 'הנדסאי\\ת', "val": eEducation.Engineer},
    {"txt": 'תואר ראשון', "val": eEducation.BA},
    {"txt": 'תואר שני', "val": eEducation.MA}    
];

  export const EDUCATION_TOKEN = new InjectionToken<readonly IOption[]>(
  'EDUCATION_TOKEN'
);


 