'use client';

import { useEffect, useState } from 'react';
import Topbar from '../../../components/Topbar';
import { supabase } from '../../../lib/supabaseClient';
import { fetchRole } from '../../../lib/role';

type TeacherRow = {
  teacher_id: string;
  active: boolean;
  created_at: string;
};

export default function AdminTeachersPage() {
  const [ready, setReady] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const [teacherId, setTeacherId] = useState('');
  const [active, setActive] = useState(true);

  const [teachers, setTeachers] = useState<TeacherRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) return (window.location.href = '/login');

      const role = await fetchRole();
      if (role !== 'admin') return (window.location.href = '/teacher');

      setReady(true);
      loadTeachers();
    })();
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
        .upsert(
          { teacher_id: id, active },
          { onConflict: 'teacher_id' }
        );

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
          <button
            className="btn secondary"
            onClick={() => (window.location.href = '/admin/dashboard')}
          >
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

          <button
            className="btn secondary"
            onClick={loadTeachers}
            disabled={loading}
          >
            {loading ? 'Lade…' : 'Aktualisieren'}
          </button>
        </div>

        {msg && (
          <>
            <hr className="sep" />
            <div
              className="small"
              style={{ color: 'rgba(255,93,108,.95)' }}
            >
              {msg}
            </div>
          </>
        )}

        {ok && (
          <>
            <hr className="sep" />
            <div
              className="small"
              style={{
                color: 'rgba(46,229,157,.95)',
                fontWeight: 800,
              }}
            >
              {ok}
            </div>
          </>
        )}

        <hr className="sep" />

        <div className="badge">
          Angelegte Lehrkräfte ({teachers.length})
        </div>

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
                <div style={{ marginLeft: 10 }}>
                  {t.active ? 'aktiv' : 'inaktiv'}
                </div>
                <div className="spacer" />
                <button
                  className="btn secondary"
                  onClick={() => toggleTeacher(t)}
                >
                  {t.active ? 'Deaktivieren' : 'Aktivieren'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
