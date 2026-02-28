'use client';

import { useEffect, useMemo, useState } from 'react';
import Topbar from '../../components/Topbar';
import { supabase } from '../../lib/supabaseClient';
import { fetchRole } from '../../lib/role';

type Assignment = {
  book_code: string;
  holder_type: string;
  holder_id: string;
};

type ClassRequiredRow = {
  class_id: string | null;
  subject: string | null;
  title_id: string;
  title_name: string | null;
  isbn: string | null;
  price_eur: number | null;
  cnt_should: number | null;
  cnt_is: number | null;
  cnt_missing: number | null;
  cnt_extra: number | null;
};

type StudentRequiredRow = {
  student_id: string;
  class_id: string | null;
  subject: string | null;
  title_id: string;
  title_name: string | null;
  isbn: string | null;
  price_eur: number | null;
  cnt_should: number | null;
  cnt_is: number | null;
  cnt_missing: number | null;
  cnt_extra: number | null;
};

type MissingStudentRow = {
  class_id: string;
  student_id: string;
  title_id: string;
  subject: string | null;
  title_name: string | null;
  isbn: string | null;
  price_eur: number | null;
};

function euro(n: number | null | undefined) {
  if (n == null || Number.isNaN(n)) return '-';
  return Number(n).toFixed(2).replace('.', ',') + ' €';
}

export default function TeacherPage() {
  const [ready, setReady] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [email, setEmail] = useState<string>('');
  const [role, setRole] = useState<string>('');
  const [teacherId, setTeacherId] = useState<string>('');
  const [items, setItems] = useState<Assignment[]>([]);

  // ===== Soll–Ist je Klasse =====
  const [checkClassId, setCheckClassId] = useState('5a');
  const [checkRows, setCheckRows] = useState<ClassRequiredRow[]>([]);
  const [checkLoading, setCheckLoading] = useState(false);
  const [checkErr, setCheckErr] = useState<string | null>(null);
  const [checkQuery, setCheckQuery] = useState('');

  const filteredCheckRows = useMemo(() => {
    const q = checkQuery.trim().toLowerCase();
    if (!q) return checkRows;
    return checkRows.filter((r) => {
      const hay = [r.title_id, r.title_name ?? '', r.subject ?? '', r.isbn ?? ''].join(' ').toLowerCase();
      return hay.includes(q);
    });
  }, [checkRows, checkQuery]);

  const checkTotals = useMemo(() => {
    let should = 0,
      isv = 0,
      miss = 0,
      extra = 0;
    for (const r of filteredCheckRows) {
      should += Number(r.cnt_should ?? 0);
      isv += Number(r.cnt_is ?? 0);
      miss += Number(r.cnt_missing ?? 0);
      extra += Number(r.cnt_extra ?? 0);
    }
    return { should, isv, miss, extra };
  }, [filteredCheckRows]);

  async function loadClassCheck() {
    setCheckErr(null);
    setCheckLoading(true);
    try {
      const cid = checkClassId.trim();
      if (!cid) throw new Error('Bitte Klasse eingeben (z.B. 5a).');

      const { data, error } = await supabase
        .from('sb_class_required_check')
        .select('class_id,subject,title_id,title_name,isbn,price_eur,cnt_should,cnt_is,cnt_missing,cnt_extra')
        .ilike('class_id', cid)
        .order('subject', { ascending: true })
        .order('title_name', { ascending: true });

      if (error) throw error;
      setCheckRows((data ?? []) as any);
    } catch (e: any) {
      setCheckErr(e?.message ?? 'Fehler beim Laden des Abgleichs.');
      setCheckRows([]);
    } finally {
      setCheckLoading(false);
    }
  }
  // ===== /Soll–Ist je Klasse =====

  // ===== Soll–Ist pro Schüler =====
  const [checkStudentId, setCheckStudentId] = useState('S0001');
  const [studentClassId, setStudentClassId] = useState<string>('');
  const [studentRows, setStudentRows] = useState<StudentRequiredRow[]>([]);
  const [studentLoading, setStudentLoading] = useState(false);
  const [studentErr, setStudentErr] = useState<string | null>(null);
  const [studentQuery, setStudentQuery] = useState('');

  const filteredStudentRows = useMemo(() => {
    const q = studentQuery.trim().toLowerCase();
    if (!q) return studentRows;
    return studentRows.filter((r) => {
      const hay = [r.title_id, r.title_name ?? '', r.subject ?? '', r.isbn ?? ''].join(' ').toLowerCase();
      return hay.includes(q);
    });
  }, [studentRows, studentQuery]);

  const studentTotals = useMemo(() => {
    let should = 0,
      isv = 0,
      miss = 0,
      extra = 0;
    for (const r of filteredStudentRows) {
      should += Number(r.cnt_should ?? 0);
      isv += Number(r.cnt_is ?? 0);
      miss += Number(r.cnt_missing ?? 0);
      extra += Number(r.cnt_extra ?? 0);
    }
    return { should, isv, miss, extra };
  }, [filteredStudentRows]);

  async function loadStudentCheck() {
    setStudentErr(null);
    setStudentLoading(true);
    try {
      const sid = checkStudentId.trim();
      if (!sid) throw new Error('Bitte Schülercode eingeben (z.B. S0001).');

      const { data: sData, error: sErr } = await supabase
        .from('sb_students')
        .select('student_id,class_id')
        .eq('student_id', sid)
        .maybeSingle();

      if (sErr) throw sErr;
      const cid = (sData as any)?.class_id ?? '';
      setStudentClassId(cid);

      const { data, error } = await supabase
        .from('sb_student_required_check')
        .select('student_id,class_id,subject,title_id,title_name,isbn,price_eur,cnt_should,cnt_is,cnt_missing,cnt_extra')
        .eq('student_id', sid)
        .order('subject', { ascending: true })
        .order('title_name', { ascending: true });

      if (error) throw error;
      setStudentRows((data ?? []) as any);
    } catch (e: any) {
      setStudentErr(e?.message ?? 'Fehler beim Laden (Schüler-Abgleich).');
      setStudentRows([]);
      setStudentClassId('');
    } finally {
      setStudentLoading(false);
    }
  }
  // ===== /Soll–Ist pro Schüler =====

  // ===== „Wer fehlt?“ (read-only) =====
  const [missingOpen, setMissingOpen] = useState(false);
  const [missingTitle, setMissingTitle] = useState<{ title_id: string; title_name?: string | null; subject?: string | null } | null>(null);
  const [missingRows, setMissingRows] = useState<MissingStudentRow[]>([]);
  const [missingLoading, setMissingLoading] = useState(false);
  const [missingErr, setMissingErr] = useState<string | null>(null);

  async function loadMissingStudentsForTitle(r: ClassRequiredRow) {
    setMissingErr(null);
    setMissingLoading(true);
    setMissingOpen(true);
    setMissingTitle({ title_id: r.title_id, title_name: r.title_name, subject: r.subject });

    try {
      const cid = checkClassId.trim();
      if (!cid) throw new Error('Klasse fehlt.');
      if (!r?.title_id) throw new Error('Titel fehlt.');

      const { data, error } = await supabase
        .from('sb_class_title_missing_students')
        .select('class_id,student_id,title_id,subject,title_name,isbn,price_eur')
        .ilike('class_id', cid)
        .eq('title_id', r.title_id)
        .order('student_id', { ascending: true });

      if (error) throw error;
      setMissingRows((data ?? []) as any);
    } catch (e: any) {
      setMissingErr(e?.message ?? 'Fehler beim Laden der fehlenden Schüler.');
      setMissingRows([]);
    } finally {
      setMissingLoading(false);
    }
  }

  function closeMissing() {
    setMissingOpen(false);
    setMissingTitle(null);
    setMissingRows([]);
    setMissingErr(null);
  }
  // ===== /Wer fehlt =====

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
      if (!(r === 'teacher' || r === 'teacher_readonly')) {
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
      <Topbar title="Lehrkräfte (nur Ansicht)" />

      {/* Kopf / Meta */}
      <div className="card">
        <div className="row">
          <div className="badge">Eingeloggt: {email || '—'}</div>
          <div className="badge">Rolle: {role || '—'}</div>
          <div className="badge">Teacher-ID: {teacherId || '—'}</div>
          <div className="spacer" />
          <button className="btn secondary" onClick={() => supabase.auth.signOut().then(() => (window.location.href = '/login'))}>
            Logout
          </button>
        </div>

        <div style={{ height: 12 }} />

        <div className="small">
          Diese Seite ist <b>nur Ansicht</b>: Keine Scan-Funktionen, keine Änderungen, kein Wechsel in den Admin-Bereich.
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

      {/* ===== Soll–Ist Abgleich je Klasse (read-only) ===== */}
      <div className="card" style={{ marginTop: 14 }}>
        <div className="row">
          <div className="badge">Soll–Ist Abgleich je Klasse (nur Ansicht)</div>
          <div className="spacer" />
          <button className="btn secondary" onClick={loadClassCheck} disabled={checkLoading}>
            {checkLoading ? 'Lade…' : 'Aktualisieren'}
          </button>
        </div>

        <div style={{ height: 10 }} />

        <div className="row" style={{ flexWrap: 'wrap', gap: 10 }}>
          <input
            className="input"
            value={checkClassId}
            onChange={(e) => setCheckClassId(e.target.value)}
            placeholder="Klasse (z.B. 5a)"
            style={{ maxWidth: 160 }}
          />
          <button className="btn ok" onClick={loadClassCheck} disabled={checkLoading}>
            Abgleich laden
          </button>

          <input
            className="input"
            value={checkQuery}
            onChange={(e) => setCheckQuery(e.target.value)}
            placeholder="Suchen nach Fach / Titel / ISBN / title_id…"
            style={{ maxWidth: 420 }}
          />

          <div className="spacer" />
          <div className="badge">Titel: {filteredCheckRows.length}</div>
          <div className="badge">Soll: {checkTotals.should}</div>
          <div className="badge">Ist: {checkTotals.isv}</div>
          <div className="badge" style={{ borderColor: 'rgba(255,93,108,.6)' }}>Fehlt: {checkTotals.miss}</div>
          <div className="badge" style={{ borderColor: 'rgba(255,188,66,.6)' }}>Zu viel: {checkTotals.extra}</div>
        </div>

        {checkErr ? (
          <>
            <hr className="sep" />
            <div className="small" style={{ color: 'rgba(255,93,108,.95)', whiteSpace: 'pre-wrap' }}>
              {checkErr}
              {'\n\n'}
              Hinweis: Prüfe, ob die View <b>sb_class_required_check</b> existiert und lesbar ist.
            </div>
          </>
        ) : null}

        <hr className="sep" />

        {filteredCheckRows.length === 0 ? (
          <div className="small" style={{ opacity: 0.85 }}>
            Keine Daten (oder Filter zu eng). Tipp: Klasse eingeben und „Abgleich laden“.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: 8 }}>Fach</th>
                  <th style={{ textAlign: 'left', padding: 8 }}>Titel</th>
                  <th style={{ textAlign: 'left', padding: 8 }}>ISBN</th>
                  <th style={{ textAlign: 'left', padding: 8 }}>Preis</th>
                  <th style={{ textAlign: 'right', padding: 8 }}>Soll</th>
                  <th style={{ textAlign: 'right', padding: 8 }}>Ist</th>
                  <th style={{ textAlign: 'right', padding: 8 }}>Fehlt</th>
                  <th style={{ textAlign: 'right', padding: 8 }}>Zu viel</th>
                  <th style={{ textAlign: 'left', padding: 8 }}>Info</th>
                </tr>
              </thead>
              <tbody>
                {filteredCheckRows.map((r, idx) => {
                  const missing = Number(r.cnt_missing ?? 0);
                  const extra = Number(r.cnt_extra ?? 0);
                  const okRow = missing === 0 && extra === 0;

                  return (
                    <tr key={`${r.title_id}_${idx}`} style={{ borderTop: '1px solid rgba(255,255,255,0.10)' }}>
                      <td style={{ padding: 8, opacity: 0.9 }}>{r.subject ?? '-'}</td>
                      <td style={{ padding: 8 }}>
                        <div style={{ fontWeight: 800 }}>{r.title_name ?? r.title_id}</div>
                        <div className="small" style={{ opacity: 0.75 }}>{r.title_id}</div>
                      </td>
                      <td style={{ padding: 8, opacity: 0.9 }}>{r.isbn ?? '-'}</td>
                      <td style={{ padding: 8, opacity: 0.9 }}>{euro(r.price_eur)}</td>
                      <td style={{ padding: 8, textAlign: 'right' }}>{Number(r.cnt_should ?? 0)}</td>
                      <td style={{ padding: 8, textAlign: 'right' }}>{Number(r.cnt_is ?? 0)}</td>
                      <td style={{ padding: 8, textAlign: 'right', fontWeight: 800, color: missing > 0 ? 'rgba(255,93,108,.95)' : 'rgba(255,255,255,0.85)' }}>
                        {missing}
                      </td>
                      <td style={{ padding: 8, textAlign: 'right', fontWeight: 800, color: extra > 0 ? 'rgba(255,188,66,.95)' : 'rgba(255,255,255,0.85)' }}>
                        {extra}
                      </td>
                      <td style={{ padding: 8 }}>
                        {okRow ? (
                          <span className="badge">OK</span>
                        ) : missing > 0 ? (
                          <button className="btn secondary" style={{ padding: '6px 10px' }} onClick={() => loadMissingStudentsForTitle(r)}>
                            Wer fehlt?
                          </button>
                        ) : (
                          <span className="badge">Prüfen</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* ===== Fehlende Schüler anzeigen (Wer fehlt?) ===== */}
        {missingOpen && missingTitle ? (
          <>
            <hr className="sep" />
            <div className="row">
              <div className="badge">
                Fehlt bei Schülern: {missingTitle.subject ?? ''} · {missingTitle.title_name ?? missingTitle.title_id} ({missingTitle.title_id}) · Klasse {checkClassId.trim()}
              </div>
              <div className="spacer" />
              <button className="btn secondary" onClick={closeMissing} disabled={missingLoading}>
                Schließen
              </button>
            </div>

            {missingLoading ? (
              <div className="small" style={{ marginTop: 10 }}>Lade…</div>
            ) : missingErr ? (
              <div className="small" style={{ marginTop: 10, color: 'rgba(255,93,108,.95)', whiteSpace: 'pre-wrap' }}>
                {missingErr}
                {'\n\n'}
                Hinweis: Prüfe, ob die View <b>sb_class_title_missing_students</b> existiert und lesbar ist.
              </div>
            ) : (
              <div className="small" style={{ marginTop: 10, lineHeight: 1.8 }}>
                {missingRows.length === 0 ? (
                  <div>Keine fehlenden Schüler gefunden.</div>
                ) : (
                  <>
                    <div style={{ marginBottom: 8, opacity: 0.85 }}>
                      Anzahl: <b>{missingRows.length}</b>
                    </div>
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                      {missingRows.map((m) => (
                        <span key={m.student_id} className="badge">{m.student_id}</span>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </>
        ) : null}
        {/* ===== /Wer fehlt ===== */}

        <div style={{ height: 6 }} />
        <div className="small" style={{ opacity: 0.75 }}>
          Quelle: View <b>sb_class_required_check</b>
        </div>
      </div>

      {/* ===== Soll–Ist Abgleich pro Schüler (read-only) ===== */}
      <div className="card" style={{ marginTop: 14 }}>
        <div className="row">
          <div className="badge">Soll–Ist Abgleich pro Schüler (nur Ansicht)</div>
          <div className="spacer" />
          <button className="btn secondary" onClick={loadStudentCheck} disabled={studentLoading}>
            {studentLoading ? 'Lade…' : 'Aktualisieren'}
          </button>
        </div>

        <div style={{ height: 10 }} />

        <div className="row" style={{ flexWrap: 'wrap', gap: 10 }}>
          <input
            className="input"
            value={checkStudentId}
            onChange={(e) => setCheckStudentId(e.target.value)}
            placeholder="Schülercode (z.B. S0001)"
            style={{ maxWidth: 200 }}
          />
          <button className="btn ok" onClick={loadStudentCheck} disabled={studentLoading}>
            Abgleich laden
          </button>

          <div className="badge">Klasse: <b>{studentClassId || '-'}</b></div>

          <input
            className="input"
            value={studentQuery}
            onChange={(e) => setStudentQuery(e.target.value)}
            placeholder="Suchen nach Fach / Titel / ISBN / title_id…"
            style={{ maxWidth: 420 }}
          />

          <div className="spacer" />
          <div className="badge">Titel: {filteredStudentRows.length}</div>
          <div className="badge">Soll: {studentTotals.should}</div>
          <div className="badge">Ist: {studentTotals.isv}</div>
          <div className="badge" style={{ borderColor: 'rgba(255,93,108,.6)' }}>Fehlt: {studentTotals.miss}</div>
          <div className="badge" style={{ borderColor: 'rgba(255,188,66,.6)' }}>Zu viel: {studentTotals.extra}</div>
        </div>

        {studentErr ? (
          <>
            <hr className="sep" />
            <div className="small" style={{ color: 'rgba(255,93,108,.95)', whiteSpace: 'pre-wrap' }}>
              {studentErr}
              {'\n\n'}
              Hinweis: Prüfe, ob die View <b>sb_student_required_check</b> existiert und lesbar ist.
            </div>
          </>
        ) : null}

        <hr className="sep" />

        {filteredStudentRows.length === 0 ? (
          <div className="small" style={{ opacity: 0.85 }}>
            Keine Daten (oder Filter zu eng). Tipp: Schülercode eingeben und „Abgleich laden“.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: 8 }}>Fach</th>
                  <th style={{ textAlign: 'left', padding: 8 }}>Titel</th>
                  <th style={{ textAlign: 'left', padding: 8 }}>ISBN</th>
                  <th style={{ textAlign: 'left', padding: 8 }}>Preis</th>
                  <th style={{ textAlign: 'right', padding: 8 }}>Soll</th>
                  <th style={{ textAlign: 'right', padding: 8 }}>Ist</th>
                  <th style={{ textAlign: 'right', padding: 8 }}>Fehlt</th>
                  <th style={{ textAlign: 'right', padding: 8 }}>Zu viel</th>
                </tr>
              </thead>
              <tbody>
                {filteredStudentRows.map((r, idx) => {
                  const missing = Number(r.cnt_missing ?? 0);
                  const extra = Number(r.cnt_extra ?? 0);
                  const okRow = missing === 0 && extra === 0;

                  return (
                    <tr key={`${r.student_id}_${r.title_id}_${idx}`} style={{ borderTop: '1px solid rgba(255,255,255,0.10)' }}>
                      <td style={{ padding: 8, opacity: 0.9 }}>{r.subject ?? '-'}</td>
                      <td style={{ padding: 8 }}>
                        <div style={{ fontWeight: 800 }}>{r.title_name ?? r.title_id}</div>
                        <div className="small" style={{ opacity: 0.75 }}>{r.title_id}</div>
                      </td>
                      <td style={{ padding: 8, opacity: 0.9 }}>{r.isbn ?? '-'}</td>
                      <td style={{ padding: 8, opacity: 0.9 }}>{euro(r.price_eur)}</td>
                      <td style={{ padding: 8, textAlign: 'right' }}>{Number(r.cnt_should ?? 0)}</td>
                      <td style={{ padding: 8, textAlign: 'right' }}>{Number(r.cnt_is ?? 0)}</td>
                      <td style={{ padding: 8, textAlign: 'right', fontWeight: 800, color: missing > 0 ? 'rgba(255,93,108,.95)' : 'rgba(255,255,255,0.85)' }}>
                        {missing}
                      </td>
                      <td style={{ padding: 8, textAlign: 'right', fontWeight: 800, color: extra > 0 ? 'rgba(255,188,66,.95)' : 'rgba(255,255,255,0.85)' }}>
                        {extra}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div style={{ height: 6 }} />
        <div className="small" style={{ opacity: 0.75 }}>
          Quelle: View <b>sb_student_required_check</b>
        </div>
      </div>
    </div>
  );
}
