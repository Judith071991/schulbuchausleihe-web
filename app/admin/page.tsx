'use client';

import { useEffect, useState } from 'react';
import Topbar from '../../components/Topbar';
import { supabase } from '../../lib/supabaseClient';
import { fetchRole } from '../../lib/role';

export default function AdminPage() {
  const [ready, setReady] = useState(false);
  const [msg, setMsg] = useState<string|null>(null);
  const [ok, setOk] = useState<string|null>(null);

  const [titleId, setTitleId] = useState('PO_TEAM_1');
  const [subject, setSubject] = useState('Politik');
  const [titleName, setTitleName] = useState('Team 1');
  const [price, setPrice] = useState('32.95');
  const [bookCodes, setBookCodes] = useState('9149,29171,2066,2084,9165,2014,2101,2004,2116');
  const [initialStatus, setInitialStatus] = useState<'ok'|'active'>('ok');
  const [active, setActive] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if(!data.session) return (window.location.href='/login');
      const role = await fetchRole();
      if(role !== 'admin') return (window.location.href='/teacher');
      setReady(true);
    })();
  }, []);

  async function save(){
    setMsg(null); setOk(null);
    try{
      const codes = bookCodes.split(',').map(s=>s.trim()).filter(Boolean);
      const pr = Number(String(price).replace(',', '.'));
      const { error } = await supabase.rpc('sb_admin_create_title_with_books', {
        p_title_id: titleId.trim(),
        p_subject: subject.trim(),
        p_title_name: titleName.trim(),
        p_price: pr,
        p_book_codes: codes,
        p_initial_status: initialStatus,
        p_active_status: active,
      });
      if(error) throw error;
      setOk('Erfolgreich gespeichert.');
    }catch(e:any){
      setMsg(e?.message ?? 'Unbekannter Fehler');
    }
  }

  if(!ready){
    return <div className="container"><div className="card"><div className="h1">Admin</div><p className="sub">Lade…</p></div></div>;
  }

  return (
    <div className="container">
      <Topbar title="Admin" />

      <div className="card">
        <div className="row">
          <div className="badge">Titel + Bücher anlegen/aktualisieren</div>
          <div className="spacer" />
          <button className="btn secondary" onClick={()=>window.location.href='/teacher'}>Zur Lehrkräfte-Ansicht</button>
        </div>

        <div style={{height:12}} />

        <div className="row">
          <input className="input" value={titleId} onChange={(e)=>setTitleId(e.target.value)} placeholder="title_id" />
          <input className="input" value={subject} onChange={(e)=>setSubject(e.target.value)} placeholder="subject" />
        </div>
        <div style={{height:10}} />
        <div className="row">
          <input className="input" value={titleName} onChange={(e)=>setTitleName(e.target.value)} placeholder="title_name" />
          <input className="input" value={price} onChange={(e)=>setPrice(e.target.value)} placeholder="price" />
        </div>
        <div style={{height:10}} />
        <div className="row">
          <input className="input" style={{maxWidth:860}} value={bookCodes} onChange={(e)=>setBookCodes(e.target.value)}
            placeholder="book codes, Komma-getrennt" />
        </div>
        <div style={{height:10}} />
        <div className="row">
          <select className="select" value={initialStatus} onChange={(e)=>setInitialStatus(e.target.value as any)} style={{maxWidth:220}}>
            <option value="ok">initial status: ok</option>
            <option value="active">initial status: active</option>
          </select>
          <label className="badge" style={{cursor:'pointer'}}>
            <input type="checkbox" checked={active} onChange={(e)=>setActive(e.target.checked)} style={{marginRight:8}} />
            Title active
          </label>
          <div className="spacer" />
          <button className="btn ok" onClick={save}>Speichern</button>
        </div>

        {msg && <>
          <hr className="sep" />
          <div className="small" style={{ color:'rgba(255,93,108,.95)' }}>{msg}</div>
        </>}
        {ok && <>
          <hr className="sep" />
          <div className="small" style={{ color:'rgba(46,229,157,.95)', fontWeight:800 }}>{ok}</div>
        </>}

        <hr className="sep" />
        <div className="small">
          Wenn diese Seite einen RPC-Parameter-Fehler wirft, müssen wir die Parameternamen an deine Funktion anpassen
          (Supabase SQL: <span className="kbd">\df+ sb_admin_create_title_with_books</span>).
        </div>
      </div>
    </div>
  );
}
