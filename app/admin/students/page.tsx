'use client';

import { useEffect, useState } from 'react';
import Topbar from '../../../components/Topbar';
import { supabase } from '../../../lib/supabaseClient';
import { fetchRole } from '../../../lib/role';

export default function AdminStudentsPage() {
  const [ready, setReady] = useState(false);

  const [studentId, setStudentId] = useState('');
  const [classId, setClassId] = useState('');
  const [active, setActive] = useState(true);

  const [msg, setMsg] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) return (window.location.href = '/login');
      const role = await fetchRole();
      if (role !== 'admin') return (window.location.href = '/teacher');
      setReady(true);
    })();
  }, []);

  async function saveStudent() {
    setMsg(null);
    setOk(null);

    if (!studentId.trim() || !classId.trim()) {
      return setMsg('Bitte Schüler-Code und Klasse ausfüllen.');
    }

    // ✅ Variante A: Tabelle heißt "students" und Spalte heißt "class_id"
    const { error } = await supabase.from('students').upsert(
      {
        student_id: studentId.trim(),
        class_id: classId.trim(),
        active: active,
      },
      { onConflict: 'student_id' }
    );

    if (error) return setMsg(error.message);

    setOk('Schüler gespeichert.');
    setStudentId('');
    setClassId('');
  }

  if (!ready) {
    return (
      <div className="container">
        <div className="card">
          <div className="h1">Schüler</div>
          <p className="sub">Lade…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <Topbar title="Schüler (Barcode + Klasse)" />

      <div className="card">
        <div className="row">
          <input
            className="input"
            placeholder="Schüler-Code (Barcode)"
            value={studentId}
            onChange={(e) => setStudentId(e.target.value)}
          />
          <input
            className="input"
            placeholder="Klasse (z.B. 5a)"
            value={classId}
            onChange={(e) => setClassId(e.target.value)}
          />
        </div>

        <div style={{ height: 10 }} />

        <div className="row">
          <label className="badge" style={{ cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
              style={{ marginRight: 8 }}
            />
            aktiv
          </label>

          <div className="spacer" />
          <button className="btn ok" onClick={saveStudent}>
            Speichern
          </button>
        </div>

        {msg && <div className="small" style={{ color: 'rgba(255,93,108,.95)' }}>{msg}</div>}
        {ok && <div className="small" style={{ color: 'rgba(46,229,157,.95)', fontWeight: 800 }}>{ok}</div>}
      </div>
    </div>
  );
}
