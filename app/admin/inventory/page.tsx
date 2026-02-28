'use client';

import { useEffect, useMemo, useState } from 'react';
import Topbar from '../../../components/Topbar';
import { supabase } from '../../../lib/supabaseClient';
import { fetchRole } from '../../../lib/role';

type TitleSummaryRow = {
  title_id: string;
  subject: string | null;
  title_name: string | null;
  isbn: string | null;
  price_eur: number | null;
  cnt_students: number | null;
  cnt_teachers: number | null;
  cnt_storage: number | null;
  cnt_total: number | null;
};

// ===== Soll–Ist Abgleich je Klasse =====
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

type StudentMiniRow = {
  student_id: string;
  class_id: string | null;
  is_gu: boolean;
  religion: string | null;
  course: string | null;
  active: boolean | null;
};
// ===== /Soll–Ist =====

function euro(n: number | null | undefined) {
  if (n == null || Number.isNaN(n)) return '-';
  return Number(n).toFixed(2).replace('.', ',') + ' €';
}

export default function AdminInventoryPage() {
  const [ready, setReady] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const [titleId, setTitleId] = useState('PO_TEAM_1');
  const [subject, setSubject] = useState('Politik');
  const [titleName, setTitleName] = useState('Team 1');
  const [isbn, setIsbn] = useState('');
  const [priceEur, setPriceEur] = useState('32.95');

  const [bookCodes, setBookCodes] = useState('9149,29171,2066,2084,9165,2014,2101,2004,2116');

  const [status, setStatus] = useState<'ok' | 'active'>('ok');
  const [condition, setCondition] = useState<'ok' | 'used' | 'damaged'>('ok');
  const [putIntoStorage, setPutIntoStorage] = useState(true);

  // ===== Titel-Übersicht (Schüler/Lehrer/Lager) =====
  const [sumLoading, setSumLoading] = useState(false);
  const [sumError, setSumError] = useState<string | null>(null);
  const [summary, setSummary] = useState<TitleSummaryRow[]>([]);
  const [sumQuery, setSumQuery] = useState('');

  const filteredSummary = useMemo(() => {
    const q = sumQuery.trim().toLowerCase();
    if (!q) return summary;
    return summary.filter((r) => {
      const hay = [r.title_id, r.subject ?? '', r.title_name ?? '', r.isbn ?? ''].join(' ').toLowerCase();
      return hay.includes(q);
    });
  }, [summary, sumQuery]);

  const sumTotals = useMemo(() => {
    let sStud = 0, sTeach = 0, sStor = 0, sTot = 0;
    for (const r of filteredSummary) {
      sStud += Number(r.cnt_students ?? 0);
      sTeach += Number(r.cnt_teachers ?? 0);
      sStor += Number(r.cnt_storage ?? 0);
      sTot += Number(r.cnt_total ?? 0);
    }
    return { sStud, sTeach, sStor, sTot };
  }, [filteredSummary]);

  async function loadSummary() {
    setSumError(null);
    setSumLoading(true);
    try {
      const { data, error } = await supabase
        .from('sb_title_location_summary')
        .select('title_id,subject,title_name,isbn,price_eur,cnt_students,cnt_teachers,cnt_storage,cnt_total')
        .order('subject', { ascending: true })
        .order('title_name', { ascending: true });

      if (error) throw error;
      setSummary((data ?? []) as any);
    } catch (e: any) {
      setSumError(e?.message ?? 'Fehler beim Laden der Titel-Übersicht.');
    } finally {
      setSumLoading(false);
    }
  }
  // ===== /Titel-Übersicht =====

  // ===== Soll–Ist Abgleich (View sb_class_required_check) =====
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
    let should = 0, isv = 0, miss = 0, extra = 0;
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
        .eq('class_id', cid)
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
  // ===== /Soll–Ist =====

  // ===== NEU: „Fehlt → Jetzt zuweisen“ (Buchcode eingeben) =====
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignTitle, setAssignTitle] = useState<{ title_id: string; title_name?: string | null; subject?: string | null } | null>(null);
  const [assignBookCode, setAssignBookCode] = useState('');
  const [assignStudentId, setAssignStudentId] = useState(''); // optional
  const [assignBusy, setAssignBusy] = useState(false);
  const [assignMsg, setAssignMsg] = useState<string | null>(null);
  const [assignOk, setAssignOk] = useState<string | null>(null);

  function openAssign(r: ClassRequiredRow) {
    setAssignOpen(true);
    setAssignTitle({ title_id: r.title_id, title_name: r.title_name, subject: r.subject });
    setAssignBookCode('');
    setAssignStudentId('');
    setAssignMsg(null);
    setAssignOk(null);
  }

  function closeAssign() {
    setAssignOpen(false);
    setAssignTitle(null);
    setAssignBookCode('');
    setAssignStudentId('');
    setAssignMsg(null);
    setAssignOk(null);
  }

  async function findFirstMissingStudentId(p_class_id: string, p_title_id: string): Promise<string> {
    // 1) alle Schüler der Klasse holen
    const { data: studs, error: e1 } = await supabase
      .from('sb_students')
      .select('student_id,class_id,is_gu,religion,course,active')
      .eq('class_id', p_class_id)
      .order('student_id', { ascending: true });

    if (e1) throw e1;
    const students = (studs ?? []) as StudentMiniRow[];
    if (students.length === 0) throw new Error(`Keine Schüler in Klasse ${p_class_id} gefunden.`);

    // 2) Für jeden Schüler prüfen, ob er das title_id bereits hat
    //    -> sb_books muss vorhanden sein und Felder: holder_type, holder_id, title_id
    for (const s of students) {
      const { data: books, error: e2 } = await supabase
        .from('sb_books')
        .select('book_code')
        .eq('holder_type', 'student')
        .eq('holder_id', s.student_id)
        .eq('title_id', p_title_id)
        .limit(1);

      if (e2) throw e2;
      const hasIt = (books ?? []).length > 0;
      if (!hasIt) return s.student_id;
    }

    throw new Error(`Alle Schüler in ${p_class_id} haben ${p_title_id} bereits (keiner fehlt mehr).`);
  }

  async function assignNow() {
    setAssignMsg(null);
    setAssignOk(null);
    setAssignBusy(true);
    try {
      const cid = checkClassId.trim();
      if (!cid) throw new Error('Klasse fehlt.');
      if (!assignTitle?.title_id) throw new Error('Titel fehlt.');
      const code = assignBookCode.trim();
      if (!code) throw new Error('Bitte Buchcode eingeben.');

      // Ziel-Schüler bestimmen
      let sid = assignStudentId.trim();
      if (!sid) {
        sid = await findFirstMissingStudentId(cid, assignTitle.title_id);
      }

      // ✅ Zuweisen (Admin)
      // Wenn deine RPC anders heißt, ändere NUR diese Zeile:
      const { error } = await supabase.rpc('sb_scan_book_admin', {
        p_scan: code,
        p_new_holder_type: 'student',
        p_new_holder_id: sid,
        p_note: `Admin-Zuweisung (Soll–Ist) Klasse ${cid} / ${assignTitle.title_id}`,
      });

      if (error) throw error;

      setAssignOk(`Buch ${code} → Schüler ${sid} (Klasse ${cid})`);
      setAssignBookCode('');

      // Abgleich + Summary aktualisieren
      await loadClassCheck();
      await loadSummary();
    } catch (e: any) {
      setAssignMsg(e?.message ?? 'Unbekannter Fehler beim Zuweisen.');
    } finally {
      setAssignBusy(false);
    }
  }
  // ===== /NEU =====

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) return (window.location.href = '/login');
      const role = await fetchRole();
      if (role !== 'admin') return (window.location.href = '/teacher');
      setReady(true);

      loadSummary();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function save() {
    setMsg(null);
    setOk(null);

    try {
      const codes = bookCodes
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      const pr = Number(String(priceEur).replace(',', '.'));
      if (Number.isNaN(pr)) throw new Error('Preis ist keine Zahl.');

      const { error } = await supabase.rpc('sb_admin_create_title_with_books', {
        p_title_id: titleId.trim(),
        p_subject: subject.trim(),
        p_title_name: titleName.trim(),
        p_isbn: isbn.trim(),
        p_price_eur: pr,
        p_book_codes: codes,
        p_condition: condition,
        p_status: status,
        p_put_into_storage: putIntoStorage,
      });

      if (error) throw error;
      setOk('Erfolgreich gespeichert.');

      loadSummary();
    } catch (e: any) {
      setMsg(e?.message ?? 'Unbekannter Fehler');
    }
  }

  if (!ready) {
    return (
      <div className="container">
        <div className="card">
          <div className="h1">Admin</div>
          <p className="sub">Lade…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <Topbar title="Bestand / Titel & Bücher" />

      <div className="card">
        <div className="row">
          <div className="badge">Titel + Bücher anlegen/aktualisieren</div>
          <div className="spacer" />
          <button className="btn secondary" onClick={() => (window.location.href = '/admin/dashboard')}>
            Zurück zum Dashboard
          </button>
        </div>

        <div style={{ height: 12 }} />

        <div className="row">
          <input className="input" value={titleId} onChange={(e) => setTitleId(e.target.value)} placeholder="p_title_id" />
          <input className="input" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="p_subject" />
        </div>

        <div style={{ height: 10 }} />

        <div className="row">
          <input className="input" value={titleName} onChange={(e) => setTitleName(e.target.value)} placeholder="p_title_name" />
          <input className="input" value={isbn} onChange={(e) => setIsbn(e.target.value)} placeholder="p_isbn (optional)" />
        </div>

        <div style={{ height: 10 }} />

        <div className="row">
          <input className="input" value={priceEur} onChange={(e) => setPriceEur(e.target.value)} placeholder="p_price_eur" />
        </div>

        <div style={{ height: 10 }} />

        <div className="row">
          <input
            className="input"
            style={{ maxWidth: 860 }}
            value={bookCodes}
            onChange={(e) => setBookCodes(e.target.value)}
            placeholder="p_book_codes (Komma-getrennt)"
          />
        </div>

        <div style={{ height: 10 }} />

        <div className="row">
          <select className="select" value={status} onChange={(e) => setStatus(e.target.value as any)} style={{ maxWidth: 240 }}>
            <option value="ok">Status: ok</option>
            <option value="active">Status: active</option>
          </select>

          <select className="select" value={condition} onChange={(e) => setCondition(e.target.value as any)} style={{ maxWidth: 240 }}>
            <option value="ok">Zustand: ok</option>
            <option value="used">Zustand: used</option>
            <option value="damaged">Zustand: damaged</option>
          </select>

          <label className="badge" style={{ cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={putIntoStorage}
              onChange={(e) => setPutIntoStorage(e.target.checked)}
              style={{ marginRight: 8 }}
            />
            In Lager einbuchen
          </label>

          <div className="spacer" />
          <button className="btn ok" onClick={save}>Speichern</button>
        </div>

        {msg && (
          <>
            <hr className="sep" />
            <div className="small" style={{ color: 'rgba(255,93,108,.95)' }}>{msg}</div>
          </>
        )}

        {ok && (
          <>
            <hr className="sep" />
            <div className="small" style={{ color: 'rgba(46,229,157,.95)', fontWeight: 800 }}>{ok}</div>
          </>
        )}
      </div>

      {/* ===== Übersicht pro Titel (Schüler/Lehrer/Lager) ===== */}
      <div className="card" style={{ marginTop: 14 }}>
        <div className="row">
          <div className="badge">Übersicht je Titel: Schüler / Lehrer / Lager</div>
          <div className="spacer" />

          <button className="btn secondary" onClick={loadSummary} disabled={sumLoading}>
            {sumLoading ? 'Lade…' : 'Aktualisieren'}
          </button>
        </div>

        <div style={{ height: 10 }} />

        <div className="row" style={{ flexWrap: 'wrap', gap: 10 }}>
          <input
            className="input"
            value={sumQuery}
            onChange={(e) => setSumQuery(e.target.value)}
            placeholder="Suchen nach Fach / Titel / ISBN / title_id…"
            style={{ maxWidth: 520 }}
          />
          <div className="spacer" />
          <div className="badge">Titel: {filteredSummary.length}</div>
          <div className="badge">Schüler: {sumTotals.sStud}</div>
          <div className="badge">Lehrer: {sumTotals.sTeach}</div>
          <div className="badge">Lager: {sumTotals.sStor}</div>
          <div className="badge">Gesamt: {sumTotals.sTot}</div>
        </div>

        {sumError ? (
          <>
            <hr className="sep" />
            <div className="small" style={{ color: 'rgba(255,93,108,.95)', whiteSpace: 'pre-wrap' }}>
              {sumError}
              {'\n\n'}
              Hinweis: Prüfe, ob die View <b>sb_title_location_summary</b> in Supabase existiert.
            </div>
          </>
        ) : null}

        <hr className="sep" />

        {filteredSummary.length === 0 ? (
          <div className="small" style={{ opacity: 0.85 }}>
            Keine Daten (oder Filter zu eng).
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
                  <th style={{ textAlign: 'right', padding: 8 }}>Schüler</th>
                  <th style={{ textAlign: 'right', padding: 8 }}>Lehrer</th>
                  <th style={{ textAlign: 'right', padding: 8 }}>Lager</th>
                  <th style={{ textAlign: 'right', padding: 8 }}>Gesamt</th>
                </tr>
              </thead>
              <tbody>
                {filteredSummary.map((r) => (
                  <tr key={r.title_id} style={{ borderTop: '1px solid rgba(255,255,255,0.10)' }}>
                    <td style={{ padding: 8, opacity: 0.9 }}>{r.subject ?? '-'}</td>
                    <td style={{ padding: 8 }}>
                      <div style={{ fontWeight: 800 }}>{r.title_name ?? r.title_id}</div>
                      <div className="small" style={{ opacity: 0.75 }}>{r.title_id}</div>
                    </td>
                    <td style={{ padding: 8, opacity: 0.9 }}>{r.isbn ?? '-'}</td>
                    <td style={{ padding: 8, opacity: 0.9 }}>{euro(r.price_eur)}</td>
                    <td style={{ padding: 8, textAlign: 'right' }}>{Number(r.cnt_students ?? 0)}</td>
                    <td style={{ padding: 8, textAlign: 'right' }}>{Number(r.cnt_teachers ?? 0)}</td>
                    <td style={{ padding: 8, textAlign: 'right' }}>{Number(r.cnt_storage ?? 0)}</td>
                    <td style={{ padding: 8, textAlign: 'right', fontWeight: 800 }}>{Number(r.cnt_total ?? 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div style={{ height: 6 }} />
        <div className="small" style={{ opacity: 0.75 }}>
          Quelle: View <b>sb_title_location_summary</b>
        </div>
      </div>

      {/* ===== Soll–Ist Abgleich je Klasse ===== */}
      <div className="card" style={{ marginTop: 14 }}>
        <div className="row">
          <div className="badge">Soll–Ist Abgleich je Klasse</div>
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
              Hinweis: Prüfe, ob die View <b>sb_class_required_check</b> in Supabase existiert und lesbar ist.
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
                  <th style={{ textAlign: 'left', padding: 8 }}>Aktion</th>
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
                      <td
                        style={{
                          padding: 8,
                          textAlign: 'right',
                          fontWeight: 800,
                          color: missing > 0 ? 'rgba(255,93,108,.95)' : 'rgba(255,255,255,0.85)',
                        }}
                      >
                        {missing}
                      </td>
                      <td
                        style={{
                          padding: 8,
                          textAlign: 'right',
                          fontWeight: 800,
                          color: extra > 0 ? 'rgba(255,188,66,.95)' : 'rgba(255,255,255,0.85)',
                        }}
                      >
                        {extra}
                      </td>
                      <td style={{ padding: 8 }}>
                        {okRow ? (
                          <span className="badge">OK</span>
                        ) : missing > 0 ? (
                          <button className="btn ok" style={{ padding: '6px 10px' }} onClick={() => openAssign(r)}>
                            Jetzt zuweisen
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

        {/* ===== NEU: Zuweisungsfeld (Buchcode → Schüler) ===== */}
        {assignOpen && assignTitle ? (
          <>
            <hr className="sep" />
            <div className="badge">Jetzt zuweisen: {assignTitle.subject ?? ''} · {assignTitle.title_name ?? assignTitle.title_id}</div>
            <div style={{ height: 10 }} />

            <div className="row" style={{ flexWrap: 'wrap', gap: 10 }}>
              <input
                className="input"
                value={assignBookCode}
                onChange={(e) => setAssignBookCode(e.target.value)}
                placeholder="Buchcode scannen/eingeben"
                style={{ maxWidth: 320 }}
              />
              <input
                className="input"
                value={assignStudentId}
                onChange={(e) => setAssignStudentId(e.target.value)}
                placeholder="optional: Schüler-ID (leer = automatisch)"
                style={{ maxWidth: 320 }}
              />
              <button className="btn ok" onClick={assignNow} disabled={assignBusy}>
                {assignBusy ? 'Zuweisen…' : 'Zuweisen'}
              </button>
              <button className="btn secondary" onClick={closeAssign} disabled={assignBusy}>
                Schließen
              </button>
            </div>

            {assignMsg ? (
              <div className="small" style={{ marginTop: 10, color: 'rgba(255,93,108,.95)', whiteSpace: 'pre-wrap' }}>
                {assignMsg}
              </div>
            ) : null}

            {assignOk ? (
              <div className="small" style={{ marginTop: 10, color: 'rgba(46,229,157,.95)', fontWeight: 800, whiteSpace: 'pre-wrap' }}>
                {assignOk}
              </div>
            ) : null}

            <div className="small" style={{ marginTop: 8, opacity: 0.8 }}>
              Hinweis: Wenn „Schüler-ID“ leer bleibt, wird automatisch der erste Schüler aus <b>{checkClassId}</b> gesucht, der dieses Buch noch nicht hat.
            </div>
          </>
        ) : null}
        {/* ===== /NEU ===== */}

        <div style={{ height: 6 }} />
        <div className="small" style={{ opacity: 0.75 }}>
          Quelle: View <b>sb_class_required_check</b>
        </div>
      </div>
    </div>
  );
}
