'use client';

import { useEffect, useState } from 'react';
import Topbar from '../../../components/Topbar';
import { supabase } from '../../../lib/supabaseClient';
import { fetchRole } from '../../../lib/role';

export default function AdminStudentsPage() {
  const [ready, setReady] = useState(false);
  const [studentId, setStudentId] = useState('');
  const [studentName, setStudentName] = useState('');
  const [studentClass, setStudentClass] = useState('');
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

    if (!studentId || !studentName || !studentClass) {
      return setMsg('Bitte alle Felder ausfüllen.');
    }

    const { error } = await supabase.from('students').upsert({
      student_id: studentId.trim(),
      name: studentName.trim(),
      class: studentClass.trim(),
    });

    if (error) {
      setMsg(error.message);
    } else {
      setOk('Schüler gespeichert.');
      setStudentId('');
      setStudentName('');
      setStudentClass('');
    }
  }

  if (!ready) {
    return <div className="container"><div className="card"><div className="h1">Schüler</div><p className="sub">Lade…</p></div></div>;
  }

  return (
    <div className="container">
      <Topbar title="Schüler anlegen / verwalten" />

      <div className="card">
        <div className="row">
          <input
            className="input"
            placeholder="Schüler-ID (Barcode)"
            value={studentId}
            onChange={(e) => setStudentId(e.target.value)}
          />
        </div>

        <div style={{ height: 10 }} />

        <div className="row">
          <input
            className="input"
            placeholder="Name"
            value={studentName}
            onChange={(e) => setStudentName(e.target.value)}
          />
          <input
            className="input"
            placeholder="Klasse"
            value={studentClass}
            onChange={(e) => setStudentClass(e.target.value)}
          />
        </div>

        <div style={{ height: 10 }} />

        <button className="btn ok" onClick={saveStudent}>
          Speichern
        </button>

        {msg && <div className="small" style={{ color: 'red' }}>{msg}</div>}
        {ok && <div className="small" style={{ color: 'green' }}>{ok}</div>}
      </div>
    </div>
  );
}
