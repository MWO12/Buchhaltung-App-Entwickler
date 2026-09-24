import { useMemo, useState } from 'react';
import { reversalDraft, reversedIds, verifyChain, type ChainCheck } from '../domain/ledger';
import { eurToCents, formatCents } from '../domain/money';
import { CATEGORIES, TAX_CASES, categoriesFor, computeVatCents, taxCasesFor } from '../domain/tax';
import type { Category, Entry, EntryDraft, EntryKind, TaxCase } from '../domain/types';
import { entriesToCsv } from '../domain/exportCsv';
import type { Ledger } from '../useLedger';

const today = () => new Date().toISOString().slice(0, 10);

export function Journal({ ledger }: { ledger: Ledger }) {
  const { entries } = ledger;
  const [check, setCheck] = useState<ChainCheck | null>(null);
  const [filter, setFilter] = useState('');
  const reversed = useMemo(() => reversedIds(entries), [entries]);
  const shown = useMemo(() => {
    const f = filter.toLowerCase();
    return [...entries]
      .reverse()
      .filter((e) => !f || e.description.toLowerCase().includes(f) || e.counterparty.name.toLowerCase().includes(f));
  }, [entries, filter]);

  async function storno(e: Entry) {
    if (!confirm(`Buchung #${e.seq} stornieren?`)) return;
    await ledger.append([reversalDraft(e, today())]);
  }

  function download() {
    const blob = new Blob([entriesToCsv(entries)], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `journal_${today()}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <section>
      <ManualEntry ledger={ledger} />
      <h2>Journal ({entries.length})</h2>
      <div className="row">
        <input placeholder="Suchen …" value={filter} onChange={(e) => setFilter(e.target.value)} />
        <button onClick={async () => setCheck(await verifyChain(entries))}>Integrität prüfen</button>
        <button onClick={download} disabled={entries.length === 0}>
          CSV-Export
        </button>
      </div>
      {check && (
        <p className={check.ok ? 'ok' : 'error'}>
          {check.ok ? 'Hash-Kette vollständig und unverändert.' : `Fehler bei #${check.brokenAtSeq}: ${check.reason}`}
        </p>
      )}
      <div className="scroll">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Datum</th>
              <th>Text</th>
              <th>USt-Fall</th>
              <th className="num">Netto</th>
              <th className="num">USt</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {shown.map((e) => (
              <tr key={e.id} className={reversed.has(e.id) || e.reversalOf ? 'muted' : ''}>
                <td>{e.seq}</td>
                <td>{e.date}</td>
                <td>
                  {e.description}
                  <br />
                  <small>
                    {e.counterparty.name} · {CATEGORIES[e.category].label}
                  </small>
                </td>
                <td>
                  <small>{TAX_CASES[e.taxCase].label}</small>
                </td>
                <td className="num">{formatCents(e.kind === 'expense' ? -e.netCents : e.netCents)}</td>
                <td className="num">{formatCents(e.vatCents)}</td>
                <td>
                  {!e.reversalOf && !reversed.has(e.id) && (
                    <button className="link" onClick={() => storno(e)}>
                      Storno
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ManualEntry({ ledger }: { ledger: Ledger }) {
  const [kind, setKind] = useState<EntryKind>('expense');
  const [date, setDate] = useState(today());
  const [serviceDate, setServiceDate] = useState(today());
  const [category, setCategory] = useState<Category>('software_lizenzen');
  const [taxCase, setTaxCase] = useState<TaxCase>('DE_19_IN');
  const [net, setNet] = useState('');
  const [party, setParty] = useState('');
  const [country, setCountry] = useState('DE');
  const [vatId, setVatId] = useState('');
  const [text, setText] = useState('');
  const [reference, setReference] = useState('');
  const [error, setError] = useState('');

  const netCents = net ? eurToCents(net) : 0;
  const vatCents = computeVatCents(taxCase, netCents, ledger.settings.kleinunternehmer);

  function switchKind(k: EntryKind) {
    setKind(k);
    setCategory(categoriesFor(k)[0]);
    setTaxCase(k === 'income' ? 'DE_19_OUT' : 'DE_19_IN');
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (TAX_CASES[taxCase].zm && !vatId) {
      setError('Für EU-Reverse-Charge ist die USt-IdNr. des Empfängers Pflicht.');
      return;
    }
    const draft: EntryDraft = {
      date,
      serviceDate,
      kind,
      category,
      taxCase,
      netCents,
      vatCents,
      taxBaseCents: netCents,
      counterparty: { name: party, country: country.toUpperCase(), vatId: vatId || undefined },
      description: text,
      source: 'manual',
      reference: reference || undefined,
    };
    try {
      await ledger.append([draft]);
      setNet('');
      setText('');
      setReference('');
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <details className="card">
      <summary>Buchung manuell erfassen</summary>
      <form className="grid" onSubmit={submit}>
        <label>
          Art
          <select value={kind} onChange={(e) => switchKind(e.target.value as EntryKind)}>
            <option value="expense">Ausgabe</option>
            <option value="income">Einnahme</option>
          </select>
        </label>
        <label>
          Zahlungsdatum
          <input type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <label>
          Leistungsdatum
          <input type="date" required value={serviceDate} onChange={(e) => setServiceDate(e.target.value)} />
        </label>
        <label>
          Kategorie
          <select value={category} onChange={(e) => setCategory(e.target.value as Category)}>
            {categoriesFor(kind).map((c) => (
              <option key={c} value={c}>
                {CATEGORIES[c].label}
              </option>
            ))}
          </select>
        </label>
        <label>
          USt-Fall
          <select value={taxCase} onChange={(e) => setTaxCase(e.target.value as TaxCase)}>
            {taxCasesFor(kind).map((t) => (
              <option key={t} value={t}>
                {TAX_CASES[t].label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Netto (EUR)
          <input required inputMode="decimal" value={net} onChange={(e) => setNet(e.target.value)} />
        </label>
        <label>
          Geschäftspartner
          <input required value={party} onChange={(e) => setParty(e.target.value)} />
        </label>
        <label>
          Land
          <input maxLength={2} value={country} onChange={(e) => setCountry(e.target.value)} />
        </label>
        <label>
          USt-IdNr.
          <input value={vatId} onChange={(e) => setVatId(e.target.value)} />
        </label>
        <label>
          Belegnummer
          <input value={reference} onChange={(e) => setReference(e.target.value)} />
        </label>
        <label className="wide">
          Buchungstext
          <input required value={text} onChange={(e) => setText(e.target.value)} />
        </label>
        <p className="wide">
          USt: <b>{formatCents(vatCents)}</b>
          {TAX_CASES[taxCase].taxKz && ' (nach §13b selbst geschuldet)'}
        </p>
        {error && <p className="error wide">{error}</p>}
        <button type="submit">Buchen</button>
      </form>
    </details>
  );
}
