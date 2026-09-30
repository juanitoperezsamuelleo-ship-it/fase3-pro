import React, { useMemo, useState } from "react";
import { LEVELS, fmt, relDays, localDay } from "../lib/calc.js";
import { sortByRisk } from "../lib/analysis.js";
import { daySummary, diagnoseItem } from "../lib/ai.js";
import { Icon, Spark, Empty } from "../ui.jsx";

const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const MES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

export function EqRow({ it, ctx, onClick, th }) {
  const ccm = ctx.data.ccms.find((c) => c.id === it.eq.ccmId);
  const d = diagnoseItem(it, th)[0];
  const L = LEVELS[it.level];
  return (
    <button className="hotrow in" onClick={onClick}>
      <span className="sev" style={{ width: it.rank >= 3 ? 5 : 3, background: L.color }} />
      <span style={{ minWidth: 0 }}>
        <span className="ellipsis" style={{ display: "block", fontWeight: 700, fontSize: 14 }}>{it.eq.name}</span>
        <span className="ellipsis muted" style={{ display: "block", fontSize: 12 }}>{d ? d.title : it.eq.typeLabel || it.T.label}{ccm ? " · " + ccm.name : ""} · {it.readings.length} lect.</span>
      </span>
      <Spark values={it.series.map((s) => s.dT)} color={L.color} />
      <span style={{ textAlign: "right" }}>
        <span className="mono" style={{ display: "block", fontWeight: 600, fontSize: 15 }}>{it.ev && it.ev.dT ? fmt(it.ev.dT.value) + "°" : "—"}</span>
        <span className="muted" style={{ fontSize: 11 }}>{relDays(it.last && it.last.date)}</span>
      </span>
    </button>
  );
}

export default function Home({ ctx }) {
  const { session, items, data, go, th } = ctx;
  const [showOk, setShowOk] = useState(false);
  const sorted = useMemo(() => sortByRisk(items), [items]);
  const hot = sorted.filter((i) => i.rank >= 2 || (i.monthsToMajor !== null && i.monthsToMajor < 6));
  const ok = sorted.filter((i) => !hot.includes(i));
  const sum = useMemo(() => daySummary(items, data.readings, data.users), [items, data.readings, data.users]);
  const month = localDay().slice(0, 7);
  const monthCount = data.readings.filter((r) => (r.date || "").startsWith(month)).length;
  const now = new Date();

  return (
    <main className="screen">
      <div className="hdr in">
        <div style={{ minWidth: 0 }}>
          <div className="eyebrow" style={{ marginBottom: 4 }}>{session.orgName} · {DIAS[now.getDay()]} {now.getDate()} {MES[now.getMonth()]}</div>
          <h1 className="title">Hola, {(session.name || "").split(" ")[0] || "técnico"}</h1>
        </div>
        <div className="row" style={{ gap: 8 }}>
        {ctx.prefs.theme === "cristal" && (
          <button className="icon-btn press" aria-label={ctx.mode === "dark" ? "Cambiar a modo día" : "Cambiar a modo noche"} onClick={() => ctx.updatePrefs({ mode: ctx.mode === "dark" ? "light" : "dark" })}>
            <Icon n={ctx.mode === "dark" ? "sun" : "moon"} size={18} />
          </button>
        )}
        <button className="icon-btn press" aria-label="Asistente" onClick={() => go("ai")} style={{ background: "radial-gradient(circle at 35% 30%, #fff 0, #B9A6FF 35%, #6B5BD6 75%)", color: "#111214", boxShadow: "0 0 24px rgba(185,166,255,.45)" }}>
          <Icon n="spark" size={18} />
        </button>
        </div>
      </div>

      <div className="in" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, animationDelay: "40ms" }}>
        {[
          { n: sum.crit, l: "Intervenir", c: "var(--crit)" },
          { n: sum.warn, l: "Precaución", c: "var(--warn)" },
          { n: monthCount, l: "Lecturas mes", c: "var(--text)" }
        ].map((k) => (
          <div key={k.l} className="card" style={{ padding: "12px 12px" }}>
            <div className="display" style={{ fontSize: 26, fontWeight: 600, color: k.n ? k.c : "var(--muted)" }}>{k.n}</div>
            <div className="muted" style={{ fontSize: 11, fontWeight: 600 }}>{k.l}</div>
          </div>
        ))}
      </div>

      <button className="card press in" onClick={() => go("ai")} style={{ border: 0, textAlign: "left", background: "linear-gradient(135deg,var(--tint-ai),var(--s1) 70%)", animationDelay: "80ms", display: "flex", flexDirection: "column", gap: 6 }}>
        <span className="row" style={{ gap: 8, color: "var(--lilac)", fontSize: 12, fontWeight: 700 }}><Icon n="spark" size={15} /> RESUMEN DEL DÍA</span>
        {sum.lines.slice(0, 3).map((l, k) => <span key={k} style={{ fontSize: 14, color: k ? "var(--muted)" : "var(--text)" }}>{l}</span>)}
        <span className="row" style={{ gap: 6, fontSize: 13, fontWeight: 700, marginTop: 2 }}>Preguntar al asistente <Icon n="chev" size={15} /></span>
      </button>

      <button className="btn press in" onClick={() => go("read")} style={{ animationDelay: "110ms" }}><Icon n="plus" /> Nueva lectura</button>

      {!items.length && <Empty icon="box" title="Aún no tienes equipos" text="Crea el primero para empezar a registrar lecturas." action={!ctx.readOnly && <button className="btn sec press" onClick={() => go("equip", { create: true })} style={{ height: 42 }}>Crear equipo</button>} />}

      {hot.length > 0 && (
        <section>
          <div className="row" style={{ justifyContent: "space-between", margin: "6px 2px 8px" }}>
            <h2 className="h2">REQUIEREN ATENCIÓN</h2>
            <span className="muted mono" style={{ fontSize: 11 }}>ΔT · tendencia</span>
          </div>
          {hot.map((it, k) => <div key={it.eq.id} style={{ animationDelay: 140 + k * 30 + "ms" }} className="in"><EqRow it={it} ctx={ctx} th={th} onClick={() => go("hist", { eqId: it.eq.id })} /></div>)}
        </section>
      )}

      {ok.length > 0 && (
        <section>
          <button className="row press" onClick={() => setShowOk(!showOk)} style={{ width: "100%", justifyContent: "space-between", background: "none", border: 0, padding: "6px 2px", color: "var(--muted)" }}>
            <h2 className="h2">SIN ALERTAS · {ok.length}</h2>
            <Icon n="chev" size={16} style={{ transform: showOk ? "rotate(90deg)" : "none", transition: "transform .15s var(--out)" }} />
          </button>
          <div className={"wrap" + (showOk ? "" : " gone")}><div>
            {ok.map((it) => (
              <button key={it.eq.id} className="okrow" onClick={() => go("hist", { eqId: it.eq.id })}>
                <span style={{ width: 8, height: 8, borderRadius: 4, background: LEVELS[it.level].color }} />
                <span className="grow ellipsis" style={{ fontSize: 14 }}>{it.eq.name}</span>
                <span className="muted" style={{ fontSize: 12 }}>{relDays(it.last && it.last.date)}</span>
              </button>
            ))}
          </div></div>
        </section>
      )}
    </main>
  );
}


