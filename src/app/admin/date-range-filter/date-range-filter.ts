import { IDoesFilterPassParams, IFilterComp, IFilterParams } from 'ag-grid-community';

type DateRangeKey = 'TODAY' | 'WEEK' | 'MONTH' | 'YEAR';

export class DateRangeSetFilter implements IFilterComp {
  private params!: IFilterParams;
  private model: DateRangeKey | null = null;

  init(params: IFilterParams): void {
    this.params = params;
  }

  getModel() {
    return this.model;
  }

  setModel(model: any) {
    this.model = (model ?? null) as DateRangeKey | null;
  }

  isFilterActive(): boolean {
    return this.model != null;
  }

  doesFilterPass(p: IDoesFilterPassParams): boolean {
    if (!this.model) return true;

    const value = this.params.getValue(p.node) as string | null | undefined;
    if (!value) return false;

    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return false;

    const now = new Date();

    const isToday =
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate();

    const startOfWeek = new Date(now);
    startOfWeek.setHours(0, 0, 0, 0);
    startOfWeek.setDate(now.getDate() - now.getDay()); // Sunday

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 7);

    const inWeek = d >= startOfWeek && d < endOfWeek;
    const inMonth = d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    const inYear = d.getFullYear() === now.getFullYear();

    switch (this.model) {
      case 'TODAY': return isToday;
      case 'WEEK': return inWeek;
      case 'MONTH': return inMonth;
      case 'YEAR': return inYear;
      default: return true;
    }
  }

  getGui(): HTMLElement {
    // לא צריך GUI כי יש לנו floating filter
    const e = document.createElement('div');
    return e;
  }
}