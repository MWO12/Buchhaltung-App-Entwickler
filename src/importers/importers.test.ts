import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseReport } from './detect';
import { groupToEurCents, importToDrafts } from './toDrafts';

const fixture = (name: string) => readFileSync(new URL(`../../test/fixtures/${name}`, import.meta.url), 'utf8');

describe('Apple-Finanzbericht', () => {
  const r = parseReport(fixture('apple_financial_report.txt'), 'apple.txt');
  it('summiert Extended Partner Share je Währung', () => {
    expect(r.source).toBe('apple');
    expect(r.periodStart).toBe('2026-08-31');
    expect(r.periodEnd).toBe('2026-10-04');
    expect(r.groups).toHaveLength(1);
    expect(r.groups[0]).toMatchObject({ currency: 'USD', micro: 373_800, units: 12, rows: 3 });
    expect(r.groups[0].breakdown).toEqual({ Verkäufe: 408_700, Rückerstattungen: -34_900 });
  });
  it('rechnet mit Monatskurs des Leistungsmonats um und erzeugt Reverse-Charge-Buchung', () => {
    const rates = { '2026-10:USD': 1.1 };
    const eur = groupToEurCents(r.groups[0], r.periodEnd, rates);
    expect(eur).toBe(3398); // 37,38 USD / 1,1 = 33,98 EUR
    expect(groupToEurCents(r.groups[0], r.periodEnd, {})).toBeNull();
    const [draft] = importToDrafts(r, [{ group: r.groups[0], taxBaseCents: 3398, receivedCents: 3401 }], '2026-11-05', rates);
    expect(draft).toMatchObject({
      taxCase: 'EU_B2B_OUT',
      netCents: 3401,
      taxBaseCents: 3398,
      date: '2026-11-05',
      serviceDate: '2026-10-04',
      counterparty: { vatId: 'IE9700053D' },
      original: { amount: '37.38', currency: 'USD', unitsPerEur: 1.1 },
    });
  });
});

describe('Google-Play-Earnings', () => {
  const r = parseReport(fixture('google_earnings.csv'), 'earnings.csv');
  it('summiert Auszahlungsbetrag inkl. Gebühren und Erstattungen', () => {
    expect(r.source).toBe('google');
    expect(r.periodStart).toBe('2026-09-01');
    expect(r.periodEnd).toBe('2026-09-20');
    expect(r.groups[0]).toMatchObject({ currency: 'EUR', micro: 8_492_500, units: 1 });
    expect(r.groups[0].breakdown).toEqual({ Charge: 10_049_900, 'Google fee': -1_507_500, 'Charge refund': -49_900 });
    expect(groupToEurCents(r.groups[0], r.periodEnd, {})).toBe(84_925);
  });
});

it('lehnt unbekannte Formate ab', () => {
  expect(() => parseReport('a,b,c\n1,2,3', 'x.csv')).toThrow(/nicht erkannt/);
});
