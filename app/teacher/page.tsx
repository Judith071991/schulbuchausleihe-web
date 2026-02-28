'use client';

import { useEffect, useMemo, useState } from 'react';
import Topbar from '../../../components/Topbar';
import Modal from '../../../components/Modal';
import { supabase } from '../../../lib/supabaseClient';
import { fetchRole } from '../../../lib/role';

type TeacherRow = { teacher_id: string };

export default function AdminTeachersPage() {
  const [ready, setReady] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const [teacherId, setTeacherId] = useState('');
  const [scan, setScan] = useState('');

  const [teachers, setTeachers] = useState<TeacherRow[]>([]);
  const filtered = useMemo(() => {
    const q = teacherId.trim();
    if (!q) return teachers;
    return teachers.filter(t => t.teacher_id.toLowerCase().includes(q.toLowerCase()));
  }, [teachers, teacherId]);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalText, setModalText] = useState('');

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) return (window.location.href = '/login');
      const role = await fetchRole();
      if (role !== 'admin') return (window.location.href = '/teacher');
      setReady(true);
      await loadTeachers();
    })();
  }, []);

  async function loadTeachers() {
    // ⚠️ Falls deine Tabelle anders heißt: hier anpassen (z.B. sb_teachers)
    const { data, error } = await supabase
      .from('sb_teachers')
      .select('teacher_id')
      .order('teacher_id', { ascending: true });

    if (error) {
      setMsg(error.message);
      return;
    }
    setTeachers((data ?? []) as any);
  }

  async function upsertTeacher() {
    setMsg(null); setOk(null);
    try {
      const tid = teacherId.trim();
      if (!tid) throw new Error('Bitte Lehrer-ID eingeben/scannen.');

      const { error } = await supabase
        .from('sb_teachers')
        .upsert({ teacher_id: tid }, { onConflict: 'teacher_id' });

      if (error) throw error;
      setOk('Lehrkraft gespeichert.');
      await loadTeachers();
    } catch (e: any) {
      setMsg(e?.message ?? 'Unbekannter Fehler');
    }
  }

  async function issueBookToTeacher() {
    setMsg(null); setOk(null);
    try {
      const tid = teacherId.trim();
      const code = scan.trim();
      if (!tid) throw new Error('Erst Lehrer-ID setzen/scannen.');
      if (!code) throw new Error('Buch-Code fehlt.');

      // ✅ Buch -> Lehrkraft
      const { error } = await supabase.rpc('sb_issue_to_teacher', {
        p_scan: code,
        p_teacher_id: tid,
        p_note: null,
      });
      if (error) throw error;

      setOk(`Buch ${code} zu Lehrkraft ${tid} zugewiesen.`);
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
          <div className="h1">Lehrkräfte</div>
          <p className="sub">Lade…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <Topbar title="Admin · Lehrkräfte" />

      <div className="card">
        <div className="row">
          <div className="badge">Lehrkräfte · Scannen & Zuweisen</div>
          <div className="spacer" />
          <button className="btn secondary" onClick={() => (window.location.href = '/admin')}>← Dashboard</button>
          <button className="btn secondary" onClick={() => (window.location.href = '/teacher')}>Zur Lehrkräfte-Ansicht</button>
        </div>

        <div style={{ height: 12 }} />

        <div className="row">
          <input
            className="input"
            value={teacherId}
            onChange={(e) => setTeacherId(e.target.value)}
            placeholder="Lehrer-ID (teacher_id) scannen/eingeben"
            style={{ maxWidth: 380 }}
          />
          <button className="btn ok" onClick={upsertTeacher}>Lehrkraft speichern</button>
          <button className="btn secondary" onClick={() => openHelp('1) Lehrer-ID eingeben/scannen\n2) „Lehrkraft speichern“\n3) Bücher scannen: „Buch → Lehrkraft“\n4) Rückgabe: „Buch → Lager“')}>?</button>
        </div>

        <div style={{ height: 12 }} />
        <hr className="sep" />

        <div className="row">
          <input
            className="input"
            value={scan}
            onChange={(e) => setScan(e.target.value)}
            placeholder="Buch-Code scannen"
            style={{ maxWidth: 380 }}
          />
          <button className="btn ok" onClick={issueBookToTeacher}>Buch → Lehrkraft</button>
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
          Gespeicherte Lehrkräfte:
        </div>

        <div className="card" style={{ background: 'rgba(255,255,255,0.04)' }}>
          {filtered.length === 0 ? (
            <div className="small" style={{ opacity: 0.7 }}>Keine Treffer.</div>
          ) : (
            <div style={{ display: 'grid', gap: 8 }}>
              {filtered.map(t => (
                <div key={t.teacher_id} className="row" style={{ alignItems: 'center' }}>
                  <div className="kbd">{t.teacher_id}</div>
                  <div className="spacer" />
                  <button className="btn secondary" onClick={() => setTeacherId(t.teacher_id)}>
                    Als aktive Lehrkraft wählen
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
