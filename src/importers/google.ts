import { parseDecimalMicro } from '../domain/money';
import { col, readTable } from './csv';
import type { CurrencyGroup, ImportResult } from './types';

const MONTHS: Record<string, string> = {
  Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06',
  Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12',
};

/** "Sep 1, 2026" oder "2026-09-01" → "YYYY-MM-DD" */
function googleDate(s: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = /^([A-Z][a-z]{2})\s+(\d{1,2}),\s*(\d{4})$/.exec(s);
  if (!m || !MONTHS[m[1]]) throw new Error(`Unbekanntes Datumsformat: ${s}`);
  return `${m[3]}-${MONTHS[m[1]]}-${m[2].padStart(2, '0')}`;
}

/**
 * Google Play Console → Download reports → Financial → Earnings (earnings_YYYYMM_*.csv).
 * Summiert "Amount (Merchant Currency)" über alle Transaktionsarten
 * (Charge, Google fee, Charge refund, Google fee refund, Tax …) = Auszahlungsbetrag.
 */
export function parseGoogleEarningsReport(text: string, fileName: string): ImportResult {
  const { header, rows } = readTable(text, ['Transaction Type', 'Amount (Merchant Currency)']);
  const iDate = col(header, 'Transaction Date');
  const iType = col(header, 'Transaction Type');
  const iCur = col(header, 'Merchant Currency');
  const iAmt = col(header, 'Amount (Merchant Currency)');

  const groups = new Map<string, CurrencyGroup>();
  const warnings: string[] = [];
  let start = '';
  let end = '';

  for (const r of rows) {
    if (r.length < header.length || !r[iCur]) continue;
    const d = googleDate(r[iDate]);
    if (!start || d < start) start = d;
    if (!end || d > end) end = d;

    const cur = r[iCur].toUpperCase();
    const g = groups.get(cur) ?? { currency: cur, micro: 0, units: 0, rows: 0, breakdown: {} };
    const amount = parseDecimalMicro(r[iAmt]);
    const type = r[iType] || 'Unbekannt';
    g.micro += amount;
    g.rows += 1;
    if (type === 'Charge') g.units += 1;
    if (type === 'Charge refund') g.units -= 1;
    g.breakdown![type] = (g.breakdown![type] ?? 0) + amount;
    groups.set(cur, g);
  }

  if (groups.size === 0) throw new Error('Keine Transaktionen im Google-Play-Bericht gefunden');
  if ([...groups.values()].some((g) => g.breakdown?.Tax)) {
    warnings.push('Bericht enthält Tax-Zeilen: Steuerbehandlung dieser Länder mit Steuerberater klären.');
  }
  return {
    source: 'google',
    fileName,
    periodStart: start,
    periodEnd: end,
    groups: [...groups.values()].sort((a, b) => a.currency.localeCompare(b.currency)),
    warnings,
  };
}
