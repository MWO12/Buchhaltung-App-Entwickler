import { useState } from 'react';
import type { Settings } from '../domain/types';
import type { Ledger } from '../useLedger';

export function SettingsPage({ ledger }: { ledger: Ledger }) {
  const [s, setS] = useState<Settings>(ledger.settings);
  const [saved, setSaved] = useState(false);
  const [newKey, setNewKey] = useState({ month: '', currency: 'USD', rate: '' });

  async function save(next: Settings) {
    setS(next);
    await ledger.saveSettings(next);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  function addRate() {
    const rate = Number(newKey.rate.replace(',', '.'));
    if (!/^\d{4}-\d{2}$/.test(newKey.month) || !(rate > 0) || !/^[A-Z]{3}$/.test(newKey.currency)) return;
    save({ ...s, fxRates: { ...s.fxRates, [`${newKey.month}:${newKey.currency}`]: rate } });
    setNewKey({ ...newKey, rate: '' });
  }

  function removeRate(key: string) {
    const fxRates = { ...s.fxRates };
    delete fxRates[key];
    save({ ...s, fxRates });
  }

  return (
    <section>
      <h2>Unternehmen</h2>
      <form
        className="grid"
        onSubmit={(e) => {
          e.preventDefault();
          save(s);
        }}
      >
        <label>
          Name
          <input value={s.companyName} onChange={(e) => setS({ ...s, companyName: e.target.value })} />
        </label>
        <label>
          Eigene USt-IdNr.
          <input value={s.vatId} onChange={(e) => setS({ ...s, vatId: e.target.value })} />
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={s.kleinunternehmer}
            onChange={(e) => setS({ ...s, kleinunternehmer: e.target.checked })}
          />
          Kleinunternehmer (§19 UStG)
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={s.istversteuerung}
            onChange={(e) => setS({ ...s, istversteuerung: e.target.checked })}
          />
          Istversteuerung (§20 UStG)
        </label>
        <button type="submit">Speichern</button>
        {saved && <span className="ok">Gespeichert</span>}
      </form>

      <h2>Umrechnungskurse</h2>
      <p className="hint">
        Monatliche Umsatzsteuer-Umrechnungskurse des BMF (§16 Abs. 6 UStG), Notation: Fremdwährung je 1 EUR.
      </p>
      <div className="row">
        <input
          type="month"
          value={newKey.month}
          onChange={(e) => setNewKey({ ...newKey, month: e.target.value })}
        />
        <input
          className="small"
          maxLength={3}
          value={newKey.currency}
          onChange={(e) => setNewKey({ ...newKey, currency: e.target.value.toUpperCase() })}
        />
        <input
          className="small"
          inputMode="decimal"
          placeholder="1,0850"
          value={newKey.rate}
          onChange={(e) => setNewKey({ ...newKey, rate: e.target.value })}
        />
        <button onClick={addRate}>Hinzufügen</button>
      </div>
      <table>
        <tbody>
          {Object.entries(s.fxRates)
            .sort(([a], [b]) => b.localeCompare(a))
            .map(([k, v]) => (
              <tr key={k}>
                <td>{k.replace(':', ' · ')}</td>
                <td className="num">{v.toLocaleString('de-DE', { minimumFractionDigits: 4 })}</td>
                <td>
                  <button className="link" onClick={() => removeRate(k)}>
                    Entfernen
                  </button>
                </td>
              </tr>
            ))}
        </tbody>
      </table>
    </section>
  );
}
