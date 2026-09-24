import { useMemo } from 'react';
import { buildEuer } from '../domain/euer';
import { formatCents } from '../domain/money';
import { buildUstva } from '../domain/ustva';
import { periodOf } from '../domain/period';
import type { Ledger } from '../useLedger';

export function Dashboard({ ledger }: { ledger: Ledger }) {
  const { entries, settings } = ledger;
  const today = new Date().toISOString().slice(0, 10);
  const year = Number(today.slice(0, 4));
  const euer = useMemo(() => buildEuer(entries, year), [entries, year]);
  const quarter = periodOf(today, true);
  const ustva = useMemo(() => buildUstva(entries, quarter, settings), [entries, quarter, settings]);

  const bySource = useMemo(() => {
    const m: Record<string, number> = {};
    for (const e of entries) if (e.kind === 'income' && e.date.startsWith(String(year))) m[e.source] = (m[e.source] ?? 0) + e.netCents;
    return m;
  }, [entries, year]);

  return (
    <section>
      <div className="tiles">
        <Tile label={`Einnahmen ${year}`} value={formatCents(euer.incomeTotal)} />
        <Tile label={`Ausgaben ${year}`} value={formatCents(euer.expenseTotal)} />
        <Tile label={`Gewinn ${year}`} value={formatCents(euer.profit)} strong />
        <Tile label={`USt-Saldo ${quarter}`} value={formatCents(ustva.zahllast)} />
      </div>
      <h2>Erlöse {year} nach Quelle</h2>
      <table>
        <tbody>
          {Object.entries(bySource).map(([src, cents]) => (
            <tr key={src}>
              <td>{src === 'apple' ? 'App Store' : src === 'google' ? 'Google Play' : 'Manuell'}</td>
              <td className="num">{formatCents(cents)}</td>
            </tr>
          ))}
          {Object.keys(bySource).length === 0 && (
            <tr>
              <td>Noch keine Erlöse. Starte mit „Import“.</td>
            </tr>
          )}
        </tbody>
      </table>
    </section>
  );
}

function Tile({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`tile ${strong ? 'strong' : ''}`}>
      <span>{label}</span>
      <b>{value}</b>
    </div>
  );
}
