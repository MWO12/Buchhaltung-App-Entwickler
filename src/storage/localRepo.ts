import { sealEntries } from '../domain/ledger';
import { DEFAULT_SETTINGS, type Entry, type EntryDraft, type Settings } from '../domain/types';
import type { Repo } from './repo';

const ENTRIES = 'appdev-buch.entries.v1';
const SETTINGS = 'appdev-buch.settings.v1';

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

/** Speicherung nur im Browser (Demo/Offline). Kein Ersatz für revisionssichere Archivierung. */
export class LocalRepo implements Repo {
  readonly mode = 'local' as const;

  async listEntries(): Promise<Entry[]> {
    return read<Entry[]>(ENTRIES, []);
  }

  async append(drafts: EntryDraft[]): Promise<Entry[]> {
    const all = await this.listEntries();
    const sealed = await sealEntries(drafts, all[all.length - 1]);
    localStorage.setItem(ENTRIES, JSON.stringify([...all, ...sealed]));
    return sealed;
  }

  async getSettings(): Promise<Settings> {
    return { ...DEFAULT_SETTINGS, ...read<Partial<Settings>>(SETTINGS, {}) };
  }

  async saveSettings(s: Settings): Promise<void> {
    localStorage.setItem(SETTINGS, JSON.stringify(s));
  }
}
