import { useState } from 'react';
import { eurToCents, formatCents, MICRO } from '../domain/money';
import { monthKey } from '../domain/period';
import { parseReport } from '../importers/detect';
import { fxKey, groupToEurCents, importToDrafts, type GroupBooking } from '../importers/toDrafts';
import type { ImportResult } from '../importers/types';
import type { Ledger } from '../useLedger';

interface Pending {
  result: ImportResult;
  payoutDate: string;
  /** manuell erfasster Zufluss laut Kontoauszug je Währung (Dezimalstring) */
  received: Record<string, string>;
}

export function ImportPage({ ledger, onDone }: { ledger: Ledger; onDone: () => void }) {
  const [pending, setPending] = useState<Pending[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const { settings, entries } = ledger;

  async function onFiles(files: FileList | null) {
    if (!files) return;
    const next: Pending[] = [];
    const errs: string[] = [];
    for (const f of Array.from(files)) {
      try {
        const result = parseReport(await f.text(), f.name);
        next.push({ result, payoutDate: result.periodEnd, received: {} });
      } catch (e) {
        errs.push(`${f.name}: ${(e as Error).message}`);
      }
    }
    setPending((p) => [...p, ...next]);
    setErrors(errs);
  }

  async function setRate(periodEnd: string, currency: string, value: string) {
    const rate = Number(value.replace(',', '.'));
    const fxRates = { ...settings.fxRates };
    if (rate > 0) fxRates[fxKey(monthKey(periodEnd), currency)] = rate;
    else delete fxRates[fxKey(monthKey(periodEnd), currency)];
    await ledger.saveSettings({ ...settings, fxRates });
  }

  function bookingsFor(p: Pending): GroupBooking[] | null {
    const out: GroupBooking[] = [];
    for (const g of p.result.groups) {
      const taxBase = groupToEurCents(g, p.result.periodEnd, settings.fxRates);
      if (taxBase === null) return null;
      const manual = p.received[g.currency];
      out.push({ group: g, taxBaseCents: taxBase, receivedCents: manual ? eurToCents(manual) : taxBase });
    }
    return out;
  }

  async function commit() {
    setBusy(true);
    try {
      const drafts = pending.flatMap((p) =>
        importToDrafts(p.result, bookingsFor(p)!, p.payoutDate, settings.fxRates),
      );
      await ledger.append(drafts);
      setPending([]);
      onDone();
    } catch (e) {
      setErrors([(e as Error).message]);
    } finally {
      setBusy(false);
    }
  }

  const ready = pending.length > 0 && pending.every((p) => bookingsFor(p) !== null);
  const known = new Set(entries.map((e) => e.reference));

  return (
    <section>
      <h2>Berichte importieren</h2>
      <p className="hint">
        Apple: App Store Connect → Zahlungen und Finanzberichte → Finanzbericht (.txt/.csv).
        <br />
        Google: Play Console → Berichte herunterladen → Finanzen → Einnahmen (earnings_*.csv).
      </p>
      <input type="file" accept=".txt,.csv,.tsv" multiple onChange={(e) => onFiles(e.target.files)} />
      {errors.map((e) => (
        <p key={e} className="error">
          {e}
        </p>
      ))}

      {pending.map((p, idx) => (
        <div key={p.result.fileName + idx} className="card">
          <h3>
            {p.result.source === 'apple' ? 'App Store' : 'Google Play'} · {p.result.periodStart} – {p.result.periodEnd}
          </h3>
          <p className="hint">{p.result.fileName}</p>
          {known.has(p.result.fileName) && <p className="warn">Diese Datei wurde bereits gebucht.</p>}
          {p.result.warnings.map((w) => (
            <p key={w} className="warn">
              {w}
            </p>
          ))}
          <label>
            Zuflussdatum (Gutschrift auf dem Konto)
            <input
              type="date"
              value={p.payoutDate}
              onChange={(e) =>
                setPending((all) => all.map((x, i) => (i === idx ? { ...x, payoutDate: e.target.value } : x)))
              }
            />
          </label>
          <div className="scroll">
          <table>
            <thead>
              <tr>
                <th>Währung</th>
                <th className="num">Betrag</th>
                <th className="num">Kurs (je 1 EUR)</th>
                <th className="num">USt-Basis EUR</th>
                <th className="num">Zufluss EUR (Kontoauszug)</th>
              </tr>
            </thead>
            <tbody>
              {p.result.groups.map((g) => {
                const eur = groupToEurCents(g, p.result.periodEnd, settings.fxRates);
                const key = fxKey(monthKey(p.result.periodEnd), g.currency);
                return (
                  <tr key={g.currency}>
                    <td>{g.currency}</td>
                    <td className="num">{(g.micro / MICRO).toFixed(2)}</td>
                    <td className="num">
                      {g.currency === 'EUR' ? (
                        '1'
                      ) : (
                        <input
                          className="small"
                          inputMode="decimal"
                          defaultValue={settings.fxRates[key] ?? ''}
                          placeholder={`${monthKey(p.result.periodEnd)}`}
                          onBlur={(e) => setRate(p.result.periodEnd, g.currency, e.target.value)}
                        />
                      )}
                    </td>
                    <td className="num">{eur === null ? '—' : formatCents(eur)}</td>
                    <td className="num">
                      <input
                        className="small"
                        inputMode="decimal"
                        placeholder={eur === null ? '' : (eur / 100).toFixed(2)}
                        value={p.received[g.currency] ?? ''}
                        onChange={(e) =>
                          setPending((all) =>
                            all.map((x, i) =>
                              i === idx ? { ...x, received: { ...x.received, [g.currency]: e.target.value } } : x,
                            ),
                          )
                        }
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
          <button className="link" onClick={() => setPending((all) => all.filter((_, i) => i !== idx))}>
            Verwerfen
          </button>
        </div>
      ))}

      {pending.length > 0 && (
        <>
          {!ready && <p className="warn">Für alle Fremdwährungen einen Monatskurs (BMF/EZB) eintragen.</p>}
          <button disabled={!ready || busy} onClick={commit}>
            {pending.length} Bericht(e) buchen
          </button>
        </>
      )}
    </section>
  );
}
