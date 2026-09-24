import type { Category, Entry } from './types';
import { CATEGORIES, TAX_CASES } from './tax';
import { yearOf } from './period';

export interface EuerReport {
  year: number;
  incomeByCategory: Partial<Record<Category, number>>;
  vatReceived: number;
  incomeTotal: number;
  expenseByCategory: Partial<Record<Category, number>>;
  vatPaid: number;
  expenseTotal: number;
  profit: number;
}

/**
 * Einnahmen-Überschuss-Rechnung nach §4 Abs. 3 EStG (Zufluss-/Abflussprinzip, Bruttomethode):
 * vereinnahmte USt ist Betriebseinnahme, gezahlte Vorsteuer und USt-Zahlungen sind Betriebsausgabe.
 * Abschreibungen (AfA) sind im MVP nicht abgebildet.
 */
export function buildEuer(entries: Entry[], year: number): EuerReport {
  const r: EuerReport = {
    year,
    incomeByCategory: {},
    vatReceived: 0,
    incomeTotal: 0,
    expenseByCategory: {},
    vatPaid: 0,
    expenseTotal: 0,
    profit: 0,
  };
  for (const e of entries) {
    if (yearOf(e.date) !== year) continue;
    const cashVat = TAX_CASES[e.taxCase].vatPaidOrReceived ? e.vatCents : 0;
    if (CATEGORIES[e.category].kind === 'income') {
      r.incomeByCategory[e.category] = (r.incomeByCategory[e.category] ?? 0) + e.netCents;
      r.vatReceived += cashVat;
    } else {
      r.expenseByCategory[e.category] = (r.expenseByCategory[e.category] ?? 0) + e.netCents;
      r.vatPaid += cashVat;
    }
  }
  const sum = (o: Partial<Record<Category, number>>) => Object.values(o).reduce((a, b) => a + (b ?? 0), 0);
  r.incomeTotal = sum(r.incomeByCategory) + r.vatReceived;
  r.expenseTotal = sum(r.expenseByCategory) + r.vatPaid;
  r.profit = r.incomeTotal - r.expenseTotal;
  return r;
}
