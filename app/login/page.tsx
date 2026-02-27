'use client';
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { fetchRole } from '../../lib/role';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string|null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        const role = await fetchRole();
        window.location.href = role === 'admin' ? '/admin' : '/teacher';
      }
    })();
  }, []);

  async function login() {
    setBusy(true); setMsg(null);
    try{
      const { error } = await supabase.auth.signInWithPassword({ email, password: pw });
      if(error) throw error;
      const role = await fetchRole();
      window.location.href = role === 'admin' ? '/admin' : '/teacher';
    }catch(e:any){
      setMsg(e?.message ?? 'Unbekannter Fehler');
    }finally{
      setBusy(false);
    }
  }

  return (
    <div className="container">
      <div className="card" style={{ maxWidth: 560, margin: '0 auto' }}>
        <div className="h1">Schulbuchausleihe</div>
        <p className="sub">Bitte einloggen.</p>
        <div className="row">
          <input className="input" placeholder="E-Mail" value={email} onChange={(e)=>setEmail(e.target.value)} />
        </div>
        <div style={{height:10}} />
        <div className="row">
          <input className="input" placeholder="Passwort" type="password" value={pw} onChange={(e)=>setPw(e.target.value)} />
        </div>
        <div style={{height:14}} />
        <div className="row">
          <button className="btn" disabled={busy} onClick={login}>{busy?'…':'Login'}</button>
          <span className="small">Rollen: <span className="kbd">admin</span> / <span className="kbd">teacher_readonly</span></span>
        </div>
        {msg && <>
          <hr className="sep" />
          <div className="small" style={{ color:'rgba(255,93,108,.95)' }}>{msg}</div>
        </>}
        <hr className="sep" />
        <div className="small">
          Wenn die App „hängt“, fehlen oft Vercel Env-Variablen: <span className="kbd">NEXT_PUBLIC_SUPABASE_URL</span> und <span className="kbd">NEXT_PUBLIC_SUPABASE_ANON_KEY</span>.
        </div>
      </div>
    </div>
  );
}
