'use client';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { fetchRole, Role } from '../lib/role';

export default function Topbar({ title }: { title: string }) {
  const [role, setRole] = useState<Role>(null);
  const [email, setEmail] = useState('');
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      setEmail(data.user?.email ?? '');
      setRole(await fetchRole());
    })();
  }, []);
  async function logout() {
    await supabase.auth.signOut();
    window.location.href = '/login';
  }
  return (
    <div className="card" style={{ marginBottom: 14 }}>
      <div className="row">
        <div>
          <div className="h1" style={{ fontSize: 26, marginBottom: 2 }}>{title}</div>
          <div className="small">
            {email ? <>Eingeloggt: <span className="kbd">{email}</span></> : '…'}{' '}
            {role ? <>Rolle: <span className="kbd">{role}</span></> : null}
          </div>
        </div>
        <div className="spacer" />
        <button className="btn secondary" onClick={logout}>Logout</button>
      </div>
    </div>
  );
}
