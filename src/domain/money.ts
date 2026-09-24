/** Beträge werden intern als ganzzahlige Cent (EUR) bzw. 1/10000-Einheiten (Fremdwährung) geführt. */

export const MICRO = 10_000;

/**
 * Parst Dezimalzahlen in beiden Schreibweisen ("1,234.56" / "1.234,56" / "-12.5")
 * und liefert ganzzahlige 1/10000-Einheiten.
 */
export function parseDecimalMicro(raw: string): number {
  let s = raw.trim().replace(/\s/g, '').replace(/[^\d.,-]/g, '');
  if (s === '' || s === '-') return 0;
  const lastDot = s.lastIndexOf('.');
  const lastComma = s.lastIndexOf(',');
  if (lastComma > lastDot) {
    s = s.replace(/\./g, '').replace(',', '.');
  } else {
    s = s.replace(/,/g, '');
  }
  const negative = s.startsWith('-');
  const [intPart, fracPart = ''] = s.replace('-', '').split('.');
  const frac = (fracPart + '0000').slice(0, 4);
  // Rundung ab der 5. Nachkommastelle (kaufmännisch)
  const roundUp = fracPart.length > 4 && Number(fracPart[4]) >= 5 ? 1 : 0;
  const value = Number(intPart || '0') * MICRO + Number(frac) + roundUp;
  return negative ? -value : value;
}

/** Kaufmännische Rundung (half away from zero) auf ganze Zahl. */
export function roundHalfAway(x: number): number {
  return Math.sign(x) * Math.round(Math.abs(x));
}

/** Fremdwährung (1/10000) → EUR-Cent, Kurs in "Einheiten Fremdwährung je 1 EUR" (EZB/BMF-Notation). */
export function microToEurCents(micro: number, unitsPerEur: number): number {
  if (!(unitsPerEur > 0)) throw new Error('Ungültiger Wechselkurs');
  return roundHalfAway(micro / unitsPerEur / 100);
}

export function eurToCents(raw: string): number {
  return roundHalfAway(parseDecimalMicro(raw) / 100);
}

const fmt = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' });
export function formatCents(cents: number): string {
  return fmt.format(cents / 100);
}

/** Bemessungsgrundlagen in der UStVA werden in vollen Euro angegeben (Cent-Beträge abgerundet). */
export function toFullEuros(cents: number): number {
  return Math.trunc(cents / 100);
}
