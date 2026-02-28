'use client';

import { useEffect, useMemo, useState } from 'react';
import Topbar from '../../../components/Topbar';
import { supabase } from '../../../lib/supabaseClient';
import { fetchRole } from '../../../lib/role';

type TitleRow = {
  title_id: string;
  subject: string | null;
  title_name: string | null;
  isbn: string | null;
  price_eur: number | null;
};

type RequiredRow = {
  req_id: string;
  class_id: string;
  subject: string | null;
  title_id: string;
  applies_to_gu: boolean | null; // null = alle, true = nur GU, false = nur Regel
  religion: string | null;       // EV/RK/PP/null
  course: string | null;         // Bio/Chemie/.../F/null
  created_at: string | null;
};

const REL = ['EV', 'RK', 'PP'] as const;
const COURSE = ['Bio', 'Chemie', 'Sowi', 'Informatik', 'Arbeitslehre', 'F'] as const;

function uuid() {
  // Browser UUID
  return crypto.randomUUID();
}

export default function AdminRequiredTitlesPage() {
  const [ready, setReady] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  // Auswahl
  const [classId, setClassId] = useState('5a');
  const [classes, setClasses] = useState<{ class_id: string }[]>([]);

  // Filter für Soll-Liste
  const [guMode, setGuMode] = useState<'all' | 'gu' | 'normal'>('all');
  const [religion, setReligion] = useState<string>(''); // '' = alle
  const [course, setCourse] = useState<string>('');     // '' = alle

  // Daten
  const [required, setRequired] = useState<RequiredRow[]>([]);
  const [titles, setTitles] = useState<TitleRow[]>([]);
  const [titleQuery, setTitleQuery] = useState('');

  // Copy
  const [copyFrom, setCopyFrom] = useState<string>('');

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) return (window.location.href = '/login');
      const role = await fetchRole();
      if (role !== 'admin') return (window.location.href = '/teacher');

      // Klassen laden
      const c = await supabase.from('sb_classes').select('class_id').order('class_id');
      if (!c.error) setClasses(c.data ?? []);

      // Titel laden (für Suche/Hinzufügen)
      const t = await supabase
        .from('sb_titles')
        .select('title_id, subject, title_name, isbn, price_eur')
        .order('subject')
        .order('title_name');
      if (!t.error) setTitles((t.data ?? []) as TitleRow[]);

      setReady(true);
    })();
  }, []);

  useEffect(() => {
    if (!ready) return;
    loadRequired();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, classId]);

  async function loadRequired() {
    setMsg(null);
    setOk(null);
    try {
      const { data, error } = await supabase
        .from('sb_required_titles')
        .select('req_id, class_id, subject, title_id, applies_to_gu, religion, course, created_at')
        .eq('class_id', classId)
        .order('subject', { ascending: true })
        .order('title_id', { ascending: true });

      if (error) throw error;
      setRequired((data ?? []) as RequiredRow[]);
    } catch (e: any) {
      setMsg(e?.message ?? 'Fehler beim Laden.');
    }
  }

  // Filtered view (nur Anzeige)
  const requiredFiltered = useMemo(() => {
    return required.filter((r) => {
      // GU Filter
      if (guMode === 'gu' && r.applies_to_gu === false) return false;
      if (guMode === 'normal' && r.applies_to_gu === true) return false;

      // Religion Filter
      if (religion && (r.religion ?? '') !== religion) return false;

      // Kurs Filter
      if (course && (r.course ?? '') !== course) return false;

      return true;
    });
  }, [required, guMode, religion, course]);

  const titlesFiltered = useMemo(() => {
    const q = titleQuery.trim().toLowerCase();
    if (!q) return titles.slice(0, 50);
    return titles
      .filter((t) => {
        return (
          (t.title_id ?? '').toLowerCase().includes(q) ||
          (t.title_name ?? '').toLowerCase().includes(q) ||
          (t.subject ?? '').toLowerCase().includes(q) ||
          (t.isbn ?? '').toLowerCase().includes(q)
        );
      })
      .slice(0, 50);
  }, [titles, titleQuery]);

  function mapAppliesToGu(mode: 'all' | 'gu' | 'normal'): boolean | null {
    if (mode === 'all') return null;
    if (mode === 'gu') return true;
    return false;
  }

  async function addRequired(title: TitleRow) {
    setMsg(null);
    setOk(null);
    try {
      const row = {
        req_id: uuid(),
        class_id: classId,
        subject: title.subject ?? null,
        title_id: title.title_id,
        applies_to_gu: mapAppliesToGu(guMode),
        religion: religion || null,
        course: course || null,
      };

      const { error } = await supabase.from('sb_required_titles').insert(row);
      if (error) throw error;

      setOk(`Hinzugefügt: ${title.title_name ?? title.title_id}`);
      await loadRequired();
    } catch (e: any) {
      setMsg(e?.message ?? 'Fehler beim Hinzufügen.');
    }
  }

  async function removeRequired(req_id: string) {
    setMsg(null);
    setOk(null);
    try {
      const { error } = await supabase.from('sb_required_titles').delete().eq('req_id', req_id);
      if (error) throw error;
      setOk('Eintrag gelöscht.');
      await loadRequired();
    } catch (e: any) {
      setMsg(e?.message ?? 'Fehler beim Löschen.');
    }
  }

  async function copyListFromOtherClass() {
    setMsg(null);
    setOk(null);
    try {
      const from = copyFrom.trim();
      if (!from) throw new Error('Bitte „Kopieren von Klasse“ wählen.');
      if (from === classId) throw new Error('Quelle und Ziel sind gleich.');

      // Quelle laden
      const src = await supabase
        .from('sb_required_titles')
        .select('subject, title_id, applies_to_gu, religion, course')
        .eq('class_id', from);

      if (src.error) throw src.error;

      const rows = (src.data ?? []).map((r: any) => ({
        req_id: uuid(),
        class_id: classId,
        subject: r.subject ?? null,
        title_id: r.title_id,
        applies_to_gu: r.applies_to_gu ?? null,
        religion: r.religion ?? null,
        course: r.course ?? null,
      }));

      if (rows.length === 0) throw new Error(`Quelle ${from} hat keine Einträge.`);

      // Ziel optional vorher leeren? (wir machen NICHT automatisch)
      // Wir fügen einfach hinzu. Doppelte Titel sind möglich -> je nach Bedarf; später können wir "Dedupe" bauen.
      const { error } = await supabase.from('sb_required_titles').insert(rows);
      if (error) throw error;

      setOk(`Liste kopiert: ${from} → ${classId} (${rows.length} Einträge).`);
      await loadRequired();
    } catch (e: any) {
      setMsg(e?.message ?? 'Fehler beim Kopieren.');
    }
  }

  async function clearClassList() {
    setMsg(null);
    setOk(null);
    try {
      const confirmText = `LÖSCHEN ${classId}`;
      const typed = prompt(`Wirklich ALLE Soll-Einträge für ${classId} löschen?\nTippe exakt: ${confirmText}`);
      if (typed !== confirmText) return;

      const { error } = await supabase.from('sb_required_titles').delete().eq('class_id', classId);
      if (error) throw error;

      setOk(`Alle Einträge für ${classId} gelöscht.`);
      await loadRequired();
    } catch (e: any) {
      setMsg(e?.message ?? 'Fehler beim Löschen der Klasse.');
    }
  }

  if (!ready) {
    return (
      <div className="container">
        <div className="card">
          <div className="h1">Soll-Liste</div>
          <p className="sub">Lade…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <Topbar title="Admin · Soll-Liste pro Klasse" />

      <div className="card">
        <div className="row">
          <div className="badge">Klasse & Filter</div>
          <div className="spacer" />
          <button className="btn secondary" onClick={() => (window.location.href = '/admin')}>
            ← Dashboard
          </button>
        </div>

        <div style={{ height: 10 }} />

        <div className="row">
          <select className="select" value={classId} onChange={(e) => setClassId(e.target.value)}>
            {classes.length === 0 ? <option value={classId}>{classId}</option> : null}
            {classes.map((c) => (
              <option key={c.class_id} value={c.class_id}>
                {c.class_id}
              </option>
            ))}
          </select>

          <select className="select" value={guMode} onChange={(e) => setGuMode(e.target.value as any)}>
            <option value="all">GU/Regel: alle</option>
            <option value="gu">nur GU</option>
            <option value="normal">nur Regel</option>
          </select>

          <select className="select" value={religion} onChange={(e) => setReligion(e.target.value)}>
            <option value="">Religion: alle</option>
            {REL.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>

          <select className="select" value={course} onChange={(e) => setCourse(e.target.value)}>
            <option value="">Kurs: alle</option>
            {COURSE.map((c) => (
              <option key={c} value={c}>
                {c === 'F' ? 'Französisch (F)' : c}
              </option>
            ))}
          </select>

          <div className="spacer" />
          <button className="btn secondary" onClick={loadRequired}>
            Neu laden
          </button>
        </div>

        <div style={{ height: 10 }} />

        <div className="row">
          <select className="select" value={copyFrom} onChange={(e) => setCopyFrom(e.target.value)} style={{ maxWidth: 220 }}>
            <option value="">Kopieren von…</option>
            {classes
              .filter((c) => c.class_id !== classId)
              .map((c) => (
                <option key={c.class_id} value={c.class_id}>
                  {c.class_id}
                </option>
              ))}
          </select>
          <button className="btn ok" onClick={copyListFromOtherClass}>
            Liste kopieren
          </button>
          <div className="spacer" />
          <button className="btn secondary" onClick={clearClassList}>
            Klasse leeren
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
            <div className="small" style={{ color: 'rgba(46,229,157,.95)', fontWeight: 800 }}>
              {ok}
            </div>
          </>
        )}

        <hr className="sep" />

        <div className="h2">Soll-Liste für {classId}</div>
        <div className="small" style={{ opacity: 0.85 }}>
          Anzeige ist gefiltert (GU/Religion/Kurs). Hinzufügen übernimmt genau die aktuell gewählten Filter.
        </div>

        <div style={{ height: 8 }} />

        {requiredFiltered.length === 0 ? (
          <div className="small">Keine Einträge (für diese Filter).</div>
        ) : (
          <div className="small" style={{ lineHeight: 1.8 }}>
            {requiredFiltered.map((r) => (
              <div key={r.req_id} className="row" style={{ alignItems: 'center' }}>
                <div style={{ flex: 1 }}>
                  <span className="kbd">{r.subject ?? '-'}</span> <b>{r.title_id}</b>
                  <span style={{ opacity: 0.8 }}>
                    {' '}
                    | GU:{' '}
                    {r.applies_to_gu === null ? 'alle' : r.applies_to_gu ? 'nur GU' : 'nur Regel'} | Reli:{' '}
                    {r.religion ?? 'alle'} | Kurs: {r.course ?? 'alle'}
                  </span>
                </div>
                <button className="btn secondary" onClick={() => removeRequired(r.req_id)}>
                  Löschen
                </button>
              </div>
            ))}
          </div>
        )}

        <hr className="sep" />

        <div className="h2">Titel suchen & hinzufügen</div>
        <div className="row">
          <input
            className="input"
            value={titleQuery}
            onChange={(e) => setTitleQuery(e.target.value)}
            placeholder="Suche nach title_id / Name / ISBN / Fach…"
          />
        </div>

        <div style={{ height: 8 }} />

        <div className="small" style={{ lineHeight: 1.8 }}>
          {titlesFiltered.map((t) => (
            <div key={t.title_id} className="row" style={{ alignItems: 'center' }}>
              <div style={{ flex: 1 }}>
                <span className="kbd">{t.subject ?? '-'}</span> <b>{t.title_name ?? t.title_id}</b>{' '}
                <span style={{ opacity: 0.8 }}>
                  ({t.title_id}) {t.isbn ? `| ISBN ${t.isbn}` : ''} {t.price_eur != null ? `| ${t.price_eur} €` : ''}
                </span>
              </div>
              <button className="btn ok" onClick={() => addRequired(t)}>
                + Hinzufügen
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
