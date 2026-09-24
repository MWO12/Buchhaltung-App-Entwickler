import { KNOWN_PARTIES } from '../domain/tax';
import { microToEurCents } from '../domain/money';
import { monthKey } from '../domain/period';
import type { EntryDraft, Settings } from '../domain/types';
import type { CurrencyGroup, ImportResult } from './types';

export function fxKey(yyyyMm: string, currency: string): string {
  return `${yyyyMm}:${currency}`;
}

/**
 * EUR-Betrag einer Währungsgruppe nach Monatskurs (§16 Abs. 6 UStG) des Leistungsmonats.
 * null, wenn kein Kurs hinterlegt ist.
 */
export function groupToEurCents(g: CurrencyGroup, periodEnd: string, fxRates: Settings['fxRates']): number | null {
  if (g.currency === 'EUR') return Math.round(g.micro / 100);
  const rate = fxRates[fxKey(monthKey(periodEnd), g.currency)];
  return rate ? microToEurCents(g.micro, rate) : null;
}

export interface GroupBooking {
  group: CurrencyGroup;
  /** USt-Bemessungsgrundlage (Monatskurs) */
  taxBaseCents: number;
  /** Tatsächlich zugeflossener EUR-Betrag laut Kontoauszug (EÜR); Default = taxBaseCents */
  receivedCents: number;
}

export function importToDrafts(
  result: ImportResult,
  bookings: GroupBooking[],
  payoutDate: string,
  fxRates: Settings['fxRates'],
): EntryDraft[] {
  const party = KNOWN_PARTIES[result.source];
  const store = result.source === 'apple' ? 'App Store' : 'Google Play';
  return bookings.map(({ group, taxBaseCents, receivedCents }) => ({
    date: payoutDate,
    serviceDate: result.periodEnd,
    kind: 'income',
    category: 'erloese_appstores',
    taxCase: 'EU_B2B_OUT',
    netCents: receivedCents,
    vatCents: 0,
    taxBaseCents,
    counterparty: { ...party },
    description: `${store} Erlöse ${result.periodStart} – ${result.periodEnd} (${group.currency})`,
    source: result.source,
    reference: result.fileName,
    original:
      group.currency === 'EUR'
        ? undefined
        : {
            amount: (group.micro / 10_000).toFixed(2),
            currency: group.currency,
            unitsPerEur: fxRates[fxKey(monthKey(result.periodEnd), group.currency)],
          },
  }));
}
