'use client';

import { useEffect, useMemo, useState } from 'react';
import Topbar from '../../../components/Topbar';
import Modal from '../../../components/Modal';
import { supabase } from '../../../lib/supabaseClient';
import { fetchRole } from '../../../lib/role';

type StudentRow = { student_id: string; class: string | null };

export default function AdminStudentsPage() {
  const [ready, setReady] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  // Schüler-Input (KEIN Name, nur Klasse + Code)
  const [studentId, setStudentId] = useState('');
  const [studentClass, setStudentClass] = useState('');

  // Buch-Scan
  const [scan, setScan] = useState('');

  // Listen
  const [students, setStudents] = useState<StudentRow[]>([]);
  const filtered = useMemo(() => {
    const q = studentId.trim();
    if (!q) return students;
    return students.filter(s => s.student_id.toLowerCase().includes(q.toLowerCase()));
  }, [students, studentId]);

  // Modal (Fehler / Warnung)
  const [modalOpen, setModalOpen] = useState(false);
  const [modalText, setModalText] = useState('');

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) return (window.location.href = '/login');
      const role = await fetchRole();
      if (role !== 'admin') return (window.location.href = '/teacher');
      setReady(true);
      await loadStudents();
    })();
  }, []);

  async function loadStudents() {
    // ⚠️ Falls deine Tabelle anders heißt: hier anpassen (z.B. sb_students)
    const { data, error } = await supabase
      .from('sb_students')
      .select('student_id,class')
      .order('class', { ascending: true })
      .order('student_id', { ascending: true });

    if (error) {
      // Wenn Tabelle anders heißt, bekommst du hier den Hinweis
      setMsg(error.message);
      return;
    }
    setStudents((data ?? []) as any);
  }

  async function upsertStudent() {
    setMsg(null); setOk(null);
    try {
      const sid = studentId.trim();
      if (!sid) throw new Error('Bitte Schüler-Code (student_id) eingeben/scannen.');
      const cls = studentClass.trim() || null;

      const { error } = await supabase
        .from('sb_students')
        .upsert({ student_id: sid, class: cls }, { onConflict: 'student_id' });

      if (error) throw error;
      setOk('Schüler gespeichert.');
      await loadStudents();
    } catch (e: any) {
      setMsg(e?.message ?? 'Unbekannter Fehler');
    }
  }

  async function issueBookToStudent() {
    setMsg(null); setOk(null);
    try {
      const sid = studentId.trim();
      const code = scan.trim();
      if (!sid) throw new Error('Erst Schüler-Code (student_id) setzen/scannen.');
      if (!code) throw new Error('Buch-Code fehlt.');

      // ✅ Buch -> Schüler
      const { error } = await supabase.rpc('sb_issue_book', {
        p_book_code: code,
        p_student_id: sid,
      });
      if (error) throw error;

      setOk(`Buch ${code} zu Schüler ${sid} zugewiesen.`);
      setScan('');
    } catch (e: any) {
      setMsg(e?.message ?? 'Unbekannter Fehler');
    }
  }

  async function returnBookToStorage() {
    setMsg(null); setOk(null);
    try {
      const code = scan.trim();
      if (!code) throw new Error('Buch-Code fehlt.');

      // ✅ Buch -> Lager
      const { error } = await supabase.rpc('sb_return_book', {
        p_scan: code,
      });
      if (error) throw error;

      setOk(`Buch ${code} ins Lager zurückgebucht.`);
      setScan('');
    } catch (e: any) {
      setMsg(e?.message ?? 'Unbekannter Fehler');
    }
  }

  function openHelp(text: string) {
    setModalText(text);
    setModalOpen(true);
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
      <Topbar title="Admin · Schüler" />

      <div className="card">
        <div className="row">
          <div className="badge">Schüler (Code + Klasse) · Scannen & Zuweisen</div>
          <div className="spacer" />
          <button className="btn secondary" onClick={() => (window.location.href = '/admin')}>← Dashboard</button>
          <button className="btn secondary" onClick={() => (window.location.href = '/teacher')}>Zur Lehrkräfte-Ansicht</button>
        </div>

        <div style={{ height: 12 }} />

        <div className="row">
          <input
            className="input"
            value={studentClass}
            onChange={(e) => setStudentClass(e.target.value)}
            placeholder="Klasse (z.B. 7b)"
            style={{ maxWidth: 220 }}
          />
          <input
            className="input"
            value={studentId}
            onChange={(e) => setStudentId(e.target.value)}
            placeholder="Schüler-Code (student_id) scannen/eingeben"
            style={{ maxWidth: 380 }}
          />
          <button className="btn ok" onClick={upsertStudent}>Schüler speichern</button>
          <button className="btn secondary" onClick={() => openHelp('Du nutzt keine Namen: Nur Klasse + Schüler-Code.\n\n1) Klasse + Code eingeben/scannen\n2) „Schüler speichern“\n3) Dann Bücher scannen und zuweisen.')}>?</button>
        </div>

        <div style={{ height: 12 }} />
        <hr className="sep" />

        <div className="row">
          <input
            className="input"
            value={scan}
            onChange={(e) => setScan(e.target.value)}
            placeholder="Buch-Code scannen (z.B. 9149)"
            style={{ maxWidth: 380 }}
          />
          <button className="btn ok" onClick={issueBookToStudent}>Buch → Schüler</button>
          <button className="btn secondary" onClick={returnBookToStorage}>Buch → Lager</button>
        </div>

        {msg && <>
          <hr className="sep" />
          <div className="small" style={{ color: 'rgba(255,93,108,.95)' }}>{msg}</div>
        </>}
        {ok && <>
          <hr className="sep" />
          <div className="small" style={{ color: 'rgba(46,229,157,.95)', fontWeight: 800 }}>{ok}</div>
        </>}

        <hr className="sep" />

        <div className="small" style={{ marginBottom: 8, opacity: 0.9 }}>
          Gespeicherte Schüler (nur Code + Klasse):
        </div>

        <div className="card" style={{ background: 'rgba(255,255,255,0.04)' }}>
          {filtered.length === 0 ? (
            <div className="small" style={{ opacity: 0.7 }}>Keine Treffer.</div>
          ) : (
            <div style={{ display: 'grid', gap: 8 }}>
              {filtered.map(s => (
                <div key={s.student_id} className="row" style={{ alignItems: 'center' }}>
                  <div className="badge" style={{ minWidth: 90, justifyContent: 'center' }}>
                    {s.class ?? '—'}
                  </div>
                  <div className="kbd">{s.student_id}</div>
                  <div className="spacer" />
                  <button className="btn secondary" onClick={() => setStudentId(s.student_id)}>
                    Als aktiven Schüler wählen
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <Modal open={modalOpen} title="Hinweis" onClose={() => setModalOpen(false)}>
        <pre style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{modalText}</pre>
      </Modal>
    </div>
  );
}
