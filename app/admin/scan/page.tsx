'use client';

import { useEffect, useRef, useState } from 'react';
import Topbar from '../../../components/Topbar';
import { supabase } from '../../../lib/supabaseClient';
import { fetchRole } from '../../../lib/role';

export default function AdminScanPage() {
  const [ready, setReady] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const [mode, setMode] = useState<'student' | 'teacher'>('student');
  const [holderId, setHolderId] = useState('');
  const [bookCode, setBookCode] = useState('');
  const [condition, setCondition] = useState<'ok' | 'used' | 'damaged'>('ok');
  const [note, setNote] = useState('');

  const bookRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) return (window.location.href = '/login');
      const role = await fetchRole();
      if (role !== 'admin') return (window.location.href = '/teacher');
      setReady(true);
    })();
  }, []);

  async function assign() {
    setMsg(null);
    setOk(null);

    const id = holderId.trim();
    const code = bookCode.trim();

    if (!id) return setMsg('Bitte zuerst Schüler- oder Lehrer-ID eingeben.');
    if (!code) return setMsg('Bitte Buchcode eingeben.');

    try {
      const { data, error } = await supabase.rpc('sb_scan_book_admin_84825', {
        p_new_student_id: id,
        p_condition: condition,
        p_note: note.trim() || null,
        book_code: code,
      });

      if (error) throw error;

      setOk(typeof data === 'string' ? data : 'Zuweisung gespeichert.');
      setBookCode('');
      setNote('');
      setTimeout(() => bookRef.current?.focus(), 50);
    } catch (e: any) {
      setMsg(e?.message ?? 'Unbekannter Fehler');
    }
  }

  async function undoLast() {
    setMsg(null);
    setOk(null);

    const { data, error } = await supabase.rpc('sb_undo_last_scan');

    if (error) setMsg(error.message);
    else setOk(String(data ?? 'Rückgängig gemacht.'));
  }

  if (!ready) {
    return (
      <div className="container">
        <div className="card">
          <div className="h1">Admin · Scan</div>
          <p className="sub">Lade…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <Topbar title="Admin · Scan & Zuweisen" />

      <div className="card">
        <div className="row">
          <div className="badge">Bücher scannen</div>
          <div className="spacer" />
          <button className="btn secondary" onClick={undoLast}>
            Letzte Aktion rückgängig
          </button>
        </div>

        <div style={{ height: 15 }} />

        <div className="row">
          <select
            className="select"
            value={mode}
            onChange={(e) => setMode(e.target.value as any)}
            style={{ maxWidth: 200 }}
          >
            <option value="student">Schüler</option>
            <option value="teacher">Lehrer</option>
          </select>

          <input
            className="input"
            value={holderId}
            onChange={(e) => setHolderId(e.target.value)}
            placeholder={mode === 'student' ? 'Schüler-ID scannen' : 'Lehrer-ID scannen'}
          />
        </div>

        <div style={{ height: 10 }} />

        <div className="row">
          <input
            ref={bookRef}
            className="input"
            value={bookCode}
            onChange={(e) => setBookCode(e.target.value)}
            placeholder="Buchcode scannen"
            onKeyDown={(e) => {
              if (e.key === 'Enter') assign();
            }}
          />
        </div>

        <div style={{ height: 10 }} />

        <div className="row">
          <select
            className="select"
            value={condition}
            onChange={(e) => setCondition(e.target.value as any)}
            style={{ maxWidth: 200 }}
          >
            <option value="ok">Zustand: ok</option>
            <option value="used">Zustand: benutzt</option>
            <option value="damaged">Zustand: kaputt</option>
          </select>

          <input
            className="input"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Notiz (optional)"
          />

          <button className="btn ok" onClick={assign}>
            Zuweisen
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
    </div>
  );
}
