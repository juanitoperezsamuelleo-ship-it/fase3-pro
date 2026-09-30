import React, { useMemo, useRef, useState } from "react";
import { LEVELS, sanitizeDecimal, localISO, relDays, num } from "../lib/calc.js";
import { TYPES, TYPE_ORDER, evaluate, requiredDone } from "../lib/templates.js";
import { compressImage } from "../lib/image.js";
import { reviewReading, aiReview, analyzePhoto, hasGemini } from "../lib/ai.js";
import { Icon, Pill, Sheet, useToast, Header, Empty } from "../ui.jsx";

/* Paso 1: elegir equipo */
function Picker({ ctx, onPick }) {
  const { items, data, go } = ctx;
  const [q, setQ] = useState("");
  const list = items.filter((i) => !q || i.eq.name.toLowerCase().includes(q.toLowerCase()));
  const byType = TYPE_ORDER.map((t) => ({ t, list: list.filter((i) => i.eq.type === t) })).filter((g) => g.list.length);
  return (
    <main className="screen">
      <Header eyebrow="Nueva lectura" title="¿Qué equipo?" />
      <label className="row card in" style={{ padding: "0 14px", height: 50, animationDelay: "40ms" }}>
        <Icon n="search" size={18} style={{ color: "var(--muted)" }} />
        <input className="grow" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por código o nombre" aria-label="Buscar equipo" style={{ background: "none", border: 0, height: 48, outline: "none", fontSize: 16 }} />
      </label>
      {!items.length && <Empty icon="box" title="Sin equipos" text="Primero crea un equipo." action={<button className="btn sec press" style={{ height: 42 }} onClick={() => go("equip", { create: true })}>Crear equipo</button>} />}
      {byType.map((g, gi) => (
        <section key={g.t} className="in" style={{ animationDelay: 60 + gi * 30 + "ms" }}>
          <h2 className="h2" style={{ margin: "6px 2px 8px" }}>{TYPES[g.t].label.toUpperCase()}</h2>
          {g.list.map((it) => {
            const ccm = data.ccms.find((c) => c.id === it.eq.ccmId);
            return (
              <button key={it.eq.id} className="hotrow" style={{ gridTemplateColumns: "40px minmax(0,1fr) auto" }} onClick={() => onPick(it.eq.id)}>
                <span style={{ width: 40, height: 40, borderRadius: 12, background: it.T.color, color: "#111214", display: "flex", alignItems: "center", justifyContent: "center" }}><Icon d={it.T.icon} size={19} /></span>
                <span style={{ minWidth: 0 }}>
                  <span className="ellipsis" style={{ display: "block", fontWeight: 700, fontSize: 14 }}>{it.eq.name}</span>
                  <span className="muted" style={{ fontSize: 12 }}>{ccm ? ccm.name + " · " : ""}{relDays(it.last && it.last.date)}</span>
                </span>
                <span style={{ width: 9, height: 9, borderRadius: 5, background: LEVELS[it.level].color }} aria-label={LEVELS[it.level].label} />
              </button>
            );
          })}
        </section>
      ))}
    </main>
  );
}

/* Paso 2: formulario por tipo de equipo */
export default function Reading({ ctx }) {
  const { route, items, store, session, go, th, data, isAdmin } = ctx;
  const toast = useToast();
  const editing = route.editId ? data.readings.find((r) => r.id === route.editId) : null;
  const [eqId, setEqId] = useState(route.eqId || (editing && editing.equipmentId) || null);
  const it = items.find((i) => i.eq.id === eqId);
  const T = it ? it.T : null;
  const [values, setValues] = useState(editing ? { ...editing.values } : {});
  const [sec, setSec] = useState(T ? T.sections[0].id : null);
  const [photos, setPhotos] = useState(editing ? (editing.photoIds || []).map((id) => ({ id })) : []);
  const [notes, setNotes] = useState(editing ? editing.notes || "" : "");
  const [date, setDate] = useState(editing ? editing.date : localISO());
  const [busy, setBusy] = useState(false);
  const [review, setReview] = useState(null);
  const [photoAI, setPhotoAI] = useState(null);
  const fileRef = useRef();
  const blockRef = useRef();

  const prev = useMemo(() => (it ? it.readings.filter((r) => !editing || r.id !== editing.id).slice(-1)[0] : null), [it, editing]);
  const ev = useMemo(() => (it ? evaluate(it.eq.type, values, th, it.eq.plate || {}) : null), [it, values, th]);

  if (!it) return <Picker ctx={ctx} onPick={(id) => { setEqId(id); setSec(items.find((i) => i.eq.id === id).T.sections[0].id); }} />;

  const section = T.sections.find((s) => s.id === sec) || T.sections[0];
  const secIdx = T.sections.indexOf(section);
  const ccm = data.ccms.find((c) => c.id === it.eq.ccmId);
  const setV = (k, v) => setValues((x) => ({ ...x, [k]: v }));
  const filled = Object.values(values).some((v) => v !== "" && v !== undefined);

  const onKey = (e) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const ins = Array.from(blockRef.current.querySelectorAll("input"));
    const i = ins.indexOf(e.target);
    if (ins[i + 1]) ins[i + 1].focus();
    else if (T.sections[secIdx + 1]) setSec(T.sections[secIdx + 1].id);
    else e.target.blur();
  };

  const addPhotos = async (files) => {
    for (const f of Array.from(files || [])) {
      try { const dataUrl = await compressImage(f); setPhotos((p) => [...p, { dataUrl }]); } catch (e) { toast(e.message, "bad"); }
    }
    if (fileRef.current) fileRef.current.value = "";
  };

  const doReview = async () => {
    const local = reviewReading(it.eq.type, values, prev, it.eq.plate, th);
    setReview({ local, ai: hasGemini() ? "…" : null });
    if (hasGemini()) {
      try { const txt = await aiReview(it.eq.type, values, prev, it.eq.plate); setReview((r) => r && { ...r, ai: txt }); } catch (e) { setReview((r) => r && { ...r, ai: "No se pudo consultar la IA: " + e.message }); }
    }
  };

  const save = async () => {
    if (!filled) return toast("Registra al menos un valor", "warn");
    setBusy(true);
    try {
      const photoIds = [];
      for (const p of photos) photoIds.push(p.id || (await store.putPhoto(p.dataUrl)));
      const clean = Object.fromEntries(Object.entries(values).filter(([, v]) => v !== "" && v !== undefined && v !== "-"));
      if (editing) {
        (editing.photoIds || []).filter((id) => !photoIds.includes(id)).forEach((id) => store.removePhoto(id));
        await store.update("readings", editing.id, { values: clean, notes: notes.trim(), date, photoIds });
        toast("Lectura actualizada");
      } else {
        await store.add("readings", { equipmentId: it.eq.id, type: it.eq.type, date, values: clean, notes: notes.trim(), photoIds, userId: session.uid, userName: session.name || session.email });
        toast(ev.worst && LEVELS[ev.worst].rank >= 3 ? "Guardada · requiere intervención" : "Lectura guardada", ev.worst && LEVELS[ev.worst].rank >= 3 ? "bad" : "ok");
      }
      go("hist", { eqId: it.eq.id, k: Date.now() });
    } catch (e) { toast("No se pudo guardar: " + e.message, "bad"); setBusy(false); }
  };

  const runPhotoAI = async (p) => {
    const url = p.dataUrl || (await store.getPhoto(p.id));
    setPhotoAI({ url, text: "Analizando…" });
    try { setPhotoAI({ url, text: await analyzePhoto(url, { ...it, ev }, th) }); } catch (e) { setPhotoAI({ url, text: "No se pudo analizar: " + e.message }); }
  };

  return (
    <main className="screen">
      <Header eyebrow={`${T.label}${ccm ? " · " + ccm.name : ""}${editing ? " · editando" : ""}`} title={it.eq.name.split(" · ")[0]} onBack={() => (editing || route.eqId ? go("hist", { eqId: it.eq.id }) : setEqId(null))}
        right={prev && <span className="muted" style={{ fontSize: 12, textAlign: "right", paddingTop: 6 }}>Anterior<br />{relDays(prev.date)}</span>} />
      {it.eq.name.includes(" · ") && <p className="muted in" style={{ marginTop: -6, fontSize: 14 }}>{it.eq.name.split(" · ").slice(1).join(" · ")}</p>}

      <div className="row in" style={{ gap: 6, animationDelay: "40ms" }} role="tablist" aria-label="Secciones">
        {T.sections.map((s) => {
          const on = s.id === section.id;
          const done = requiredDone(it.eq.type, values, s.id) && s.groups.some((g) => g.fields.some((f) => values[f.k]));
          return (
            <button key={s.id} className="tabb" aria-pressed={on} onClick={() => setSec(s.id)} style={{ background: on ? s.color : undefined }} role="tab" aria-selected={on} aria-label={s.title}>
              <Icon d={s.icon} size={18} />{on && <span className="fade">{s.title}</span>}
              {done && <span className="done" style={{ background: on ? "#111214" : s.color }} />}
            </button>
          );
        })}
      </div>

      <div ref={blockRef} key={section.id} className="block in" style={{ "--sc": section.color }}>
        <div className="row" style={{ justifyContent: "space-between", padding: "2px 4px" }}>
          <span className="display" style={{ fontSize: 18, fontWeight: 600 }}>{section.title}</span>
          <span style={{ fontSize: 12, fontWeight: 600, opacity: .65 }}>{section.hint}</span>
        </div>
        {section.groups.map((g, gi) => (
          <div key={gi} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {g.title && <div style={{ fontSize: 12, fontWeight: 700, opacity: .65, padding: "6px 6px 0" }}>{g.title}</div>}
            {g.fields.map((f) => f.kind === "choice" ? (
              <div key={f.k} className="frow" style={{ justifyContent: "space-between", flexWrap: "wrap", padding: "10px 12px" }}>
                <span style={{ fontWeight: 600, fontSize: 14 }}>{f.name}</span>
                <span className="row" style={{ gap: 6 }} role="radiogroup" aria-label={f.name}>
                  {f.opts.map((o) => (
                    <button key={o} role="radio" aria-checked={values[f.k] === o} className="chip bchip press" onClick={() => setV(f.k, values[f.k] === o ? "" : o)}>{o}</button>
                  ))}
                </span>
              </div>
            ) : (
              <label key={f.k} className="frow">
                <span className="tag">{f.tag}</span>
                <span style={{ fontSize: 12, fontWeight: 600, opacity: .7, lineHeight: 1.2, maxWidth: 120 }}>{f.name || ""}{f.optional && <><br /><span style={{ opacity: .7 }}>opcional</span></>}</span>
                <input inputMode="decimal" enterKeyHint="next" value={values[f.k] || ""} placeholder={f.ph} onChange={(e) => setV(f.k, sanitizeDecimal(e.target.value))} onKeyDown={onKey} aria-label={`${f.name || f.tag} en ${f.unit}`} />
                <span style={{ fontSize: 13, fontWeight: 700, opacity: .6, minWidth: 22 }}>{f.unit}</span>
              </label>
            ))}
          </div>
        ))}
        {section.note && <p style={{ fontSize: 12, opacity: .7, padding: "2px 6px" }}>{section.note}</p>}
        {T.sections[secIdx + 1] && (
          <button className="btn bnext press" onClick={() => setSec(T.sections[secIdx + 1].id)}>
            Siguiente: {T.sections[secIdx + 1].title} <Icon n="chev" size={16} />
          </button>
        )}
      </div>

      {/* Evaluación en vivo */}
      <section className="card in" aria-live="polite">
        <div className="row" style={{ justifyContent: "space-between", marginBottom: 6 }}>
          <h2 className="h2">EVALUACIÓN</h2>
          {filled && <Pill level={ev.worst} />}
        </div>
        {ev.rows.map((r) => (
          <div key={r.id} className="row" style={{ minHeight: 36, borderTop: "1px solid var(--s2)", fontSize: 14 }}>
            <span className="grow">{r.name}{r.note && <span className="muted" style={{ display: "block", fontSize: 11 }}>{r.note}</span>}</span>
            <span className="mono" style={{ fontWeight: 600 }}>{r.value}</span>
            <span style={{ width: 8, height: 8, borderRadius: 4, background: LEVELS[r.level].color }} />
          </div>
        ))}
        {prev && ev.dT && num(prev.values && prev.values.tMax) !== null && (
          <p className="muted" style={{ fontSize: 12, marginTop: 6 }}>Anterior: punto máximo {String(prev.values.tMax).replace(".", ",")} °C · {relDays(prev.date)}</p>
        )}
      </section>

      {/* Fotos */}
      <section className="card in">
        <div className="row" style={{ justifyContent: "space-between", marginBottom: 10 }}>
          <h2 className="h2">FOTOS · {photos.length}</h2>
          <span className="muted" style={{ fontSize: 11 }}>termografía o visual</span>
        </div>
        <div className="row" style={{ gap: 8, overflowX: "auto", paddingBottom: 2 }}>
          <button className="thumb press" onClick={() => fileRef.current.click()} aria-label="Agregar foto" style={{ display: "flex", alignItems: "center", justifyContent: "center", color: "var(--muted)", border: "1.5px dashed var(--line2)" }}>
            <Icon n="camera" size={22} />
          </button>
          {photos.map((p, k) => (
            <PhotoThumb key={p.id || k} p={p} store={store} onRemove={() => setPhotos(photos.filter((x) => x !== p))} onAI={hasGemini() ? () => runPhotoAI(p) : null} />
          ))}
        </div>
        <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => addPhotos(e.target.files)} />
        {photos.length > 0 && hasGemini() && <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>Toca una foto para que la IA la analice.</p>}
      </section>

      <label className="field in"><span>Notas</span><textarea className="textarea" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Hallazgos, condición de carga, acciones…" /></label>
      <label className="field in"><span>Fecha y hora (hora local)</span><input className="input" type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} /></label>

      <div className="row" style={{ gap: 8 }}>
        <button className="btn sec press" style={{ flex: 1 }} onClick={doReview}><Icon n="spark" size={18} /> Revisar</button>
        <button className="btn press" style={{ flex: 1.4 }} onClick={save} disabled={busy} aria-disabled={busy || !filled}>{busy ? "Guardando…" : editing ? "Guardar cambios" : "Guardar lectura"}</button>
      </div>
      {editing && isAdmin && <p className="muted" style={{ fontSize: 12, textAlign: "center" }}>Editando lectura de {editing.userName}</p>}

      <Sheet open={!!review} onClose={() => setReview(null)} label="Revisión de la lectura">
        {review && (
          <>
            <h2 className="display" style={{ fontSize: 20 }}>Revisión antes de guardar</h2>
            {review.local.map((n, k) => (
              <div key={k} className="row" style={{ alignItems: "flex-start", gap: 10, fontSize: 14 }}>
                <span style={{ width: 8, height: 8, borderRadius: 4, marginTop: 6, background: LEVELS[n.level].color, flexShrink: 0 }} />
                <span>{n.text}</span>
              </div>
            ))}
            {review.ai && <div className="card" style={{ background: "var(--tint-ai)", fontSize: 14 }}><b style={{ color: "var(--lilac)" }}>IA · </b>{review.ai}</div>}
            <div className="row" style={{ gap: 8 }}>
              <button className="btn sec press" style={{ flex: 1 }} onClick={() => setReview(null)}>Corregir</button>
              <button className="btn press" style={{ flex: 1 }} onClick={() => { setReview(null); save(); }}>Guardar así</button>
            </div>
          </>
        )}
      </Sheet>

      <Sheet open={!!photoAI} onClose={() => setPhotoAI(null)} label="Análisis de foto">
        {photoAI && (
          <>
            <img src={photoAI.url} alt="" style={{ width: "100%", maxHeight: 260, objectFit: "contain", borderRadius: 16, background: "#000" }} />
            <div style={{ fontSize: 14, whiteSpace: "pre-wrap" }}>{photoAI.text}</div>
            <button className="btn sec press" onClick={() => { setNotes((n) => (n ? n + "\n" : "") + photoAI.text); setPhotoAI(null); }}>Agregar a notas</button>
          </>
        )}
      </Sheet>
    </main>
  );
}

function PhotoThumb({ p, store, onRemove, onAI }) {
  const [url, setUrl] = useState(p.dataUrl || null);
  React.useEffect(() => { if (!url && p.id) store.getPhoto(p.id).then(setUrl); }, [p.id]); // eslint-disable-line
  return (
    <div className="thumb fade">
      <button onClick={onAI || undefined} style={{ border: 0, padding: 0, width: "100%", height: "100%", background: "none" }} aria-label={onAI ? "Analizar foto con IA" : "Foto"}>
        {url ? <img src={url} alt="" /> : null}
      </button>
      <button className="x" onClick={onRemove} aria-label="Quitar foto"><Icon n="close" size={13} /></button>
    </div>
  );
}
