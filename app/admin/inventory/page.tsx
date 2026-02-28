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

  // Laut Screenshot: p_status, p_condition, p_put_into_storage
  const [status, setStatus] = useState<'ok' | 'active'>('ok');
  const [condition, setCondition] = useState<'ok' | 'used' | 'damaged'>('ok');
  const [putIntoStorage, setPutIntoStorage] = useState(true);

  // ===== NEU: Titel-Übersicht (Schüler/Lehrer/Lager) =====
  const [sumLoading, setSumLoading] = useState(false);
  const [sumError, setSumError] = useState<string | null>(null);
  const [summary, setSummary] = useState<TitleSummaryRow[]>([]);
  const [sumQuery, setSumQuery] = useState('');

  const filteredSummary = useMemo(() => {
    const q = sumQuery.trim().toLowerCase();
    if (!q) return summary;
    return summary.filter((r) => {
      const hay = [
        r.title_id,
        r.subject ?? '',
        r.title_name ?? '',
        r.isbn ?? '',
      ]
        .join(' ')
        .toLowerCase();
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
  // ===== /NEU =====

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) return (window.location.href = '/login');
      const role = await fetchRole();
      if (role !== 'admin') return (window.location.href = '/teacher');
      setReady(true);

      // NEU: automatisch mitladen
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

      // NEU: nach Speichern aktualisieren (damit die Übersicht stimmt)
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

      {/* ===== NEU: Übersicht pro Titel (Schüler/Lehrer/Lager) ===== */}
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
      {/* ===== /NEU ===== */}
    </div>
  );
}
