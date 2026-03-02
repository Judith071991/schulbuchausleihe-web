'use client';

import { useEffect, useMemo, useState } from 'react';
import Topbar from '../../../components/Topbar';
import { supabase } from '../../../lib/supabaseClient';
import { fetchRole } from '../../../lib/role';

type TeacherRow = {
  teacher_id: string;
  active: boolean;
  created_at: string;
};

type TeacherBookRow = {
  book_code: string;
  title_id: string | null;
  title_name: string | null;
  subject: string | null;
  isbn: string | null;
};

function safeStr(x: any) {
  return x == null ? '' : String(x);
}

export default function AdminTeachersPage() {
  const [ready, setReady] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const [teacherId, setTeacherId] = useState('');
  const [active, setActive] = useState(true);

  const [teachers, setTeachers] = useState<TeacherRow[]>([]);
  const [loading, setLoading] = useState(false);

  // ===== Buch-Scan für Zuweisung =====
  const [bookScan, setBookScan] = useState('');
  const [scanBusy, setScanBusy] = useState(false);
  // ===== /Buch-Scan =====

  // ===== NEU: Ansicht "Welche Bücher hat welcher Lehrer?" =====
  const [teacherQuery, setTeacherQuery] = useState('');
  const filteredTeachers = useMemo(() => {
    const q = teacherQuery.trim().toLowerCase();
    if (!q) return teachers;
    return teachers.filter((t) => {
      const hay = [t.teacher_id, t.active ? 'aktiv' : 'inaktiv'].join(' ').toLowerCase();
      return hay.includes(q);
    });
  }, [teachers, teacherQuery]);

  const [viewTeacherId, setViewTeacherId] = useState<string>(''); // Auswahl für Anzeige (getrennt von "teacherId" fürs Scannen)
  const [books, setBooks] = useState<TeacherBookRow[]>([]);
  const [booksLoading, setBooksLoading] = useState(false);
  const [booksErr, setBooksErr] = useState<string | null>(null);

  async function loadTeacherBooks(p_teacher_id: string) {
    setBooksErr(null);
    setBooksLoading(true);
    setBooks([]);

    try {
      const tid = (p_teacher_id || '').trim();
      if (!tid) throw new Error('Bitte Lehrkraft auswählen.');

      // 1) Buchcodes für Lehrer aus der Zuordnungs-View holen
      const { data: a, error: aErr } = await supabase
        .from('sb_current_assignments')
        .select('book_code,holder_type,holder_id')
        .eq('holder_type', 'teacher')
        .eq('holder_id', tid)
        .order('book_code', { ascending: true });

      if (aErr) throw aErr;

      const codes = (a ?? []).map((x: any) => safeStr(x.book_code)).filter(Boolean);
      if (codes.length === 0) {
        setBooks([]);
        return;
      }

      // 2) sb_books: title_id pro Buchcode
      const { data: b, error: bErr } = await supabase
        .from('sb_books')
        .select('book_code,title_id')
        .in('book_code', codes);

      if (bErr) throw bErr;

      const bookRows = (b ?? []) as any[];
      const titleIds = Array.from(new Set(bookRows.map((x) => safeStr(x.title_id)).filter(Boolean)));

      // 3) sb_titles: Metadaten pro title_id (wenn vorhanden)
      let titlesMap = new Map<string, { title_name: string | null; subject: string | null; isbn: string | null }>();
      if (titleIds.length > 0) {
        const { data: t, error: tErr } = await supabase
          .from('sb_titles')
          .select('title_id,title_name,subject,isbn')
          .in('title_id', titleIds);

        if (tErr) throw tErr;

        for (const row of (t ?? []) as any[]) {
          titlesMap.set(safeStr(row.title_id), {
            title_name: row.title_name ?? null,
            subject: row.subject ?? null,
            isbn: row.isbn ?? null,
          });
        }
      }

      // zusammenbauen + sortieren
      const rows: TeacherBookRow[] = bookRows.map((x) => {
        const tid2 = x.title_id ?? null;
        const meta = tid2 ? titlesMap.get(String(tid2)) : undefined;
        return {
          book_code: safeStr(x.book_code),
          title_id: tid2,
          title_name: meta?.title_name ?? null,
          subject: meta?.subject ?? null,
          isbn: meta?.isbn ?? null,
        };
      });

      rows.sort((r1, r2) => {
        const a1 = `${r1.subject ?? ''} ${r1.title_name ?? ''} ${r1.title_id ?? ''} ${r1.book_code}`.toLowerCase();
        const a2 = `${r2.subject ?? ''} ${r2.title_name ?? ''} ${r2.title_id ?? ''} ${r2.book_code}`.toLowerCase();
        return a1.localeCompare(a2);
      });

      setBooks(rows);
    } catch (e: any) {
      setBooksErr(e?.message ?? 'Fehler beim Laden der Lehrer-Bücher.');
      setBooks([]);
    } finally {
      setBooksLoading(false);
    }
  }
  // ===== /NEU: Ansicht =====

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) return (window.location.href = '/login');

      const role = await fetchRole();
      if (role !== 'admin') return (window.location.href = '/teacher');

      setReady(true);
      loadTeachers();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadTeachers() {
    setLoading(true);
    setMsg(null);

    const { data, error } = await supabase
      .from('sb_teachers')
      .select('teacher_id, active, created_at')
      .order('teacher_id', { ascending: true });

    if (error) {
      setMsg(error.message);
      setLoading(false);
      return;
    }

    setTeachers((data ?? []) as any);
    setLoading(false);
  }

  async function saveTeacher() {
    setMsg(null);
    setOk(null);

    try {
      const id = teacherId.trim();
      if (!id) throw new Error('Bitte teacher_id eingeben.');

      const { error } = await supabase
        .from('sb_teachers')
        .upsert({ teacher_id: id, active }, { onConflict: 'teacher_id' });

      if (error) throw error;

      setOk('Lehrkraft gespeichert.');
      setTeacherId('');
      setActive(true);
      loadTeachers();
    } catch (e: any) {
      setMsg(e?.message ?? 'Unbekannter Fehler');
    }
  }

  async function toggleTeacher(t: TeacherRow) {
    setMsg(null);
    setOk(null);

    const { error } = await supabase
      .from('sb_teachers')
      .update({ active: !t.active })
      .eq('teacher_id', t.teacher_id);

    if (error) {
      setMsg(error.message);
      return;
    }

    setOk('Status aktualisiert.');
    loadTeachers();
  }

  // ===== Buch -> Lehrkraft =====
  async function assignBookToTeacher() {
    setMsg(null);
    setOk(null);

    try {
      const tid = teacherId.trim();
      const code = bookScan.trim();
      if (!tid) throw new Error('Bitte zuerst teacher_id setzen (oben) oder aus Liste wählen.');
      if (!code) throw new Error('Bitte Buchcode scannen/eingeben.');

      setScanBusy(true);
      const { error } = await supabase.rpc('sb_admin_assign_book_to_teacher', {
        p_book_code: code,
        p_teacher_id: tid,
      });
      if (error) throw error;

      setOk(`Buch ${code} → Lehrkraft ${tid} zugewiesen.`);
      setBookScan('');

      // falls gerade diese Lehrkraft in der Anzeige ausgewählt ist: aktualisieren
      if (viewTeacherId.trim() && viewTeacherId.trim() === tid) {
        await loadTeacherBooks(viewTeacherId);
      }
    } catch (e: any) {
      setMsg(e?.message ?? 'Unbekannter Fehler');
    } finally {
      setScanBusy(false);
    }
  }

  // ===== Buch -> Lager =====
  async function returnBookToStorage() {
    setMsg(null);
    setOk(null);

    try {
      const code = bookScan.trim();
      if (!code) throw new Error('Bitte Buchcode scannen/eingeben.');

      setScanBusy(true);
      const { error } = await supabase.rpc('sb_admin_return_book_to_storage', {
        p_book_code: code,
      });
      if (error) throw error;

      setOk(`Buch ${code} → Lager.`);
      setBookScan('');

      // falls gerade eine Lehrkraft angezeigt wird: neu laden (damit das Buch verschwindet)
      if (viewTeacherId.trim()) {
        await loadTeacherBooks(viewTeacherId);
      }
    } catch (e: any) {
      setMsg(e?.message ?? 'Unbekannter Fehler');
    } finally {
      setScanBusy(false);
    }
  }
  // ===== /Buch-Zuweisung =====

  if (!ready) {
    return (
      <div className="container">
        <div className="card">
          <div className="h1">Admin · Lehrkräfte</div>
          <p className="sub">Lade…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <Topbar title="Admin · Lehrkräfte verwalten" />

      <div className="card">
        <div className="row">
          <div className="badge">Lehrkraft anlegen / bearbeiten</div>
          <div className="spacer" />
          <button className="btn secondary" onClick={() => (window.location.href = '/admin/dashboard')}>
            ← Dashboard
          </button>
        </div>

        <div style={{ height: 12 }} />

        <div className="row" style={{ flexWrap: 'wrap', gap: 10 }}>
          <input
            className="input"
            value={teacherId}
            onChange={(e) => setTeacherId(e.target.value)}
            placeholder="teacher_id (z.B. T0001)"
            style={{ maxWidth: 260 }}
          />

          <label className="badge" style={{ cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
              style={{ marginRight: 8 }}
            />
            aktiv
          </label>

          <button className="btn ok" onClick={saveTeacher}>
            Speichern
          </button>

          <div className="spacer" />

          <button className="btn secondary" onClick={loadTeachers} disabled={loading}>
            {loading ? 'Lade…' : 'Aktualisieren'}
          </button>
        </div>

        {msg && (
          <>
            <hr className="sep" />
            <div className="small" style={{ color: 'rgba(255,93,108,.95)', whiteSpace: 'pre-wrap' }}>
              {msg}
            </div>
          </>
        )}

        {ok && (
          <>
            <hr className="sep" />
            <div className="small" style={{ color: 'rgba(46,229,157,.95)', fontWeight: 800, whiteSpace: 'pre-wrap' }}>
              {ok}
            </div>
          </>
        )}

        <hr className="sep" />

        <div className="badge">Angelegte Lehrkräfte ({teachers.length})</div>

        <div style={{ height: 10 }} />

        {teachers.length === 0 ? (
          <div className="small">Noch keine Lehrkräfte vorhanden.</div>
        ) : (
          <div style={{ display: 'grid', gap: 8 }}>
            {teachers.map((t) => (
              <div
                key={t.teacher_id}
                className="row"
                style={{
                  alignItems: 'center',
                  borderTop: '1px solid rgba(255,255,255,0.1)',
                  paddingTop: 8,
                }}
              >
                <div className="kbd">{t.teacher_id}</div>
                <div style={{ marginLeft: 10 }}>{t.active ? 'aktiv' : 'inaktiv'}</div>

                <div className="spacer" />

                <button className="btn secondary" onClick={() => setTeacherId(t.teacher_id)}>
                  Als aktiv wählen
                </button>

                <button className="btn secondary" onClick={() => toggleTeacher(t)}>
                  {t.active ? 'Deaktivieren' : 'Aktivieren'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ===== Scan / Zuweisen ===== */}
      <div className="card" style={{ marginTop: 14 }}>
        <div className="row">
          <div className="badge">Bücher zuweisen</div>
          <div className="spacer" />
          <div className="badge">
            Aktive Lehrkraft: <b>{teacherId.trim() || '—'}</b>
          </div>
        </div>

        <div style={{ height: 12 }} />

        <div className="row" style={{ flexWrap: 'wrap', gap: 10 }}>
          <input
            className="input"
            value={bookScan}
            onChange={(e) => setBookScan(e.target.value)}
            placeholder="Buchcode scannen/eingeben"
            style={{ maxWidth: 320 }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') assignBookToTeacher();
            }}
          />

          <button className="btn ok" onClick={assignBookToTeacher} disabled={scanBusy}>
            Buch → Lehrkraft
          </button>

          <button className="btn secondary" onClick={returnBookToStorage} disabled={scanBusy}>
            Buch → Lager
          </button>

          <div className="small" style={{ opacity: 0.85 }}>
            Tipp: erst Lehrkraft wählen/setzen, dann Buchcodes scannen (Enter weist direkt zu).
          </div>
        </div>
      </div>
      {/* ===== /Scan ===== */}

      {/* ===== NEU: Lehrer → ausgeliehene Bücher (Dauerhafte Ansicht) ===== */}
      <div className="card" style={{ marginTop: 14 }}>
        <div className="row">
          <div className="badge">Lehrer → ausgeliehene Bücher (nur Anzeige)</div>
          <div className="spacer" />
          <button
            className="btn secondary"
            onClick={() => {
              loadTeachers();
              if (viewTeacherId.trim()) loadTeacherBooks(viewTeacherId);
            }}
            disabled={loading || booksLoading}
          >
            {(loading || booksLoading) ? 'Lade…' : 'Aktualisieren'}
          </button>
        </div>

        <div style={{ height: 12 }} />

        <div className="row" style={{ flexWrap: 'wrap', gap: 10 }}>
          <input
            className="input"
            value={teacherQuery}
            onChange={(e) => setTeacherQuery(e.target.value)}
            placeholder="Lehrer suchen (ID)…"
            style={{ maxWidth: 320 }}
          />

          <select
            className="select"
            value={viewTeacherId}
            onChange={(e) => {
              const tid = e.target.value;
              setViewTeacherId(tid);
              if (tid) loadTeacherBooks(tid);
              else setBooks([]);
            }}
            style={{ maxWidth: 340 }}
          >
            <option value="">— Lehrer auswählen —</option>
            {filteredTeachers.map((t) => (
              <option key={t.teacher_id} value={t.teacher_id}>
                {t.teacher_id} {t.active ? '' : ' (inaktiv)'}
              </option>
            ))}
          </select>

          <button
            className="btn secondary"
            onClick={() => {
              const tid = teacherId.trim();
              if (!tid) return;
              setViewTeacherId(tid);
              loadTeacherBooks(tid);
            }}
            disabled={!teacherId.trim()}
          >
            Aktive Lehrkraft anzeigen
          </button>

          <button
            className="btn ok"
            onClick={() => (viewTeacherId.trim() ? loadTeacherBooks(viewTeacherId) : null)}
            disabled={!viewTeacherId.trim() || booksLoading}
          >
            {booksLoading ? 'Lade Bücher…' : 'Bücher laden'}
          </button>
        </div>

        {booksErr ? (
          <>
            <hr className="sep" />
            <div className="small" style={{ color: 'rgba(255,93,108,.95)', whiteSpace: 'pre-wrap' }}>
              {booksErr}
            </div>
          </>
        ) : null}

        <hr className="sep" />

        {!viewTeacherId.trim() ? (
          <div className="small" style={{ opacity: 0.85 }}>
            Wähle einen Lehrer aus, um seine ausgeliehenen Bücher zu sehen.
          </div>
        ) : booksLoading ? (
          <div className="small" style={{ opacity: 0.85 }}>Lade…</div>
        ) : books.length === 0 ? (
          <div className="small" style={{ opacity: 0.85 }}>
            Keine Bücher gefunden für Lehrer <b>{viewTeacherId.trim()}</b>.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <div className="small" style={{ opacity: 0.85, marginBottom: 8 }}>
              Anzahl: <b>{books.length}</b>
            </div>

            <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: 8 }}>Fach</th>
                  <th style={{ textAlign: 'left', padding: 8 }}>Titel</th>
                  <th style={{ textAlign: 'left', padding: 8 }}>ISBN</th>
                  <th style={{ textAlign: 'left', padding: 8 }}>Buchcode</th>
                </tr>
              </thead>
              <tbody>
                {books.map((x) => (
                  <tr key={x.book_code} style={{ borderTop: '1px solid rgba(255,255,255,0.10)' }}>
                    <td style={{ padding: 8, opacity: 0.9 }}>{x.subject ?? '-'}</td>
                    <td style={{ padding: 8 }}>
                      <div style={{ fontWeight: 800 }}>{x.title_name ?? x.title_id ?? '-'}</div>
                      <div className="small" style={{ opacity: 0.75 }}>{x.title_id ?? '-'}</div>
                    </td>
                    <td style={{ padding: 8, opacity: 0.9 }}>{x.isbn ?? '-'}</td>
                    <td style={{ padding: 8 }}>
                      <span className="kbd">{x.book_code}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div style={{ height: 6 }} />
            <div className="small" style={{ opacity: 0.75 }}>
              Quelle: <b>sb_current_assignments</b> (Zuordnung) + <b>sb_books</b>/<b>sb_titles</b> (Titelinfos)
            </div>
          </div>
        )}
      </div>
      {/* ===== /NEU ===== */}
    </div>
  );
}
