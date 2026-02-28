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

// ===== Soll–Ist pro Schüler (View sb_student_required_check) =====
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
// ===== /Soll–Ist pro Schüler =====

// ===== NEU: Fehlende Schüler pro Klasse+Titel (View sb_class_title_missing_students) =====
type MissingStudentRow = {
  class_id: string;
  student_id: string;
  title_id: string;
  subject: string | null;
  title_name: string | null;
  isbn: string | null;
  price_eur: number | null;
};
// ===== /NEU =====

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

  // ===== Auto-Fill Titelmeta + vorhandene Buchcodes =====
  const [autoLoading, setAutoLoading] = useState(false);
  const [autoErr, setAutoErr] = useState<string | null>(null);
  const [existingCodes, setExistingCodes] = useState<string>(''); // vorhandene Codes des Titels (nur Anzeige)
  const [autoTouched, setAutoTouched] = useState(false); // verhindert „überbügeln“, wenn du manuell editierst

  async function autoFillFromTitle(p_title_id: string) {
    const tid = (p_title_id || '').trim();
    if (!tid) return;

    setAutoErr(null);
    setAutoLoading(true);
    try {
      // 1) Titel holen
      const { data: t, error: tErr } = await supabase
        .from('sb_titles')
        .select('title_id, subject, title_name, isbn, price_eur')
        .eq('title_id', tid)
        .maybeSingle();

      if (tErr) throw tErr;

      if (t) {
        if (!autoTouched) {
          setSubject((t as any).subject ?? '');
          setTitleName((t as any).title_name ?? '');
          setIsbn((t as any).isbn ?? '');
          const pr = (t as any).price_eur;
          setPriceEur(pr != null ? String(pr).replace('.', ',') : '');
        }

        // 2) vorhandene Buchcodes für diesen Titel laden
        const { data: b, error: bErr } = await supabase
          .from('sb_books')
          .select('book_code')
          .eq('title_id', tid)
          .order('book_code', { ascending: true })
          .limit(5000);

        if (bErr) throw bErr;

        const codes = (b ?? []).map((x: any) => String(x.book_code));
        setExistingCodes(codes.join(','));
      } else {
        setExistingCodes('');
      }
    } catch (e: any) {
      setAutoErr(e?.message ?? 'Fehler beim Auto-Fill.');
      setExistingCodes('');
    } finally {
      setAutoLoading(false);
    }
  }
  // ===== /Auto-Fill =====

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
    let sStud = 0,
      sTeach = 0,
      sStor = 0,
      sTot = 0;
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

      // WICHTIG: ilike statt eq (5B/5b/Leerzeichen)
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
  // ===== /Soll–Ist =====

  // ===== „Fehlt → Jetzt zuweisen“ (Buchcode eingeben) =====
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
    const { data: studs, error: e1 } = await supabase
      .from('sb_students')
      .select('student_id,class_id,is_gu,religion,course,active')
      .ilike('class_id', (p_class_id || '').trim()) // WICHTIG: ilike
      .order('student_id', { ascending: true });

    if (e1) throw e1;
    const students = (studs ?? []) as StudentMiniRow[];
    if (students.length === 0) throw new Error(`Keine Schüler in Klasse ${p_class_id} gefunden.`);

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

      let sid = assignStudentId.trim();
      if (!sid) {
        sid = await findFirstMissingStudentId(cid, assignTitle.title_id);
      }

      const { error } = await supabase.rpc('sb_scan_book_admin', {
        p_scan: code,
        p_new_holder_type: 'student',
        p_new_holder_id: sid,
        p_note: `Admin-Zuweisung (Soll–Ist) Klasse ${cid} / ${assignTitle.title_id}`,
      });

      if (error) throw error;

      setAssignOk(`Buch ${code} → Schüler ${sid} (Klasse ${cid})`);
      setAssignBookCode('');

      await loadClassCheck();
      await loadSummary();

      if (checkStudentId.trim()) {
        await loadStudentCheck();
      }
    } catch (e: any) {
      setAssignMsg(e?.message ?? 'Unbekannter Fehler beim Zuweisen.');
    } finally {
      setAssignBusy(false);
    }
  }
  // ===== /Zuweisen =====

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

  function openAssignForStudent(r: StudentRequiredRow) {
    if (r.class_id) setCheckClassId(r.class_id);
    else if (studentClassId) setCheckClassId(studentClassId);

    setAssignOpen(true);
    setAssignTitle({ title_id: r.title_id, title_name: r.title_name, subject: r.subject });
    setAssignStudentId(r.student_id);
    setAssignBookCode('');
    setAssignMsg(null);
    setAssignOk(null);
  }
  // ===== /Soll–Ist pro Schüler =====

  // ===== „Wer fehlt?“ =====
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
        .ilike('class_id', cid) // WICHTIG: ilike
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
      const { data } = await supabase.auth.getSession();
      if (!data.session) return (window.location.href = '/login');
      const role = await fetchRole();
      if (role !== 'admin') return (window.location.href = '/teacher');
      setReady(true);

      loadSummary();
      autoFillFromTitle(titleId);
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
      autoFillFromTitle(titleId);
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
          <input
            className="input"
            value={titleId}
            onChange={(e) => {
              setTitleId(e.target.value);
              setAutoErr(null);
            }}
            onBlur={() => autoFillFromTitle(titleId)}
            placeholder="p_title_id"
          />
          <input
            className="input"
            value={subject}
            onChange={(e) => {
              setSubject(e.target.value);
              setAutoTouched(true);
            }}
            placeholder="p_subject"
          />
        </div>

        <div style={{ height: 10 }} />

        <div className="row">
          <input
            className="input"
            value={titleName}
            onChange={(e) => {
              setTitleName(e.target.value);
              setAutoTouched(true);
            }}
            placeholder="p_title_name"
          />
          <input
            className="input"
            value={isbn}
            onChange={(e) => {
              setIsbn(e.target.value);
              setAutoTouched(true);
            }}
            placeholder="p_isbn (optional)"
          />
        </div>

        <div style={{ height: 10 }} />

        <div className="row">
          <input
            className="input"
            value={priceEur}
            onChange={(e) => {
              setPriceEur(e.target.value);
              setAutoTouched(true);
            }}
            placeholder="p_price_eur"
          />

          <button
            className="btn secondary"
            onClick={() => {
              setAutoTouched(false);
              autoFillFromTitle(titleId);
            }}
            disabled={autoLoading}
          >
            {autoLoading ? 'Lade…' : 'ISBN/Preis/Fach automatisch ziehen'}
          </button>
        </div>

        {autoErr ? (
          <div className="small" style={{ marginTop: 8, color: 'rgba(255,93,108,.95)', whiteSpace: 'pre-wrap' }}>
            {autoErr}
          </div>
        ) : null}

        {existingCodes ? (
          <div className="small" style={{ marginTop: 8, opacity: 0.85, lineHeight: 1.6 }}>
            <b>Vorhandene Buchcodes für {titleId.trim()}:</b>
            <div style={{ marginTop: 6 }}>
              <span className="kbd" style={{ display: 'inline-block', maxWidth: '100%', overflowX: 'auto' }}>
                {existingCodes}
              </span>
            </div>
            <div style={{ marginTop: 6, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button className="btn secondary" onClick={() => setBookCodes(existingCodes)} disabled={autoLoading}>
                Vorhandene Codes in Eingabefeld übernehmen (ersetzen)
              </button>
              <button
                className="btn secondary"
                onClick={() =>
                  setBookCodes((prev) => {
                    const p = (prev || '').trim();
                    if (!p) return existingCodes;
                    return p + ',' + existingCodes;
                  })
                }
                disabled={autoLoading}
              >
                Vorhandene Codes an Eingabefeld anhängen
              </button>
            </div>
          </div>
        ) : (
          <div className="small" style={{ marginTop: 8, opacity: 0.7 }}>
            (Keine vorhandenen Codes geladen – entweder Titel noch nicht vorhanden oder noch keine Exemplare.)
          </div>
        )}

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
          <button className="btn ok" onClick={save}>
            Speichern
          </button>
        </div>

        {msg && (
          <>
            <hr className="sep" />
            <div className="small" style={{ color: 'rgba(255,93,108,.95)' }}>
              {msg}
            </div>
          </>
        )}

        {ok && (
          <>
            <hr className="sep" />
            <div className="small" style={{ color: 'rgba(46,229,157,.95)', fontWeight: 800 }}>
              {ok}
            </div>
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
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            <button className="btn ok" style={{ padding: '6px 10px' }} onClick={() => openAssign(r)}>
                              Jetzt zuweisen
                            </button>
                            <button className="btn secondary" style={{ padding: '6px 10px' }} onClick={() => loadMissingStudentsForTitle(r)}>
                              Wer fehlt?
                            </button>
                          </div>
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

        {/* ===== Zuweisungsfeld (Buchcode → Schüler) ===== */}
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
          </>
        ) : null}
        {/* ===== /Zuweisungsfeld ===== */}

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

      {/* ===== Soll–Ist Abgleich pro Schüler ===== */}
      <div className="card" style={{ marginTop: 14 }}>
        <div className="row">
          <div className="badge">Soll–Ist Abgleich pro Schüler (Schülercode)</div>
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
                  <th style={{ textAlign: 'left', padding: 8 }}>Aktion</th>
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
                      <td style={{ padding: 8 }}>
                        {okRow ? (
                          <span className="badge">OK</span>
                        ) : missing > 0 ? (
                          <button className="btn ok" style={{ padding: '6px 10px' }} onClick={() => openAssignForStudent(r)}>
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

        <div style={{ height: 6 }} />
        <div className="small" style={{ opacity: 0.75 }}>
          Quelle: View <b>sb_student_required_check</b>
        </div>
      </div>
      {/* ===== /Soll–Ist pro Schüler ===== */}
    </div>
  );
}
