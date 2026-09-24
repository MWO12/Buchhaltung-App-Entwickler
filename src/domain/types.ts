export type Source = 'apple' | 'google' | 'manual';

export type EntryKind = 'income' | 'expense';

/** Umsatzsteuerliche Behandlung eines Geschäftsvorfalls. */
export type TaxCase =
  | 'DE_19_OUT' // Inland steuerpflichtig 19 %
  | 'DE_7_OUT' // Inland steuerpflichtig 7 %
  | 'EU_B2B_OUT' // sonstige Leistung an Unternehmer im EU-Ausland (Reverse Charge beim Empfänger, ZM-pflichtig)
  | 'NON_EU_OUT' // sonstige Leistung ins Drittland (nicht steuerbar)
  | 'DE_19_IN' // Eingangsrechnung Inland 19 %
  | 'DE_7_IN' // Eingangsrechnung Inland 7 %
  | 'RC_EU_IN' // §13b Abs. 1: Leistung eines EU-Unternehmers (z. B. Apple Developer Program)
  | 'RC_NONEU_IN' // §13b Abs. 2 Nr. 1: Leistung eines Drittlandsunternehmers (z. B. US-SaaS)
  | 'NO_VAT'; // ohne USt (Gebühren, Versicherungen, Kleinunternehmer-Umsätze)

export type Category =
  | 'erloese_appstores'
  | 'erloese_sonstige'
  | 'ust_erstattung'
  | 'software_lizenzen'
  | 'hosting_server'
  | 'hardware_gwg'
  | 'fremdleistungen'
  | 'werbung'
  | 'telekommunikation'
  | 'fortbildung'
  | 'gebuehren_beitraege'
  | 'reisekosten'
  | 'ust_zahlung'
  | 'sonstige_ausgaben';

export interface Counterparty {
  name: string;
  country: string; // ISO-3166-1 alpha-2
  vatId?: string;
}

export interface OriginalAmount {
  amount: string; // Dezimalstring in Originalwährung
  currency: string;
  unitsPerEur: number;
}

/** Neue Buchung, bevor sie in das Journal geschrieben wird. */
export interface EntryDraft {
  date: string; // Zu-/Abflussdatum (EÜR), YYYY-MM-DD
  serviceDate: string; // Leistungsdatum bzw. Ende des Leistungszeitraums (UStVA/ZM), YYYY-MM-DD
  kind: EntryKind;
  category: Category;
  taxCase: TaxCase;
  netCents: number; // Nettobetrag in EUR-Cent (Zufluss/Abfluss); negativ bei Storno
  vatCents: number; // ausgewiesene bzw. nach §13b geschuldete USt in Cent
  taxBaseCents: number; // USt-Bemessungsgrundlage (Umrechnung nach §16 Abs. 6 UStG)
  counterparty: Counterparty;
  description: string;
  source: Source;
  reference?: string; // Belegnummer / Report-Dateiname
  original?: OriginalAmount;
  reversalOf?: string;
}

/** Festgeschriebene Journalbuchung. Unveränderbar; Korrektur nur per Storno (GoBD). */
export interface Entry extends EntryDraft {
  id: string;
  seq: number;
  createdAt: string;
  prevHash: string;
  hash: string;
}

export interface Settings {
  companyName: string;
  vatId: string;
  kleinunternehmer: boolean;
  istversteuerung: boolean;
  /** Monatliche Umrechnungskurse (BMF/EZB), Schlüssel "YYYY-MM:USD" → Einheiten je 1 EUR */
  fxRates: Record<string, number>;
}

export const DEFAULT_SETTINGS: Settings = {
  companyName: '',
  vatId: '',
  kleinunternehmer: false,
  istversteuerung: true,
  fxRates: {},
};
