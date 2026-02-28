'use client';

import { useEffect, useState } from 'react';
import Topbar from '../../../components/Topbar';
import { supabase } from '../../../lib/supabaseClient';
import { fetchRole } from '../../../lib/role';

type RpcTry = {
  fn: string;
  payload: any;
  label: string;
};

async function tryRpc(trials: RpcTry[]) {
  let lastErr: any = null;
  for (const t of trials) {
    const res = await supabase.rpc(t.fn as any, t.payload);
    if (!res.error) return { ok: true as const, data: res.data, used: t };
    lastErr = { ...res.error, _try: t };
  }
  return { ok: false as const, error: lastErr };
}

export default function AdminIssuesPage() {
  const [ready, setReady] = useState(false);

  const [msg, setMsg] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  // Eingaben
  const [studentId, setStudentId] = useState(''); // bei dir: nur Klasse+Code / Student-Code (ohne Namen)
  const [scan, setScan] = useState(''); // Buch-Scan (Barcode oder Buchcode)
  const [issueType, setIssueType] = useState<'lost' | 'damaged' | 'missing'>('damaged');
  const [condition, setCondition] = useState<'ok' | 'used' | 'damaged'>('damaged');
  const [amount, setAmount] = useState('0'); // Euro
  const [paymentMode, setPaymentMode] = useState<'none' | 'invoice' | 'paid'>('invoice');
  const [note, setNote] = useState('');

  // Anzeige
  const [resolvedBookCode, setResolvedBookCode] = useState<string>('');

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) return (window.location.href = '/login');
      const role = await fetchRole();
      if (role !== 'admin') return (window.location.href = '/teacher');
      setReady(true);
    })();
  }, []);

  async function resolveBookCode(p_scan: string) {
    // Du hast die Routine sb_resolve_book_code in der Liste
    // Wir versuchen: p_scan => book_code
    const res = await supabase.rpc('sb_resolve_book_code' as any, { p_scan });
    if (res.error) throw res.error;
    const bc = String(res.data ?? '').trim();
    if (!bc) throw new Error('Konnte keinen book_code aus dem Scan ableiten.');
    return bc;
  }

  async function submitIssue() {
    setMsg(null);
    setOk(null);
    setResolvedBookCode('');

    try {
      const s = scan.trim();
      if (!s) throw new Error('Buch-Scan fehlt.');
      const sid = studentId.trim();
      if (!sid) throw new Error('Student-Code (Klasse+Code) fehlt.');

      // 1) book_code aus Scan ableiten
      const book_code = await resolveBookCode(s);
      setResolvedBookCode(book_code);

      // 2) Zahl pars(en)
      const amt = Number(String(amount).replace(',', '.'));
      if (Number.isNaN(amt)) throw new Error('Betrag ist keine Zahl.');

      // 3) RPC: wir probieren mehrere Funktionsnamen + Payload-Varianten
      //    (weil deine DB je nach Version z.B. sb_report_issue_84827 heißt
      //     und mal p_scan / mal book_code verwendet)
      const fnCandidates = ['sb_report_issue', 'sb_report_issue_84827'];

      const trials: RpcTry[] = [];
      for (const fn of fnCandidates) {
        // Variante A: Scan+Student (häufig bei Scan-basierten Routinen)
        trials.push({
          fn,
          label: `${fn} mit p_scan+p_student_id`,
          payload: {
            p_scan: s,
            p_student_id: sid,
            p_issue_type: issueType,
            p_condition: condition,
            p_amount: amt,
            p_payment_mode: paymentMode,
            p_note: note || null,
          },
        });

        // Variante B: book_code statt Scan
        trials.push({
          fn,
          label: `${fn} mit book_code+p_student_id`,
          payload: {
            book_code,
            p_student_id: sid,
            p_issue_type: issueType,
            p_condition: condition,
            p_amount: amt,
            p_payment_mode: paymentMode,
            p_note: note || null,
          },
        });

        // Variante C: nur Scan (falls deine Funktion nur p_scan erwartet)
        trials.push({
          fn,
          label: `${fn} nur p_scan`,
          payload: { p_scan: s },
        });
      }

      const result = await tryRpc(trials);
      if (!result.ok) {
        const t = result.error?._try;
        throw new Error(
          `Issues-RPC fehlgeschlagen.\nLetzter Versuch: ${t?.label ?? 'unbekannt'}\n` +
            (result.error?.message ?? 'Unbekannter Fehler')
        );
      }

      setOk(`Issue gespeichert (Buch: ${book_code}).`);
      setScan('');
      setNote('');
      // studentId lassen wir stehen (oft scannt man mehrere Bücher für denselben Schüler)
    } catch (e: any) {
      setMsg(e?.message ?? 'Unbekannter Fehler');
    }
  }

  if (!ready) {
    return (
      <div className="container">
        <div className="card">
          <div className="h1">Issues</div>
          <p className="sub">Lade…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <Topbar title="Verlust / Kaputt (Issues)" />

      <div className="card">
        <div className="row">
          <div className="badge">Issue erfassen</div>
          <div className="spacer" />
          <button className="btn secondary" onClick={() => (window.location.href = '/admin')}>
            Zurück zum Dashboard
          </button>
        </div>

        <div style={{ height: 12 }} />

        <div className="row">
          <input
            className="input"
            value={studentId}
            onChange={(e) => setStudentId(e.target.value)}
            placeholder="Student-Code (z.B. Klasse+Code) – ohne Namen"
          />
        </div>

        <div style={{ height: 10 }} />

        <div className="row">
          <input
            className="input"
            value={scan}
            onChange={(e) => setScan(e.target.value)}
            placeholder="Buch scannen / Buchcode eingeben"
          />
          <button className="btn ok" onClick={submitIssue}>
            Speichern
          </button>
        </div>

        <div style={{ height: 10 }} />

        <div className="row">
          <select className="select" value={issueType} onChange={(e) => setIssueType(e.target.value as any)}>
            <option value="damaged">kaputt</option>
            <option value="lost">verloren</option>
            <option value="missing">fehlt</option>
          </select>

          <select className="select" value={condition} onChange={(e) => setCondition(e.target.value as any)}>
            <option value="ok">Zustand: ok</option>
            <option value="used">Zustand: gebraucht</option>
            <option value="damaged">Zustand: beschädigt</option>
          </select>

          <input
            className="input"
            style={{ maxWidth: 160 }}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Betrag €"
          />

          <select className="select" value={paymentMode} onChange={(e) => setPaymentMode(e.target.value as any)}>
            <option value="invoice">Zahlung: Rechnung</option>
            <option value="paid">Zahlung: bezahlt</option>
            <option value="none">Zahlung: keine</option>
          </select>
        </div>

        <div style={{ height: 10 }} />

        <div className="row">
          <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Notiz (optional)" />
        </div>

        {resolvedBookCode && (
          <>
            <div style={{ height: 10 }} />
            <div className="small">
              Erkannter <b>book_code</b>: <span className="kbd">{resolvedBookCode}</span>
            </div>
          </>
        )}

        {msg && (
          <>
            <hr className="sep" />
            <div className="small" style={{ color: 'rgba(255,93,108,.95)', whiteSpace: 'pre-wrap' }}>
              {msg}
            </div>
          </>
        )}

        {ok && (
          <>
            <hr className="sep" />
            <div className="small" style={{ color: 'rgba(46,229,157,.95)', fontWeight: 800 }}>
              {ok}
            </div>
          </>
        )}

        <hr className="sep" />
        <div className="small">
          Hinweis: Diese Seite versucht automatisch verschiedene RPC-Varianten (sb_report_issue / sb_report_issue_84827),
          damit es bei dir sicher baut und funktioniert.
        </div>
      </div>
    </div>
  );
}
