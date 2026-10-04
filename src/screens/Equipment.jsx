import React, { useRef, useState } from "react";
import { LEVELS, fmt, relDays, sanitizeDecimal } from "../lib/calc.js";
import { TYPES, TYPE_ORDER } from "../lib/templates.js";
import { compressImage } from "../lib/image.js";
import { diagnoseItem, hasGemini, readNameplate } from "../lib/ai.js";
import { Icon, Pill, Sheet, useToast, Header, Field, Empty, FilterBar, applyFilter, ShowMore } from "../ui.jsx";

function EqForm({ ctx, initial, onClose }) {
  const { store, data } = ctx;
  const toast = useToast();
  const [f, setF] = useState(() => initial || { name: "", type: "motor", plantId: (data.plants[0] || {}).id || "", ccmId: "", plate: {} });
  const [busy, setBusy] = useState(false);
  const [reading, setReading] = useState(false);
  const fileRef = useRef();
  const photoRef = useRef();
  const legacy = store.mode === "legacy";
  const [photo, setPhoto] = useState(null); // dataURL actual
  const [photoChanged, setPhotoChanged] = useState(false);
  React.useEffect(() => { if (initial && initial.photoId) store.getPhoto(initial.photoId).then((u) => u && setPhoto(u)); }, []); // eslint-disable-line
  const pickPhoto = async (file) => {
    if (!file) return;
    try { const url = await compressImage(file, 1000, 150 * 1024); setPhoto(url); setPhotoChanged(true); } catch (e) { toast(e.message, "bad"); }
    photoRef.current.value = "";
  };
  const typeOptions = legacy ? ["motor", "tablero"] : TYPE_ORDER;
  const T = TYPES[f.type];
  const ccms = data.ccms.filter((c) => !f.plantId || c.plantId === f.plantId);

  const fromPhoto = async (file) => {
    if (!file) return;
    setReading(true);
    try {
      const url = await compressImage(file, 1600, 400 * 1024);
      const r = await readNameplate(url);
      setF((x) => ({ ...x, type: r.type, name: x.name || r.name || "", plate: { ...x.plate, ...(r.plate || {}) } }));
      toast("Placa leída · revisa los datos");
    } catch (e) { toast("No se pudo leer la placa", "bad"); console.error(e); }
    setReading(false);
    fileRef.current.value = "";
  };

  const save = async () => {
    if (!f.name.trim()) return toast("Escribe el nombre del equipo", "warn");
    setBusy(true);
    const doc = { name: f.name.trim(), type: f.type, plantId: f.plantId || "", ccmId: f.ccmId || "", plate: Object.fromEntries(Object.entries(f.plate || {}).filter(([k, v]) => v !== "" && T.plate.some((p) => p.k === k))) };
    if (legacy) doc.typeLabel = initial && initial.type === f.type && initial.typeLabel ? initial.typeLabel : TYPES[f.type].label;
    try {
      if (photoChanged) {
        if (legacy) doc.photoData = photo || null;
        else doc.photoId = photo ? await store.putPhoto(photo) : null;
      }
      if (initial && initial.id) await store.update("equipment", initial.id, doc);
      else await store.add("equipment", doc);
      toast(initial && initial.id ? "Equipo actualizado" : "Equipo creado");
      onClose();
    } catch (e) { toast("Error: " + e.message, "bad"); setBusy(false); }
  };

  return (
    <>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h2 className="display" style={{ fontSize: 20 }}>{initial && initial.id ? "Editar equipo" : "Nuevo equipo"}</h2>
        <button className="icon-btn press" onClick={onClose} aria-label="Cerrar"><Icon n="close" /></button>
      </div>
      {hasGemini() && (
        <>
          <button className="btn sec press" onClick={() => fileRef.current.click()} disabled={reading} style={{ background: "var(--tint-ai)", color: "var(--lilac)" }}>
            <Icon n="camera" size={18} /> {reading ? "Leyendo placa…" : "Llenar desde foto de la placa"}
          </button>
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => fromPhoto(e.target.files[0])} />
        </>
      )}
      <div className="row" style={{ gap: 12 }}>
        <button className="thumb press" onClick={() => photoRef.current.click()} aria-label={photo ? "Cambiar foto del equipo" : "Agregar foto del equipo"} style={{ width: 88, height: 88, borderRadius: 18, display: "flex", flexDirection: "column", gap: 4, alignItems: "center", justifyContent: "center", color: "var(--muted)", border: photo ? 0 : "1.5px dashed var(--line2)", fontSize: 11, fontWeight: 600 }}>
          {photo ? <img src={photo} alt="Foto del equipo" /> : <><Icon n="camera" size={24} />Foto</>}
        </button>
        <div className="grow" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span style={{ fontWeight: 600, fontSize: 14 }}>Foto del equipo</span>
          <span className="muted" style={{ fontSize: 12 }}>Ayuda a identificarlo en la ruta. Toca para tomarla o elegirla.</span>
          {photo && <button className="btn ghost press" style={{ height: 30, padding: 0, justifyContent: "flex-start", fontSize: 13, color: "var(--on-bad)" }} onClick={() => { setPhoto(null); setPhotoChanged(true); }}>Quitar foto</button>}
        </div>
        <input ref={photoRef} type="file" accept="image/*" hidden onChange={(e) => pickPhoto(e.target.files[0])} />
      </div>
      <Field label="Nombre (código · descripción)"><input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="M-114 · Bomba agua fresca" /></Field>
      <div className="field"><span>Tipo de equipo</span>
        <div className="row" style={{ gap: 6, flexWrap: "wrap" }} role="radiogroup">
          {typeOptions.map((t) => (
            <button key={t} role="radio" aria-checked={f.type === t} className="chip press" onClick={() => setF({ ...f, type: t })} style={f.type === t ? { background: TYPES[t].color, color: "#111214" } : null}>
              <span className="row" style={{ gap: 6 }}><Icon d={TYPES[t].icon} size={15} />{TYPES[t].label}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="row" style={{ gap: 8 }}>
        <Field label="Planta"><select className="select" value={f.plantId} onChange={(e) => setF({ ...f, plantId: e.target.value, ccmId: "" })}><option value="">—</option>{data.plants.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>
        <Field label="CCM / área"><select className="select" value={f.ccmId} onChange={(e) => setF({ ...f, ccmId: e.target.value })}><option value="">—</option>{ccms.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
      </div>
      <div className="field"><span>Datos de placa · opcionales (la corriente nominal activa el % de carga)</span>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {T.plate.map((p) => (
            <label key={p.k} className="card" style={{ padding: "8px 12px", display: "flex", flexDirection: "column", gap: 2, background: "var(--s2)" }}>
              <span className="muted" style={{ fontSize: 11 }}>{p.label}</span>
              <span className="row" style={{ gap: 4 }}>
                <input inputMode="decimal" className="mono grow" value={(f.plate || {})[p.k] || ""} onChange={(e) => setF({ ...f, plate: { ...f.plate, [p.k]: sanitizeDecimal(e.target.value) } })} style={{ background: "none", border: 0, outline: "none", fontSize: 18, width: "100%" }} aria-label={p.label} />
                <span className="muted" style={{ fontSize: 12 }}>{p.unit}</span>
              </span>
            </label>
          ))}
        </div>
      </div>
      <button className="btn press" onClick={save} disabled={busy}>{busy ? "Guardando…" : "Guardar equipo"}</button>
    </>
  );
}

function EqThumb({ id, store }) {
  const [url, setUrl] = useState(null);
  React.useEffect(() => { let on = true; store.getPhoto(id).then((u) => on && setUrl(u)); return () => { on = false; }; }, [id]); // eslint-disable-line
  return <span style={{ width: 40, height: 40, borderRadius: 12, overflow: "hidden", background: "var(--s2)", flexShrink: 0 }}>{url && <img src={url} alt="" loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />}</span>;
}

function EqPhoto({ id, store }) {
  const [url, setUrl] = useState(null);
  React.useEffect(() => { let on = true; store.getPhoto(id).then((u) => on && setUrl(u)); return () => { on = false; }; }, [id]); // eslint-disable-line
  return url ? <img src={url} alt="Foto del equipo" className="fade" style={{ width: "100%", maxHeight: 220, objectFit: "cover", borderRadius: 16 }} /> : null;
}

export default function Equipment({ ctx }) {
  const { items, data, go, route, isAdmin, store, th } = ctx;
  const toast = useToast();
  const [limit, setLimit] = useState(40);
  const [type, setType] = useState("all");
  const [sel, setSel] = useState(null);
  const [form, setForm] = useState(route.create ? {} : null);
  const [confirm, setConfirm] = useState(false);

  const list = applyFilter(items, ctx.filter, ctx.data).filter((i) => type === "all" || i.eq.type === type)
    .sort((a, b) => a.eq.name.localeCompare(b.eq.name));
  const types = TYPE_ORDER.filter((t) => items.some((i) => i.eq.type === t));
  const it = sel && items.find((i) => i.eq.id === sel);

  const del = async () => {
    const eq = it.eq;
    setSel(null); setConfirm(false);
    for (const r of it.readings) { (r.photoIds || []).forEach((p) => store.removePhoto(p)); await store.remove("readings", r.id); }
    await store.remove("equipment", eq.id);
    toast("Equipo eliminado");
  };

  return (
    <main className="screen">
      <Header eyebrow={`${items.length} equipos`} title="Equipos" right={<button className="icon-btn light press" onClick={() => setForm({})} aria-label="Nuevo equipo"><Icon n="plus" /></button>} />
      <FilterBar ctx={ctx} count={list.length} />
      {types.length > 1 && (
        <div className="row in" style={{ gap: 6, overflowX: "auto", margin: "0 -16px", padding: "0 16px" }}>
          <button className="chip press" aria-pressed={type === "all"} onClick={() => setType("all")}>Todos</button>
          {types.map((t) => <button key={t} className="chip press" aria-pressed={type === t} onClick={() => setType(t)}>{TYPES[t].label}</button>)}
        </div>
      )}
      {!items.length && <Empty icon="box" title="Crea tu primer equipo" text="Cada tipo trae sus propios puntos de medida." action={<button className="btn sec press" style={{ height: 42 }} onClick={() => setForm({})}>Crear equipo</button>} />}
      {items.length > 0 && !list.length && <Empty icon="search" title="Sin resultados" text="Cambia la planta, el CCM o la búsqueda." />}
      <div>
        {list.slice(0, limit).map((i, k) => {
          const ccm = data.ccms.find((c) => c.id === i.eq.ccmId);
          return (
            <button key={i.eq.id} className="hotrow in" style={{ gridTemplateColumns: "40px minmax(0,1fr) auto", animationDelay: Math.min(k, 10) * 25 + "ms" }} onClick={() => setSel(i.eq.id)}>
              {i.eq.photoId ? <EqThumb id={i.eq.photoId} store={store} /> : <span style={{ width: 40, height: 40, borderRadius: 12, background: i.T.color, color: "#111214", display: "flex", alignItems: "center", justifyContent: "center" }}><Icon d={i.T.icon} size={19} /></span>}
              <span style={{ minWidth: 0 }}>
                <span className="ellipsis" style={{ display: "block", fontWeight: 700, fontSize: 14 }}>{i.eq.name}</span>
                <span className="muted ellipsis" style={{ display: "block", fontSize: 12 }}>{i.eq.typeLabel || i.T.label}{ccm ? " · " + ccm.name : ""} · {i.readings.length} lecturas</span>
              </span>
              <Pill level={i.level} />
            </button>
          );
        })}
      </div>
      <ShowMore total={list.length} shown={Math.min(limit, list.length)} onMore={() => setLimit(limit + 60)} />

      <Sheet open={!!it} onClose={() => { setSel(null); setConfirm(false); }} label="Detalle del equipo">
        {it && (
          <>
            <div className="row" style={{ alignItems: "flex-start" }}>
              <span style={{ width: 48, height: 48, borderRadius: 14, background: it.T.color, color: "#111214", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Icon d={it.T.icon} size={22} /></span>
              <div className="grow">
                <div className="display" style={{ fontSize: 19, fontWeight: 600, lineHeight: 1.15 }}>{it.eq.name}</div>
                <div className="muted" style={{ fontSize: 13, marginTop: 2 }}>{it.eq.typeLabel || it.T.label} · última lectura {relDays(it.last && it.last.date)}</div>
              </div>
              <Pill level={it.level} />
            </div>
            {it.eq.photoId && <EqPhoto id={it.eq.photoId} store={store} />}
            {it.T.plate.some((p) => (it.eq.plate || {})[p.k]) && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(90px,1fr))", gap: 6 }}>
                {it.T.plate.filter((p) => (it.eq.plate || {})[p.k]).map((p) => (
                  <div key={p.k} className="card" style={{ background: "var(--s2)", padding: "8px 10px" }}>
                    <div className="muted" style={{ fontSize: 11 }}>{p.label}</div>
                    <div className="mono" style={{ fontWeight: 600 }}>{String(it.eq.plate[p.k]).replace(".", ",")} <span className="muted" style={{ fontSize: 11 }}>{p.unit}</span></div>
                  </div>
                ))}
              </div>
            )}
            {it.ev && (
              <div>
                {it.ev.rows.map((r) => (
                  <div key={r.id} className="row" style={{ minHeight: 34, borderTop: "1px solid var(--s2)", fontSize: 14 }}>
                    <span className="grow">{r.name}</span><span className="mono">{r.value}</span>
                    <span style={{ width: 8, height: 8, borderRadius: 4, background: LEVELS[r.level].color }} />
                  </div>
                ))}
                {diagnoseItem(it, th).slice(0, 1).map((d) => <p key={d.id} className="muted" style={{ fontSize: 13, marginTop: 8 }}><b style={{ color: "var(--text)" }}>{d.title}.</b> {d.rec[0]}</p>)}
                {it.dtTrend !== null && <p className="muted mono" style={{ fontSize: 12, marginTop: 4 }}>Tendencia ΔT: {it.dtTrend > 0 ? "+" : ""}{fmt(it.dtTrend)} °C/mes</p>}
              </div>
            )}
            <div className="row" style={{ gap: 8 }}>
              <button className="btn press" style={{ flex: 1 }} onClick={() => go("read", { eqId: it.eq.id })}><Icon n="plus" size={18} /> Lectura</button>
              <button className="btn sec press" style={{ flex: 1 }} onClick={() => go("hist", { eqId: it.eq.id })}><Icon n="chart" size={18} /> Histórico</button>
            </div>
            {isAdmin && (
              <div className="row" style={{ gap: 8 }}>
                <button className="btn ghost press" style={{ flex: 1, height: 44 }} onClick={() => { setForm({ ...it.eq }); setSel(null); }}><Icon n="edit" size={17} /> Editar</button>
                {ctx.canManage && (!confirm
                  ? <button className="btn ghost press" style={{ flex: 1, height: 44, color: "var(--on-bad)" }} onClick={() => setConfirm(true)}><Icon n="trash" size={17} /> Eliminar</button>
                  : <button className="btn danger press fade" style={{ flex: 1, height: 44 }} onClick={del}>Confirmar ({it.readings.length} lecturas)</button>)}
              </div>
            )}
          </>
        )}
      </Sheet>

      <Sheet open={!!form} onClose={() => setForm(null)} label="Formulario de equipo">
        {form && <EqForm ctx={ctx} initial={form.id ? form : null} onClose={() => setForm(null)} />}
      </Sheet>
    </main>
  );
}
