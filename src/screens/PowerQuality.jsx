import React, { useMemo, useRef, useState } from "react";
import { LEVELS, fmtDate, localISO, worstOf } from "../lib/calc.js";
import { readPowerFiles, evaluatePQ } from "../lib/fluke.js";
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
    const { shots: s, errors } = await readPowerFiles(files, (f) => compressImage(f, 1000, 160 * 1024));
    setShots((x) => [...x, ...s]);
    if (errors.length) toast(errors[0], "bad");
    else if (s.length) toast(`${s.length} ${s.length === 1 ? "pantalla leída" : "pantallas leídas"}`);
    else toast("No había pantallas en esos archivos", "warn");
    setBusy("");
    if (fileRef.current) fileRef.current.value = "";
  };

  const runAI = async () => {
    setBusy("La IA está leyendo las pantallas…");
    try { setAi(await analyzeFluke(shots.map((s) => s.dataUrl), it, vals, th)); } catch (e) { toast(e.message, "bad"); }
    setBusy("");
  };

  const save = async () => {
    if (!shots.length && !rows.length) return toast("Carga pantallas o anota valores", "warn");
    const images = shots.map((s) => ({ src: s.dataUrl, date: s.date || "", screen: s.screen || s.name || "" }));
    const size = images.reduce((a, b) => a + b.src.length, 0);
    if (size > 900000) return toast("Demasiadas pantallas para un registro; guarda máximo 8", "warn");
    setBusy("Guardando…");
    try {
      const first = shots.find((s) => s.serial) || {};
      const id = await store.add("pq", {
        equipmentId: eqId || "", date: (shots.find((s) => s.date) || {}).date?.slice(0, 16) || localISO(),
        images, values: vals, nominalV: parseFloat(nomV) || 480, notes: notes.trim(), ai: ai || "",
        instrument: [first.model, first.serial && "S/N " + first.serial, first.firmware].filter(Boolean).join(" · "),
        userName: session.name || session.email
      });
      toast("Registro guardado");
      setShots([]); setVals({}); setNotes(""); setAi(""); setView(id);
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
      <p className="muted in" style={{ fontSize: 13, marginTop: -4 }}>Sube los archivos <b>SCREEN0.INT, SCREEN1.INT…</b> de la memoria del Fluke 435-II (o fotos de la pantalla). La app los convierte en imágenes.</p>

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
