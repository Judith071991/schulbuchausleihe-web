'use client';

import { useEffect, useState } from 'react';
import Topbar from '../../components/Topbar';
import { supabase } from '../../lib/supabaseClient';
import { fetchRole } from '../../lib/role';

export default function TeacherPage() {
  const [ready, setReady] = useState(false);
  const [email, setEmail] = useState<string>('');
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) return (window.location.href = '/login');

      setEmail(data.session.user?.email ?? '');

      const role = await fetchRole();

      // Admin soll NICHT hier landen
      if (role === 'admin') return (window.location.href = '/admin');

      // Nur teacher darf rein
      if (role !== 'teacher') return (window.location.href = '/login');

      setReady(true);
    })();
  }, []);

  async function logout() {
    await supabase.auth.signOut();
    window.location.href = '/login';
  }

  if (!ready) {
    return (
      <div className="container">
        <div className="card">
          <div className="h1">Lehrkräfte</div>
          <p className="sub">Lade…</p>
          {msg && <p className="small" style={{ color: 'rgba(255,93,108,.95)' }}>{msg}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <Topbar title="Lehrkräfte" />

      <div className="card">
        <div className="row">
          <div>
            <div className="h1">Lehrkräfte-Ansicht</div>
            <div className="small">Eingeloggt: <span className="kbd">{email}</span></div>
            <div className="small">Rolle: <span className="kbd">teacher</span></div>
          </div>
          <div className="spacer" />
          <button className="btn secondary" onClick={logout}>Logout</button>
        </div>

        <hr className="sep" />

        <div className="small">
          Diese Seite ist aktuell <b>nur Ansicht</b>. Scannen läuft über den Adminbereich.
        </div>

        <div style={{ height: 10 }} />

        <button className="btn ok" onClick={() => (window.location.href = '/admin')}>
          Zum Adminbereich (falls freigeschaltet)
        </button>
      </div>
    </div>
  );
}
