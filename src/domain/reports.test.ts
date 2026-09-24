import { describe, expect, it } from 'vitest';
import { buildEuer } from './euer';
import { sealEntries } from './ledger';
import { computeVatCents } from './tax';
import { buildUstva, buildZm } from './ustva';
import { DEFAULT_SETTINGS, type EntryDraft, type Settings, type TaxCase } from './types';

function d(taxCase: TaxCase, net: number, over: Partial<EntryDraft> = {}): EntryDraft {
  const income = ['DE_19_OUT', 'DE_7_OUT', 'EU_B2B_OUT', 'NON_EU_OUT'].includes(taxCase);
  return {
    date: '2026-08-15',
    serviceDate: '2026-08-15',
    kind: income ? 'income' : 'expense',
    category: income ? 'erloese_appstores' : 'software_lizenzen',
    taxCase,
    netCents: net,
    vatCents: computeVatCents(taxCase, net, false),
    taxBaseCents: net,
    counterparty: { name: 'X', country: 'DE' },
    description: taxCase,
    source: 'manual',
    ...over,
  };
}

const apple = { name: 'Apple Distribution International Ltd.', country: 'IE', vatId: 'IE9700053D' };

async function sample() {
  return sealEntries(
    [
      d('EU_B2B_OUT', 123_456, { counterparty: apple, date: '2026-10-05', serviceDate: '2026-09-27' }),
      d('DE_19_OUT', 10_000),
      d('RC_EU_IN', 9_300, { counterparty: apple }), // Apple Developer Program
      d('RC_NONEU_IN', 2_000), // US-SaaS
      d('DE_19_IN', 5_000),
      d('NO_VAT', 1_900, { category: 'gebuehren_beitraege' }),
    ],
    undefined,
  );
}

describe('UStVA', () => {
  it('ordnet Kennzahlen zu und berechnet die Zahllast', async () => {
    const entries = await sample();
    const q3 = buildUstva(entries, '2026-Q3', DEFAULT_SETTINGS);
    expect(q3).toMatchObject({
      kz81: 100, tax81: 1900,
      kz21: 1234, // Leistungszeitraum Q3, Zufluss erst im Oktober
      kz46: 93, kz47: 1767,
      kz52: 20, kz53: 380,
      kz66: 950, kz67: 1767 + 380,
    });
    expect(q3.zahllast).toBe(1900 + 1767 + 380 - 950 - 2147);
  });

  it('Istversteuerung verschiebt Inlandsumsätze auf den Zufluss', async () => {
    const entries = await sealEntries([d('DE_19_OUT', 10_000, { date: '2026-10-02', serviceDate: '2026-09-30' })], undefined);
    const ist: Settings = { ...DEFAULT_SETTINGS, istversteuerung: true };
    const soll: Settings = { ...DEFAULT_SETTINGS, istversteuerung: false };
    expect(buildUstva(entries, '2026-Q3', ist).kz81).toBe(0);
    expect(buildUstva(entries, '2026-Q4', ist).kz81).toBe(100);
    expect(buildUstva(entries, '2026-Q3', soll).kz81).toBe(100);
  });

  it('Kleinunternehmer: keine Vorsteuer, §13b-Steuer bleibt', async () => {
    const entries = await sample();
    const ku = buildUstva(entries, '2026-Q3', { ...DEFAULT_SETTINGS, kleinunternehmer: true });
    expect(ku.kz66).toBe(0);
    expect(ku.kz67).toBe(0);
    expect(ku.zahllast).toBe(1767 + 380);
  });

  it('ZM gruppiert nach USt-IdNr. in vollen Euro', async () => {
    const entries = await sample();
    expect(buildZm(entries, '2026-Q3', DEFAULT_SETTINGS)).toEqual([
      { vatId: 'IE9700053D', name: apple.name, amount: 1234, type: 'S' },
    ]);
    expect(buildZm(entries, '2026-Q4', DEFAULT_SETTINGS)).toEqual([]);
  });
});

describe('EÜR', () => {
  it('folgt dem Zuflussprinzip und der Bruttomethode', async () => {
    const entries = await sample();
    const r2026 = buildEuer(entries, 2026);
    expect(r2026.incomeByCategory.erloese_appstores).toBe(123_456 + 10_000);
    expect(r2026.vatReceived).toBe(1_900);
    expect(r2026.vatPaid).toBe(950); // §13b-Steuer fließt nicht ab
    expect(r2026.expenseTotal).toBe(9_300 + 2_000 + 5_000 + 1_900 + 950);
    expect(r2026.profit).toBe(r2026.incomeTotal - r2026.expenseTotal);
    expect(buildEuer(entries, 2025).profit).toBe(0);
  });
});
