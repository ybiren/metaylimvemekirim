import { eRegions } from "../enums/regions.enums";
import { InjectionToken } from '@angular/core';
import { IOption } from "../interfaces";

export const regions:IOption[] = [
    {"txt" : 'כל הארץ',"val": eRegions.AllCountry},
    {"txt": 'תל אביב מרכז', "val": eRegions.TelAviv},
    {"txt":'חיפה והקריות', "val": eRegions.Haifa},
    {"txt": 'ירושלים והסביבה', "val": eRegions.Jerusalem},
    {"txt": 'השרון', "val": eRegions.Sharon},
    {"txt": 'השפלה', "val": eRegions.Shfela},
    {"txt":'אשדוד אשקלון', "val":eRegions.AshdodAshkelon},
    {"txt": 'אילת', "val": eRegions.Eilat},
    {"txt": 'באר שבע והסביבה', "val": eRegions.BeerSheva},
    {"txt": 'ערבה', "val": eRegions.Arava},
    {"txt": 'צפון', "val": eRegions.North }
  ];

  export const REGIONS_TOKEN = new InjectionToken<readonly IOption[]>(
  'REGIONS_TOKEN'
);
