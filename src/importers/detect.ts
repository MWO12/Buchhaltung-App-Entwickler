import { parseAppleFinancialReport } from './apple';
import { parseGoogleEarningsReport } from './google';
import type { ImportResult } from './types';

export function parseReport(text: string, fileName: string): ImportResult {
  if (text.includes('Extended Partner Share')) return parseAppleFinancialReport(text, fileName);
  if (text.includes('Amount (Merchant Currency)')) return parseGoogleEarningsReport(text, fileName);
  throw new Error('Dateiformat nicht erkannt (erwartet: Apple-Finanzbericht oder Google-Play-Earnings-Report)');
}
