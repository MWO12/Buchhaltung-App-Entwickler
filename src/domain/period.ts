/** Voranmeldungszeitraum: "2026-03" (Monat) oder "2026-Q1" (Quartal). */
export type Period = string;

export function periodOf(date: string, quarterly: boolean): Period {
  const [y, m] = date.split('-');
  return quarterly ? `${y}-Q${Math.ceil(Number(m) / 3)}` : `${y}-${m}`;
}

export function yearOf(date: string): number {
  return Number(date.slice(0, 4));
}

export function lastDayOfMonth(yyyyMm: string): string {
  const [y, m] = yyyyMm.split('-').map(Number);
  const d = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${yyyyMm}-${String(d).padStart(2, '0')}`;
}

export function monthKey(date: string): string {
  return date.slice(0, 7);
}
