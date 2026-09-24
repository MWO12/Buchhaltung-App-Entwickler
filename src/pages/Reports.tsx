import { useMemo, useState } from 'react';
import { buildEuer } from '../domain/euer';
import { formatCents } from '../domain/money';
import { CATEGORIES } from '../domain/tax';
import { buildUstva, buildZm, periodsWithData } from '../domain/ustva';
import { periodOf, yearOf } from '../domain/period';
import type { Category } from '../domain/types';
import type { Ledger } from '../useLedger';

const eur = (n: number) => `${n.toLocaleString('de-DE')} €`;

export function Reports({ ledger }: { ledger: Ledger }) {
  const { entries, settings } = ledger;
  const todayStr = new Date().toISOString().slice(0, 10);
  const years = useMemo(() => {
    const ys = new Set(entries.map((e) => yearOf(e.date)));
    ys.add(yearOf(todayStr));
    return [...ys].sort((a, b) => b - a);
  }, [entries, todayStr]);
  const [year, setYear] = useState(years[0]);
  const [quarterly, setQuarterly] = useState(true);
  const periods = useMemo(() => {
    const ps = new Set(periodsWithData(entries, settings, quarterly));
    ps.add(periodOf(todayStr, quarterly));
    return [...ps].sort().reverse();
  }, [entries, settings, quarterly, todayStr]);
  const [period, setPeriod] = useState('');
  const activePeriod = periods.includes(period) ? period : periods[0];

  const euer = useMemo(() => buildEuer(entries, year), [entries, year]);
  const ustva = useMemo(() => buildUstva(entries, activePeriod, settings), [entries, activePeriod, settings]);
  const zm = useMemo(() => buildZm(entries, activePeriod, settings), [entries, activePeriod, settings]);

  return (
    <section>
      <h2>Einnahmen-Überschuss-Rechnung</h2>
      <select value={year} onChange={(e) => setYear(Number(e.target.value))}>
        {years.map((y) => (
          <option key={y}>{y}</option>
        ))}
      </select>
      <table>
        <tbody>
          <tr className="head">
            <td>Betriebseinnahmen</td>
            <td />
          </tr>
          {rows(euer.incomeByCategory)}
          <tr>
            <td>Vereinnahmte Umsatzsteuer</td>
            <td className="num">{formatCents(euer.vatReceived)}</td>
          </tr>
          <tr className="sum">
            <td>Summe Einnahmen</td>
            <td className="num">{formatCents(euer.incomeTotal)}</td>
          </tr>
          <tr className="head">
            <td>Betriebsausgaben</td>
            <td />
          </tr>
          {rows(euer.expenseByCategory)}
          <tr>
            <td>Gezahlte Vorsteuer</td>
            <td className="num">{formatCents(euer.vatPaid)}</td>
          </tr>
          <tr className="sum">
            <td>Summe Ausgaben</td>
            <td className="num">{formatCents(euer.expenseTotal)}</td>
          </tr>
          <tr className="sum strong">
            <td>Gewinn / Verlust</td>
            <td className="num">{formatCents(euer.profit)}</td>
          </tr>
        </tbody>
      </table>
      <p className="hint">Abschreibungen (AfA) und Privatanteile sind im MVP nicht enthalten.</p>

      <h2>Umsatzsteuer-Voranmeldung</h2>
      <div className="row">
        <select value={quarterly ? 'q' : 'm'} onChange={(e) => setQuarterly(e.target.value === 'q')}>
          <option value="q">Quartal</option>
          <option value="m">Monat</option>
        </select>
        <select value={activePeriod} onChange={(e) => setPeriod(e.target.value)}>
          {periods.map((p) => (
            <option key={p}>{p}</option>
          ))}
        </select>
      </div>
      <table>
        <thead>
          <tr>
            <th>Kz</th>
            <th>Bezeichnung</th>
            <th className="num">Bemessungsgrundlage</th>
            <th className="num">Steuer</th>
          </tr>
        </thead>
        <tbody>
          <Kz kz="81" label="Steuerpflichtige Umsätze 19 %" base={ustva.kz81} tax={ustva.tax81} />
          <Kz kz="86" label="Steuerpflichtige Umsätze 7 %" base={ustva.kz86} tax={ustva.tax86} />
          <Kz kz="21" label="Nicht steuerbare sonstige Leistungen (EU, §18b)" base={ustva.kz21} />
          <Kz kz="45" label="Übrige nicht steuerbare Umsätze (Drittland)" base={ustva.kz45} />
          <Kz kz="46/47" label="§13b: Leistungen EU-Unternehmer" base={ustva.kz46} tax={ustva.kz47} />
          <Kz kz="52/53" label="§13b: andere Leistungen (Drittland)" base={ustva.kz52} tax={ustva.kz53} />
          <Kz kz="66" label="Vorsteuer aus Rechnungen" tax={0 - ustva.kz66 || 0} />
          <Kz kz="67" label="Vorsteuer §13b" tax={0 - ustva.kz67 || 0} />
          <tr className="sum strong">
            <td>83</td>
            <td>{ustva.zahllast >= 0 ? 'Vorauszahlung' : 'Erstattung'}</td>
            <td />
            <td className="num">{formatCents(ustva.zahllast)}</td>
          </tr>
        </tbody>
      </table>

      <h2>Zusammenfassende Meldung {activePeriod}</h2>
      {zm.length === 0 ? (
        <p className="hint">Keine meldepflichtigen EU-Leistungen im Zeitraum.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>USt-IdNr.</th>
              <th>Empfänger</th>
              <th className="num">Summe</th>
              <th>Art</th>
            </tr>
          </thead>
          <tbody>
            {zm.map((l) => (
              <tr key={l.vatId}>
                <td>{l.vatId}</td>
                <td>{l.name}</td>
                <td className="num">{eur(l.amount)}</td>
                <td>{l.type}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p className="hint">
        Übermittlung: UStVA über ELSTER, ZM über das BZSt-Onlineportal. Direkte Übermittlung ist für eine spätere Version
        geplant.
      </p>
    </section>
  );
}

function rows(o: Partial<Record<Category, number>>) {
  return (Object.entries(o) as [Category, number][]).map(([c, v]) => (
    <tr key={c}>
      <td className="indent">{CATEGORIES[c].label}</td>
      <td className="num">{formatCents(v)}</td>
    </tr>
  ));
}

function Kz({ kz, label, base, tax }: { kz: string; label: string; base?: number; tax?: number }) {
  return (
    <tr className={!base && !tax ? 'muted' : ''}>
      <td>{kz}</td>
      <td>{label}</td>
      <td className="num">{base === undefined ? '' : eur(base)}</td>
      <td className="num">{tax === undefined ? '' : formatCents(tax)}</td>
    </tr>
  );
}
