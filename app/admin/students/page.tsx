'use client';

import { useEffect, useMemo, useState } from 'react';
import Topbar from '../../components/Topbar';
import { supabase } from '../../../lib/supabaseClient';
import { fetchRole } from '../../../lib/role';

type StudentRow = {
  student_id: string;
  class_id: string | null;
  active: boolean | null;
  created_at: string | null;
};

export default function AdminStudentsPage() {
  const [ready, setReady] = useState(false);

  const [classId, setClassId] = useState('');     // z.B. 5a
  const [studentId, setStudentId] = useState(''); // z.B. S0001

  const [bookCode, setBookCode] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const [rows, setRows] = useState<StudentRow[]>([]);
  const [loadingList, setLoadingList] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) return (window.location.href = '/login');

      const role = await fetchRole();
      if (role !== 'admin') return (window.location.href = '/teacher');

      setReady(true);
      await loadStudents();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadStudents() {
    setLoadingList(true);
    setMsg(null);
    try {
      const { data, error } = await supabase
        .from('sb_students')
        .select('student_id, class_id, active, created_at')
        .order('class_id', { ascending: true })
        .order('student_id', { ascending: true });

      if (error) throw error;
      setRows((data ?? []) as StudentRow[]);
    } catch (e: any) {
      setMsg(e?.message ?? 'Unbekannter Fehler beim Laden.');
    } finally {
      setLoadingList(false);
    }
  }

  async function saveStudent() {
    setMsg(null);
    setOk(null);

    try {
      const sid = studentId.trim();
      const cid = classId.trim();

      if (!sid) throw new Error('Schüler-Code fehlt (z.B. S0001).');
      if (!cid) throw new Error('Klasse fehlt (z.B. 5a).');

      const { error } = await supabase
        .from('sb_students')
        .upsert(
          {
            student_id: sid,
            class_id: cid,     // ✅ WICHTIG: class_id, nicht class
            active: true,
          },
          { onConflict: 'student_id' }
        );

      if (error) throw error;

      setOk(`Schüler ${sid} (${cid}) gespeichert.`);
      await loadStudents();
    } catch (e: any) {
      setMsg(e?.message ?? 'Unbekannter Fehler beim Speichern.');
    }
  }

  // Buch -> Schüler (Admin)
  async function assignBookToStudent() {
    setMsg(null);
    setOk(null);

    try {
      const sid = studentId.trim();
      const code = bookCode.trim();

      if (!sid) throw new Error('Schüler-Code fehlt.');
      if (!code) throw new Error('Buch-Code fehlt.');

      // ✅ Wir nehmen die Admin-Scan-Funktion (bei dir existiert sb_scan_book_admin)
      // Falls dein RPC andere Parameternamen hat: Supabase -> SQL Editor -> Routine Parameter List -> sb_scan_book_admin
      const { error } = await supabase.rpc('sb_scan_book_admin', {
        p_scan: code,
        p_new_holder_type: 'student',
        p_new_holder_id: sid,
        p_note: null,
      });

      if (error) throw error;

      setOk(`Buch ${code} → Schüler ${sid}`);
      setBookCode('');
    } catch (e: any) {
      setMsg(e?.message ?? 'Unbekannter Fehler beim Zuweisen.');
    }
  }

  // Buch -> Lager (Admin)
  async function assignBookToStorage() {
    setMsg(null);
    setOk(null);

    try {
      const code = bookCode.trim();
      if (!code) throw new Error('Buch-Code fehlt.');

      const { error } = await supabase.rpc('sb_scan_book_admin', {
        p_scan: code,
        p_new_holder_type: 'storage',
        p_new_holder_id: 'storage',
        p_note: null,
      });

      if (error) throw error;

      setOk(`Buch ${code} → Lager`);
      setBookCode('');
    } catch (e: any) {
      setMsg(e?.message ?? 'Unbekannter Fehler beim Einlagern.');
    }
  }

  const filtered = useMemo(() => {
    // optional: kleine Filterlogik (leer = alle)
    const cid = classId.trim().toLowerCase();
    const sid = studentId.trim().toLowerCase();
    return rows.filter(r => {
      const okClass = cid ? (r.class_id ?? '').toLowerCase().includes(cid) : true;
      const okStudent = sid ? (r.student_id ?? '').toLowerCase().includes(sid) : true;
      return okClass && okStudent;
    });
  }, [rows, classId, studentId]);

  if (!ready) return <div style={{ padding: 20 }}>Lade…</div>;

  return (
    <div style={{ padding: 16 }}>
      <Topbar title="Admin · Schüler" />

      <div style={{ display: 'flex', gap: 10, marginTop: 10, flexWrap: 'wrap' }}>
        <button onClick={() => (window.location.href = '/admin')}>← Dashboard</button>
        <button onClick={() => (window.location.href = '/teacher')}>Zur Lehrkräfte-Ansicht</button>
        <button onClick={() => supabase.auth.signOut().then(() => (window.location.href = '/login'))}>
          Logout
        </button>
      </div>

      <h3 style={{ marginTop: 16 }}>Schüler (Code + Klasse) anlegen</h3>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          placeholder="Klasse (z.B. 5a)"
          value={classId}
          onChange={(e) => setClassId(e.target.value)}
          style={{ padding: 8, minWidth: 160 }}
        />
        <input
          placeholder="Schüler-Code (z.B. S0001)"
          value={studentId}
          onChange={(e) => setStudentId(e.target.value)}
          style={{ padding: 8, minWidth: 180 }}
        />
        <button onClick={saveStudent} style={{ padding: '8px 12px' }}>
          Schüler speichern
        </button>
        <button onClick={loadStudents} style={{ padding: '8px 12px' }}>
          Liste aktualisieren
        </button>
      </div>

      <h3 style={{ marginTop: 16 }}>Buch scannen</h3>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          placeholder="Buch-Code scannen (z.B. 9149)"
          value={bookCode}
          onChange={(e) => setBookCode(e.target.value)}
          style={{ padding: 8, minWidth: 260 }}
        />
        <button onClick={assignBookToStudent} style={{ padding: '8px 12px' }}>
          Buch → Schüler
        </button>
        <button onClick={assignBookToStorage} style={{ padding: '8px 12px' }}>
          Buch → Lager
        </button>
      </div>

      {msg && <div style={{ marginTop: 12, color: 'crimson' }}>{msg}</div>}
      {ok && <div style={{ marginTop: 12, color: 'limegreen' }}>{ok}</div>}

      <h3 style={{ marginTop: 18 }}>Gespeicherte Schüler (nur Code + Klasse)</h3>
      {loadingList ? (
        <div>Lade Liste…</div>
      ) : (
        <div style={{ marginTop: 8 }}>
          {filtered.length === 0 ? (
            <div>Keine Treffer.</div>
          ) : (
            <ul>
              {filtered.map((r) => (
                <li key={r.student_id}>
                  <b>{r.student_id}</b> — Klasse: <b>{r.class_id ?? '-'}</b> — aktiv:{' '}
                  {String(r.active ?? true)}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
