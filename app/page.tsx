'use client';
import { useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { fetchRole } from '../lib/role';

export default function Home() {
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) return (window.location.href = '/login');
      const role = await fetchRole();
      window.location.href = role === 'admin' ? '/admin' : '/teacher';
    })();
  }, []);
  return (
    <div className="container">
      <div className="card">
        <div className="h1">Schulbuchausleihe</div>
        <p className="sub">Lade…</p>
      </div>
    </div>
  );
}
