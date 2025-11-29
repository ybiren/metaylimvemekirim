// src/app/consts/children-status.consts.ts

import { eChildrenStatus } from "../enums/children-status.enums";
import { InjectionToken } from "@angular/core";
import { IOption } from "../interfaces";

export const childrenStatus: IOption[] = [
  { txt: 'ללא ילדים',      val: eChildrenStatus.None },
  { txt: 'ילד/ה אחד',      val: eChildrenStatus.One },
  { txt: '2 ילדים',        val: eChildrenStatus.Two },
  { txt: '3 ילדים ומעלה',  val: eChildrenStatus.ThreePlus }
];

export const CHILDREN_STATUS_TOKEN =
  new InjectionToken<readonly IOption[]>('CHILDREN_STATUS_TOKEN');
