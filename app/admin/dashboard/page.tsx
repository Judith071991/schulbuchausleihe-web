'use client';

import { useEffect, useState } from 'react';
import Topbar from '../../../components/Topbar';
import { supabase } from '../../../lib/supabaseClient';
import { fetchRole } from '../../../lib/role';

export default function AdminDashboardPage() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
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
    </div>
  );
}
