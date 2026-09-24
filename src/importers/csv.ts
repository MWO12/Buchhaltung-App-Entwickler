import Papa from 'papaparse';

/** Liest CSV/TSV (Trennzeichen automatisch) und liefert Kopfzeile ab der ersten Zeile, die `mustContain` enthält. */
export function readTable(text: string, mustContain: string[]): { header: string[]; rows: string[][] } {
  const parsed = Papa.parse<string[]>(text.replace(/^﻿/, ''), { skipEmptyLines: 'greedy' });
  const all = parsed.data.map((r) => r.map((c) => (c ?? '').trim()));
  const headerIdx = all.findIndex((r) => mustContain.every((col) => r.includes(col)));
  if (headerIdx < 0) throw new Error(`Spalten nicht gefunden: ${mustContain.join(', ')}`);
  return { header: all[headerIdx], rows: all.slice(headerIdx + 1) };
}

export function col(header: string[], name: string): number {
  const i = header.indexOf(name);
  if (i < 0) throw new Error(`Spalte "${name}" fehlt`);
  return i;
}

export function optCol(header: string[], name: string): number {
  return header.indexOf(name);
}
