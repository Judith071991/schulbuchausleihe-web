'use client';

import { useEffect, useState } from 'react';
import Topbar from '../../components/Topbar';
import { supabase } from '../../lib/supabaseClient';
import { fetchRole } from '../../lib/role';

type Assignment = {
  book_code: string;
  holder_type: string;
  holder_id: string;
};

export default function TeacherPage() {
  const [ready, setReady] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [email, setEmail] = useState<string>('');
  const [role, setRole] = useState<string>('');
  const [teacherId, setTeacherId] = useState<string>('');
  const [items, setItems] = useState<Assignment[]>([]);

  useEffect(() => {
    (async () => {
      setMsg(null);

      const { data } = await supabase.auth.getSession();
      if (!data.session) return (window.location.href = '/login');

      setEmail(data.session.user.email ?? '');

      const r = await fetchRole();
      setRole(r);

      // Admin soll NICHT in teacher landen
      if (r === 'admin') return (window.location.href = '/admin');

      // Erlaubt: teacher ODER teacher_readonly
      if (r !== 'teacher' && r !== 'teacher_readonly') {
        return (window.location.href = '/login');
      }

      // teacher_id holen (RPC existiert bei dir: sb_my_teacher_id)
      const tidRes = await supabase.rpc('sb_my_teacher_id');
      if (tidRes.error) {
        setMsg(`Teacher-ID konnte nicht geladen werden: ${tidRes.error.message}`);
      } else {
        setTeacherId(String(tidRes.data ?? ''));
      }

      setReady(true);
    })();
  }, []);

  useEffect(() => {
    (async () => {
      if (!ready || !teacherId) return;

      // Zuweisungen laden (vereinfachte Anzeige)
      // Wenn deine Tabelle/VIEW anders heißt, sag kurz Bescheid – dann passen wir’s an.
      const { data, error } = await supabase
        .from('sb_current_assignments')
        .select('book_code, holder_type, holder_id')
        .eq('holder_type', 'teacher')
        .eq('holder_id', teacherId)
        .order('book_code', { ascending: true });

      if (error) {
        setMsg(`Zuweisungen konnten nicht geladen werden: ${error.message}`);
        setItems([]);
      } else {
        setItems((data ?? []) as any);
      }
    })();
  }, [ready, teacherId]);

  if (!ready) {
    return (
      <div className="container">
        <div className="card">
          <div className="h1">Lehrkräfte</div>
          <p className="sub">Lade…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <Topbar title="Lehrkräfte (Ansicht)" />

      <div className="card">
        <div className="row">
          <div className="badge">Eingeloggt: {email || '—'}</div>
          <div className="badge">Rolle: {role || '—'}</div>
          <div className="badge">Teacher-ID: {teacherId || '—'}</div>
          <div className="spacer" />
          <button className="btn secondary" onClick={() => (window.location.href = '/admin')}>
            Zum Admin-Dashboard
          </button>
        </div>

        <div style={{ height: 12 }} />

        <div className="small">
          Diese Seite ist aktuell <b>nur Ansicht</b>. Scannen/Ändern passiert im Admin-Bereich.
        </div>

        {msg && (
          <>
            <hr className="sep" />
            <div className="small" style={{ color: 'rgba(255,93,108,.95)' }}>
              {msg}
            </div>
          </>
        )}

        <hr className="sep" />
        <div className="h2">Meine ausgeliehenen Bücher</div>

        {items.length === 0 ? (
          <div className="small">Keine Bücher zugeordnet.</div>
        ) : (
          <div className="small" style={{ lineHeight: 1.8 }}>
            {items.map((x) => (
              <div key={x.book_code}>
                • <span className="kbd">{x.book_code}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
