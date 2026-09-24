import type { Entry, EntryDraft } from './types';

export const GENESIS_HASH = '0'.repeat(64);

/** Deterministische Serialisierung (Schlüssel sortiert), Grundlage des Hashes. */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const obj = value as Record<string, unknown>;
  return `{${Object.keys(obj)
    .filter((k) => obj[k] !== undefined)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${canonicalJson(obj[k])}`)
    .join(',')}}`;
}

export async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');
}

function hashPayload(e: Omit<Entry, 'hash'>): string {
  return canonicalJson(e);
}

/** Hängt Buchungen an das Journal an und verkettet sie per SHA-256 (Unveränderbarkeit nach GoBD). */
export async function sealEntries(drafts: EntryDraft[], last: Entry | undefined, now = new Date()): Promise<Entry[]> {
  const out: Entry[] = [];
  let prevHash = last?.hash ?? GENESIS_HASH;
  let seq = last?.seq ?? 0;
  for (const d of drafts) {
    validateDraft(d);
    seq += 1;
    const base: Omit<Entry, 'hash'> = {
      ...d,
      id: crypto.randomUUID(),
      seq,
      createdAt: now.toISOString(),
      prevHash,
    };
    const hash = await sha256Hex(hashPayload(base));
    out.push({ ...base, hash });
    prevHash = hash;
  }
  return out;
}

export interface ChainCheck {
  ok: boolean;
  brokenAtSeq?: number;
  reason?: string;
}

export async function verifyChain(entries: Entry[]): Promise<ChainCheck> {
  const sorted = [...entries].sort((a, b) => a.seq - b.seq);
  let prevHash = GENESIS_HASH;
  for (let i = 0; i < sorted.length; i++) {
    const e = sorted[i];
    if (e.seq !== i + 1) return { ok: false, brokenAtSeq: e.seq, reason: 'Lücke in der Belegnummernfolge' };
    if (e.prevHash !== prevHash) return { ok: false, brokenAtSeq: e.seq, reason: 'Verkettung unterbrochen' };
    const { hash, ...rest } = e;
    if ((await sha256Hex(hashPayload(rest))) !== hash) {
      return { ok: false, brokenAtSeq: e.seq, reason: 'Inhalt nachträglich verändert' };
    }
    prevHash = hash;
  }
  return { ok: true };
}

/** Storno-Buchung: identische Buchung mit umgekehrtem Vorzeichen. */
export function reversalDraft(e: Entry, date: string): EntryDraft {
  return {
    date,
    serviceDate: e.serviceDate,
    kind: e.kind,
    category: e.category,
    taxCase: e.taxCase,
    netCents: -e.netCents,
    vatCents: -e.vatCents,
    taxBaseCents: -e.taxBaseCents,
    counterparty: e.counterparty,
    description: `Storno #${e.seq}: ${e.description}`,
    source: 'manual',
    reference: e.reference,
    original: e.original,
    reversalOf: e.id,
  };
}

export function reversedIds(entries: Entry[]): Set<string> {
  return new Set(entries.filter((e) => e.reversalOf).map((e) => e.reversalOf as string));
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function validateDraft(d: EntryDraft): void {
  if (!DATE_RE.test(d.date) || !DATE_RE.test(d.serviceDate)) throw new Error('Ungültiges Datum');
  for (const k of ['netCents', 'vatCents', 'taxBaseCents'] as const) {
    if (!Number.isInteger(d[k])) throw new Error(`${k} muss ganzzahlig (Cent) sein`);
  }
  if (!d.description.trim()) throw new Error('Buchungstext fehlt');
}
