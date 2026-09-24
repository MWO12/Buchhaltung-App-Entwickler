import type { Entry } from './types';

const HEADER = [
  'Nr', 'Zahlungsdatum', 'Leistungsdatum', 'Art', 'Kategorie', 'USt-Fall', 'Netto', 'USt', 'Bemessungsgrundlage',
  'Partner', 'Land', 'USt-IdNr', 'Text', 'Beleg', 'Quelle', 'Originalbetrag', 'Waehrung', 'Kurs', 'Storno von', 'Hash',
];

function cell(v: string | number | undefined): string {
  const s = v === undefined ? '' : String(v);
  return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const dec = (cents: number) => (cents / 100).toFixed(2).replace('.', ',');

/** Semikolon-getrennter Export (deutsches Excel-Format) inkl. Hash für die Prüfbarkeit. */
export function entriesToCsv(entries: Entry[]): string {
  const bySeq = new Map(entries.map((e) => [e.id, e.seq]));
  const lines = [...entries]
    .sort((a, b) => a.seq - b.seq)
    .map((e) =>
      [
        e.seq, e.date, e.serviceDate, e.kind, e.category, e.taxCase, dec(e.netCents), dec(e.vatCents),
        dec(e.taxBaseCents), e.counterparty.name, e.counterparty.country, e.counterparty.vatId, e.description,
        e.reference, e.source, e.original?.amount, e.original?.currency, e.original?.unitsPerEur,
        e.reversalOf ? bySeq.get(e.reversalOf) : undefined, e.hash,
      ]
        .map(cell)
        .join(';'),
    );
  return '﻿' + [HEADER.join(';'), ...lines].join('\r\n');
}
