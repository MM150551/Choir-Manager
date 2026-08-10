import React, { useState, useEffect, useMemo, useRef } from "react";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { Users, CalendarCheck, Wallet, Music2, CalendarDays, Plus, Trash2, Check, X, Upload, AlertTriangle, UserX, LogIn } from "lucide-react";

const CHOIR_NAME = "نبرة فرح جونيورز";
const VOICE_TYPES = ["سوبرانو", "ألتو", "تينور", "باص", "غير محدد"];
const STATUS_COLORS = { "تحت التدريب": "#B08D57", "جاهزة": "#3E6259", "للمراجعة": "#8A4B3B" };
const ATT_MIN_RATE = 70; // % - below this, can't perform in events
const MAX_UNEXCUSED = 3; // unexcused absences before removal flag

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

async function loadShared(key, fallback) {
  try {
    const r = await window.storage.get(key, true);
    return r ? JSON.parse(r.value) : fallback;
  } catch {
    return fallback;
  }
}
async function saveShared(key, value) {
  try { await window.storage.set(key, JSON.stringify(value), true); } catch (e) { console.error(e); }
}
async function loadPersonal(key, fallback) {
  try {
    const r = await window.storage.get(key, false);
    return r ? JSON.parse(r.value) : fallback;
  } catch { return fallback; }
}
async function savePersonal(key, value) {
  try { await window.storage.set(key, JSON.stringify(value), false); } catch (e) { console.error(e); }
}

export default function ChoirManager() {
  const [tab, setTab] = useState("members");
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState([]);
  const [sessions, setSessions] = useState([]); // {date, records: {memberId: 'present'|'excused'|'unexcused'}}
  const [transactions, setTransactions] = useState([]);
  const [repertoire, setRepertoire] = useState([]);
  const [events, setEvents] = useState([]); // {id, name, date, notes, lineup: [memberId]}
  const [userName, setUserName] = useState(null);
  const [nameInput, setNameInput] = useState("");

  useEffect(() => {
    (async () => {
      const [m, s, t, r, ev, me] = await Promise.all([
        loadShared("members", []),
        loadShared("sessions", []),
        loadShared("transactions", []),
        loadShared("repertoire", []),
        loadShared("events", []),
        loadPersonal("me", null),
      ]);
      setMembers(m); setSessions(s); setTransactions(t); setRepertoire(r); setEvents(ev);
      setUserName(me);
      setLoading(false);
    })();
  }, []);

  useEffect(() => { if (!loading) saveShared("members", members); }, [members]);
  useEffect(() => { if (!loading) saveShared("sessions", sessions); }, [sessions]);
  useEffect(() => { if (!loading) saveShared("transactions", transactions); }, [transactions]);
  useEffect(() => { if (!loading) saveShared("repertoire", repertoire); }, [repertoire]);
  useEffect(() => { if (!loading) saveShared("events", events); }, [events]);

  // attendance stats used across tabs
  const stats = useMemo(() => {
    const map = {};
    members.forEach((m) => {
      let present = 0, excused = 0, unexcused = 0, total = 0;
      sessions.forEach((s) => {
        const st = s.records?.[m.id];
        if (!st) return;
        total++;
        if (st === "present") present++;
        else if (st === "excused") excused++;
        else if (st === "unexcused") unexcused++;
      });
      const rate = total > 0 ? Math.round((present / total) * 100) : null;
      map[m.id] = {
        total, present, excused, unexcused, rate,
        blockedFromEvents: rate !== null && rate < ATT_MIN_RATE,
        flaggedForRemoval: unexcused >= MAX_UNEXCUSED,
      };
    });
    return map;
  }, [members, sessions]);

  if (loading) {
    return <div style={{ padding: 60, textAlign: "center", fontFamily: "'Cairo',sans-serif", color: "#8a8578" }}>جارِ التحميل…</div>;
  }

  if (!userName) {
    return <NameGate onSubmit={async (n) => { await savePersonal("me", n); setUserName(n); }} />;
  }

  const tabs = [
    { id: "members", label: "الأعضاء", icon: Users },
    { id: "attendance", label: "الحضور", icon: CalendarCheck },
    { id: "events", label: "الإيفنتات", icon: CalendarDays },
    { id: "finance", label: "المالية", icon: Wallet },
    { id: "repertoire", label: "الفنيات", icon: Music2 },
  ];

  const alerts = members.filter((m) => stats[m.id]?.flaggedForRemoval || stats[m.id]?.blockedFromEvents);

  return (
    <div dir="rtl" style={{ fontFamily: "'Cairo','Tajawal',sans-serif", minHeight: "100vh", background: "#F7F5F0", color: "#22201C" }}>
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;900&family=Tajawal:wght@400;500;700&display=swap" />

      <header style={{ background: "#1E2A32", color: "#F2EBDD", padding: "24px 20px 20px", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "relative", zIndex: 2, maxWidth: 760, margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ fontSize: 12, letterSpacing: 2, color: "#C9A25E", fontWeight: 700, marginBottom: 4 }}>إدارة الكورال</div>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 900 }}>{CHOIR_NAME}</h1>
          </div>
          <div style={{ fontSize: 12, background: "rgba(255,255,255,0.1)", padding: "6px 12px", borderRadius: 20, fontWeight: 600, whiteSpace: "nowrap" }}>
            👋 {userName}
          </div>
        </div>
        <div style={{ position: "absolute", inset: 0, opacity: 0.18 }}>
          {[0, 1, 2, 3, 4].map((i) => <div key={i} style={{ position: "absolute", top: `${18 + i * 13}px`, left: 0, right: 0, height: 1, background: "#C9A25E" }} />)}
        </div>
      </header>

      {alerts.length > 0 && (
        <div style={{ maxWidth: 760, margin: "12px auto 0", padding: "0 16px" }}>
          <div style={{ background: "#FBEFE7", border: "1px solid #E3B88F", borderRadius: 12, padding: "10px 14px", fontSize: 12.5, color: "#8A4B3B", display: "flex", gap: 8, alignItems: "flex-start" }}>
            <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>فيه {alerts.length} طفل محتاج انتباه (نسبة حضور واطية أو غياب بدون إذن متكرر) — تفاصيل في تبويب "الحضور".</span>
          </div>
        </div>
      )}

      <nav style={{ display: "flex", background: "#1E2A32", borderTop: "1px solid rgba(255,255,255,0.08)", position: "sticky", top: 0, zIndex: 10, overflowX: "auto" }}>
        {tabs.map((t) => {
          const Icon = t.icon; const active = tab === t.id;
          return (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              flex: "1 0 auto", minWidth: 68, display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
              padding: "10px 4px 12px", background: active ? "#F7F5F0" : "transparent", color: active ? "#1E2A32" : "#C7CDCF",
              border: "none", borderRadius: active ? "14px 14px 0 0" : 0, fontFamily: "inherit", fontWeight: active ? 700 : 500,
              fontSize: 12, cursor: "pointer",
            }}>
              <Icon size={16} strokeWidth={active ? 2.4 : 2} />{t.label}
            </button>
          );
        })}
      </nav>

      <main style={{ maxWidth: 760, margin: "0 auto", padding: "18px 16px 60px" }}>
        {tab === "members" && <MembersTab members={members} setMembers={setMembers} stats={stats} />}
        {tab === "attendance" && <AttendanceTab members={members} sessions={sessions} setSessions={setSessions} stats={stats} />}
        {tab === "events" && <EventsTab members={members} events={events} setEvents={setEvents} stats={stats} />}
        {tab === "finance" && <FinanceTab members={members} transactions={transactions} setTransactions={setTransactions} />}
        {tab === "repertoire" && <RepertoireTab repertoire={repertoire} setRepertoire={setRepertoire} />}
      </main>
    </div>
  );
}

/* ---------- Name gate (lightweight identification, not real login) ---------- */
function NameGate({ onSubmit }) {
  const [name, setName] = useState("");
  return (
    <div dir="rtl" style={{ fontFamily: "'Cairo',sans-serif", minHeight: "100vh", background: "#1E2A32", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;900&display=swap" />
      <div style={{ background: "#F7F5F0", borderRadius: 16, padding: 28, maxWidth: 360, width: "100%", textAlign: "center" }}>
        <div style={{ fontSize: 13, color: "#C9A25E", fontWeight: 700, letterSpacing: 1 }}>{CHOIR_NAME}</div>
        <h2 style={{ margin: "8px 0 4px", fontSize: 20 }}>مين بيستخدم البرنامج؟</h2>
        <p style={{ fontSize: 12.5, color: "#8a8578", marginBottom: 16 }}>اكتب اسمك عشان يتسجل باسمك أي تعديل بتعمله. البيانات مشتركة بين كل المستخدمين.</p>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="اكتب اسمك"
          style={{ width: "100%", boxSizing: "border-box", padding: "10px 12px", border: "1px solid #DCD6C6", borderRadius: 9, fontFamily: "inherit", fontSize: 14, marginBottom: 12 }} />
        <button onClick={() => name.trim() && onSubmit(name.trim())} disabled={!name.trim()} style={{
          width: "100%", background: name.trim() ? "#1E2A32" : "#c9c3b2", color: "#F2EBDD", border: "none", borderRadius: 9,
          padding: "11px 16px", fontFamily: "inherit", fontWeight: 700, fontSize: 14, cursor: name.trim() ? "pointer" : "not-allowed",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
        }}><LogIn size={15} /> دخول</button>
      </div>
    </div>
  );
}

/* ---------- Shared UI ---------- */
function Card({ children, style }) {
  return <div style={{ background: "#FFFFFF", border: "1px solid #E7E2D6", borderRadius: 14, padding: 16, marginBottom: 12, ...style }}>{children}</div>;
}
function Field({ label, children }) {
  return <div style={{ marginBottom: 10 }}><label style={{ display: "block", fontSize: 12.5, color: "#6b675c", marginBottom: 4, fontWeight: 600 }}>{label}</label>{children}</div>;
}
const inputStyle = { width: "100%", boxSizing: "border-box", padding: "9px 12px", border: "1px solid #DCD6C6", borderRadius: 9, fontFamily: "inherit", fontSize: 14, background: "#FCFBF8", outline: "none" };
function PrimaryBtn({ children, onClick, style, disabled }) {
  return <button onClick={onClick} disabled={disabled} style={{ background: disabled ? "#c9c3b2" : "#1E2A32", color: "#F2EBDD", border: "none", borderRadius: 9, padding: "10px 16px", fontFamily: "inherit", fontWeight: 700, fontSize: 13.5, cursor: disabled ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, ...style }}>{children}</button>;
}
function GhostBtn({ children, onClick, style }) {
  return <button onClick={onClick} style={{ background: "#fff", color: "#1E2A32", border: "1px solid #DCD6C6", borderRadius: 9, padding: "9px 14px", fontFamily: "inherit", fontWeight: 700, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, ...style }}>{children}</button>;
}
function IconBtn({ onClick, children, color = "#8A4B3B" }) {
  return <button onClick={onClick} style={{ background: "transparent", border: "none", color, cursor: "pointer", padding: 6, display: "flex", alignItems: "center" }}>{children}</button>;
}
function Badge({ text, color }) {
  return <span style={{ fontSize: 11, fontWeight: 700, color, background: `${color}1c`, padding: "3px 9px", borderRadius: 20 }}>{text}</span>;
}

/* ---------- Members Tab ---------- */
function MembersTab({ members, setMembers, stats }) {
  const [form, setForm] = useState({ name: "", age: "", voice: VOICE_TYPES[4], phone: "" });
  const fileRef = useRef(null);

  function addMember() {
    if (!form.name.trim()) return;
    setMembers([...members, { id: uid(), status: "active", ...form }]);
    setForm({ name: "", age: "", voice: VOICE_TYPES[4], phone: "" });
  }
  function removeMember(id) { setMembers(members.filter((m) => m.id !== id)); }
  function toggleActive(id) {
    setMembers(members.map((m) => m.id === id ? { ...m, status: m.status === "removed" ? "active" : "removed" } : m));
  }

  function rowsToMembers(dataRows) {
    return dataRows.map((row) => {
      const get = (keys) => { for (const k of keys) { if (row[k] !== undefined && row[k] !== null) return row[k]; } return ""; };
      return {
        id: uid(),
        status: "active",
        name: get(["الاسم", "اسم", "name", "Name"]).toString().trim(),
        age: get(["السن", "العمر", "age", "Age"]).toString().trim(),
        voice: get(["الصوت", "نوع الصوت", "voice", "Voice"]).toString().trim() || VOICE_TYPES[4],
        phone: get(["الهاتف", "رقم التواصل", "phone", "Phone"]).toString().trim(),
      };
    }).filter((r) => r.name);
  }

  function handleCSV(e) {
    const file = e.target.files[0];
    if (!file) return;
    const ext = file.name.split(".").pop().toLowerCase();

    
    if (ext === "csv") {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (res) => {
          const rows = rowsToMembers(res.data);
          if (rows.length) setMembers([...members, ...rows]);
          if (fileRef.current) fileRef.current.value = "";
        },
      });
    } else if (ext === "xlsx" || ext === "xls") {
      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const wb = XLSX.read(evt.target.result, { type: "array" });
          const sheet = wb.Sheets[wb.SheetNames[0]];
          const data = XLSX.utils.sheet_to_json(sheet, { defval: "" });
          const rows = rowsToMembers(data);
          if (rows.length) setMembers([...members, ...rows]);
        } catch (err) {
          console.error("xlsx parse error", err);
        }
        if (fileRef.current) fileRef.current.value = "";
      };
      reader.readAsArrayBuffer(file);
    } else {
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const active = members.filter((m) => m.status !== "removed");
  const removed = members.filter((m) => m.status === "removed");

  return (
    <div>
      <Card>
        <div style={{ fontWeight: 700, marginBottom: 6, fontSize: 15 }}>رفع شيت أعضاء (Excel أو CSV)</div>
        <p style={{ fontSize: 12, color: "#8a8578", margin: "0 0 10px" }}>الأعمدة المتوقعة: الاسم، السن، نوع الصوت، رقم التواصل (أو بالإنجليزي name/age/voice/phone). بيقبل ملفات xlsx أو xls أو csv.</p>
        <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" onChange={handleCSV} style={{ display: "none" }} id="sheet-upload" />
        <GhostBtn onClick={() => fileRef.current?.click()}><Upload size={15} /> رفع ملف Excel / CSV</GhostBtn>
      </Card>

      <Card>
        <div style={{ fontWeight: 700, marginBottom: 10, fontSize: 15 }}>إضافة عضو يدويًا</div>
        <Field label="الاسم"><input style={inputStyle} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="اسم الطفل" /></Field>
        <div style={{ display: "flex", gap: 10 }}>
          <div style={{ flex: 1 }}><Field label="السن"><input style={inputStyle} type="number" value={form.age} onChange={(e) => setForm({ ...form, age: e.target.value })} placeholder="مثال: 9" /></Field></div>
          <div style={{ flex: 1 }}><Field label="نوع الصوت"><select style={inputStyle} value={form.voice} onChange={(e) => setForm({ ...form, voice: e.target.value })}>{VOICE_TYPES.map((v) => <option key={v} value={v}>{v}</option>)}</select></Field></div>
        </div>
        <Field label="رقم تواصل ولي الأمر"><input style={inputStyle} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="01xxxxxxxxx" /></Field>
        <PrimaryBtn onClick={addMember} disabled={!form.name.trim()}><Plus size={15} /> إضافة عضو</PrimaryBtn>
      </Card>

      <div style={{ fontSize: 13, color: "#6b675c", marginBottom: 8, fontWeight: 600 }}>الأعضاء النشطين ({active.length})</div>
      {active.length === 0 && <div style={{ color: "#a39d8c", fontSize: 13.5, padding: "12px 4px" }}>لسه مفيش أعضاء متسجلين.</div>}
      {active.map((m) => {
        const s = stats[m.id];
        return (
          <Card key={m.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px" }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14.5, display: "flex", alignItems: "center", gap: 8 }}>
                {m.name}
                {s?.flaggedForRemoval && <Badge text="غياب متكرر" color="#8A4B3B" />}
                {s?.blockedFromEvents && <Badge text="ممنوع من الإيفنتات" color="#B08D57" />}
              </div>
              <div style={{ fontSize: 12.5, color: "#8a8578", marginTop: 2 }}>
                {m.age ? `${m.age} سنة` : ""} {m.voice ? `· ${m.voice}` : ""} {m.phone ? `· ${m.phone}` : ""}
                {s?.rate !== null && s?.rate !== undefined ? ` · حضور ${s.rate}%` : ""}
              </div>
            </div>
            <div style={{ display: "flex", gap: 2 }}>
              <IconBtn onClick={() => toggleActive(m.id)} color="#B08D57"><UserX size={16} /></IconBtn>
              <IconBtn onClick={() => removeMember(m.id)}><Trash2 size={16} /></IconBtn>
            </div>
          </Card>
        );
      })}

      {removed.length > 0 && (
        <>
          <div style={{ fontSize: 13, color: "#6b675c", margin: "16px 0 8px", fontWeight: 600 }}>مستبعدين من الكورال ({removed.length})</div>
          {removed.map((m) => (
            <Card key={m.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", opacity: 0.6 }}>
              <div style={{ fontWeight: 700, fontSize: 14 }}>{m.name}</div>
              <GhostBtn onClick={() => toggleActive(m.id)} style={{ padding: "5px 10px", fontSize: 12 }}>رجّعه</GhostBtn>
            </Card>
          ))}
        </>
      )}
    </div>
  );
}

/* ---------- Attendance Tab ---------- */
function AttendanceTab({ members, sessions, setSessions, stats }) {
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const active = members.filter((m) => m.status !== "removed");
  const existing = sessions.find((s) => s.date === date);
  const records = existing ? existing.records : {};

  function setStatus(id, status) {
    const current = records[id];
    const next = current === status ? undefined : status; // click again to clear
    const newRecords = { ...records };
    if (next) newRecords[id] = next; else delete newRecords[id];
    const list = sessions.filter((s) => s.date !== date);
    list.push({ date, records: newRecords });
    setSessions(list);
  }

  const sorted = [...active].sort((a, b) => (stats[a.id]?.rate ?? 100) - (stats[b.id]?.rate ?? 100));

  return (
    <div>
      <Card>
        <Field label="تاريخ البروفة"><input type="date" style={inputStyle} value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        <div style={{ fontSize: 12.5, color: "#6b675c", fontWeight: 600, margin: "10px 0 6px" }}>سجل الحضور</div>
        {active.length === 0 && <div style={{ color: "#a39d8c", fontSize: 13.5 }}>ضيف أعضاء الأول من تبويب "الأعضاء".</div>}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {active.map((m) => {
            const st = records[m.id];
            return (
              <div key={m.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", borderRadius: 9, border: "1px solid #E7E2D6" }}>
                <span style={{ fontWeight: 600, fontSize: 13.5 }}>{m.name}</span>
                <div style={{ display: "flex", gap: 4 }}>
                  <button onClick={() => setStatus(m.id, "present")} style={{ fontSize: 11, fontWeight: 700, padding: "5px 9px", borderRadius: 7, border: "1px solid #3E6259", background: st === "present" ? "#3E6259" : "#fff", color: st === "present" ? "#fff" : "#3E6259", cursor: "pointer" }}>حاضر</button>
                  <button onClick={() => setStatus(m.id, "excused")} style={{ fontSize: 11, fontWeight: 700, padding: "5px 9px", borderRadius: 7, border: "1px solid #B08D57", background: st === "excused" ? "#B08D57" : "#fff", color: st === "excused" ? "#fff" : "#B08D57", cursor: "pointer" }}>غياب بإذن</button>
                  <button onClick={() => setStatus(m.id, "unexcused")} style={{ fontSize: 11, fontWeight: 700, padding: "5px 9px", borderRadius: 7, border: "1px solid #8A4B3B", background: st === "unexcused" ? "#8A4B3B" : "#fff", color: st === "unexcused" ? "#fff" : "#8A4B3B", cursor: "pointer" }}>غياب بدون إذن</button>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <Card>
        <div style={{ fontWeight: 700, marginBottom: 4, fontSize: 15 }}>نسب الحضور والقواعد</div>
        <p style={{ fontSize: 11.5, color: "#8a8578", margin: "0 0 12px" }}>أقل من {ATT_MIN_RATE}% حضور = ممنوع من الإيفنتات. {MAX_UNEXCUSED} غيابات بدون إذن أو أكتر = يُستبعد من الكورال.</p>
        {sorted.map((m) => {
          const s = stats[m.id] || {};
          return (
            <div key={m.id} style={{ marginBottom: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 3 }}>
                <span style={{ fontWeight: 600 }}>{m.name}</span>
                <span style={{ color: "#8a8578" }}>{s.rate === null || s.rate === undefined ? "—" : `${s.rate}%`} · غياب بدون إذن: {s.unexcused || 0}</span>
              </div>
              <div style={{ background: "#EFEBDF", borderRadius: 6, height: 8, overflow: "hidden" }}>
                <div style={{ width: `${s.rate ?? 0}%`, height: "100%", background: s.rate === null ? "#DCD6C6" : s.rate < ATT_MIN_RATE ? "#8A4B3B" : s.rate < 85 ? "#B08D57" : "#3E6259" }} />
              </div>
              {(s.blockedFromEvents || s.flaggedForRemoval) && (
                <div style={{ marginTop: 4, display: "flex", gap: 6 }}>
                  {s.blockedFromEvents && <Badge text="ممنوع من الإيفنتات" color="#B08D57" />}
                  {s.flaggedForRemoval && <Badge text="يستوفي شرط الاستبعاد" color="#8A4B3B" />}
                </div>
              )}
            </div>
          );
        })}
      </Card>
    </div>
  );
}

/* ---------- Events Tab ---------- */
function EventsTab({ members, events, setEvents, stats }) {
  const [form, setForm] = useState({ name: "", date: "", notes: "" });
  const active = members.filter((m) => m.status !== "removed");

  function addEvent() {
    if (!form.name.trim() || !form.date) return;
    setEvents([{ id: uid(), ...form, lineup: [] }, ...events]);
    setForm({ name: "", date: "", notes: "" });
  }
  function removeEvent(id) { setEvents(events.filter((e) => e.id !== id)); }
  function toggleLineup(eventId, memberId) {
    setEvents(events.map((e) => e.id === eventId ? { ...e, lineup: e.lineup.includes(memberId) ? e.lineup.filter((x) => x !== memberId) : [...e.lineup, memberId] } : e));
  }

  return (
    <div>
      <Card>
        <div style={{ fontWeight: 700, marginBottom: 10, fontSize: 15 }}>إضافة إيفنت جديد</div>
        <Field label="اسم الإيفنت"><input style={inputStyle} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="حفل ختام السنة..." /></Field>
        <Field label="التاريخ"><input type="date" style={inputStyle} value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></Field>
        <Field label="ملاحظات"><input style={inputStyle} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="اختياري" /></Field>
        <PrimaryBtn onClick={addEvent} disabled={!form.name.trim() || !form.date}><Plus size={15} /> إضافة إيفنت</PrimaryBtn>
      </Card>

      {events.length === 0 && <div style={{ color: "#a39d8c", fontSize: 13.5 }}>لسه مفيش إيفنتات مضافة.</div>}
      {events.map((ev) => (
        <Card key={ev.id}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{ev.name}</div>
              <div style={{ fontSize: 12, color: "#8a8578", marginTop: 2 }}>{ev.date} {ev.notes ? `· ${ev.notes}` : ""}</div>
            </div>
            <IconBtn onClick={() => removeEvent(ev.id)}><Trash2 size={16} /></IconBtn>
          </div>
          <div style={{ fontSize: 12, color: "#6b675c", fontWeight: 600, margin: "12px 0 6px" }}>
            الدور ({ev.lineup.length}) — الأطفال اللي نسبة حضورهم أقل من {ATT_MIN_RATE}% متعلّم عليهم تلقائي
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            {active.map((m) => {
              const blocked = stats[m.id]?.blockedFromEvents;
              const inLineup = ev.lineup.includes(m.id);
              return (
                <button key={m.id} onClick={() => !blocked && toggleLineup(ev.id, m.id)} disabled={blocked} style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", borderRadius: 8,
                  border: `1px solid ${blocked ? "#E3B88F" : inLineup ? "#3E6259" : "#E7E2D6"}`,
                  background: blocked ? "#FBEFE7" : inLineup ? "#EAF1EE" : "#FCFBF8",
                  fontFamily: "inherit", fontSize: 13, cursor: blocked ? "not-allowed" : "pointer", opacity: blocked ? 0.75 : 1,
                }}>
                  <span style={{ fontWeight: 600 }}>{m.name}</span>
                  {blocked ? <span style={{ fontSize: 11, color: "#B08D57", fontWeight: 700 }}>نسبة حضور أقل من {ATT_MIN_RATE}%</span> : (inLineup ? <Check size={16} color="#3E6259" /> : <X size={14} color="#c9c3b2" />)}
                </button>
              );
            })}
          </div>
        </Card>
      ))}
    </div>
  );
}

/* ---------- Finance Tab ---------- */
function FinanceTab({ members, transactions, setTransactions }) {
  const [form, setForm] = useState({ type: "income", amount: "", desc: "", memberId: "" });
  function addTx() {
    if (!form.amount || isNaN(Number(form.amount))) return;
    setTransactions([{ id: uid(), date: new Date().toISOString().slice(0, 10), ...form, amount: Number(form.amount) }, ...transactions]);
    setForm({ type: "income", amount: "", desc: "", memberId: "" });
  }
  function removeTx(id) { setTransactions(transactions.filter((t) => t.id !== id)); }
  const totals = useMemo(() => {
    const income = transactions.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
    const expense = transactions.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
    return { income, expense, balance: income - expense };
  }, [transactions]);
  const active = members.filter((m) => m.status !== "removed");

  return (
    <div>
      <Card style={{ display: "flex", gap: 10 }}>
        <div style={{ flex: 1, textAlign: "center" }}><div style={{ fontSize: 11.5, color: "#8a8578" }}>الإيرادات</div><div style={{ fontSize: 17, fontWeight: 800, color: "#3E6259" }}>{totals.income}</div></div>
        <div style={{ flex: 1, textAlign: "center" }}><div style={{ fontSize: 11.5, color: "#8a8578" }}>المصروفات</div><div style={{ fontSize: 17, fontWeight: 800, color: "#8A4B3B" }}>{totals.expense}</div></div>
        <div style={{ flex: 1, textAlign: "center" }}><div style={{ fontSize: 11.5, color: "#8a8578" }}>الرصيد</div><div style={{ fontSize: 17, fontWeight: 800, color: "#1E2A32" }}>{totals.balance}</div></div>
      </Card>
      <Card>
        <div style={{ fontWeight: 700, marginBottom: 10, fontSize: 15 }}>تسجيل حركة مالية</div>
        <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
          {[{ v: "income", l: "إيراد (اشتراك)" }, { v: "expense", l: "مصروف" }].map((o) => (
            <button key={o.v} onClick={() => setForm({ ...form, type: o.v })} style={{ flex: 1, padding: "8px 6px", borderRadius: 9, fontFamily: "inherit", fontSize: 13, fontWeight: 700, cursor: "pointer", border: `1px solid ${form.type === o.v ? "#1E2A32" : "#E7E2D6"}`, background: form.type === o.v ? "#1E2A32" : "#fff", color: form.type === o.v ? "#F2EBDD" : "#22201C" }}>{o.l}</button>
          ))}
        </div>
        <Field label="المبلغ"><input style={inputStyle} type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="0" /></Field>
        {form.type === "income" && <Field label="مرتبط بعضو (اختياري)"><select style={inputStyle} value={form.memberId} onChange={(e) => setForm({ ...form, memberId: e.target.value })}><option value="">— بدون —</option>{active.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select></Field>}
        <Field label="وصف"><input style={inputStyle} value={form.desc} onChange={(e) => setForm({ ...form, desc: e.target.value })} placeholder="اشتراك شهر أغسطس / إيجار قاعة..." /></Field>
        <PrimaryBtn onClick={addTx} disabled={!form.amount}><Plus size={15} /> إضافة الحركة</PrimaryBtn>
      </Card>
      <div style={{ fontSize: 13, color: "#6b675c", marginBottom: 8, fontWeight: 600 }}>آخر الحركات</div>
      {transactions.length === 0 && <div style={{ color: "#a39d8c", fontSize: 13.5 }}>لسه مفيش حركات مسجلة.</div>}
      {transactions.map((t) => {
        const memberName = members.find((m) => m.id === t.memberId)?.name;
        return (
          <Card key={t.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px" }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14, color: t.type === "income" ? "#3E6259" : "#8A4B3B" }}>{t.type === "income" ? "+" : "-"}{t.amount} {t.desc ? `— ${t.desc}` : ""}</div>
              <div style={{ fontSize: 12, color: "#8a8578", marginTop: 2 }}>{t.date} {memberName ? `· ${memberName}` : ""}</div>
            </div>
            <IconBtn onClick={() => removeTx(t.id)}><Trash2 size={16} /></IconBtn>
          </Card>
        );
      })}
    </div>
  );
}

/* ---------- Repertoire Tab ---------- */
function RepertoireTab({ repertoire, setRepertoire }) {
  const [form, setForm] = useState({ title: "", status: "تحت التدريب", notes: "" });
  function addPiece() { if (!form.title.trim()) return; setRepertoire([...repertoire, { id: uid(), ...form }]); setForm({ title: "", status: "تحت التدريب", notes: "" }); }
  function removePiece(id) { setRepertoire(repertoire.filter((p) => p.id !== id)); }
  function cycleStatus(id) {
    const order = ["تحت التدريب", "للمراجعة", "جاهزة"];
    setRepertoire(repertoire.map((p) => p.id === id ? { ...p, status: order[(order.indexOf(p.status) + 1) % order.length] } : p));
  }
  return (
    <div>
      <Card>
        <div style={{ fontWeight: 700, marginBottom: 10, fontSize: 15 }}>إضافة عمل جديد للريبرتوار</div>
        <Field label="اسم القطعة / الترنيمة"><input style={inputStyle} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="اسم العمل" /></Field>
        <Field label="الحالة"><select style={inputStyle} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>{Object.keys(STATUS_COLORS).map((s) => <option key={s} value={s}>{s}</option>)}</select></Field>
        <Field label="ملاحظات فنية (توزيع، مقام، صعوبات...)"><input style={inputStyle} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="اختياري" /></Field>
        <PrimaryBtn onClick={addPiece} disabled={!form.title.trim()}><Plus size={15} /> إضافة</PrimaryBtn>
      </Card>
      <div style={{ fontSize: 13, color: "#6b675c", marginBottom: 8, fontWeight: 600 }}>الريبرتوار ({repertoire.length}) — اضغط على الحالة لتغييرها</div>
      {repertoire.length === 0 && <div style={{ color: "#a39d8c", fontSize: 13.5 }}>لسه مفيش أعمال مضافة.</div>}
      {repertoire.map((p) => (
        <Card key={p.id} style={{ padding: "12px 16px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ fontWeight: 700, fontSize: 14.5 }}>{p.title}</div>
            <IconBtn onClick={() => removePiece(p.id)}><Trash2 size={16} /></IconBtn>
          </div>
          {p.notes && <div style={{ fontSize: 12.5, color: "#8a8578", marginTop: 4 }}>{p.notes}</div>}
          <button onClick={() => cycleStatus(p.id)} style={{ marginTop: 8, border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 700, padding: "5px 12px", borderRadius: 20, background: `${STATUS_COLORS[p.status]}22`, color: STATUS_COLORS[p.status] }}>● {p.status}</button>
        </Card>
      ))}
    </div>
  );
}
