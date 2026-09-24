import type { Entry, EntryDraft, Settings } from '../domain/types';

export interface Repo {
  readonly mode: 'local' | 'cloud';
  listEntries(): Promise<Entry[]>;
  /** Versiegelt und speichert neue Buchungen (append-only). */
  append(drafts: EntryDraft[]): Promise<Entry[]>;
  getSettings(): Promise<Settings>;
  saveSettings(s: Settings): Promise<void>;
}
