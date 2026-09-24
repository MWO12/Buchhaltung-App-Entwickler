import type { Entry, Settings } from './types';
import { TAX_CASES } from './tax';
import { periodOf, type Period } from './period';
import { toFullEuros } from './money';

export interface UstvaReport {
  period: Period;
  /** Bemessungsgrundlagen in vollen Euro */
  kz81: number;
  kz86: number;
  kz21: number;
  kz45: number;
  kz46: number;
  kz52: number;
  /** Steuerbeträge in Cent */
  tax81: number;
  tax86: number;
  kz47: number;
  kz53: number;
  kz66: number;
  kz67: number;
  /** Verbleibende Vorauszahlung (positiv) bzw. Erstattung (negativ) in Cent */
  zahllast: number;
}

export interface ZmLine {
  vatId: string;
  name: string;
  /** Summe der Bemessungsgrundlagen in vollen Euro */
  amount: number;
  type: 'S'; // sonstige Leistung
}

/**
 * Zeitpunkt der USt-Entstehung: Inlandsumsätze bei Istversteuerung mit Zahlungseingang,
 * sonst (Sollversteuerung, §13b, innergemeinschaftliche sonstige Leistungen, Vorsteuer) mit Leistung.
 */
export function taxDate(e: Entry, settings: Settings): string {
  const info = TAX_CASES[e.taxCase];
  const domesticOut = info.kind === 'income' && info.rate > 0;
  return domesticOut && settings.istversteuerung ? e.date : e.serviceDate;
}

export function buildUstva(entries: Entry[], period: Period, settings: Settings): UstvaReport {
  const quarterly = period.includes('Q');
  const base = { kz81: 0, kz86: 0, kz21: 0, kz45: 0, kz46: 0, kz52: 0 };
  const r: UstvaReport = { period, ...base, tax81: 0, tax86: 0, kz47: 0, kz53: 0, kz66: 0, kz67: 0, zahllast: 0 };
  for (const e of entries) {
    if (periodOf(taxDate(e, settings), quarterly) !== period) continue;
    const info = TAX_CASES[e.taxCase];
    if (info.baseKz) {
      if (info.baseKz === '81' || info.baseKz === '86') {
        if (settings.kleinunternehmer) continue;
        r[`tax${info.baseKz}`] += e.vatCents;
      }
      base[`kz${info.baseKz}`] += e.taxBaseCents;
    }
    if (info.taxKz) r[`kz${info.taxKz}`] += e.vatCents;
    if (info.inputKz && !settings.kleinunternehmer) r[`kz${info.inputKz}`] += e.vatCents;
  }
  for (const k of Object.keys(base) as (keyof typeof base)[]) r[k] = toFullEuros(base[k]);
  r.zahllast = r.tax81 + r.tax86 + r.kz47 + r.kz53 - r.kz66 - r.kz67;
  return r;
}

export function buildZm(entries: Entry[], period: Period, settings: Settings): ZmLine[] {
  const quarterly = period.includes('Q');
  const byVat = new Map<string, { name: string; cents: number }>();
  for (const e of entries) {
    if (!TAX_CASES[e.taxCase].zm) continue;
    if (periodOf(taxDate(e, settings), quarterly) !== period) continue;
    const key = e.counterparty.vatId ?? '';
    const cur = byVat.get(key) ?? { name: e.counterparty.name, cents: 0 };
    cur.cents += e.taxBaseCents;
    byVat.set(key, cur);
  }
  return [...byVat.entries()]
    .map(([vatId, v]) => ({ vatId, name: v.name, amount: toFullEuros(v.cents), type: 'S' as const }))
    .filter((l) => l.amount !== 0)
    .sort((a, b) => a.vatId.localeCompare(b.vatId));
}

export function periodsWithData(entries: Entry[], settings: Settings, quarterly: boolean): Period[] {
  return [...new Set(entries.map((e) => periodOf(taxDate(e, settings), quarterly)))].sort().reverse();
}
