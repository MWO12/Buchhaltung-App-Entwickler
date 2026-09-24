import { describe, expect, it } from 'vitest';
import { reversalDraft, sealEntries, verifyChain } from './ledger';
import type { EntryDraft } from './types';

const draft = (net: number, text = 'Test'): EntryDraft => ({
  date: '2026-09-01',
  serviceDate: '2026-09-01',
  kind: 'expense',
  category: 'software_lizenzen',
  taxCase: 'DE_19_IN',
  netCents: net,
  vatCents: Math.round(net * 0.19),
  taxBaseCents: net,
  counterparty: { name: 'ACME GmbH', country: 'DE' },
  description: text,
  source: 'manual',
});

describe('ledger', () => {
  it('verkettet Buchungen und erkennt Manipulation', async () => {
    const first = await sealEntries([draft(1000), draft(2000)], undefined);
    const more = await sealEntries([draft(3000)], first[1]);
    const all = [...first, ...more];
    expect(all.map((e) => e.seq)).toEqual([1, 2, 3]);
    expect(await verifyChain(all)).toEqual({ ok: true });

    const tampered = all.map((e) => (e.seq === 2 ? { ...e, netCents: 1 } : e));
    expect(await verifyChain(tampered)).toMatchObject({ ok: false, brokenAtSeq: 2 });
    expect(await verifyChain([all[0], all[2]])).toMatchObject({ ok: false, brokenAtSeq: 3 });
  });

  it('erzeugt Storno mit umgekehrtem Vorzeichen', async () => {
    const [e] = await sealEntries([draft(1000)], undefined);
    const r = reversalDraft(e, '2026-09-02');
    expect(r).toMatchObject({ netCents: -1000, vatCents: -190, taxBaseCents: -1000, reversalOf: e.id });
  });

  it('lehnt ungültige Buchungen ab', async () => {
    await expect(sealEntries([{ ...draft(1000), netCents: 10.5 }], undefined)).rejects.toThrow();
    await expect(sealEntries([{ ...draft(1000), date: '01.09.2026' }], undefined)).rejects.toThrow();
  });
});
