import { useCallback, useEffect, useState } from 'react';
import { DEFAULT_SETTINGS, type Entry, type EntryDraft, type Settings } from './domain/types';
import type { Repo } from './storage/repo';

export interface Ledger {
  entries: Entry[];
  settings: Settings;
  loading: boolean;
  error: string | null;
  append(drafts: EntryDraft[]): Promise<void>;
  saveSettings(s: Settings): Promise<void>;
}

export function useLedger(repo: Repo): Ledger {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    Promise.all([repo.listEntries(), repo.getSettings()])
      .then(([e, s]) => {
        if (!alive) return;
        setEntries(e);
        setSettings(s);
      })
      .catch((err: unknown) => alive && setError(String((err as Error).message ?? err)))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [repo]);

  const append = useCallback(
    async (drafts: EntryDraft[]) => {
      const sealed = await repo.append(drafts);
      setEntries((prev) => [...prev, ...sealed]);
    },
    [repo],
  );

  const saveSettings = useCallback(
    async (s: Settings) => {
      await repo.saveSettings(s);
      setSettings(s);
    },
    [repo],
  );

  return { entries, settings, loading, error, append, saveSettings };
}
