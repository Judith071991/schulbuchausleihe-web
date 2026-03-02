'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';

type TeacherRow = {
  teacher_id: string;
  last_name: string | null;
  first_name: string | null;
  short_name: string | null;
  active: boolean | null;
};

type TeacherBookRow = {
  book_code: string;
  title_id: string | null;
  title_name: string | null;
  subject: string | null;
  isbn: string | null;
};

export default function AdminIndexPage() {
  // ✅ Ergänzung: Lehrkräfte-Bestände anzeigen (read-only)
  const [teachers, setTeachers] = useState<TeacherRow[]>([]);
  const [tLoading, setTLoading] = useState(false);
  const [tErr, setTErr] = useState<string | null>(null);

  const [teacherQuery, setTeacherQuery] = useState('');
  const filteredTeachers = useMemo(() => {
    const q = teacherQuery.trim().toLowerCase();
    if (!q) return teachers;
    return teachers.filter((t) => {
      const hay = [t.teacher_id, t.last_name ?? '', t.first_name ?? '', t.short_name ?? ''].join(' ').toLowerCase();
      return hay.includes(q);
    });
  }, [teachers, teacherQuery]);

  const [selectedTeacherId, setSelectedTeacherId] = useState<string>('');
  const [books, setBooks] = useState<TeacherBookRow[]>([]);
  const [bLoading, setBLoading] = useState(false);
  const [bErr, setBErr] = useState<string | null>(null);

  async function loadTeachers() {
    setTErr(null);
    setTLoading(true);
    try {
      // ✅ Spaltennamen an deine echte Tabelle angepasst: short_name (nicht short)
      const { data, error } = await supabase
        .from('sb_teachers')
        .select('teacher_id,last_name,first_name,short_name,active')
        .order('teacher_id', { ascending: true });

      if (error) throw error;
      setTeachers((data ?? []) as any);
    } catch (e: any) {
      setTErr(e?.message ?? 'Fehler beim Laden der Lehrkräfte.');
      setTeachers([]);
    } finally {
      setTLoading(false);
    }
  }

  async function loadTeacherBooks(tid: string) {
    setBErr(null);
    setBLoading(true);
    setBooks([]);
    try {
      const teacherId = (tid || '').trim();
      if (!teacherId) throw new Error('Bitte Lehrer auswählen.');

      // 1) Bücher-Zuordnung laden
      const { data: a, error: aErr } = await supabase
        .from('sb_current_assignments')
        .select('book_code,holder_type,holder_id')
        .eq('holder_type', 'teacher')
        .eq('holder_id', teacherId)
        .order('book_code', { ascending: true });

      if (aErr) throw aErr;

      const codes = (a ?? []).map((x: any) => String(x.book_code)).filter(Boolean);
      if (codes.length === 0) {
        setBooks([]);
        return;
      }

      // 2) Metadaten zu Buchcodes holen (sb_books + sb_titles)
      // Hinweis: `sb_titles(...)` funktioniert, wenn FK sb_books.title_id -> sb_titles.title_id existiert
      const { data: b, error: bErr } = await supabase
        .from('sb_books')
        .select('book_code,title_id,sb_titles(title_name,subject,isbn)')
        .in('book_code', codes);

      if (bErr) throw bErr;

      const rows: TeacherBookRow[] = (b ?? []).map((x: any) => ({
        book_code: String(x.book_code),
        title_id: x.title_id ?? null,
        title_name: x.sb_titles?.title_name ?? null,
        subject: x.sb_titles?.subject ?? null,
        isbn: x.sb_titles?.isbn ?? null,
      }));

      // sort by subject/title/book_code for nicer view
      rows.sort((r1, r2) => {
        const a1 = `${r1.subject ?? ''} ${r1.title_name ?? ''} ${r1.book_code}`.toLowerCase();
        const a2 = `${r2.subject ?? ''} ${r2.title_name ?? ''} ${r2.book_code}`.toLowerCase();
        return a1.localeCompare(a2);
      });

      setBooks(rows);
    } catch (e: any) {
      setBErr(e?.message ?? 'Fehler beim Laden der Bücher dieses Lehrers.');
      setBooks([]);
    } finally {
      setBLoading(false);
    }
  }

  // ✅ Redirect bleibt (wie vorher), aber wir geben dir zusätzlich:
  // - einen “Zum Dashboard”-Button
  // - und wir machen den Redirect etwas länger, damit man auch wirklich klicken kann
  useEffect(() => {
    let cancelled = false;

    (async () => {
      // parallel schon mal Lehrer laden (falls Redirect blockiert / für Debug)
      loadTeachers();

      // Redirect wie vorher:
      setTimeout(() => {
        if (!cancelled) window.location.href = '/admin/dashboard';
      }, 2500);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div style={{ padding: 14 }}>
      <div
        style={{
          border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: 12,
          padding: 14,
          maxWidth: 1100,
          margin: '0 auto',
          background: 'rgba(0,0,0,0.18)',
          color: 'white',
        }}
      >
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ fontWeight: 800 }}>Lehrer → ausgeliehene Bücher (nur Anzeige)</div>
          <div style={{ flex: 1 }} />
          <button
            onClick={() => (window.location.href = '/admin/dashboard')}
            style={{
              padding: '8px 10px',
              borderRadius: 10,
              border: '1px solid rgba(255,255,255,0.14)',
              background: 'rgba(255,255,255,0.06)',
              color: 'white',
              cursor: 'pointer',
              fontWeight: 800,
            }}
          >
            Zum Dashboard
          </button>
        </div>

        <div style={{ opacity: 0.8, fontSize: 13, marginTop: 8, marginBottom: 12 }}>
          Hinweis: Du wirst gleich automatisch ins Dashboard weitergeleitet. Wenn du hier bleibst (z.B. falls Redirect blockiert), kannst du schnell prüfen, welcher Lehrer welche Bücher hat.
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <button
            onClick={loadTeachers}
            disabled={tLoading}
            style={{
              padding: '8px 10px',
              borderRadius: 10,
              border: '1px solid rgba(255,255,255,0.14)',
              background: 'rgba(255,255,255,0.06)',
              color: 'white',
              cursor: tLoading ? 'default' : 'pointer',
              fontWeight: 700,
            }}
          >
            {tLoading ? 'Lade Lehrkräfte…' : 'Lehrkräfte aktualisieren'}
          </button>

          <input
            value={teacherQuery}
            onChange={(e) => setTeacherQuery(e.target.value)}
            placeholder="Lehrer suchen (ID / Name / Kürzel)…"
            style={{
              padding: '8px 10px',
              borderRadius: 10,
              border: '1px solid rgba(255,255,255,0.14)',
              background: 'rgba(0,0,0,0.25)',
              color: 'white',
              minWidth: 280,
            }}
          />

          <select
            value={selectedTeacherId}
            onChange={(e) => {
              const tid = e.target.value;
              setSelectedTeacherId(tid);
              if (tid) loadTeacherBooks(tid);
              else setBooks([]);
            }}
            style={{
              padding: '8px 10px',
              borderRadius: 10,
              border: '1px solid rgba(255,255,255,0.14)',
              background: 'rgba(0,0,0,0.25)',
              color: 'white',
              minWidth: 260,
            }}
          >
            <option value="">— Lehrer auswählen —</option>
            {filteredTeachers.map((t) => {
              const ln = (t.last_name ?? '').trim();
              const fn = (t.first_name ?? '').trim();
              const sn = (t.short_name ?? '').trim();
              const namePart = [ln, fn].filter(Boolean).join(' ').trim();
              const suffix = sn ? ` (${sn})` : '';
              return (
                <option key={t.teacher_id} value={t.teacher_id}>
                  {t.teacher_id}
                  {namePart ? ` — ${namePart}` : ''}
                  {suffix}
                </option>
              );
            })}
          </select>

          <button
            onClick={() => (selectedTeacherId ? loadTeacherBooks(selectedTeacherId) : null)}
            disabled={!selectedTeacherId || bLoading}
            style={{
              padding: '8px 10px',
              borderRadius: 10,
              border: '1px solid rgba(255,255,255,0.14)',
              background: selectedTeacherId ? 'rgba(46,229,157,0.18)' : 'rgba(255,255,255,0.06)',
              color: 'white',
              cursor: !selectedTeacherId || bLoading ? 'default' : 'pointer',
              fontWeight: 800,
            }}
          >
            {bLoading ? 'Lade Bücher…' : 'Bücher laden'}
          </button>
        </div>

        {tErr ? <div style={{ marginTop: 10, color: 'rgba(255,93,108,.95)', whiteSpace: 'pre-wrap' }}>{tErr}</div> : null}
        {bErr ? <div style={{ marginTop: 10, color: 'rgba(255,93,108,.95)', whiteSpace: 'pre-wrap' }}>{bErr}</div> : null}

        <div style={{ marginTop: 12 }}>
          {selectedTeacherId ? (
            bLoading ? (
              <div style={{ opacity: 0.85 }}>Lade…</div>
            ) : books.length === 0 ? (
              <div style={{ opacity: 0.85 }}>Keine Bücher gefunden für Lehrer {selectedTeacherId}.</div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
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
                          <div style={{ opacity: 0.7, fontSize: 12 }}>{x.title_id ?? '-'}</div>
                        </td>
                        <td style={{ padding: 8, opacity: 0.9 }}>{x.isbn ?? '-'}</td>
                        <td style={{ padding: 8 }}>
                          <span style={{ padding: '2px 6px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.14)' }}>
                            {x.book_code}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          ) : (
            <div style={{ opacity: 0.85 }}>Wähle einen Lehrer aus, um seine ausgeliehenen Bücher zu sehen.</div>
          )}
        </div>

        <div style={{ marginTop: 10, opacity: 0.7, fontSize: 12 }}>
          Quelle: <b>sb_current_assignments</b> (Zuordnung) + <b>sb_books</b>/<b>sb_titles</b> (Titelinfos)
        </div>
      </div>
    </div>
  );
}
