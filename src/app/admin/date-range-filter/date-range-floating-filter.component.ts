import { Component } from '@angular/core';
import { IFloatingFilterAngularComp } from 'ag-grid-angular';
import { IFloatingFilterParams } from 'ag-grid-community';

type DateRangeKey = 'ALL' | 'TODAY' | 'WEEK' | 'MONTH' | 'YEAR';

@Component({
  selector: 'date-range-floating-filter',
  standalone: true,
  template: `
    <select class="sel" [value]="value" (change)="onChange($any($event.target).value)">
      <option value="ALL">הכל</option>
      <option value="TODAY">היום</option>
      <option value="WEEK">השבוע</option>
      <option value="MONTH">החודש</option>
      <option value="YEAR">השנה</option>
    </select>
  `,
  styles: [`
    .sel{
      width: 100%;
      height: 28px;
      border: 1px solid #ddd;
      border-radius: 8px;
      padding: 0 8px;
      background: #fff;
      outline: none;
    }
  `],
})
export class DateRangeFloatingFilterComponent
  implements IFloatingFilterAngularComp
{
  params!: IFloatingFilterParams;
  value: DateRangeKey = 'ALL';

  agInit(params: IFloatingFilterParams): void {
    this.params = params;
  }

  // נקרא כשהפילטר “האמיתי” משתנה (למשל מהתפריט)
  onParentModelChanged(parentModel: any): void {
    // אנחנו נשים במודל ערך פשוט: 'TODAY' וכו'
    this.value = (parentModel ?? 'ALL') as DateRangeKey;
  }

  onChange(v: DateRangeKey) {
    this.value = v;

    // מעדכן את הפילטר הראשי של העמודה
    this.params.parentFilterInstance((instance: any) => {
      // כאן אנחנו קובעים "מודל" פשוט שהפילטר שלנו ידע לפרש
      instance.setModel(v === 'ALL' ? null : v);
      this.params.api.onFilterChanged();
    });
  }
}