'use client';

import { useEffect, useState } from 'react';
import Topbar from '../../../components/Topbar';
import { supabase } from '../../../lib/supabaseClient';
import { fetchRole } from '../../../lib/role';

export default function AdminDashboardPage() {
  const [ready, setReady] = useState(false);

  const [bookCode, setBookCode] = useState('');
  const [bookResult, setBookResult] = useState<any>(null);
  const [bookNotFound, setBookNotFound] = useState(false);
  const [bookLoading, setBookLoading] = useState(false);

  async function previewPromote() {
    const { data, error } = await supabase.rpc('sb_admin_promote_classes', { p_dry_run: true });
    if (error) return alert(error.message);

    alert(
      (data ?? [])
        .map((r: any) => `${r.old_class_id} → ${r.new_class_id} (${r.student_count} Schüler)`)
        .join('\n') || 'Keine Klassen gefunden.'
    );
  }

  async function doPromote() {
    const typed = prompt('Wirklich Schuljahreswechsel durchführen?\nTippe: HOCHSETZEN');
    if (typed !== 'HOCHSETZEN') return;

    const { data, error } = await supabase.rpc('sb_admin_promote_classes', { p_dry_run: false });
    if (error) return alert(error.message);

    alert(
      'Fertig.\n' +
        ((data ?? []).map((r: any) => `${r.old_class_id} → ${r.new_class_id}`).join('\n') || '')
    );

    window.location.reload();
  }

  async function searchBookCode() {
    const code = bookCode.trim();

    if (!code) {
      setBookResult(null);
      setBookNotFound(false);
      return;
    }

    setBookLoading(true);
    setBookResult(null);
    setBookNotFound(false);

    const paddedCode = `B-${code.padStart(6, '0')}`;

    const { data, error } = await supabase
      .from('v_book_code_lookup')
      .select('*')
      .or(`book_code.eq.${code},book_code.eq.${paddedCode}`)
      .maybeSingle();

    setBookLoading(false);

    if (error) {
      console.error(error);
      alert('Fehler bei der Buchsuche: ' + error.message);
      return;
    }

    if (!data) {
      setBookNotFound(true);
      return;
    }

    setBookResult(data);
  }

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) return (window.location.href = '/login');

      const role = await fetchRole();
      if (role !== 'admin') return (window.location.href = '/teacher');

      setReady(true);
    })();
  }, []);

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
      <Topbar title="Admin Dashboard" />

      <div className="card">
        <div className="h1" style={{ marginBottom: 12 }}>Navigation</div>

        <div className="row" style={{ flexWrap: 'wrap', gap: 10 }}>
          <button className="btn" onClick={() => (window.location.href = '/admin/scan')}>
            Scan & Zuweisen
          </button>

          <button className="btn" onClick={() => (window.location.href = '/admin/inventory')}>
            Bestand / Titel & Bücher
          </button>

          <button className="btn ok" onClick={() => (window.location.href = '/admin/required')}>
            Soll-Listen
          </button>

          <button className="btn" onClick={() => (window.location.href = '/admin/students')}>
            Schüler
          </button>

          <button className="btn" onClick={() => (window.location.href = '/admin/teachers')}>
            Lehrkräfte
          </button>

          <button className="btn" onClick={() => (window.location.href = '/admin/incidents')}>
            Verlust / Kaputt
          </button>

          <button className="btn secondary" onClick={previewPromote}>
            Schuljahreswechsel: Vorschau
          </button>

          <button className="btn ok" onClick={doPromote}>
            Schuljahreswechsel: HOCHSETZEN
          </button>

          <div className="spacer" />

          <button className="btn secondary" onClick={() => (window.location.href = '/teacher')}>
            Zur Lehrkräfte-Ansicht
          </button>
        </div>

        <hr className="sep" />

        <div className="small">
          Tipp: /admin ist jetzt nur Dashboard. Funktionen liegen sauber in Unterseiten (scan, inventory, …).
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="h1" style={{ marginBottom: 12 }}>Buchcode suchen</div>

        <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
          <input
            value={bookCode}
            onChange={(e) => setBookCode(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') searchBookCode();
            }}
            placeholder="Buchnummer eingeben, z. B. 1345"
            style={{
              padding: 10,
              minWidth: 260,
              flex: 1,
            }}
          />

          <button className="btn" onClick={searchBookCode}>
            Suchen
          </button>
        </div>

        {bookLoading && (
          <p className="sub" style={{ marginTop: 12 }}>
            Suche läuft…
          </p>
        )}

        {bookNotFound && (
          <div className="small" style={{ marginTop: 12 }}>
            Kein Buch mit dieser Nummer gefunden.
          </div>
        )}

        {bookResult && (
          <div
            style={{
              marginTop: 16,
              border: '1px solid #ddd',
              borderRadius: 8,
              padding: 12,
            }}
          >
            <p>
              <strong>Buchcode:</strong> {bookResult.book_code}
            </p>

            <p>
              <strong>Buchtitel:</strong> {bookResult.title_name || 'kein Titel gefunden'}
            </p>

            <p>
              <strong>Status:</strong>{' '}
              {bookResult.holder_type === 'student'
                ? 'Schüler'
                : bookResult.holder_type === 'teacher'
                ? 'Lehrkraft'
                : bookResult.holder_type === 'storage'
                ? 'LAGER'
                : 'nicht vergeben'}
            </p>

            <p>
              <strong>Aktueller Besitzer:</strong>{' '}
              {bookResult.current_holder || bookResult.holder_id || 'nicht vergeben'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
