'use client';

import { useEffect, useMemo, useState } from 'react';
import Topbar from '../../../components/Topbar';
import { supabase } from '../../../lib/supabaseClient';
import { fetchRole } from '../../../lib/role';

type StudentRow = {
  student_id: string;
  class_id: string | null;
  is_gu: boolean; // NOT NULL bei dir
  religion: 'EV' | 'RK' | 'PP' | null;
  course: 'Bio' | 'Chemie' | 'Sowi' | 'Informatik' | 'Arbeitslehre' | 'F' | null;
  active: boolean | null;
  created_at: string | null;
};

const COURSE_OPTIONS: StudentRow['course'][] = ['Bio', 'Chemie', 'Sowi', 'Informatik', 'Arbeitslehre', 'F'];
const REL_OPTIONS: NonNullable<StudentRow['religion']>[] = ['EV', 'RK', 'PP'];

type ClassRow = { class_id: string };

function gradeFromClassId(classId: string): number | null {
  const m = (classId || '').trim().match(/^(\d{1,2})/);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
}

export default function AdminStudentsPage() {
  const [ready, setReady] = useState(false);

  const [msg, setMsg] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  // Formular
  const [classId, setClassId] = useState('');       // z.B. 5a
  const [studentId, setStudentId] = useState('');   // z.B. S0001
  const [isGu, setIsGu] = useState(false);          // Regel default
  const [religion, setReligion] = useState<StudentRow['religion']>('EV'); // Pflicht
  const [course, setCourse] = useState<StudentRow['course']>(null);       // optional
  const [active, setActive] = useState(true);

  // Scannen
  const [bookCode, setBookCode] = useState('');

  // Liste
  const [rows, setRows] = useState<StudentRow[]>([]);
  const [loadingList, setLoadingList] = useState(false);

  // Auswahl zum Bearbeiten
  const [selected, setSelected] = useState<string | null>(null);

  const grade = useMemo(() => gradeFromClassId(classId), [classId]);
  const showCourseHint = grade !== null && grade >= 7;

  // ===== NEU: Klassenliste + Umsetzen =====
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [moveStudentId, setMoveStudentId] = useState('');
  const [moveToClassId, setMoveToClassId] = useState('');
  const [moveBusy, setMoveBusy] = useState(false);

  async function loadClasses() {
    const { data, error } = await supabase
      .from('sb_classes')
      .select('class_id')
      .order('class_id', { ascending: true });

    if (!error && data) {
      setClasses(data as any);
      // Falls noch nichts ausgewählt: ersten Wert setzen
      if (!moveToClassId && data.length > 0) setMoveToClassId((data[0] as any).class_id);
    }
  }

  async function moveStudentToClass() {
    setMsg(null);
    setOk(null);

    try {
      const sid = moveStudentId.trim() || studentId.trim();
      const newCid = moveToClassId.trim();

      if (!sid) throw new Error('Schüler-Code fehlt (für Umsetzen).');
      if (!newCid) throw new Error('Bitte Ziel-Klasse wählen.');

      setMoveBusy(true);

      // Admin-RPC (sauber & sicher)
      const { error } = await supabase.rpc('sb_admin_update_student_class', {
        p_student_id: sid,
        p_new_class_id: newCid,
      });

      if (error) throw error;

      setOk(`Schüler ${sid} wurde nach ${newCid} umgesetzt.`);
      // Formular ebenfalls aktualisieren (wenn es derselbe Schüler ist)
      if (studentId.trim() === sid) setClassId(newCid);

      await loadStudents();
    } catch (e: any) {
      setMsg(e?.message ?? 'Unbekannter Fehler beim Umsetzen.');
    } finally {
      setMoveBusy(false);
    }
  }

  function useSelectedForMove() {
    // nimmt den aktuell ausgewählten Schüler (selected) oder studentId
    const sid = (selected ?? studentId).trim();
    if (sid) setMoveStudentId(sid);
  }
  // ===== /NEU =====

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) return (window.location.href = '/login');
      const role = await fetchRole();
      if (role !== 'admin') return (window.location.href = '/teacher');

      setReady(true);
      await loadStudents();
      await loadClasses(); // NEU
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadStudents() {
    setLoadingList(true);
    setMsg(null);
    try {
      const { data, error } = await supabase
        .from('sb_students')
        .select('student_id, class_id, is_gu, religion, course, active, created_at')
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

  function resetForm() {
    setSelected(null);
    setClassId('');
    setStudentId('');
    setIsGu(false);
    setReligion('EV');
    setCourse(null);
    setActive(true);
    setBookCode('');
    setMsg(null);
    setOk(null);

    // NEU: Umsetzen-Form nicht hart löschen, aber Student-Feld leeren
    setMoveStudentId('');
  }

  function loadIntoForm(r: StudentRow) {
    setSelected(r.student_id);
    setClassId(r.class_id ?? '');
    setStudentId(r.student_id);
    setIsGu(Boolean(r.is_gu));
    setReligion((r.religion ?? 'EV') as any);
    setCourse((r.course ?? null) as any);
    setActive(Boolean(r.active ?? true));
    setOk(null);
    setMsg(null);

    // NEU: praktischer: direkt in Umsetzen-Feld übernehmen
    setMoveStudentId(r.student_id);
    if (r.class_id && !moveToClassId) setMoveToClassId(r.class_id);
  }

  async function saveStudent() {
    setMsg(null);
    setOk(null);

    try {
      const sid = studentId.trim();
      const cid = classId.trim();

      if (!sid) throw new Error('Schüler-Code fehlt (z.B. S0001).');
      if (!cid) throw new Error('Klasse fehlt (z.B. 5a).');

      if (!religion) throw new Error('Religion fehlt (EV / RK / PP).');

      const courseVal = course ? course : null;

      const { error } = await supabase
        .from('sb_students')
        .upsert(
          {
            student_id: sid,
            class_id: cid,
            is_gu: Boolean(isGu),
            religion,
            course: courseVal,
            active: Boolean(active),
          },
          { onConflict: 'student_id' }
        );

      if (error) throw error;

      setOk(`Schüler ${sid} gespeichert.`);
      setSelected(sid);
      await loadStudents();
    } catch (e: any) {
      setMsg(e?.message ?? 'Unbekannter Fehler beim Speichern.');
    }
  }

  async function assignBookToStudent() {
    setMsg(null);
    setOk(null);

    try {
      const sid = studentId.trim();
      const code = bookCode.trim();
      if (!sid) throw new Error('Schüler-Code fehlt (oben).');
      if (!code) throw new Error('Buch-Code fehlt.');

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
    const cid = classId.trim().toLowerCase();
    const sid = studentId.trim().toLowerCase();
    return rows.filter((r) => {
      const okClass = cid ? (r.class_id ?? '').toLowerCase().includes(cid) : true;
      const okStudent = sid ? (r.student_id ?? '').toLowerCase().includes(sid) : true;
      return okClass && okStudent;
    });
  }, [rows, classId, studentId]);

  if (!ready) return <div style={{ padding: 20 }}>Lade…</div>;

  return (
    <div className="container">
      <Topbar title="Admin · Schüler" />

      <div className="card">
        <div className="row">
          <div className="badge">Schüler anlegen / bearbeiten</div>
          <div className="spacer" />
          <button className="btn secondary" onClick={() => (window.location.href = '/admin')}>← Dashboard</button>
          <button className="btn secondary" onClick={() => (window.location.href = '/teacher')}>Lehrkräfte</button>
          <button className="btn secondary" onClick={resetForm}>Neu</button>
        </div>

        <div style={{ height: 12 }} />

        <div className="row">
          <input className="input" value={classId} onChange={(e) => setClassId(e.target.value)} placeholder="Klasse (z.B. 5a)" />
          <input className="input" value={studentId} onChange={(e) => setStudentId(e.target.value)} placeholder="Schüler-Code (z.B. S0001)" />
        </div>

        <div style={{ height: 10 }} />

        <div className="row">
          <label className="badge" style={{ cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={isGu}
              onChange={(e) => setIsGu(e.target.checked)}
              style={{ marginRight: 8 }}
            />
            GU (aus) / Regel (an) → aktuell: <b>{isGu ? 'GU' : 'Regel'}</b>
          </label>

          <select className="select" value={religion ?? ''} onChange={(e) => setReligion(e.target.value as any)} style={{ maxWidth: 180 }}>
            {REL_OPTIONS.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>

          <select
            className="select"
            value={course ?? ''}
            onChange={(e) => setCourse((e.target.value || null) as any)}
            style={{ maxWidth: 240 }}
          >
            <option value="">Kurs: keiner</option>
            {COURSE_OPTIONS.map((c) => (
              <option key={c!} value={c!}>{c}</option>
            ))}
          </select>

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
          <button className="btn ok" onClick={saveStudent}>Speichern</button>
        </div>

        {showCourseHint && (
          <div className="small" style={{ marginTop: 8, opacity: 0.85 }}>
            Hinweis: Klasse <b>{classId}</b> (ab Stufe 7) → Kurs kann gesetzt werden (Bio/Chemie/Sowi/Informatik/Arbeitslehre).
          </div>
        )}

        {msg && (
          <>
            <hr className="sep" />
            <div className="small" style={{ color: 'rgba(255,93,108,.95)', whiteSpace: 'pre-wrap' }}>{msg}</div>
          </>
        )}
        {ok && (
          <>
            <hr className="sep" />
            <div className="small" style={{ color: 'rgba(46,229,157,.95)', fontWeight: 800 }}>{ok}</div>
          </>
        )}

        <hr className="sep" />

        <div className="badge">Buch scannen (optional)</div>
        <div style={{ height: 8 }} />
        <div className="row">
          <input className="input" value={bookCode} onChange={(e) => setBookCode(e.target.value)} placeholder="Buch-Code scannen" />
          <button className="btn ok" onClick={assignBookToStudent}>Buch → Schüler</button>
          <button className="btn secondary" onClick={assignBookToStorage}>Buch → Lager</button>
        </div>

        {/* ===== NEU: Schüler umsetzen ===== */}
        <hr className="sep" />
        <div className="row">
          <div className="badge">Schüler in andere Klasse umsetzen (z.B. Wechsel / Nicht versetzt)</div>
          <div className="spacer" />
          <button className="btn secondary" onClick={loadClasses}>Klassen aktualisieren</button>
        </div>

        <div style={{ height: 8 }} />

        <div className="row" style={{ flexWrap: 'wrap', gap: 10 }}>
          <input
            className="input"
            value={moveStudentId}
            onChange={(e) => setMoveStudentId(e.target.value)}
            placeholder="Schüler-Code (leer = nimmt oben)"
            style={{ maxWidth: 260 }}
          />

          <select
            className="select"
            value={moveToClassId}
            onChange={(e) => setMoveToClassId(e.target.value)}
            style={{ maxWidth: 200 }}
          >
            {classes.length === 0 ? (
              <option value={moveToClassId || ''}>{moveToClassId || '(keine Klassen geladen)'}</option>
            ) : null}
            {classes.map((c) => (
              <option key={c.class_id} value={c.class_id}>
                {c.class_id}
              </option>
            ))}
          </select>

          <button className="btn ok" onClick={moveStudentToClass} disabled={moveBusy}>
            {moveBusy ? 'Speichere…' : 'Klasse ändern'}
          </button>

          <button className="btn secondary" onClick={useSelectedForMove}>
            Aus Auswahl übernehmen
          </button>

          <div className="small" style={{ opacity: 0.85 }}>
            Tipp: „Bearbeiten“ klicken → Schüler wird automatisch ins Umsetzen-Feld übernommen.
          </div>
        </div>
        {/* ===== /NEU ===== */}

        <hr className="sep" />

        <div className="row">
          <div className="badge">Gespeicherte Schüler</div>
          <div className="spacer" />
          <button className="btn secondary" onClick={loadStudents}>Liste aktualisieren</button>
        </div>

        {loadingList ? (
          <div className="small" style={{ marginTop: 10 }}>Lade…</div>
        ) : (
          <div className="small" style={{ marginTop: 10, lineHeight: 1.8 }}>
            {filtered.length === 0 ? (
              <div>Keine Treffer.</div>
            ) : (
              filtered.map((r) => (
                <div key={r.student_id} style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <button className="btn secondary" style={{ padding: '6px 10px' }} onClick={() => loadIntoForm(r)}>
                    Bearbeiten
                  </button>
                  <div>
                    <b>{r.student_id}</b> — Klasse: <b>{r.class_id ?? '-'}</b> — {r.is_gu ? 'GU' : 'Regel'} — Reli:{' '}
                    <b>{r.religion ?? '-'}</b> — Kurs: <b>{r.course ?? '-'}</b> — aktiv: {String(r.active ?? true)}
                    {selected === r.student_id ? <span className="badge" style={{ marginLeft: 8 }}>ausgewählt</span> : null}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
