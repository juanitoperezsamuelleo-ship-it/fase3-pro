import React, { useMemo, useRef, useState } from "react";
import { LEVELS, fmtDate, localISO, worstOf } from "../lib/calc.js";
import { readPowerFiles, evaluatePQ, classifyEvent } from "../lib/fluke.js";
import { compressImage } from "../lib/image.js";
import { analyzeFluke, hasGemini } from "../lib/ai.js";
import { Icon, Header, Pill, Sheet, useToast, Empty } from "../ui.jsx";

const FIELDS = [
  { k: "v1", tag: "V12", unit: "V" }, { k: "v2", tag: "V23", unit: "V" }, { k: "v3", tag: "V31", unit: "V" },
  { k: "i1", tag: "I1", unit: "A" }, { k: "i2", tag: "I2", unit: "A" }, { k: "i3", tag: "I3", unit: "A" },
  { k: "hz", tag: "Hz", unit: "Hz" }, { k: "thdv", tag: "THD-V", unit: "%" }, { k: "thdi", tag: "THD-I", unit: "%" }, { k: "pf", tag: "FP", unit: "" }
];
const clean = (s) => String(s || "").replace(",", ".").replace(/[^0-9.\-]/g, "");

function Shot({ s, onOpen, onRemove }) {
  return (
    <div className="fade" style={{ position: "relative", borderRadius: 14, overflow: "hidden", background: "#000", aspectRatio: "4 / 3" }}>
      <button onClick={onOpen} style={{ border: 0, padding: 0, width: "100%", height: "100%", background: "none" }} aria-label={"Ver " + (s.screen || s.name)}>
        <img src={s.dataUrl} alt={s.screen || s.name} style={{ width: "100%", height: "100%", objectFit: "contain", imageRendering: "pixelated", display: "block" }} />
      </button>
      {s.date && <span className="mono" style={{ position: "absolute", left: 6, bottom: 6, fontSize: 10, background: "rgba(0,0,0,.7)", color: "#fff", padding: "2px 6px", borderRadius: 6 }}>{fmtDate(s.date)}</span>}
      {onRemove && <button className="x" onClick={onRemove} aria-label="Quitar" style={{ position: "absolute", top: 6, right: 6, width: 24, height: 24, borderRadius: 12, border: 0, background: "rgba(0,0,0,.7)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}><Icon n="close" size={13} /></button>}
    </div>
  );
}

export default function PowerQuality({ ctx }) {
  const { items, data, store, session, go, route, th } = ctx;
  const toast = useToast();
  const fileRef = useRef();
  const [shots, setShots] = useState([]);
  const [recs, setRecs] = useState([]);
  const [eqId, setEqId] = useState(route.eqId || "");
  const [vals, setVals] = useState({});
  const [nomV, setNomV] = useState("480");
  const [notes, setNotes] = useState("");
  const [ai, setAi] = useState("");
  const [busy, setBusy] = useState("");
  const [big, setBig] = useState(null);
  const [view, setView] = useState(route.pqId || null);

  const eqList = useMemo(() => items.slice().sort((a, b) => a.eq.name.localeCompare(b.eq.name, "es", { numeric: true })), [items]);
  const it = items.find((i) => i.eq.id === eqId);
  const rows = evaluatePQ(vals, parseFloat(nomV) || 480, 60);
  const worst = rows.length ? worstOf(rows.map((r) => r.level)) : null;
  const saved = (data.pq || []).slice().sort((a, b) => String(b.date).localeCompare(String(a.date)));
  const rec = view && saved.find((r) => r.id === view);
  const eqName = (id) => (items.find((i) => i.eq.id === id) || { eq: { name: "Sin equipo" } }).eq.name;

  const load = async (files) => {
    setBusy("Leyendo archivos…");
    const { shots: s, errors, recordings } = await readPowerFiles(files, (f) => compressImage(f, 1000, 160 * 1024));
    setShots((x) => [...x, ...s]);
    if (recordings.length) {
      setRecs((x) => [...x, ...recordings]);
      const r = recordings.find((x) => x.V[0].rms > 50);
      if (r) {
        const f2 = (x) => (x == null ? "" : String(Math.round(x * 100) / 100));
        setVals((v) => ({ ...v, v1: f2(r.V[0].rms), v2: f2(r.V[1].rms), v3: f2(r.V[2].rms), i1: f2(r.I[0].rms), i2: f2(r.I[1].rms), i3: f2(r.I[2].rms), hz: r.hz ? r.hz.toFixed(3) : v.hz }));
      }
    }
    if (errors.length) toast(errors[0], "bad");
    else if (s.length || recordings.length) toast([recordings.length && `${recordings.length} ${recordings.length === 1 ? "grabación" : "grabaciones"}`, s.length && `${s.length} ${s.length === 1 ? "pantalla" : "pantallas"}`].filter(Boolean).join(" y ") + " leídas");
    else toast("No había datos del Fluke en esos archivos", "warn");
    setBusy("");
    if (fileRef.current) fileRef.current.value = "";
  };

  const runAI = async () => {
    setBusy("La IA está leyendo las pantallas…");
    try { setAi(await analyzeFluke(shots.map((s) => s.dataUrl), it, vals, th)); } catch (e) { toast(e.message, "bad"); }
    setBusy("");
  };

  const save = async () => {
    if (!shots.length && !rows.length && !recs.length) return toast("Carga archivos o anota valores", "warn");
    const images = shots.map((s) => ({ src: s.dataUrl, date: s.date || "", screen: s.screen || s.name || "" }));
    const size = images.reduce((a, b) => a + b.src.length, 0);
    if (size > 900000) return toast("Demasiadas pantallas para un registro; guarda máximo 8", "warn");
    setBusy("Guardando…");
    try {
      const first = shots.find((s) => s.serial) || {};
      const id = await store.add("pq", {
        equipmentId: eqId || "",
        date: (recs[0] && recs[0].start.slice(0, 16)) || (shots.find((s) => s.date) || {}).date?.slice(0, 16) || localISO(),
        images, values: vals, recordings: recs.map((r) => ({ ...r, events: r.events.map((e) => ({ date: e.date, min: e.min, max: e.max })) })), nominalV: parseFloat(nomV) || 480, notes: notes.trim(), ai: ai || "",
        instrument: [first.model, first.serial && "S/N " + first.serial, first.firmware].filter(Boolean).join(" · "),
        userName: session.name || session.email
      });
      toast("Registro guardado");
      setShots([]); setRecs([]); setVals({}); setNotes(""); setAi(""); setView(id);
    } catch (e) {
      toast(/permission|insufficient/i.test(e.message) ? "La base de la app inicial no permite guardar registros del analizador (reglas de Firestore)." : "No se pudo guardar: " + e.message, "bad");
    }
    setBusy("");
  };

  if (rec) {
    const r2 = evaluatePQ(rec.values || {}, rec.nominalV || 480, 60);
    return (
      <main className="screen">
        <Header eyebrow={"Analizador · " + eqName(rec.equipmentId)} title={fmtDate(rec.date)} onBack={() => setView(null)} />
        {rec.instrument && <p className="muted mono in" style={{ fontSize: 12, marginTop: -4 }}>{rec.instrument} · {rec.userName}</p>}
        <div className="in" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {(rec.images || []).map((s, k) => <Shot key={k} s={{ dataUrl: s.src, date: s.date, screen: s.screen }} onOpen={() => setBig(s.src)} />)}
        </div>
        {(rec.recordings || []).map((r, k) => <RecordingCard key={k} r={r} nominal={rec.nominalV || 480} />)}
        {r2.length > 0 && <EvalCard rows={r2} />}
        {rec.ai && <div className="card in" style={{ background: "var(--tint-ai)", fontSize: 14, whiteSpace: "pre-wrap" }}><b style={{ color: "var(--lilac)" }}>Análisis IA</b>{"\n"}{rec.ai}</div>}
        {rec.notes && <div className="card in" style={{ fontSize: 14 }}><span className="muted" style={{ fontSize: 11, display: "block" }}>NOTAS</span>{rec.notes}</div>}
        {ctx.isAdmin && <button className="btn ghost press" style={{ color: "var(--on-bad)" }} onClick={async () => { await store.remove("pq", rec.id); setView(null); toast("Registro eliminado"); }}><Icon n="trash" size={17} /> Eliminar registro</button>}
        <Sheet open={!!big} onClose={() => setBig(null)} label="Pantalla"><img src={big || ""} alt="" style={{ width: "100%", imageRendering: "pixelated", borderRadius: 12, background: "#000" }} /></Sheet>
      </main>
    );
  }

  return (
    <main className="screen">
      <Header eyebrow="Calidad de energía" title="Analizador" onBack={() => go("more")} />
      <p className="muted in" style={{ fontSize: 13, marginTop: -4 }}>Sube los archivos de la memoria del Fluke 435-II: las <b>pantallas</b> (SCREEN0.INT, SCREEN1.INT…) o una <b>grabación</b> completa (todo lo que hay dentro de DATA → DAT0000n: MEAS.ADM, SETUP.BIN, LIMITS.BIN, SCREEN.INT). Selecciónalos todos juntos.</p>

      <button className="btn press in" onClick={() => fileRef.current.click()} disabled={!!busy}><Icon n="file" size={18} /> {busy && busy.startsWith("Leyendo") ? busy : "Cargar archivos del Fluke"}</button>
      <input ref={fileRef} type="file" multiple hidden accept=".int,.INT,.idx,.IDX,image/*" onChange={(e) => load(e.target.files)} />

      {shots.length > 0 && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {shots.map((s, k) => <Shot key={k} s={s} onOpen={() => setBig(s.dataUrl)} onRemove={() => setShots(shots.filter((x) => x !== s))} />)}
          </div>
          {shots[0].serial && <p className="muted mono" style={{ fontSize: 11 }}>{shots[0].model} · S/N {shots[0].serial} · {shots[0].firmware}</p>}
        </>
      )}

      {recs.map((r, k) => <RecordingCard key={k} r={r} nominal={parseFloat(nomV) || 480} onRemove={() => setRecs(recs.filter((x) => x !== r))} />)}

      <label className="field in"><span>Equipo o punto medido</span>
        <select className="select" value={eqId} onChange={(e) => setEqId(e.target.value)}>
          <option value="">Sin equipo (medición general)</option>
          {eqList.map((i) => <option key={i.eq.id} value={i.eq.id}>{i.eq.name}</option>)}
        </select>
      </label>

      <section className="card in" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div className="row" style={{ justifyContent: "space-between" }}>
          <h2 className="h2">VALORES · OPCIONAL</h2>
          <label className="row" style={{ gap: 6, fontSize: 12 }}><span className="muted">Nominal</span>
            <input className="mono" inputMode="decimal" value={nomV} onChange={(e) => setNomV(clean(e.target.value))} style={{ width: 56, background: "var(--s2)", border: 0, borderRadius: 8, padding: "6px 8px", textAlign: "right" }} aria-label="Tensión nominal" /> V
          </label>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6 }}>
          {FIELDS.map((f) => (
            <label key={f.k} className="card" style={{ background: "var(--s2)", padding: "6px 10px", display: "flex", flexDirection: "column" }}>
              <span className="muted" style={{ fontSize: 10, fontWeight: 700 }}>{f.tag}</span>
              <span className="row" style={{ gap: 3 }}>
                <input inputMode="decimal" className="mono grow" value={vals[f.k] || ""} onChange={(e) => setVals({ ...vals, [f.k]: clean(e.target.value) })} placeholder="—" style={{ background: "none", border: 0, outline: "none", fontSize: 16, width: "100%", minWidth: 0 }} aria-label={f.tag} />
                <span className="muted" style={{ fontSize: 10 }}>{f.unit}</span>
              </span>
            </label>
          ))}
        </div>
        <p className="muted" style={{ fontSize: 11 }}>Cópialos de la pantalla del analizador. Con ellos la app evalúa desbalance, desviación, frecuencia, THD y factor de potencia sin internet.</p>
      </section>

      {rows.length > 0 && <EvalCard rows={rows} worst={worst} />}

      {shots.length > 0 && (hasGemini()
        ? <button className="btn sec press" onClick={runAI} disabled={!!busy} style={{ background: "var(--tint-ai)", color: "var(--lilac)" }}><Icon n="spark" size={18} /> {busy.startsWith("La IA") ? busy : "Analizar pantallas con IA"}</button>
        : <button className="btn ghost press" onClick={() => go("more")} style={{ fontSize: 13 }}><Icon n="spark" size={16} /> Conecta Gemini en Más → IA y voz para que la IA lea las pantallas</button>)}
      {ai && <div className="card fade" style={{ background: "var(--tint-ai)", fontSize: 14, whiteSpace: "pre-wrap" }}><b style={{ color: "var(--lilac)" }}>Análisis IA</b>{"\n"}{ai}</div>}

      <label className="field in"><span>Notas</span><textarea className="textarea" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Carga en el momento, equipos operando, observaciones…" /></label>
      <button className="btn press" onClick={save} disabled={!!busy}>{busy === "Guardando…" ? busy : "Guardar registro"}</button>

      <h2 className="h2" style={{ marginTop: 8 }}>REGISTROS GUARDADOS · {saved.length}</h2>
      {!saved.length && <Empty icon="file" title="Aún no hay registros" text="Los registros guardados aparecen aquí y en el diagnóstico del equipo." />}
      {saved.slice(0, 30).map((r) => (
        <button key={r.id} className="hotrow" style={{ gridTemplateColumns: "64px minmax(0,1fr) auto" }} onClick={() => setView(r.id)}>
          <span style={{ width: 64, height: 48, borderRadius: 8, overflow: "hidden", background: "#000" }}>{r.images && r.images[0] && <img src={r.images[0].src} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", imageRendering: "pixelated" }} />}</span>
          <span style={{ minWidth: 0 }}>
            <span className="ellipsis" style={{ display: "block", fontWeight: 700, fontSize: 14 }}>{eqName(r.equipmentId)}</span>
            <span className="muted ellipsis" style={{ display: "block", fontSize: 12 }}>{fmtDate(r.date)} · {(r.images || []).length} pantallas</span>
          </span>
          <Icon n="chev" size={16} style={{ color: "var(--muted)" }} />
        </button>
      ))}

      <Sheet open={!!big} onClose={() => setBig(null)} label="Pantalla"><img src={big || ""} alt="" style={{ width: "100%", imageRendering: "pixelated", borderRadius: 12, background: "#000" }} /></Sheet>
    </main>
  );
}

function EvalCard({ rows, worst }) {
  return (
    <section className="card in">
      <div className="row" style={{ justifyContent: "space-between", marginBottom: 6 }}>
        <h2 className="h2">EVALUACIÓN</h2>
        {worst && <Pill level={worst} />}
      </div>
      {rows.map((r) => (
        <div key={r.id} style={{ borderTop: "1px solid var(--s2)", padding: "7px 0" }}>
          <div className="row" style={{ fontSize: 14 }}>
            <span className="grow">{r.name}</span><span className="mono" style={{ fontWeight: 600 }}>{r.value}</span>
            <span style={{ width: 8, height: 8, borderRadius: 4, background: LEVELS[r.level].color }} />
          </div>
          {r.note && <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>{r.note}</div>}
        </div>
      ))}
    </section>
  );
}

function RecordingCard({ r, nominal, onRemove }) {
  const ev = r.events || [];
  const t0 = new Date(r.start).getTime(), t1 = new Date(r.end).getTime();
  const W = 320, H = 110, pl = 30, pr = 8, pt = 8, pb = 18;
  const Xt = (t) => pl + ((t - t0) / Math.max(1, t1 - t0)) * (W - pl - pr);
  const X = (iso) => Xt(new Date(iso).getTime());
  const lo = Math.max(0, Math.min(0.7, ...ev.map((e) => e.min / nominal - 0.05)));
  const Y = (v) => pt + (1 - (Math.min(1.1, Math.max(lo, v / nominal)) - lo) / (1.1 - lo)) * (H - pt - pb);
  const days = [];
  for (let t = new Date(r.start.slice(0, 10) + "T00:00").getTime() + 86400000; t < t1; t += 86400000) days.push(t);
  const dur = r.hours >= 24 ? `${Math.floor(r.hours / 24)} d ${Math.round(r.hours % 24)} h` : `${r.hours.toFixed(1).replace(".", ",")} h`;
  const fmtN = (x, d = 1) => (x == null ? "—" : x.toFixed(d).replace(".", ","));
  const live = r.V[0].rms > nominal * 0.1;
  return (
    <section className="card in" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div className="row" style={{ alignItems: "flex-start" }}>
        <div className="grow">
          <div className="eyebrow">Grabación · {r.norm || "Fluke 435-II"}</div>
          <div className="display" style={{ fontSize: 18, fontWeight: 600 }}>{r.name || "Medición del analizador"}</div>
          <div className="muted" style={{ fontSize: 12 }}>{fmtDate(r.start)} → {fmtDate(r.end)} · {dur}</div>
        </div>
        {onRemove && <button className="icon-btn press" style={{ width: 34, height: 34 }} onClick={onRemove} aria-label="Quitar grabación"><Icon n="close" size={14} /></button>}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Eventos de tensión en el periodo">
        {[1, 0.9, 0.7].filter((k) => k >= lo).map((k) => <g key={k}><line x1={pl} x2={W - pr} y1={Y(nominal * k)} y2={Y(nominal * k)} style={{ stroke: k === 1 ? "var(--line2)" : "var(--line)" }} strokeDasharray={k === 1 ? "" : "3 3"} /><text x={pl - 4} y={Y(nominal * k) + 3} textAnchor="end" fontSize="8" style={{ fill: "var(--muted)" }}>{Math.round(k * 100)}%</text></g>)}
        {days.map((t) => <g key={t}><line x1={Xt(t)} x2={Xt(t)} y1={pt} y2={H - pb} style={{ stroke: "var(--line)" }} /><text x={Xt(t)} y={H - 5} textAnchor="middle" fontSize="8" style={{ fill: "var(--muted)" }}>{new Date(t).getDate()}</text></g>)}
        {ev.map((e, k) => { const c = classifyEvent(e, nominal); return (
          <g key={k} className="dot" style={{ animationDelay: 200 + k * 80 + "ms" }}>
            <line x1={X(e.date)} x2={X(e.date)} y1={Y(nominal)} y2={Y(e.min)} stroke={LEVELS[c.level].color} strokeWidth="2" />
            <circle cx={X(e.date)} cy={Y(e.min)} r="3.5" fill={LEVELS[c.level].color} />
          </g>); })}
      </svg>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 6 }}>
        {[["V12", r.V[0]], ["V23", r.V[1]], ["V31", r.V[2]], ["I1", r.I[0]], ["I2", r.I[1]], ["I3", r.I[2]]].map(([t, x]) => (
          <div key={t} className="card" style={{ background: "var(--s2)", padding: "6px 10px" }}>
            <div className="muted" style={{ fontSize: 10, fontWeight: 700 }}>{t}{x.cf ? " · FC " + fmtN(x.cf, 2) : ""}</div>
            <div className="mono" style={{ fontWeight: 600 }}>{fmtN(x.rms)} <span className="muted" style={{ fontSize: 10 }}>{t[0] === "V" ? "V" : "A"}</span></div>
          </div>
        ))}
      </div>
      <p className="muted" style={{ fontSize: 11 }}>Valores al cerrar la grabación{r.hz ? ` · ${fmtN(r.hz, 3)} Hz` : ""}.{!live ? " La tensión estaba en 0: la grabación terminó con el circuito desenergizado." : ""}{r.I.some((x) => x.cf > 1.5) ? " Factor de cresta de corriente mayor a 1,5: corriente distorsionada (cargas no lineales como variadores)." : ""}</p>
      <div>
        <h2 className="h2" style={{ marginBottom: 4 }}>EVENTOS · {ev.length}</h2>
        {!ev.length && <p className="muted" style={{ fontSize: 13 }}>Sin eventos registrados.</p>}
        {ev.map((e, k) => { const c = classifyEvent(e, nominal); return (
          <div key={k} className="row" style={{ minHeight: 34, borderTop: "1px solid var(--s2)", fontSize: 13 }}>
            <span style={{ width: 8, height: 8, borderRadius: 4, background: LEVELS[c.level].color }} />
            <span className="grow">{fmtDate(e.date)}<span className="muted"> · {c.type}</span></span>
            <span className="mono" style={{ fontWeight: 600 }}>{fmtN(e.min)} V</span>
          </div>); })}
      </div>
    </section>
  );
}
