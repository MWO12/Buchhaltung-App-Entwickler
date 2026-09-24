import { useEffect, useMemo, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './storage/client';
import { LocalRepo } from './storage/localRepo';
import { SupabaseRepo } from './storage/supabaseRepo';
import type { Repo } from './storage/repo';
import { useLedger } from './useLedger';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { ImportPage } from './pages/Import';
import { Journal } from './pages/Journal';
import { Reports } from './pages/Reports';
import { SettingsPage } from './pages/Settings';

const TABS = [
  ['dashboard', 'Übersicht'],
  ['import', 'Import'],
  ['journal', 'Journal'],
  ['reports', 'Auswertungen'],
  ['settings', 'Einstellungen'],
] as const;
type Tab = (typeof TABS)[number][0];

export function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(!supabase);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthReady(true);
    });
    const { data } = supabase.auth.onAuthStateChange((_evt, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  if (!authReady) return <p className="center">Lade …</p>;
  if (supabase && !session) return <Login client={supabase} />;

  const repoKey = session?.user.id ?? 'local';
  return <Shell key={repoKey} session={session} />;
}

function Shell({ session }: { session: Session | null }) {
  const repo: Repo = useMemo(
    () => (supabase && session ? new SupabaseRepo(supabase, session.user.id) : new LocalRepo()),
    [session],
  );
  const ledger = useLedger(repo);
  const [tab, setTab] = useState<Tab>('dashboard');

  return (
    <div className="app">
      <header>
        <h1>AppDev Buchhaltung</h1>
        <span className={`badge ${repo.mode}`}>
          {repo.mode === 'cloud' ? `Cloud · ${session?.user.email ?? ''}` : 'Lokal (nur dieser Browser)'}
        </span>
        {supabase && session && (
          <button className="link" onClick={() => supabase!.auth.signOut()}>
            Abmelden
          </button>
        )}
      </header>
      <nav>
        {TABS.map(([id, label]) => (
          <button key={id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </nav>
      <main>
        {ledger.error && <p className="error">Fehler: {ledger.error}</p>}
        {ledger.loading ? (
          <p>Lade Buchungen …</p>
        ) : (
          <>
            {tab === 'dashboard' && <Dashboard ledger={ledger} />}
            {tab === 'import' && <ImportPage ledger={ledger} onDone={() => setTab('journal')} />}
            {tab === 'journal' && <Journal ledger={ledger} />}
            {tab === 'reports' && <Reports ledger={ledger} />}
            {tab === 'settings' && <SettingsPage ledger={ledger} />}
          </>
        )}
      </main>
      <footer>Keine Steuerberatung. Ergebnisse vor Abgabe durch Steuerberater prüfen lassen.</footer>
    </div>
  );
}
