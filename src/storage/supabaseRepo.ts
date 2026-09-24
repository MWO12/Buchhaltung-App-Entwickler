import type { SupabaseClient } from '@supabase/supabase-js';
import { sealEntries } from '../domain/ledger';
import { DEFAULT_SETTINGS, type Entry, type EntryDraft, type Settings } from '../domain/types';
import type { Repo } from './repo';

interface EntryRow {
  id: string;
  seq: number;
  data: Entry;
}

/**
 * Cloud-Speicher (Supabase/Postgres, EU-Region). Tabelle `entries` ist per Trigger append-only,
 * Row Level Security beschränkt jeden Nutzer auf seine eigenen Buchungen.
 */
export class SupabaseRepo implements Repo {
  readonly mode = 'cloud' as const;

  constructor(
    private readonly db: SupabaseClient,
    private readonly userId: string,
  ) {}

  async listEntries(): Promise<Entry[]> {
    const out: Entry[] = [];
    const page = 1000;
    for (let from = 0; ; from += page) {
      const { data, error } = await this.db
        .from('entries')
        .select('id, seq, data')
        .order('seq', { ascending: true })
        .range(from, from + page - 1);
      if (error) throw error;
      out.push(...(data as EntryRow[]).map((r) => r.data));
      if (data.length < page) return out;
    }
  }

  async append(drafts: EntryDraft[]): Promise<Entry[]> {
    const { data: last, error: lastErr } = await this.db
      .from('entries')
      .select('data')
      .order('seq', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (lastErr) throw lastErr;
    const sealed = await sealEntries(drafts, (last as { data: Entry } | null)?.data);
    const { error } = await this.db.from('entries').insert(
      sealed.map((e) => ({ id: e.id, user_id: this.userId, seq: e.seq, hash: e.hash, prev_hash: e.prevHash, data: e })),
    );
    // Unique(user_id, seq) verhindert parallele Verzweigungen der Hash-Kette.
    if (error) throw error;
    return sealed;
  }

  async getSettings(): Promise<Settings> {
    const { data, error } = await this.db.from('settings').select('data').maybeSingle();
    if (error) throw error;
    return { ...DEFAULT_SETTINGS, ...((data as { data: Partial<Settings> } | null)?.data ?? {}) };
  }

  async saveSettings(s: Settings): Promise<void> {
    const { error } = await this.db.from('settings').upsert({ user_id: this.userId, data: s });
    if (error) throw error;
  }
}
