import React, { useState } from "react";
import { DEFAULT_THRESHOLDS, LEVELS, localDay } from "../lib/calc.js";
import { htmlReport, openHtml, excelReport } from "../lib/reports.js";
import { getAIConfig, setAIConfig, speak } from "../lib/ai.js";
import { Icon, Header, Field, Stepper, Seg, useToast, Pill, Empty } from "../ui.jsx";

const MENU = [
  { id: "account", label: "Cuenta", icon: "user", color: "#F4F2EE" },
  { id: "alerts", label: "Alertas", icon: "bell", color: "#FFB05C" },
  { id: "reports", label: "Informes", icon: "file", color: "#8FD3FF" },
  { id: "ai", label: "IA y voz", icon: "brain", color: "#B9A6FF" },
  { id: "thresholds", label: "Umbrales", icon: "sliders", color: "#FFC6A8", admin: true },
  { id: "plants", label: "Plantas y CCM", icon: "factory", color: "#7BE0A0", admin: true },
  { id: "users", label: "Usuarios", icon: "users", color: "#D8E86B", admin: true },
  { id: "look", label: "Apariencia", icon: "palette", color: "#FF9BD2" }
];

function Account({ ctx }) {
  const { session, store, demo } = ctx;
  return (
    <>
      <div className="card in" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {[["Nombre", session.name], ["Correo", session.email], ["Empresa", session.orgName], ["Rol", session.role === "admin" ? "Administrador" : "Técnico"], ["Modo", demo ? "Demo (este dispositivo)" : ctx.readOnly ? "App inicial · solo lectura" : "En la nube"]].map(([k, v]) => (
          <div key={k} className="row" style={{ justifyContent: "space-between", fontSize: 14 }}><span className="muted">{k}</span><span style={{ fontWeight: 600, textAlign: "right" }}>{v}</span></div>
        ))}
      </div>
      {demo && <button className="btn sec press" onClick={() => store.resetDemo()}>Restaurar datos de ejemplo</button>}
      <button className="btn danger press" onClick={() => store.signOut()}><Icon n="out" size={18} /> Cerrar sesión</button>
      <p className="muted" style={{ fontSize: 12, textAlign: "center" }}>FASE·3 Pro · versión 0.1</p>
    </>
  );
}

function Alerts({ ctx }) {
  const { items, go, th } = ctx;
  const crit = items.filter((i) => i.rank >= 2).sort((a, b) => b.rank - a.rank);
  const trend = items.filter((i) => i.monthsToMajor !== null && i.monthsToMajor < 6 && i.rank < 2);
  const stale = items.filter((i) => !i.last || (Date.now() - new Date(i.last.date).getTime()) / 86400000 > 45);
  const Row = ({ i, right }) => (
    <button className="okrow" onClick={() => go("hist", { eqId: i.eq.id })}>
      <span style={{ width: 8, height: 8, borderRadius: 4, background: LEVELS[i.level].color }} />
      <span className="grow ellipsis" style={{ fontSize: 14 }}>{i.eq.name}</span>{right}
    </button>
  );
  return (
    <>
      {!crit.length && !trend.length && !stale.length && <Empty icon="check" title="Sin alertas" text="Todo dentro de los umbrales." />}
      {crit.length > 0 && <section className="in"><h2 className="h2" style={{ margin: "4px 2px 4px" }}>POR UMBRAL · {crit.length}</h2>{crit.map((i) => <Row key={i.eq.id} i={i} right={<Pill level={i.level} />} />)}</section>}
      {trend.length > 0 && <section className="in"><h2 className="h2" style={{ margin: "12px 2px 4px" }}>POR TENDENCIA · {trend.length}</h2>{trend.map((i) => <Row key={i.eq.id} i={i} right={<span className="mono muted" style={{ fontSize: 12 }}>~{Math.max(1, Math.round(i.monthsToMajor))} m a {th.deltaTMayor} °C</span>} />)}</section>}
      {stale.length > 0 && <section className="in"><h2 className="h2" style={{ margin: "12px 2px 4px" }}>SIN LECTURA +45 DÍAS · {stale.length}</h2>{stale.map((i) => <Row key={i.eq.id} i={i} right={<span className="muted" style={{ fontSize: 12 }}>{i.last ? i.last.date.slice(0, 10) : "nunca"}</span>} />)}</section>}
    </>
  );
}

function Reports({ ctx }) {
  const { items, data, th, session } = ctx;
  const toast = useToast();
  const d = new Date();
  const [from, setFrom] = useState(localDay(new Date(d.getFullYear(), d.getMonth(), 1)));
  const [to, setTo] = useState(localDay());
  const [plant, setPlant] = useState("");
  const [busy, setBusy] = useState(false);
  const scoped = plant ? items.filter((i) => i.eq.plantId === plant) : items;
  const ids = new Set(scoped.map((i) => i.eq.id));
  const rs = data.readings.filter((r) => ids.has(r.equipmentId));
  const n = rs.filter((r) => r.date.slice(0, 10) >= from && r.date.slice(0, 10) <= to).length;
  const quick = (days) => { const a = new Date(); a.setDate(a.getDate() - days); setFrom(localDay(a)); setTo(localDay()); };
  return (
    <>
      <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
        <button className="chip press" onClick={() => quick(7)}>7 días</button>
        <button className="chip press" onClick={() => quick(30)}>30 días</button>
        <button className="chip press" onClick={() => quick(90)}>Trimestre</button>
        <button className="chip press" onClick={() => quick(365)}>Año</button>
      </div>
      <div className="row" style={{ gap: 8 }}>
        <Field label="Desde"><input className="input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
        <Field label="Hasta"><input className="input" type="date" value={to} onChange={(e) => setTo(e.target.value)} /></Field>
      </div>
      {data.plants.length > 1 && <Field label="Planta"><select className="select" value={plant} onChange={(e) => setPlant(e.target.value)}><option value="">Todas</option>{data.plants.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>}
      <div className="card" style={{ fontSize: 14 }}><span className="mono" style={{ fontWeight: 700 }}>{n}</span> lecturas en el rango</div>
      <button className="btn press" disabled={!n} aria-disabled={!n} onClick={() => openHtml(htmlReport({ orgName: session.orgName, items: scoped, readings: rs, from, to, th, plantName: (data.plants.find((p) => p.id === plant) || {}).name }))}><Icon n="file" size={18} /> Informe (PDF)</button>
      <button className="btn sec press" disabled={!n || busy} aria-disabled={!n || busy} onClick={async () => { setBusy(true); try { await excelReport({ items: scoped, readings: rs, from, to, th, orgName: session.orgName }); toast("Excel descargado"); } catch (e) { toast("Error: " + e.message, "bad"); } setBusy(false); }}>
        {busy ? "Generando…" : "Exportar Excel"}
      </button>
      <p className="muted" style={{ fontSize: 12 }}>El informe se abre en una pestaña nueva: usa “Guardar PDF / Imprimir”. Incluye evaluación, diagnóstico y acciones por equipo.</p>
    </>
  );
}

function AISettings() {
  const toast = useToast();
  const [c, setC] = useState(getAIConfig());
  const [show, setShow] = useState(false);
  const save = (n) => { setC(n); setAIConfig(n); };
  return (
    <>
      <div className="card in" style={{ fontSize: 14, display: "flex", flexDirection: "column", gap: 6 }}>
        <b>IA local · siempre activa</b>
        <span className="muted">Diagnóstico por reglas (NETA, NEMA), proyección de tendencias, revisión de lecturas y resumen del día. Gratis y sin internet.</span>
      </div>
      <div className="card in" style={{ display: "flex", flexDirection: "column", gap: 10, animationDelay: "40ms" }}>
        <b style={{ fontSize: 14 }}>IA avanzada con Gemini · opcional</b>
        <span className="muted" style={{ fontSize: 13 }}>Analiza fotos, lee placas y responde preguntas abiertas. Usa la capa gratuita de Google: crea tu clave en aistudio.google.com → “Get API key”. La clave queda solo en este dispositivo.</span>
        <div className="row" style={{ gap: 6 }}>
          <input className="input mono grow" type={show ? "text" : "password"} value={c.apiKey || ""} onChange={(e) => save({ ...c, apiKey: e.target.value.trim() })} placeholder="Pega tu API key" aria-label="API key de Gemini" style={{ background: "var(--s2)", fontSize: 14 }} />
          <button className="icon-btn press" onClick={() => setShow(!show)} aria-label={show ? "Ocultar" : "Mostrar"}><Icon n="eye" d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" size={18} /></button>
        </div>
        <Field label="Modelo"><input className="input mono" value={c.model} onChange={(e) => save({ ...c, model: e.target.value.trim() || "gemini-2.5-flash" })} style={{ background: "var(--s2)", fontSize: 14 }} /></Field>
      </div>
      <div className="card in row" style={{ justifyContent: "space-between", animationDelay: "80ms" }}>
        <span style={{ fontSize: 14 }}><b>Respuestas por voz</b><br /><span className="muted" style={{ fontSize: 12 }}>El asistente lee sus respuestas</span></span>
        <Seg options={[{ v: true, l: "Sí" }, { v: false, l: "No" }]} value={c.voice} onChange={(v) => { save({ ...c, voice: v }); if (v) setTimeout(() => speak("Voz activada."), 50); toast(v ? "Voz activada" : "Voz desactivada"); }} />
      </div>
    </>
  );
}

function Thresholds({ ctx }) {
  const { th, store } = ctx;
  const toast = useToast();
  const [t, setT] = useState(th);
  const dirty = JSON.stringify(t) !== JSON.stringify(th);
  const S = (k, label, unit, step = 1) => (
    <div className="row" style={{ justifyContent: "space-between", minHeight: 56, borderTop: "1px solid var(--s2)" }}>
      <span style={{ fontSize: 14 }}>{label}</span>
      <Stepper value={t[k]} unit={unit} step={step} onChange={(v) => setT({ ...t, [k]: v })} />
    </div>
  );
  return (
    <>
      <section className="card in"><h2 className="h2" style={{ marginBottom: 4 }}>DESBALANCE DE CORRIENTE · NEMA MG1</h2>{S("currentWarn", "Precaución desde", "%")}{S("currentCrit", "Crítico desde", "%")}</section>
      <section className="card in"><h2 className="h2" style={{ marginBottom: 4 }}>DESBALANCE DE TENSIÓN</h2>{S("voltageWarn", "Precaución desde", "%", 0.5)}{S("voltageCrit", "Crítico desde", "%", 0.5)}</section>
      <section className="card in"><h2 className="h2" style={{ marginBottom: 4 }}>ΔT ENTRE FASES · NETA</h2>{S("deltaTBaja", "Posible deficiencia", "°C")}{S("deltaTMedia", "Deficiencia probable", "°C")}{S("deltaTMayor", "Deficiencia mayor", "°C")}{S("deltaTCritico", "Crítico sobre", "°C")}</section>
      <div className={"wrap" + (dirty ? "" : " gone")}><div>
        <div className="row" style={{ gap: 8 }}>
          <button className="btn sec press" style={{ flex: 1 }} onClick={() => setT(th)}>Descartar</button>
          <button className="btn press" style={{ flex: 1 }} onClick={async () => { await store.saveSettings({ thresholds: t }); toast("Umbrales guardados"); }}>Guardar</button>
        </div>
      </div></div>
      <button className="btn ghost press muted" onClick={() => setT({ ...DEFAULT_THRESHOLDS })}>Restaurar valores por defecto</button>
      <p className="muted" style={{ fontSize: 12 }}>Los cambios se aplican también a las lecturas anteriores, porque la evaluación se calcula en vivo.</p>
    </>
  );
}

function Plants({ ctx }) {
  const { data, store, items } = ctx;
  const toast = useToast();
  const [np, setNp] = useState("");
  const [nc, setNc] = useState({});
  const inUse = (ccmId) => items.some((i) => i.eq.ccmId === ccmId);
  return (
    <>
      {data.plants.map((p) => (
        <section key={p.id} className="card in" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <b className="display" style={{ fontSize: 16 }}>{p.name}</b>
            {!data.ccms.some((c) => c.plantId === p.id) && !items.some((i) => i.eq.plantId === p.id) && <button className="icon-btn press" onClick={() => store.remove("plants", p.id)} aria-label="Eliminar planta"><Icon n="trash" size={17} /></button>}
          </div>
          {data.ccms.filter((c) => c.plantId === p.id).sort((x, y) => String(x.name).localeCompare(String(y.name), "es", { numeric: true })).map((c) => (
            <div key={c.id} className="row" style={{ minHeight: 40, borderTop: "1px solid var(--s2)" }}>
              <span className="grow" style={{ fontSize: 14 }}>{c.name}</span>
              <span className="muted" style={{ fontSize: 12 }}>{items.filter((i) => i.eq.ccmId === c.id).length} equipos</span>
              {!inUse(c.id) && <button className="icon-btn press" style={{ width: 36, height: 36 }} onClick={() => store.remove("ccms", c.id)} aria-label={"Eliminar " + c.name}><Icon n="close" size={15} /></button>}
            </div>
          ))}
          <form className="row" style={{ gap: 6 }} onSubmit={async (e) => { e.preventDefault(); const v = (nc[p.id] || "").trim(); if (!v) return; await store.add("ccms", { name: v, plantId: p.id }); setNc({ ...nc, [p.id]: "" }); toast("CCM agregado"); }}>
            <input className="input grow" value={nc[p.id] || ""} onChange={(e) => setNc({ ...nc, [p.id]: e.target.value })} placeholder="Nuevo CCM o área" style={{ background: "var(--s2)", height: 44 }} />
            <button className="icon-btn light press" aria-label="Agregar CCM"><Icon n="plus" /></button>
          </form>
        </section>
      ))}
      <form className="row" style={{ gap: 6 }} onSubmit={async (e) => { e.preventDefault(); if (!np.trim()) return; await store.add("plants", { name: np.trim() }); setNp(""); toast("Planta creada"); }}>
        <input className="input grow" value={np} onChange={(e) => setNp(e.target.value)} placeholder="Nueva planta" />
        <button className="btn press" style={{ height: 50 }}>Agregar</button>
      </form>
    </>
  );
}

function Users({ ctx }) {
  const { data, store, session } = ctx;
  const toast = useToast();
  const copy = async () => { try { await navigator.clipboard.writeText(session.inviteCode); toast("Código copiado"); } catch (e) { toast(session.inviteCode, "warn"); } };
  return (
    <>
      {ctx.readOnly ? <p className="muted in" style={{ fontSize: 13 }}>Las cuentas nuevas se crean desde la app inicial. Aquí puedes cambiar el rol de cada usuario.</p> : <div className="card in" style={{ background: "var(--tint-ai)", display: "flex", flexDirection: "column", gap: 6 }}>
        <span className="muted" style={{ fontSize: 12 }}>CÓDIGO DE LA EMPRESA</span>
        <div className="row" style={{ justifyContent: "space-between" }}>
          <span className="display" style={{ fontSize: 28, letterSpacing: ".12em", color: "var(--lilac)" }}>{session.inviteCode || "—"}</span>
          <button className="icon-btn press" onClick={copy} aria-label="Copiar código"><Icon n="copy" size={18} /></button>
        </div>
        <span className="muted" style={{ fontSize: 13 }}>Tus técnicos lo escriben al crear su cuenta (“Unirme con código”).</span>
      </div>}
      {data.users.map((u) => (
        <div key={u.id} className="card in row" style={{ justifyContent: "space-between" }}>
          <span style={{ minWidth: 0 }}><b style={{ fontSize: 14 }}>{u.name}</b>{u.id === session.uid && <span className="muted"> · tú</span>}<br /><span className="muted ellipsis" style={{ fontSize: 12 }}>{u.email}</span></span>
          <Seg options={[{ v: "tecnico", l: "Técnico" }, { v: "admin", l: "Admin" }]} value={u.role} onChange={async (v) => { if (u.id === session.uid && v !== "admin" && data.users.filter((x) => x.role === "admin").length < 2) return toast("Debe quedar al menos un admin", "warn"); await store.setRole(u.id, v); toast("Rol actualizado"); }} />
        </div>
      ))}
    </>
  );
}

function Look({ ctx }) {
  const { prefs, updatePrefs } = ctx;
  const THEMES = [
    { v: "cristal", l: "Cristal", d: "Vidrio líquido sobre luces difusas. Día y noche.", sw: ["#07080B", "#3B3FD8", "#0E7C74", "#FFB86B"] },
    { v: "expresiva", l: "Expresiva", d: "Oscura, bloques de color, tipografía grande.", sw: ["#111214", "#B9A6FF", "#8FD3FF", "#FFC6A8"] },
    { v: "instrumento", l: "Instrumento", d: "Estilo multímetro: LCD verde, números mono.", sw: ["#0C0E0C", "#B8F15A", "#7FE3C9", "#FFC857"] }
  ];
  return (
    <>
      <h2 className="h2">TEMA</h2>
      {THEMES.map((t) => (
        <button key={t.v} className="card press row" onClick={() => updatePrefs({ theme: t.v })} style={{ border: prefs.theme === t.v ? "1.5px solid var(--text)" : "1.5px solid transparent", textAlign: "left", gap: 12 }} aria-pressed={prefs.theme === t.v}>
          <span className="row" style={{ gap: 0 }}>{t.sw.map((c, k) => <span key={c} style={{ width: 22, height: 38, background: c, borderRadius: k === 0 ? "8px 0 0 8px" : k === 3 ? "0 8px 8px 0" : 0 }} />)}</span>
          <span className="grow"><b>{t.l}</b><br /><span className="muted" style={{ fontSize: 12 }}>{t.d}</span></span>
          {prefs.theme === t.v && <Icon n="check" />}
        </button>
      ))}
      <div className={"wrap" + (prefs.theme === "cristal" ? "" : " gone")}><div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <h2 className="h2" style={{ marginTop: 8 }}>DÍA Y NOCHE</h2>
        <Seg options={[{ v: "auto", l: "Automático" }, { v: "light", l: "Día" }, { v: "dark", l: "Noche" }]} value={prefs.mode} onChange={(v) => updatePrefs({ mode: v })} />
        <p className="muted" style={{ fontSize: 12 }}>Automático sigue el modo claro u oscuro de tu celular. También puedes cambiarlo desde Inicio con el sol o la luna.</p>
      </div></div>
      <h2 className="h2" style={{ marginTop: 8 }}>APERTURA</h2>
      <Seg options={[{ v: "ondas", l: "Ondas" }, { v: "ninguna", l: "Sin apertura" }]} value={prefs.intro} onChange={(v) => updatePrefs({ intro: v })} />
      <p className="muted" style={{ fontSize: 12 }}>La apertura completa se ve una vez al día; las demás veces es corta.</p>
    </>
  );
}

export default function More({ ctx }) {
  const { isAdmin, session } = ctx;
  const [view, setView] = useState(null);
  const V = { account: Account, alerts: Alerts, reports: Reports, ai: AISettings, thresholds: Thresholds, plants: Plants, users: Users, look: Look }[view];
  const item = MENU.find((m) => m.id === view);
  if (V) {
    return (
      <main className="screen">
        <Header eyebrow="Más" title={item.label} onBack={() => setView(null)} />
        <V ctx={ctx} />
      </main>
    );
  }
  const visible = MENU.filter((m) => !m.admin || isAdmin);
  return (
    <main className="screen">
      <Header eyebrow={session.orgName} title="Más" />
      <div className="menu in">
        {visible.map((m) => (
          <button key={m.id} className="menu-row" onClick={() => setView(m.id)}>
            <span className="ic" style={{ background: m.color }}><Icon n={m.icon} size={18} /></span>
            <span className="grow" style={{ fontWeight: 600 }}>{m.label}</span>
            <Icon n="chev" size={16} style={{ color: "var(--muted)" }} />
          </button>
        ))}
      </div>
      {!isAdmin && <p className="muted" style={{ fontSize: 12 }}>Umbrales, plantas y usuarios los gestiona el administrador.</p>}
    </main>
  );
}
