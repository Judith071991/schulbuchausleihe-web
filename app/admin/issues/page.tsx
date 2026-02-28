'use client';

import { useEffect, useState } from 'react';
import Topbar from '../../../components/Topbar';
import Modal from '../../../components/Modal';
import { supabase } from '../../../lib/supabaseClient';
import { fetchRole } from '../../../lib/role';

type IssueType = 'lost' | 'damaged';
type PaymentMode = 'cash' | 'invoice' | 'none';

export default function AdminIssuesPage() {
  const [ready, setReady] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  // KEIN Name: nur Schülercode + Buchcode
  const [studentId, setStudentId] = useState('');
  const [bookCode, setBookCode] = useState('');

  const [issueType, setIssueType] = useState<IssueType>('lost');
  const [amount, setAmount] = useState('0');
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('none');
  const [note, setNote] = useState('');

  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) return (window.location.href = '/login');
      const role = await fetchRole();
      if (role !== 'admin') return (window.location.href = '/teacher');
      setReady(true);
    })();
  }, []);

  async function submit() {
    setMsg(null); setOk(null);
    try {
      const sid = studentId.trim();
      const bc = bookCode.trim();
      if (!sid) throw new Error('Schüler-Code fehlt.');
      if (!bc) throw new Error('Buch-Code fehlt.');

      const a = Number(String(amount).replace(',', '.'));
      if (Number.isNaN(a) || a < 0) throw new Error('Betrag ist ungültig.');

      // ✅ sb_report_issue ist bei dir vorhanden (Parameterliste hast du gezeigt)
      const { error } = await supabase.rpc('sb_report_issue', {
        p_student_id: sid,
        p_issue_type: issueType,
        p_condition: issueType === 'damaged' ? 'damaged' : 'lost',
        p_amount: a,
        p_payment_mode: paymentMode,
        p_note: note || null,
        book_code: bc,
        event_type: issueType,
      });

      if (error) throw error;

      setOk('Meldung gespeichert.');
      setBookCode('');
      setNote('');
      setConfirmOpen(false);
    } catch (e: any) {
      setMsg(e?.message ?? 'Unbekannter Fehler');
      setConfirmOpen(false);
    }
  }

  if (!ready) {
    return (
      <div className="container">
        <div className="card">
          <div className="h1">Verlust / Kaputt</div>
          <p className="sub">Lade…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <Topbar title="Admin · Verlust / Kaputt" />

      <div className="card">
        <div className="row">
          <div className="badge">Buch als verloren/kaputt melden (Popup)</div>
          <div className="spacer" />
          <button className="btn secondary" onClick={() => (window.location.href = '/admin')}>← Dashboard</button>
          <button className="btn secondary" onClick={() => (window.location.href = '/teacher')}>Zur Lehrkräfte-Ansicht</button>
        </div>

        <div style={{ height: 12 }} />

        <div className="row">
          <input
            className="input"
            value={studentId}
            onChange={(e) => setStudentId(e.target.value)}
            placeholder="Schüler-Code (student_id) scannen/eingeben"
            style={{ maxWidth: 380 }}
          />
          <input
            className="input"
            value={bookCode}
            onChange={(e) => setBookCode(e.target.value)}
            placeholder="Buch-Code scannen"
            style={{ maxWidth: 260 }}
          />
        </div>

        <div style={{ height: 10 }} />

        <div className="row">
          <select
            className="select"
            value={issueType}
            onChange={(e) => setIssueType(e.target.value as IssueType)}
            style={{ maxWidth: 220 }}
          >
            <option value="lost">verloren</option>
            <option value="damaged">kaputt</option>
          </select>

          <input
            className="input"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Betrag (z.B. 25)"
            style={{ maxWidth: 160 }}
          />

          <select
            className="select"
            value={paymentMode}
            onChange={(e) => setPaymentMode(e.target.value as PaymentMode)}
            style={{ maxWidth: 220 }}
          >
            <option value="none">Zahlung: offen/keine</option>
            <option value="cash">Bar</option>
            <option value="invoice">Rechnung</option>
          </select>
        </div>

        <div style={{ height: 10 }} />

        <div className="row">
          <input
            className="input"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Notiz (optional)"
            style={{ maxWidth: 860 }}
          />
        </div>

        <div style={{ height: 10 }} />

        <div className="row">
          <div className="spacer" />
          <button className="btn ok" onClick={() => setConfirmOpen(true)}>
            Meldung speichern (Popup)
          </button>
        </div>

        {msg && <>
          <hr className="sep" />
          <div className="small" style={{ color: 'rgba(255,93,108,.95)' }}>{msg}</div>
        </>}
        {ok && <>
          <hr className="sep" />
          <div className="small" style={{ color: 'rgba(46,229,157,.95)', fontWeight: 800 }}>{ok}</div>
        </>}
      </div>

      <Modal open={confirmOpen} title="Bestätigen" onClose={() => setConfirmOpen(false)}>
        <div className="small" style={{ marginBottom: 10 }}>
          Wirklich speichern?
          <br />
          <b>Schüler:</b> {studentId || '—'}<br />
          <b>Buch:</b> {bookCode || '—'}<br />
          <b>Typ:</b> {issueType}<br />
          <b>Betrag:</b> {amount}<br />
          <b>Zahlung:</b> {paymentMode}
        </div>
        <div className="row">
          <button className="btn secondary" onClick={() => setConfirmOpen(false)}>Abbrechen</button>
          <div className="spacer" />
          <button className="btn ok" onClick={submit}>Ja, speichern</button>
        </div>
      </Modal>
    </div>
  );
}
