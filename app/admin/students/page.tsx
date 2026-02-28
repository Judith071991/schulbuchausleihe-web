'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Topbar from '../../../components/Topbar';
import Modal from '../../../components/Modal';
import { supabase } from '../../../lib/supabaseClient';
import { fetchRole } from '../../../lib/role';

type StudentRow = {
  student_id: string;
  class_id: string | null;
  active: boolean | null;
};

type AssignmentRow = {
  book_code: string;
  title_id?: string | null;
  title_name?: string | null;
  subject?: string | null;
  price_eur?: number | null;
  status?: string | null;
  condition?: string | null;
  holder_type?: string | null;
  holder_id?: string | null;
};

type IssueKind = 'lost' | 'damaged' | 'missing';

export default function AdminStudentsPage() {
  const [ready, setReady] = useState(false);

  // Student scan/input
  const [studentId, setStudentId] = useState('');
  const [student, setStudent] = useState<StudentRow | null>(null);

  // Book scan/input
  const [bookCode, setBookCode] = useState('');
  const bookRef = useRef<HTMLInputElement>(null);

  // Shared scan fields
  const [condition, setCondition] = useState<'ok' | 'used' | 'damaged'>('ok');
  const [note, setNote] = useState('');

  // UI state
  const [msg, setMsg] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Current assignments for selected student
  const [assignments, setAssignments] = useState<AssignmentRow[]>([]);
  const [loadingAssignments, setLoadingAssignments] = useState(false);

  // Issue modal
  const [issueOpen, setIssueOpen] = useState(false);
  const [issueKind, setIssueKind] = useState<IssueKind>('lost');
  const [issueAmount, setIssueAmount] = useState<string>(''); // string for input
  const [issueNote, setIssueNote] = useState('');
  const [issueBook, setIssueBook] = useState<AssignmentRow | null>(null);
  const [issueSavedText, setIssueSavedText] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) return (window.location.href = '/login');
      const role = await fetchRole();
      if (role !== 'admin') return (window.location.href = '/teacher');
      setReady(true);
    })();
  }, []);

  // ---------- Helpers ----------
  function resetAlerts() {
    setMsg(null);
    setOk(null);
  }

  function focusBook() {
    setTimeout(() => bookRef.current?.focus(), 60);
  }

  const studentLabel = useMemo(() => {
    if (!student) return null;
    const cls = student.class_id ? `Klasse ${student.class_id}` : 'keine Klasse';
    const act = student.active === false ? 'inaktiv' : 'aktiv';
    return `${cls} · ${act}`;
  }, [student]);

  // ---------- Load student ----------
  async function loadStudentById(id: string) {
    resetAlerts();
    setStudent(null);
    setAssignments([]);

    const sid = id.trim();
    if (!sid) return;

    setBusy(true);
    try {
      const { data, error } = await supabase
        .from('sb_students')
        .select('student_id, class_id, active')
        .eq('student_id', sid)
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        setMsg('Schüler nicht gefunden. Du kannst ihn unten anlegen.');
      } else {
        setStudent(data as StudentRow);
        setOk('Schüler geladen.');
        await refreshAssignments(sid);
        focusBook();
      }
    } catch (e: any) {
      setMsg(e?.message ?? 'Fehler beim Laden des Schülers');
    } finally {
      setBusy(false);
    }
  }

  // ---------- Create / update student ----------
  const [createClassId, setCreateClassId] = useState('');
  const [createActive, setCreateActive] = useState(true);

  async function saveStudent() {
    resetAlerts();
    const sid = studentId.trim();
    const cls = createClassId.trim();
    if (!sid || !cls) return setMsg('Bitte Schüler-Code und Klasse ausfüllen.');

    setBusy(true);
    try {
      const { error } = await supabase
        .from('sb_students')
        .upsert(
          { student_id: sid, class_id: cls, active: createActive },
          { onConflict: 'student_id' }
        );

      if (error) throw error;

      setOk('Schüler gespeichert.');
      await loadStudentById(sid);
    } catch (e: any) {
      setMsg(e?.message ?? 'Fehler beim Speichern');
    } finally {
      setBusy(false);
    }
  }

  // ---------- Assignments ----------
  async function refreshAssignments(sid?: string) {
    const id = (sid ?? studentId).trim();
    if (!id) return;

    setLoadingAssignments(true);
    try {
      // 1) assignments for this student
      const { data: aData, error: aErr } = await supabase
        .from('sb_current_assignments')
        .select('book_code, holder_type, holder_id, updated_at')
        .eq('holder_type', 'student')
        .eq('holder_id', id);

      if (aErr) throw aErr;

      const codes = (aData ?? []).map((x: any) => x.book_code).filter(Boolean);
      if (codes.length === 0) {
        setAssignments([]);
        return;
      }

      // 2) books info for these codes
      const { data: bData, error: bErr } = await supabase
        .from('sb_books')
        .select('book_code, title_id, status, condition')
        .in('book_code', codes);

      if (bErr) throw bErr;

      const titleIds = Array.from(new Set((bData ?? []).map((b: any) => b.title_id).filter(Boolean)));

      // 3) titles info (name, subject, price)
      let titleMap = new Map<string, any>();
      if (titleIds.length > 0) {
        const { data: tData, error: tErr } = await supabase
          // falls deine Tabelle anders heißt: hier anpassen
          .from('sb_course_titles')
          .select('title_id, title_name, subject, price_eur')
          .in('title_id', titleIds);

        if (tErr) throw tErr;
        (tData ?? []).forEach((t: any) => titleMap.set(t.title_id, t));
      }

      // merge
      const bookMap = new Map<string, any>();
      (bData ?? []).forEach((b: any) => bookMap.set(b.book_code, b));

      const merged: AssignmentRow[] = (aData ?? []).map((a: any) => {
        const b = bookMap.get(a.book_code) ?? {};
        const t = b.title_id ? titleMap.get(b.title_id) ?? {} : {};
        return {
          book_code: a.book_code,
          holder_type: a.holder_type,
          holder_id: a.holder_id,
          title_id: b.title_id ?? null,
          status: b.status ?? null,
          condition: b.condition ?? null,
          title_name: t.title_name ?? null,
          subject: t.subject ?? null,
          price_eur: t.price_eur ?? null,
        };
      });

      // sort: subject, title_name, book_code
      merged.sort((x, y) => {
        const a = `${x.subject ?? ''} ${x.title_name ?? ''} ${x.book_code}`;
        const b = `${y.subject ?? ''} ${y.title_name ?? ''} ${y.book_code}`;
        return a.localeCompare(b);
      });

      setAssignments(merged);
    } catch (e: any) {
      setMsg(e?.message ?? 'Fehler beim Laden der Ausleihen');
    } finally {
      setLoadingAssignments(false);
    }
  }

  // ---------- Scanning actions ----------
  async function scanToStudent() {
    resetAlerts();
    const sid = studentId.trim();
    const code = bookCode.trim();
    if (!sid) return setMsg('Bitte zuerst Schüler-Code scannen/eingeben.');
    if (!code) return setMsg('Bitte Buchcode scannen/eingeben.');

    setBusy(true);
    try {
      const { data, error } = await supabase.rpc('sb_scan_book_admin_84825', {
        p_new_student_id: sid,
        p_condition: condition,
        p_note: note.trim() || null,
        book_code: code,
      });

      if (error) throw error;

      setOk(typeof data === 'string' ? data : `Zugewiesen: ${code}`);
      setBookCode('');
      setNote('');
      await refreshAssignments(sid);
      focusBook();
    } catch (e: any) {
      setMsg(e?.message ?? 'Fehler beim Zuweisen');
    } finally {
      setBusy(false);
    }
  }

  async function scanToStorage() {
    resetAlerts();
    const code = bookCode.trim();
    if (!code) return setMsg('Bitte Buchcode scannen/eingeben.');

    setBusy(true);
    try {
      // Lager buchen: wir schicken p_new_student_id = null
      const { data, error } = await supabase.rpc('sb_scan_book_admin_84825', {
        p_new_student_id: null,
        p_condition: condition,
        p_note: note.trim() || null,
        book_code: code,
      });

      if (error) throw error;

      setOk(typeof data === 'string' ? data : `Ins Lager: ${code}`);
      setBookCode('');
      setNote('');
      await refreshAssignments(studentId.trim());
      focusBook();
    } catch (e: any) {
      setMsg(e?.message ?? 'Fehler beim Ins-Lager-Buchen');
    } finally {
      setBusy(false);
    }
  }

  // ---------- Issue modal ----------
  function openIssueModal(book: AssignmentRow) {
    setIssueBook(book);
    setIssueOpen(true);
    setIssueSavedText(null);

    // Default amount = title price, if known
    const p = book.price_eur;
    setIssueAmount(typeof p === 'number' && !Number.isNaN(p) ? String(p) : '');
    setIssueNote('');
    setIssueKind('lost');
  }

  async function saveIssue() {
    resetAlerts();
    if (!issueBook) return;
    const sid = studentId.trim();
    const code = issueBook.book_code;

    const amount = issueAmount.trim()
      ? Number(issueAmount.trim().replace(',', '.'))
      : null;

    if (issueAmount.trim() && (amount === null || Number.isNaN(amount))) {
      return setMsg('Betrag ist keine Zahl.');
    }

    setBusy(true);
    try {
      /**
       * ⚠️ HIER kann es sein, dass deine RPC andere Parameternamen hat.
       * Wenn Vercel/Console “parameter … does not exist” sagt:
       * → dann ändern wir NUR diese Schlüssel hier.
       */
      const { data, error } = await supabase.rpc('sb_report_issue_84825', {
        p_student_id: sid || null,
        p_book_code: code,
        p_incident_type: issueKind,       // ggf. heißt es bei dir: p_issue_type
        p_amount_eur: amount,             // ggf. heißt es bei dir: amount_eur
        p_note: issueNote.trim() || null, // ggf. heißt es: p_receipt_text / p_note
      });

      if (error) throw error;

      setIssueSavedText(typeof data === 'string' ? data : 'Vorgang gespeichert.');
      setOk('Verlust/Beschädigung gespeichert.');
    } catch (e: any) {
      setMsg(e?.message ?? 'Fehler beim Speichern des Vorgangs');
    } finally {
      setBusy(false);
    }
  }

  function printIssue() {
    // einfache Druckansicht: neues Fenster mit Minimal-HTML
    if (!issueBook) return;
    const sid = studentId.trim();
    const html = `
      <html><head><title>Schadensmeldung</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 24px; }
        h1 { margin: 0 0 8px 0; }
        .box { border: 1px solid #ccc; padding: 16px; border-radius: 10px; }
        .row { margin: 8px 0; }
        .label { font-weight: 700; display:inline-block; width: 140px; }
      </style>
      </head><body>
        <h1>Schulbuch – Verlust / Beschädigung</h1>
        <div class="box">
          <div class="row"><span class="label">Schüler:</span> ${sid || '-'} ${studentLabel ? `(${studentLabel})` : ''}</div>
          <div class="row"><span class="label">Buchcode:</span> ${issueBook.book_code}</div>
          <div class="row"><span class="label">Titel:</span> ${(issueBook.subject ?? '')} ${(issueBook.title_name ?? '')}</div>
          <div class="row"><span class="label">Art:</span> ${issueKind}</div>
          <div class="row"><span class="label">Betrag:</span> ${issueAmount || '-'} €</div>
          <div class="row"><span class="label">Notiz:</span> ${issueNote || '-'}</div>
          <div class="row" style="margin-top:18px;"><span class="label">Datum:</span> ${new Date().toLocaleDateString('de-DE')}</div>
          <div class="row"><span class="label">Unterschrift:</span> ____________________________</div>
        </div>
        <script>window.print();</script>
      </body></html>
    `;
    const w = window.open('', '_blank', 'width=900,height=650');
    if (!w) return;
    w.document.open();
    w.document.write(html);
    w.document.close();
  }

  // ---------- Render ----------
  if (!ready) {
    return (
      <div className="container">
        <div className="card">
          <div className="h1">Admin · Schüler</div>
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
          <div className="badge">Schüler scannen · Bücher zuweisen · Lager · Verlust/Kaputt</div>
          <div className="spacer" />
          <button className="btn secondary" onClick={() => (window.location.href = '/admin')}>
            Dashboard
          </button>
        </div>

        <div style={{ height: 12 }} />

        {/* Student scan */}
        <div className="row">
          <input
            className="input"
            placeholder="Schüler-Code scannen/eingeben"
            value={studentId}
            onChange={(e) => setStudentId(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') loadStudentById(studentId);
            }}
          />
          <button className="btn" disabled={busy} onClick={() => loadStudentById(studentId)}>
            Laden
          </button>

          {student && (
            <div className="badge" style={{ marginLeft: 10 }}>
              {studentLabel}
            </div>
          )}
        </div>

        {/* If student not found: create section */}
        {!student && (
          <>
            <div style={{ height: 10 }} />
            <div className="row">
              <input
                className="input"
                placeholder="Klasse (z.B. 7b)"
                value={createClassId}
                onChange={(e) => setCreateClassId(e.target.value)}
              />
              <label className="badge" style={{ cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={createActive}
                  onChange={(e) => setCreateActive(e.target.checked)}
                  style={{ marginRight: 8 }}
                />
                aktiv
              </label>
              <div className="spacer" />
              <button className="btn ok" disabled={busy} onClick={saveStudent}>
                Schüler anlegen/speichern
              </button>
            </div>
          </>
        )}

        <hr className="sep" />

        {/* Book scan */}
        <div className="row">
          <input
            ref={bookRef}
            className="input"
            placeholder="Buchcode scannen/eingeben"
            value={bookCode}
            onChange={(e) => setBookCode(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') scanToStudent();
            }}
          />
        </div>

        <div style={{ height: 10 }} />

        <div className="row" style={{ flexWrap: 'wrap', gap: 10 }}>
          <select
            className="select"
            value={condition}
            onChange={(e) => setCondition(e.target.value as any)}
            style={{ maxWidth: 220 }}
          >
            <option value="ok">Zustand: ok</option>
            <option value="used">Zustand: benutzt</option>
            <option value="damaged">Zustand: kaputt</option>
          </select>

          <input
            className="input"
            placeholder="Notiz (optional)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />

          <button className="btn ok" disabled={busy} onClick={scanToStudent}>
            Zu Schüler
          </button>
          <button className="btn" disabled={busy} onClick={scanToStorage}>
            Ins Lager
          </button>

          <div className="spacer" />
          <button className="btn secondary" disabled={busy || !studentId.trim()} onClick={() => refreshAssignments()}>
            Aktualisieren
          </button>
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

        <hr className="sep" />

        {/* Assignments list */}
        <div className="row">
          <div className="h2" style={{ margin: 0 }}>Aktuelle Bücher bei diesem Schüler</div>
          <div className="spacer" />
          <div className="badge">{loadingAssignments ? 'lädt…' : `${assignments.length} Buch/Bücher`}</div>
        </div>

        <div style={{ height: 10 }} />

        {assignments.length === 0 ? (
          <div className="small" style={{ opacity: 0.85 }}>
            Keine aktuellen Zuweisungen gefunden.
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 10 }}>
            {assignments.map((a) => (
              <div key={a.book_code} className="row" style={{ alignItems: 'center' }}>
                <div style={{ minWidth: 110, fontWeight: 800 }}>{a.book_code}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700 }}>
                    {(a.subject ?? '').toString()} {(a.title_name ?? '').toString()}
                  </div>
                  <div className="small" style={{ opacity: 0.85 }}>
                    title_id: {a.title_id ?? '-'} · Zustand: {a.condition ?? '-'} · Status: {a.status ?? '-'} · Preis: {typeof a.price_eur === 'number' ? `${a.price_eur} €` : '-'}
                  </div>
                </div>
                <button className="btn secondary" onClick={() => openIssueModal(a)}>
                  Verlust/Kaputt
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Issue Modal */}
      <Modal open={issueOpen} onClose={() => setIssueOpen(false)} title="Verlust / Beschädigung">
        <div style={{ display: 'grid', gap: 10 }}>
          <div className="small" style={{ opacity: 0.9 }}>
            Schüler: <b>{studentId.trim() || '-'}</b> {studentLabel ? `(${studentLabel})` : ''}
          </div>

          <div className="small">
            Buch: <b>{issueBook?.book_code ?? '-'}</b> · {(issueBook?.subject ?? '')} {(issueBook?.title_name ?? '')}
          </div>

          <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
            <select className="select" value={issueKind} onChange={(e) => setIssueKind(e.target.value as any)} style={{ maxWidth: 240 }}>
              <option value="lost">verloren</option>
              <option value="damaged">beschädigt</option>
              <option value="missing">fehlend</option>
            </select>

            <input
              className="input"
              placeholder="Betrag € (optional)"
              value={issueAmount}
              onChange={(e) => setIssueAmount(e.target.value)}
              style={{ maxWidth: 220 }}
            />
          </div>

          <input
            className="input"
            placeholder="Notiz (optional)"
            value={issueNote}
            onChange={(e) => setIssueNote(e.target.value)}
          />

          <div className="row" style={{ gap: 10 }}>
            <button className="btn ok" disabled={busy} onClick={saveIssue}>
              Speichern
            </button>
            <button className="btn secondary" onClick={printIssue}>
              Drucken
            </button>
            <div className="spacer" />
            <button className="btn" onClick={() => setIssueOpen(false)}>
              Schließen
            </button>
          </div>

          {issueSavedText && (
            <div className="small" style={{ color: 'rgba(46,229,157,.95)', fontWeight: 800 }}>
              {issueSavedText}
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
