import type { Category, EntryKind, TaxCase } from './types';
import { roundHalfAway } from './money';

export interface TaxCaseInfo {
  label: string;
  kind: EntryKind;
  rate: number; // Steuersatz in Prozent
  /** Kennzahl der Bemessungsgrundlage in der UStVA */
  baseKz?: '81' | '86' | '21' | '45' | '46' | '52';
  /** Kennzahl der geschuldeten Steuer (nur §13b) */
  taxKz?: '47' | '53';
  /** Vorsteuer-Kennzahl */
  inputKz?: '66' | '67';
  zm?: boolean;
  /** USt wird tatsächlich gezahlt/vereinnahmt (relevant für EÜR) */
  vatPaidOrReceived: boolean;
}

export const TAX_CASES: Record<TaxCase, TaxCaseInfo> = {
  DE_19_OUT: { label: 'Inland 19 %', kind: 'income', rate: 19, baseKz: '81', vatPaidOrReceived: true },
  DE_7_OUT: { label: 'Inland 7 %', kind: 'income', rate: 7, baseKz: '86', vatPaidOrReceived: true },
  EU_B2B_OUT: {
    label: 'EU-Unternehmer, sonstige Leistung (Reverse Charge, ZM)',
    kind: 'income',
    rate: 0,
    baseKz: '21',
    zm: true,
    vatPaidOrReceived: false,
  },
  NON_EU_OUT: { label: 'Drittland, nicht steuerbar', kind: 'income', rate: 0, baseKz: '45', vatPaidOrReceived: false },
  DE_19_IN: { label: 'Eingangsrechnung Inland 19 %', kind: 'expense', rate: 19, inputKz: '66', vatPaidOrReceived: true },
  DE_7_IN: { label: 'Eingangsrechnung Inland 7 %', kind: 'expense', rate: 7, inputKz: '66', vatPaidOrReceived: true },
  RC_EU_IN: {
    label: '§13b – Leistung EU-Unternehmer',
    kind: 'expense',
    rate: 19,
    baseKz: '46',
    taxKz: '47',
    inputKz: '67',
    vatPaidOrReceived: false,
  },
  RC_NONEU_IN: {
    label: '§13b – Leistung Drittlandsunternehmer',
    kind: 'expense',
    rate: 19,
    baseKz: '52',
    taxKz: '53',
    inputKz: '67',
    vatPaidOrReceived: false,
  },
  NO_VAT: { label: 'ohne USt', kind: 'expense', rate: 0, vatPaidOrReceived: false },
};

export function taxCasesFor(kind: EntryKind): TaxCase[] {
  return (Object.keys(TAX_CASES) as TaxCase[]).filter(
    (tc) => tc === 'NO_VAT' || TAX_CASES[tc].kind === kind,
  );
}

export function computeVatCents(taxCase: TaxCase, netCents: number, kleinunternehmer: boolean): number {
  const info = TAX_CASES[taxCase];
  // Kleinunternehmer weisen keine USt aus; gezahlte Vorsteuer und §13b-Steuer fallen trotzdem an.
  if (kleinunternehmer && info.kind === 'income') return 0;
  return roundHalfAway((netCents * info.rate) / 100);
}

export const CATEGORIES: Record<Category, { label: string; kind: EntryKind }> = {
  erloese_appstores: { label: 'Erlöse App Stores', kind: 'income' },
  erloese_sonstige: { label: 'Sonstige Erlöse', kind: 'income' },
  ust_erstattung: { label: 'USt-Erstattung Finanzamt', kind: 'income' },
  software_lizenzen: { label: 'Software, Lizenzen, Developer-Programme', kind: 'expense' },
  hosting_server: { label: 'Hosting, Server, Cloud', kind: 'expense' },
  hardware_gwg: { label: 'Hardware / GWG', kind: 'expense' },
  fremdleistungen: { label: 'Fremdleistungen (Freelancer, Design)', kind: 'expense' },
  werbung: { label: 'Werbung, Marketing', kind: 'expense' },
  telekommunikation: { label: 'Telekommunikation, Internet', kind: 'expense' },
  fortbildung: { label: 'Fortbildung, Fachliteratur', kind: 'expense' },
  gebuehren_beitraege: { label: 'Gebühren, Beiträge, Versicherungen', kind: 'expense' },
  reisekosten: { label: 'Reisekosten', kind: 'expense' },
  ust_zahlung: { label: 'USt-Zahlung an Finanzamt', kind: 'expense' },
  sonstige_ausgaben: { label: 'Sonstige Ausgaben', kind: 'expense' },
};

export function categoriesFor(kind: EntryKind): Category[] {
  return (Object.keys(CATEGORIES) as Category[]).filter((c) => CATEGORIES[c].kind === kind);
}

/**
 * Bekannte Vertragspartner. USt-IdNrn. vor produktivem Einsatz gegen die aktuelle
 * Gutschrift/Rechnung bzw. per BZSt-Bestätigungsabfrage prüfen.
 */
export const KNOWN_PARTIES = {
  apple: { name: 'Apple Distribution International Ltd.', country: 'IE', vatId: 'IE9700053D' },
  google: { name: 'Google Commerce Ltd.', country: 'IE', vatId: 'IE9825613N' },
} as const;
