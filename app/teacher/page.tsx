'use client';

import { useEffect, useMemo, useState } from 'react';
import Topbar from '../../components/Topbar';
import Modal from '../../components/Modal';
import { supabase } from '../../lib/supabaseClient';
import { fetchRole } from '../../lib/role';

type BookRow = {
  class_id: string;
  student_id: string;
  subject: string;
  title_id: string;
  title_name: string;
  status: string;
};

type SummaryRow = {
  class_id: string;
  student_id: string;
  ok_count: number;
  missing_count: number;
  return_count: number;
};

export default function TeacherPage() {
  const [ready, setReady] = useState(false);
  const [classId, setClassId] = useState('');
  const [studentQuery, setStudentQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all'|'missing'|'ok'|'return'>('all');
  const [rows, setRows] = useState<BookRow[]>([]);
  const [summary, setSummary] = useState<SummaryRow[]>([]);
  const [msg, setMsg] = useState<string|null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalData, setModalData] = useState<BookRow|null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if(!data.session) return (window.location.href='/login');
      const role = await fetchRole();
      if(role !== 'admin' && role !== 'teacher_readonly') return (window.location.href='/login');
      setReady(true);
      await runQuery();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function runQuery(){
    setMsg(null);

    let q = supabase.from('v_teacher_student_book_status').select('*')
      .order('class_id').order('student_id').order('subject');
    if(classId.trim()) q = q.eq('class_id', classId.trim());
    if(studentQuery.trim()) q = q.ilike('student_id', `%${studentQuery.trim()}%`);
    const { data: d1, error: e1 } = await q;
    if(e1){ setMsg(`Fehler (v_teacher_student_book_status): ${e1.message}`); setRows([]); return; }
    setRows((d1 ?? []) as any as BookRow[]);

    let q2 = supabase.from('v_teacher_class_student_summary').select('*')
      .order('class_id').order('student_id');
    if(classId.trim()) q2 = q2.eq('class_id', classId.trim());
    if(studentQuery.trim()) q2 = q2.ilike('student_id', `%${studentQuery.trim()}%`);
    const { data: d2, error: e2 } = await q2;
    if(e2){ setMsg(`Fehler (v_teacher_class_student_summary): ${e2.message}`); setSummary([]); }
    else setSummary((d2 ?? []) as any as SummaryRow[]);
  }

  const filtered = useMemo(() => {
    if(statusFilter==='all') return rows;
    return rows.filter(r => (r.status ?? '').toLowerCase() === statusFilter);
  }, [rows, statusFilter]);

  const classOptions = useMemo(() => {
    const set = new Set(rows.map(r=>r.class_id).filter(Boolean));
    return Array.from(set).sort();
  }, [rows]);

  function openMissing(r:BookRow){
    setModalData(r); setModalOpen(true);
  }

  if(!ready){
    return <div className="container"><div className="card"><div className="h1">Schulbuchausleihe</div><p className="sub">Lade…</p></div></div>;
  }

  return (
    <div className="container">
      <Topbar title="Lehrkräfte" />

      <div className="card">
        <div className="row">
          <div className="badge">Suche & Filter</div>
          <div className="spacer" />
          <button className="btn secondary" onClick={runQuery}>Aktualisieren</button>
        </div>
        <div style={{height:12}} />
        <div className="row">
          <input className="input" placeholder="Schülernummer suchen (z.B. S-BLEISTIFT-003)"
            value={studentQuery} onChange={(e)=>setStudentQuery(e.target.value)} />
          <select className="select" value={classId} onChange={(e)=>setClassId(e.target.value)} style={{maxWidth:220}}>
            <option value="">Alle Klassen</option>
            {classOptions.map(c => <option key={c} value={c}>{c}</option>)}
          </select>

          <div className="spacer" />
          <button className={statusFilter==='all'?'btn':'btn secondary'} onClick={()=>setStatusFilter('all')}>Alle</button>
          <button className={statusFilter==='missing'?'btn danger':'btn secondary'} onClick={()=>setStatusFilter('missing')}>Missing</button>
          <button className={statusFilter==='return'?'btn':'btn secondary'} onClick={()=>setStatusFilter('return')}>Return</button>
          <button className={statusFilter==='ok'?'btn ok':'btn secondary'} onClick={()=>setStatusFilter('ok')}>OK</button>
        </div>

        {msg && <>
          <hr className="sep" />
          <div className="small" style={{ color:'rgba(255,93,108,.95)' }}>{msg}</div>
        </>}
      </div>

      <div style={{height:14}} />

      <div className="card">
        <div className="row">
          <div className="badge">Übersicht je Schüler</div>
          <div className="spacer" />
          <div className="small">OK / Missing / Return</div>
        </div>
        <div style={{height:10}} />
        <div className="tableWrap">
          <table>
            <thead><tr><th>Klasse</th><th>Schüler</th><th>OK</th><th>Missing</th><th>Return</th></tr></thead>
            <tbody>
              {summary.map(s => (
                <tr key={`${s.class_id}-${s.student_id}`}>
                  <td>{s.class_id}</td>
                  <td><span className="kbd">{s.student_id}</span></td>
                  <td>{s.ok_count}</td>
                  <td style={{color:'rgba(255,93,108,.95)', fontWeight:800}}>{s.missing_count}</td>
                  <td style={{color:'rgba(255,209,102,.95)', fontWeight:800}}>{s.return_count}</td>
                </tr>
              ))}
              {summary.length===0 && <tr><td colSpan={5} className="small">Keine Daten.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{height:14}} />

      <div className="card">
        <div className="row">
          <div className="badge">Bücherstatus (Details)</div>
          <div className="spacer" />
          <div className="small">{filtered.length} Einträge</div>
        </div>
        <div style={{height:10}} />
        <div className="tableWrap">
          <table>
            <thead><tr><th>Klasse</th><th>Schüler</th><th>Fach</th><th>Titel</th><th>Status</th><th>Aktion</th></tr></thead>
            <tbody>
              {filtered.map((r, idx) => (
                <tr key={idx}>
                  <td>{r.class_id}</td>
                  <td><span className="kbd">{r.student_id}</span></td>
                  <td>{r.subject}</td>
                  <td>
                    <div style={{fontWeight:800}}>{r.title_name}</div>
                    <div className="small"><span className="kbd">{r.title_id}</span></div>
                  </td>
                  <td><span className={`status ${(r.status ?? '').toLowerCase()}`}>{(r.status ?? '').toLowerCase()}</span></td>
                  <td>
                    {String(r.status).toLowerCase()==='missing'
                      ? <button className="btn danger" onClick={()=>openMissing(r)}>Pop-up für Screenshot</button>
                      : <span className="small">—</span>}
                  </td>
                </tr>
              ))}
              {filtered.length===0 && <tr><td colSpan={6} className="small">Keine passenden Treffer.</td></tr>}
            </tbody>
          </table>
        </div>

        <hr className="sep" />
        <div className="small">
          Lehrkräfte sehen <b>alle Klassen</b> (wie gewünscht) – aber nur lesend.
        </div>
      </div>

      <Modal open={modalOpen} title="Buch fehlt – bitte neu kaufen" onClose={()=>setModalOpen(false)}>
        {modalData && (
          <div className="alertBox">
            <div style={{fontSize:18, fontWeight:900, marginBottom:8, color:'#ffe6e8'}}>Fehlendes Buch (Missing)</div>
            <div className="row">
              <div className="badge">Klasse: <span className="kbd">{modalData.class_id}</span></div>
              <div className="badge">Schüler: <span className="kbd">{modalData.student_id}</span></div>
            </div>
            <div style={{height:10}} />
            <div style={{fontWeight:800}}>{modalData.title_name}</div>
            <div className="small">Titel-ID: <span className="kbd">{modalData.title_id}</span> · Fach: {modalData.subject}</div>
            <div style={{height:12}} />
            <div className="small">Bitte jetzt Screenshot machen. Danach <b>Schließen</b>.</div>
          </div>
        )}
      </Modal>
    </div>
  );
}
