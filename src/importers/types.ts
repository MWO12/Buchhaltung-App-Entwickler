import type { Source } from '../domain/types';

export interface CurrencyGroup {
  currency: string;
  /** Summe in 1/10000-Einheiten der Originalwährung */
  micro: number;
  units: number;
  rows: number;
  /** Aufschlüsselung, z. B. nach Transaktionsart (Google) */
  breakdown?: Record<string, number>;
}

export interface ImportResult {
  source: Exclude<Source, 'manual'>;
  fileName: string;
  periodStart: string; // YYYY-MM-DD
  periodEnd: string; // YYYY-MM-DD
  groups: CurrencyGroup[];
  warnings: string[];
}
