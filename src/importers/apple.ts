import { parseDecimalMicro } from '../domain/money';
import { col, optCol, readTable } from './csv';
import type { CurrencyGroup, ImportResult } from './types';

/** "MM/DD/YYYY" → "YYYY-MM-DD" */
function usDate(s: string): string {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s);
  if (!m) throw new Error(`Unbekanntes Datumsformat: ${s}`);
  return `${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`;
}

/**
 * App Store Connect → Zahlungen und Finanzberichte → Finanzbericht (Tab-getrennt, je Region).
 * Summiert "Extended Partner Share" je "Partner Share Currency" (Apple-Erlös nach Provision).
 */
export function parseAppleFinancialReport(text: string, fileName: string): ImportResult {
  const { header, rows } = readTable(text, ['Extended Partner Share', 'Partner Share Currency']);
  const iStart = col(header, 'Start Date');
  const iEnd = col(header, 'End Date');
  const iQty = col(header, 'Quantity');
  const iExt = col(header, 'Extended Partner Share');
  const iCur = col(header, 'Partner Share Currency');
  const iType = optCol(header, 'Sales or Return');

  const groups = new Map<string, CurrencyGroup>();
  const warnings: string[] = [];
  let start = '';
  let end = '';

  for (const r of rows) {
    // Fußzeilen ("Total_Rows", "Total_Amount", "Total_Units") beenden die Datenzeilen
    if (/^Total_/.test(r[0] ?? '')) break;
    if (r.length < header.length || !r[iCur]) continue;
    const s = usDate(r[iStart]);
    const e = usDate(r[iEnd]);
    if (!start || s < start) start = s;
    if (!end || e > end) end = e;

    const cur = r[iCur].toUpperCase();
    const g = groups.get(cur) ?? { currency: cur, micro: 0, units: 0, rows: 0, breakdown: {} };
    const amount = parseDecimalMicro(r[iExt]);
    g.micro += amount;
    g.units += Number(r[iQty]) || 0;
    g.rows += 1;
    const type = iType >= 0 && r[iType] === 'R' ? 'Rückerstattungen' : 'Verkäufe';
    g.breakdown![type] = (g.breakdown![type] ?? 0) + amount;
    groups.set(cur, g);
  }

  if (groups.size === 0) throw new Error('Keine Umsatzzeilen im Apple-Bericht gefunden');
  return {
    source: 'apple',
    fileName,
    periodStart: start,
    periodEnd: end,
    groups: [...groups.values()].sort((a, b) => a.currency.localeCompare(b.currency)),
    warnings,
  };
}
