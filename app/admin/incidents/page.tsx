'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Topbar from '../../../components/Topbar';
import Modal from '../../../components/Modal';
import { supabase } from '../../../lib/supabaseClient';
import { fetchRole } from '../../../lib/role';

type ClassRow = { class_id: string };

type BookMeta = {
  book_code: string;
  title_id: string;
  subject: string | null;
  title_name: string | null;
  isbn: string | null;
  price_eur: number | null;
};

type Line = {
  book_code: string;
  meta?: BookMeta;
  // Auswahl
  mode: 'full' | 'damage5' | 'damage10' | 'custom';
  customAmount: string; // für custom
  note?: string;
};

function euro(n: number | null | undefined) {
  if (n == null || Number.isNaN(n)) return '-';
  return n.toFixed(2).replace('.', ',') + ' €';
}

function parseNum(s: string): number | null {
  const x = Number(String(s).replace(',', '.'));
  return Number.isFinite(x) ? x : null;
}

export default function AdminIncidentsPage() {
  const [ready, setReady] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  // Klassen
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [classId, setClassId] = useState('5a');

  // Schüler
  const [studentId, setStudentId] = useState('');

  // Buch scan/input
  const [bookInput, setBookInput] = useState('');
  const bookInputRef = useRef<HTMLInputElement | null>(null);

  // Liste
  const [lines, setLines] = useState<Line[]>([]);

  // Pop-up
  const [showPrint, setShowPrint] = useState(false);

  // speichern
  const [alsoSave, setAlsoSave] = useState(true);
  const [paymentMode, setPaymentMode] = useState<'cash' | 'transfer' | 'unknown'>('unknown');

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) return (window.location.href = '/login');
      const role = await fetchRole();
      if (role !== 'admin') return (window.location.href = '/teacher');

      // Klassen laden (falls Tabelle existiert)
      const c = await supabase.from('sb_classes').select('class_id').order('class_id');
      if (!c.error && c.data) {
        setClasses(c.data as any);
        if (c.data.length > 0) setClassId((c.data[0] as any).class_id);
      }

      setReady(true);
      setTimeout(() => bookInputRef.current?.focus(), 150);
    })();
  }, []);

  // Meta-Daten für einen Buchcode holen
  async function fetchBookMeta(code: string): Promise<BookMeta> {
    // sb_books(book_code, title_id) + sb_titles(title_id, subject, title_name, isbn, price_eur)
    const { data, error } = await supabase
      .from('sb_books')
      .select('book_code, title_id, sb_titles:sb_titles(subject, title_name, isbn, price_eur)')
      .eq('book_code', code)
      .maybeSingle();

    if (error) throw error;
    if (!data) throw new Error(`Buchcode ${code} nicht gefunden (sb_books).`);

    const t = (data as any).sb_titles;
    return {
      book_code: (data as any).book_code,
      title_id: (data as any).title_id,
      subject: t?.subject ?? null,
      title_name: t?.title_name ?? null,
      isbn: t?.isbn ?? null,
      price_eur: t?.price_eur != null ? Number(t.price_eur) : null,
    };
  }

  async function addBookCode(raw: string) {
    setMsg(null);
    setOk(null);

    const code = raw.trim();
    if (!code) return;

    // Duplikat-Warnung: trotzdem erlauben (wie bei dir generell)
    const already = lines.some((l) => l.book_code === code);

    try {
      const meta = await fetchBookMeta(code);
      setLines((prev) => [
        ...prev,
        {
          book_code: code,
          meta,
          mode: 'full',
          customAmount: '',
          note: already ? 'Duplikat-Scan' : '',
        },
      ]);
      setBookInput('');
      setTimeout(() => bookInputRef.current?.focus(), 50);
      if (already) setOk(`Hinweis: ${code} war schon in der Liste (Duplikat).`);
    } catch (e: any) {
      setMsg(e?.message ?? 'Fehler beim Laden der Buchdaten.');
    }
  }

  function removeLine(idx: number) {
    setLines((prev) => prev.filter((_, i) => i !== idx));
  }

  function updateLine(idx: number, patch: Partial<Line>) {
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  }

  const total = useMemo(() => {
    let sum = 0;
    for (const l of lines) {
      const price = l.meta?.price_eur ?? null;
      if (l.mode === 'full') sum += price ?? 0;
      else if (l.mode === 'damage5') sum += 5;
      else if (l.mode === 'damage10') sum += 10;
      else if (l.mode === 'custom') sum += parseNum(l.customAmount) ?? 0;
    }
    return sum;
  }, [lines]);

  function validate() {
    const sid = studentId.trim();
    if (!classId.trim()) throw new Error('Bitte Klasse wählen.');
    if (!sid) throw new Error('Bitte Schülercode eingeben.');
    if (lines.length === 0) throw new Error('Bitte mindestens einen Buchcode hinzufügen.');

    // Optional: prüfen, ob Schüler wirklich in dieser Klasse ist (nur Warnung)
    // Wir machen das nicht hart, damit du flexibel bleibst.
  }

  // Speichern in Supabase (pro Buch ein Issue-Event)
  async function saveAllIssues() {
    const sid = studentId.trim();

    for (const l of lines) {
      const code = l.book_code;
      const meta = l.meta;

      const amount =
        l.mode === 'full'
          ? meta?.price_eur ?? null
          : l.mode === 'damage5'
            ? 5
            : l.mode === 'damage10'
              ? 10
              : parseNum(l.customAmount);

      const issue_type = l.mode === 'full' ? 'lost' : 'damaged';
      const condition =
        l.mode === 'full'
          ? 'replace_full'
          : l.mode === 'damage5'
            ? 'damage_minor'
            : l.mode === 'damage10'
              ? 'damage_major'
              : 'damage_custom';

      // sb_report_issue(...) existiert bei dir (hatten wir in der Routine-Liste)
      const { error } = await supabase.rpc('sb_report_issue', {
        p_scan: code,
        p_student_id: sid,
        p_issue_type: issue_type,
        p_condition: condition,
        p_amount: amount,
        p_payment_mode: paymentMode === 'unknown' ? null : paymentMode,
        p_note: l.note ?? null,
      });

      if (error) throw error;
    }
  }

  async function openPrintPopup() {
    setMsg(null);
    setOk(null);
    try {
      validate();

      // optional speichern
      if (alsoSave) {
        await saveAllIssues();
        setOk('Gespeichert. Pop-up wird geöffnet…');
      } else {
        setOk('Pop-up wird geöffnet… (ohne Speichern)');
      }

      setShowPrint(true);
    } catch (e: any) {
      setMsg(e?.message ?? 'Unbekannter Fehler');
    }
  }

  function resetAll() {
    setStudentId('');
    setBookInput('');
    setLines([]);
    setMsg(null);
    setOk(null);
    setTimeout(() => bookInputRef.current?.focus(), 80);
  }

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
      <Topbar title="Admin · Verlust / Kaputt" />

      <div className="card">
        <div className="row">
          <div className="badge">Ersatz / Beschädigung</div>
          <div className="spacer" />
          <button className="btn secondary" onClick={() => (window.location.href = '/admin')}>
            ← Dashboard
          </button>
          <button className="btn secondary" onClick={resetAll}>
            Neu
          </button>
        </div>

        <div style={{ height: 12 }} />

        {/* Klasse + Schüler */}
        <div className="row" style={{ flexWrap: 'wrap', gap: 10 }}>
          <select className="select" value={classId} onChange={(e) => setClassId(e.target.value)} style={{ maxWidth: 160 }}>
            {classes.length === 0 ? <option value={classId}>{classId}</option> : null}
            {classes.map((c) => (
              <option key={c.class_id} value={c.class_id}>
                {c.class_id}
              </option>
            ))}
          </select>

          <input
            className="input"
            value={studentId}
            onChange={(e) => setStudentId(e.target.value)}
            placeholder="Schülercode (z.B. S0001)"
            style={{ maxWidth: 220 }}
          />

          <label className="badge" style={{ cursor: 'pointer' }}>
            <input type="checkbox" checked={alsoSave} onChange={(e) => setAlsoSave(e.target.checked)} style={{ marginRight: 8 }} />
            Auch in Supabase speichern
          </label>

          <select className="select" value={paymentMode} onChange={(e) => setPaymentMode(e.target.value as any)} style={{ maxWidth: 220 }}>
            <option value="unknown">Zahlung: (egal)</option>
            <option value="cash">Zahlung: Bar</option>
            <option value="transfer">Zahlung: Überweisung</option>
          </select>

          <div className="spacer" />
          <button className="btn ok" onClick={openPrintPopup}>
            Pop-up / Drucken
          </button>
        </div>

        <div style={{ height: 10 }} />

        {/* Buchscan */}
        <div className="row" style={{ flexWrap: 'wrap', gap: 10 }}>
          <input
            ref={bookInputRef}
            className="input"
            value={bookInput}
            onChange={(e) => setBookInput(e.target.value)}
            placeholder="Buchcode scannen/eingeben (Enter)"
            onKeyDown={(e) => {
              if (e.key === 'Enter') addBookCode(bookInput);
            }}
            style={{ maxWidth: 320 }}
          />
          <button className="btn" onClick={() => addBookCode(bookInput)}>
            + Hinzufügen
          </button>

          <div className="small" style={{ opacity: 0.85 }}>
            Tipp: Mehrere Codes Komma-getrennt einfügen (z.B. 9149,2014,2101) und Enter drücken
          </div>
        </div>

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

        {/* Liste */}
        <div className="row">
          <div className="badge">Bücher ({lines.length})</div>
          <div className="spacer" />
          <div className="badge">Gesamt: {euro(total)}</div>
        </div>

        <div style={{ height: 8 }} />

        {lines.length === 0 ? (
          <div className="small">Noch keine Bücher hinzugefügt.</div>
        ) : (
          <div className="small" style={{ lineHeight: 1.8 }}>
            {lines.map((l, idx) => (
              <div key={idx} style={{ borderTop: '1px solid rgba(255,255,255,0.10)', paddingTop: 10, marginTop: 10 }}>
                <div className="row" style={{ alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 260 }}>
                    <div>
                      <b>{l.meta?.title_name ?? '—'}</b> <span className="kbd">{l.meta?.subject ?? '-'}</span>
                    </div>
                    <div style={{ opacity: 0.85 }}>
                      Buchcode: <b>{l.book_code}</b> | ISBN: {l.meta?.isbn ?? '-'} | Preis: {euro(l.meta?.price_eur)}
                    </div>
                  </div>

                  <button className="btn secondary" onClick={() => removeLine(idx)}>
                    Entfernen
                  </button>
                </div>

                <div style={{ height: 8 }} />

                <div className="row" style={{ gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                  <label className="badge" style={{ cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name={`mode_${idx}`}
                      checked={l.mode === 'full'}
                      onChange={() => updateLine(idx, { mode: 'full' })}
                      style={{ marginRight: 8 }}
                    />
                    komplett ersetzen ({euro(l.meta?.price_eur)})
                  </label>

                  <label className="badge" style={{ cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name={`mode_${idx}`}
                      checked={l.mode === 'damage5'}
                      onChange={() => updateLine(idx, { mode: 'damage5' })}
                      style={{ marginRight: 8 }}
                    />
                    leichte Beschädigung (5 €)
                  </label>

                  <label className="badge" style={{ cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name={`mode_${idx}`}
                      checked={l.mode === 'damage10'}
                      onChange={() => updateLine(idx, { mode: 'damage10' })}
                      style={{ marginRight: 8 }}
                    />
                    stärkere Beschädigung (10 €)
                  </label>

                  <label className="badge" style={{ cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name={`mode_${idx}`}
                      checked={l.mode === 'custom'}
                      onChange={() => updateLine(idx, { mode: 'custom' })}
                      style={{ marginRight: 8 }}
                    />
                    anderer Betrag:
                  </label>

                  {l.mode === 'custom' ? (
                    <input
                      className="input"
                      value={l.customAmount}
                      onChange={(e) => updateLine(idx, { customAmount: e.target.value })}
                      placeholder="z.B. 12,50"
                      style={{ maxWidth: 120 }}
                    />
                  ) : null}

                  <input
                    className="input"
                    value={l.note ?? ''}
                    onChange={(e) => updateLine(idx, { note: e.target.value })}
                    placeholder="Notiz (optional)"
                    style={{ maxWidth: 420 }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Druck-Pop-up */}
      {showPrint && (
        <Modal title="Ersatz / Beschädigung – Druckansicht" onClose={() => setShowPrint(false)}>
          <div style={{ padding: 8 }}>
            {/* Druck-CSS direkt inline */}
            <style>{`
              @media print {
                .no-print { display: none !important; }
                body { background: white !important; }
              }
              .print-sheet {
                padding: 16px;
                background: white;
                color: black;
                border-radius: 8px;
              }
              .print-h1 { font-size: 18px; font-weight: 800; margin-bottom: 6px; }
              .print-small { font-size: 12px; opacity: 0.9; }
              .print-table { width: 100%; border-collapse: collapse; margin-top: 12px; }
              .print-table th, .print-table td { border: 1px solid #222; padding: 6px; font-size: 12px; vertical-align: top; }
            `}</style>

            <div className="print-sheet">
              <div className="print-h1">Schulbuchausleihe – Ersatz / Beschädigung</div>
              <div className="print-small">
                Klasse: <b>{classId}</b> &nbsp;|&nbsp; Schülercode: <b>{studentId.trim()}</b>
              </div>
              <div className="print-small">
                Datum: <b>{new Date().toLocaleDateString('de-DE')}</b> &nbsp;|&nbsp; Gesamt: <b>{euro(total)}</b>
              </div>

              <table className="print-table">
                <thead>
                  <tr>
                    <th>Buch</th>
                    <th>Fach</th>
                    <th>ISBN</th>
                    <th>Buchcode</th>
                    <th>Preis</th>
                    <th>Auswahl</th>
                    <th>Betrag</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l, i) => {
                    const amount =
                      l.mode === 'full'
                        ? l.meta?.price_eur ?? 0
                        : l.mode === 'damage5'
                          ? 5
                          : l.mode === 'damage10'
                            ? 10
                            : parseNum(l.customAmount) ?? 0;

                    const choice =
                      l.mode === 'full'
                        ? 'Ersatz (voll)'
                        : l.mode === 'damage5'
                          ? 'Beschädigt (5€)'
                          : l.mode === 'damage10'
                            ? 'Beschädigt (10€)'
                            : 'Beschädigt (frei)';

                    return (
                      <tr key={i}>
                        <td>{l.meta?.title_name ?? l.meta?.title_id ?? '-'}</td>
                        <td>{l.meta?.subject ?? '-'}</td>
                        <td>{l.meta?.isbn ?? '-'}</td>
                        <td>{l.book_code}</td>
                        <td>{euro(l.meta?.price_eur)}</td>
                        <td>{choice}</td>
                        <td>{euro(amount)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              <div style={{ marginTop: 14, fontSize: 12 }}>
                Unterschrift Erziehungsberechtigte/r: ________________________________
              </div>
            </div>

            <div className="no-print" style={{ display: 'flex', gap: 10, marginTop: 12, justifyContent: 'flex-end' }}>
              <button className="btn secondary" onClick={() => setShowPrint(false)}>
                Schließen
              </button>
              <button className="btn ok" onClick={() => window.print()}>
                Drucken
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
