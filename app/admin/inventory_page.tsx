'use client';

import { useEffect, useState } from 'react';
import Topbar from '../../components/Topbar';
import { supabase } from '../../lib/supabaseClient';
import { fetchRole } from '../../lib/role';

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

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) return (window.location.href = '/login');
      const role = await fetchRole();
      if (role !== 'admin') return (window.location.href = '/teacher');
      setReady(true);
    })();
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
    </div>
  );
}
