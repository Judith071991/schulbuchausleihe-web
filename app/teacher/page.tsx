'use client';

import { useEffect, useMemo, useState } from 'react';
import Topbar from '../../components/Topbar';
import Modal from '../../components/Modal';
import { supabase } from '../../lib/supabaseClient';
import { fetchRole } from '../../lib/role';

export default function TeacherPage() {
  const [ready, setReady] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const [scan, setScan] = useState('');
  const [teacherId, setTeacherId] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [modalText, setModalText] = useState('');

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) return (window.location.href = '/login');

      const role = await fetchRole();

      if (role === 'admin') {
        return (window.location.href = '/admin');
      }

      if (role !== 'teacher') {
        return (window.location.href = '/login');
      }

      setReady(true);
    })();
  }, []);

  async function issueBook() {
    setMsg(null);
    setOk(null);

    try {
      const code = scan.trim();
      const tid = teacherId.trim();

      if (!code) throw new Error('Buch-Code fehlt.');
      if (!tid) throw new Error('Lehrer-ID fehlt.');

      const { error } = await supabase.rpc('sb_issue_to_teacher', {
        p_scan: code,
        p_teacher_id: tid,
        p_note: null,
      });

      if (error) throw error;

      setOk(`Buch ${code} erfolgreich zugewiesen.`);
      setScan('');
    } catch (e: any) {
      setMsg(e?.message ?? 'Unbekannter Fehler');
    }
  }

  async function returnBook() {
    setMsg(null);
    setOk(null);

    try {
      const code = scan.trim();
      if (!code) throw new Error('Buch-Code fehlt.');

      const { error } = await supabase.rpc('sb_return_book', {
        p_scan: code,
      });

      if (error) throw error;

      setOk(`Buch ${code} ins Lager zurückgebucht.`);
      setScan('');
    } catch (e: any) {
      setMsg(e?.message ?? 'Unbekannter Fehler');
    }
  }

  if (!ready) {
    return (
      <div className="container">
        <div className="card">
          <div className="h1">Lehrerbereich</div>
          <p className="sub">Lade…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <Topbar title="Lehrerbereich" />

      <div className="card">
        <div className="row">
          <div className="badge">Lehrkräfte-Ansicht</div>
          <div className="spacer" />
          <button
            className="btn secondary"
            onClick={() => (window.location.href = '/admin')}
          >
            Zum Adminbereich
          </button>
        </div>

        <div style={{ height: 12 }} />

        <div className="row">
          <input
            className="input"
            value={teacherId}
            onChange={(e) => setTeacherId(e.target.value)}
            placeholder="Lehrer-ID scannen/eingeben"
            style={{ maxWidth: 380 }}
          />
        </div>

        <div style={{ height: 12 }} />

        <div className="row">
          <input
            className="input"
            value={scan}
            onChange={(e) => setScan(e.target.value)}
            placeholder="Buch-Code scannen"
            style={{ maxWidth: 380 }}
          />
          <button className="btn ok" onClick={issueBook}>
            Buch zuweisen
          </button>
          <button className="btn secondary" onClick={returnBook}>
            Buch zurück ins Lager
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
            <div
              className="small"
              style={{ color: 'rgba(46,229,157,.95)', fontWeight: 800 }}
            >
              {ok}
            </div>
          </>
        )}
      </div>

      <Modal open={modalOpen} title="Hinweis" onClose={() => setModalOpen(false)}>
        <pre style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{modalText}</pre>
      </Modal>
    </div>
  );
}
