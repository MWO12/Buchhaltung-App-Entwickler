import { useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';

export function Login({ client }: { client: SupabaseClient }) {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'sent' | 'error'>('idle');
  const [msg, setMsg] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await client.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    });
    if (error) {
      setState('error');
      setMsg(error.message);
    } else setState('sent');
  }

  return (
    <div className="login">
      <h1>AppDev Buchhaltung</h1>
      {state === 'sent' ? (
        <p>Anmeldelink wurde an {email} gesendet.</p>
      ) : (
        <form onSubmit={submit}>
          <label>
            E-Mail
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <button type="submit">Anmeldelink senden</button>
          {state === 'error' && <p className="error">{msg}</p>}
        </form>
      )}
    </div>
  );
}
