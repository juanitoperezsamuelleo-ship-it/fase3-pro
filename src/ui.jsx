import React, { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState } from "react";
import { LEVELS } from "./lib/calc.js";

/* ───────── Iconos (trazo 2 px) ───────── */
const P = {
  home: "M3 11 12 4l9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z",
  plus: "M12 5v14M5 12h14",
  box: "M4 7l8-4 8 4v10l-8 4-8-4zM4 7l8 4 8-4M12 11v10",
  chart: "M4 20V10M10 20V4M16 20v-7M22 20H2",
  dots: "M5 12h.01M12 12h.01M19 12h.01",
  back: "M15 18l-6-6 6-6",
  close: "M18 6 6 18M6 6l12 12",
  search: "M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3",
  camera: "M3 8h4l2-3h6l2 3h4v12H3zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
  check: "M5 12l5 5L20 7",
  trash: "M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3",
  edit: "M4 20h4L20 8l-4-4L4 16zM14 6l4 4",
  chev: "M9 6l6 6-6 6",
  spark: "M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6",
  mic: "M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3zM5 11a7 7 0 0 0 14 0M12 18v3",
  send: "M4 12 20 4l-6 16-3-7z",
  user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0",
  users: "M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21a7 7 0 0 1 14 0M16 3.5a4 4 0 0 1 0 7.5M18 14a6 6 0 0 1 4 7",
  bell: "M6 16V11a6 6 0 0 1 12 0v5l2 2H4zM10 21h4",
  file: "M6 3h8l4 4v14H6zM14 3v4h4M9 13h6M9 17h6",
  sliders: "M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0M14 4v4M8 10v4M16 16v4",
  factory: "M3 21V10l6 4V10l6 4V6l6 3v12z",
  palette: "M12 3a9 9 0 1 0 0 18c1 0 1.5-.7 1.5-1.5 0-1-1-1.2-1-2.2 0-.8.7-1.3 1.5-1.3H17a4 4 0 0 0 4-4c0-5-4-9-9-9zM7.5 12h.01M10 7.5h.01M15 7.5h.01",
  brain: "M9 4a3 3 0 0 0-3 3 3 3 0 0 0-2 5 3 3 0 0 0 2 5 3 3 0 0 0 6 1V5a3 3 0 0 0-3-1zM15 4a3 3 0 0 1 3 3 3 3 0 0 1 2 5 3 3 0 0 1-2 5 3 3 0 0 1-6 1",
  out: "M15 4h4v16h-4M10 17l5-5-5-5M15 12H3",
  up: "M7 17 17 7M9 7h8v8",
  info: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 11v5M12 8h.01",
  copy: "M8 8h12v12H8zM4 16V4h12",
  volume: "M4 9h4l5-4v14l-5-4H4zM17 9a4 4 0 0 1 0 6M19.5 6.5a8 8 0 0 1 0 11",
  mute: "M4 9h4l5-4v14l-5-4H4zM17 9l5 6M22 9l-5 6",
  image: "M4 5h16v14H4zM4 16l5-5 4 4 3-3 4 4M15 9h.01",
  sun: "M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4",
  moon: "M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"
};
export function Icon({ n, d, size = 20, w = 2, style }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0, ...style }}>
      <path d={d || P[n]} />
    </svg>
  );
}

export function Pill({ level, children }) {
  const L = LEVELS[level] || LEVELS.none;
  return <span className="pill" style={{ background: L.color }}>{children || L.short}</span>;
}

/* ───────── Aviso tipo isla ───────── */
const ToastCtx = createContext(() => {});
export const useToast = () => useContext(ToastCtx);
export function ToastHost({ children }) {
  const [t, setT] = useState(null);
  const timer = useRef();
  const show = useCallback((text, tone = "ok") => {
    clearTimeout(timer.current);
    setT({ text, tone, k: Date.now(), out: false });
    timer.current = setTimeout(() => {
      setT((x) => (x ? { ...x, out: true } : x));
      timer.current = setTimeout(() => setT(null), 160);
    }, 2200);
  }, []);
  const c = t && (t.tone === "ok" ? "var(--ok)" : t.tone === "bad" ? "var(--crit)" : "var(--warn)");
  return (
    <ToastCtx.Provider value={show}>
      {children}
      {t && (
        <div key={t.k} className={"island" + (t.out ? " out" : "")} role="status" aria-live="polite">
          <span style={{ width: 8, height: 8, borderRadius: 4, background: c }} />
          {t.text}
        </div>
      )}
    </ToastCtx.Provider>
  );
}

/* ───────── Hoja inferior con salida animada ───────── */
export function Sheet({ open, onClose, children, label }) {
  const [shown, setShown] = useState(open);
  const [out, setOut] = useState(false);
  useEffect(() => {
    if (open) { setShown(true); setOut(false); }
    else if (shown) { setOut(true); const t = setTimeout(() => { setShown(false); setOut(false); }, 190); return () => clearTimeout(t); }
  }, [open]); // eslint-disable-line
  useEffect(() => {
    if (!open) return;
    const k = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [open, onClose]);
  if (!shown) return null;
  return (
    <>
      <div className={"scrim" + (out ? " out" : "")} onClick={onClose} />
      <div className={"sheet" + (out ? " out" : "")} role="dialog" aria-modal="true" aria-label={label}>
        <div className="grab" />
        {children}
      </div>
    </>
  );
}

/* ───────── Pestañas con subrayado que se desliza ───────── */
export function Tabs({ items, value, onChange }) {
  const ref = useRef();
  const [ul, setUl] = useState({ x: 0, w: 0 });
  useLayoutEffect(() => {
    const el = ref.current && ref.current.querySelector('[aria-selected="true"]');
    if (el) setUl({ x: el.offsetLeft, w: el.offsetWidth });
  }, [value, items.length]);
  return (
    <div className="tabs" role="tablist" ref={ref}>
      {items.map((it) => (
        <button key={it.id} role="tab" aria-selected={value === it.id} onClick={() => onChange(it.id)}>
          {it.label}{it.count !== undefined && <span className="mono" style={{ fontSize: 11, color: "var(--muted)" }}>{it.count}</span>}
        </button>
      ))}
      <span className="ul" style={{ width: ul.w, transform: `translateX(${ul.x}px)` }} />
    </div>
  );
}

export function Header({ eyebrow, title, onBack, right }) {
  return (
    <div className="hdr in">
      <div className="row" style={{ alignItems: "flex-start", minWidth: 0 }}>
        {onBack && <button className="icon-btn press" onClick={onBack} aria-label="Volver" style={{ marginTop: 2 }}><Icon n="back" /></button>}
        <div style={{ minWidth: 0 }}>
          {eyebrow && <div className="eyebrow" style={{ marginBottom: 4 }}>{eyebrow}</div>}
          <h1 className="title">{title}</h1>
        </div>
      </div>
      {right}
    </div>
  );
}

export function Field({ label, children, style }) {
  return <label className="field" style={style}><span>{label}</span>{children}</label>;
}

export function Empty({ icon = "info", title, text, action }) {
  return (
    <div className="card in" style={{ textAlign: "center", padding: "28px 18px", display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
      <Icon n={icon} size={26} style={{ color: "var(--muted)" }} />
      <div style={{ fontWeight: 700 }}>{title}</div>
      {text && <div className="muted" style={{ fontSize: 13 }}>{text}</div>}
      {action}
    </div>
  );
}

/* ───────── Mini tendencia ───────── */
export function Spark({ values, color = "var(--text)", w = 58, h = 22 }) {
  const v = values.filter((x) => x !== null && Number.isFinite(x));
  if (v.length < 2) return <span />;
  const mn = Math.min(...v), mx = Math.max(...v);
  const pts = v.map((y, k) => `${(k / (v.length - 1)) * (w - 4) + 2},${h - 3 - ((y - mn) / (mx - mn || 1)) * (h - 6)}`).join(" ");
  return <svg width={w} height={h} aria-hidden="true"><polyline className="spark" points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

/* ───────── Gráfica de tendencias en ondas ─────────
   Curva suave (Catmull-Rom → Bézier) sin sobrepasar los valores reales entre puntos. */
function smooth(pts) {
  if (!pts.length) return "";
  if (pts.length < 3) return "M" + pts.map((p) => p.join(",")).join(" L");
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
    const lo = Math.min(p1[1], p2[1]), hi = Math.max(p1[1], p2[1]);
    const c1x = p1[0] + (p2[0] - p0[0]) / 6, c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c1y = Math.min(hi, Math.max(lo, p1[1] + (p2[1] - p0[1]) / 6));
    const c2y = Math.min(hi, Math.max(lo, p2[1] - (p3[1] - p1[1]) / 6));
    d += ` C${c1x},${c1y} ${c2x},${c2y} ${p2[0]},${p2[1]}`;
  }
  return d;
}

/* ───────── Gráfica de líneas ───────── */
export function LineChart({ series, labels, unit, height = 170, bands, delay = 0 }) {
  const gid = React.useId().replace(/:/g, "");
  const W = 340, H = height, pl = 30, pr = 8, pt = 10, pb = 22;
  const all = series.flatMap((s) => s.values).filter((x) => x !== null && Number.isFinite(x));
  if (!all.length || labels.length < 1) return <div className="muted" style={{ fontSize: 13, padding: 12 }}>Sin datos suficientes.</div>;
  let mn = Math.min(...all), mx = Math.max(...all);
  if (bands) bands.forEach((b) => { mx = Math.max(mx, Math.min(b.y, mx * 1.6 + 1)); });
  const pad = (mx - mn) * 0.15 || 1;
  mn -= pad; mx += pad;
  if (all.every((x) => x >= 0) && mn < 0) mn = 0;
  const n = labels.length;
  const X = (k) => pl + (n === 1 ? (W - pl - pr) / 2 : (k / (n - 1)) * (W - pl - pr));
  const Y = (y) => pt + (1 - (y - mn) / (mx - mn)) * (H - pt - pb);
  const ticks = [mn + (mx - mn) * 0.1, (mn + mx) / 2, mx - (mx - mn) * 0.1];
  const step = Math.max(1, Math.ceil(n / 5));
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={series.map((s) => s.name).join(", ")}>
      {ticks.map((t, k) => (
        <g key={k}><line className="gridl" x1={pl} x2={W - pr} y1={Y(t)} y2={Y(t)} style={{ stroke: "var(--line)", animationDelay: delay + k * 50 + "ms" }} /><text x={pl - 5} y={Y(t) + 3} textAnchor="end" fontSize="9" style={{ fill: "var(--muted)" }} fontFamily="JetBrains Mono">{t.toFixed(Math.abs(mx - mn) < 10 ? 1 : 0)}</text></g>
      ))}
      {bands && bands.filter((b) => b.y > mn && b.y < mx).map((b, k) => (
        <g key={"b" + k} className="bandl" style={{ animationDelay: delay + 500 + k * 90 + "ms" }}><line x1={pl} x2={W - pr} y1={Y(b.y)} y2={Y(b.y)} stroke={b.color} strokeDasharray="4 4" opacity=".7" /><text x={W - pr} y={Y(b.y) - 3} textAnchor="end" fontSize="9" fill={b.color}>{b.label}</text></g>
      ))}
      {labels.map((l, k) => (k % step === 0 || k === n - 1) && <text key={k} x={X(k)} y={H - 6} textAnchor="middle" fontSize="9" style={{ fill: "var(--muted)" }}>{l}</text>)}
      {series.map((s, si) => {
        const pts = s.values.map((y, k) => (y === null || !Number.isFinite(y) ? null : [X(k), Y(y)])).filter(Boolean);
        const d0 = delay + 120 + si * 110;
        const dur = 900;
        const last = pts[pts.length - 1];
        const curve = smooth(pts);
        const base = H - pb;
        const fillOp = series.length === 1 ? 0.38 : 0.16;
        return (
          <g key={si}>
            {pts.length > 1 && (
              <>
                <defs><linearGradient id={gid + si} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={s.color} stopOpacity={fillOp} /><stop offset="1" stopColor={s.color} stopOpacity="0" /></linearGradient></defs>
                <g className="wavefill" style={{ animationDelay: -si * 1.7 + "s" }}>
                  <path className="areaf" d={`${curve} L${last[0]},${base} L${pts[0][0]},${base} Z`} fill={`url(#${gid + si})`} style={{ animationDelay: d0 + dur * 0.55 + "ms" }} />
                </g>
                <path className="line" d={curve} pathLength="1200" stroke={s.color} style={{ animationDelay: d0 + "ms", animationDuration: dur + "ms" }} />
              </>
            )}
            {pts.map((p, k) => <circle key={k} className="dot" cx={p[0]} cy={p[1]} r={k === pts.length - 1 ? 3.5 : 1.8} fill={s.color} style={{ animationDelay: d0 + (pts.length > 1 ? (k / (pts.length - 1)) * dur * 0.9 : 0) + "ms" }} />)}
            {last && si === 0 && <circle className="pulse" cx={last[0]} cy={last[1]} r="3.5" fill="none" stroke={s.color} strokeWidth="1.5" style={{ animationDelay: d0 + dur + "ms" }} />}
          </g>
        );
      })}
      {unit && <text x={4} y={10} fontSize="9" style={{ fill: "var(--muted)" }}>{unit}</text>}
    </svg>
  );
}

export function Stepper({ value, onChange, step = 1, min = 0, max = 999, unit }) {
  const set = (v) => onChange(Math.max(min, Math.min(max, Math.round(v * 10) / 10)));
  return (
    <div className="row" style={{ gap: 6 }}>
      <button className="icon-btn press" style={{ width: 40, height: 40 }} onClick={() => set(value - step)} aria-label="Menos">−</button>
      <div className="mono" style={{ minWidth: 64, textAlign: "center", fontSize: 18, fontWeight: 600 }}>{String(value).replace(".", ",")}<span className="muted" style={{ fontSize: 12 }}> {unit}</span></div>
      <button className="icon-btn press" style={{ width: 40, height: 40 }} onClick={() => set(value + step)} aria-label="Más">+</button>
    </div>
  );
}

export function Seg({ options, value, onChange }) {
  return (
    <div className="row" style={{ gap: 6, flexWrap: "wrap" }} role="radiogroup">
      {options.map((o) => (
        <button key={o.v ?? o} role="radio" aria-checked={value === (o.v ?? o)} className="chip press" onClick={() => onChange(o.v ?? o)}>{o.l ?? o}</button>
      ))}
    </div>
  );
}

/* Número que cuenta hasta su valor (conserva prefijo y sufijo: "+0,8/m", "14,0°") */
export function CountUp({ text, dur = 800, delay = 0 }) {
  const m = /^([^\d-]*)(-?\d+(?:,\d+)?)(.*)$/.exec(String(text));
  const [v, setV] = React.useState(m ? 0 : null);
  React.useEffect(() => {
    if (!m) return;
    const target = parseFloat(m[2].replace(",", "."));
    const dec = (m[2].split(",")[1] || "").length;
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) { setV(target); return; }
    let raf, t0;
    const tick = (t) => {
      if (!t0) t0 = t;
      const k = Math.min(1, Math.max(0, (t - t0 - delay) / dur));
      const e = 1 - Math.pow(1 - k, 3);
      setV(+(target * e).toFixed(dec));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [text]); // eslint-disable-line
  if (!m) return <>{text}</>;
  const dec = (m[2].split(",")[1] || "").length;
  return <>{m[1]}{Number(v).toFixed(dec).replace(".", ",")}{m[3]}</>;
}

/* ───────── Filtros: planta · CCM / ubicación · búsqueda (compartidos entre pantallas) ───────── */
const byName = (a, b) => String(a.name).localeCompare(String(b.name), "es", { numeric: true });
export function applyFilter(items, filter, data) {
  const q = (filter.q || "").trim().toLowerCase();
  const ccmName = {};
  const plantName = {};
  if (data) { data.ccms.forEach((c) => { ccmName[c.id] = String(c.name || "").toLowerCase(); }); data.plants.forEach((p) => { plantName[p.id] = String(p.name || "").toLowerCase(); }); }
  return items.filter((i) => (!filter.plantId || i.eq.plantId === filter.plantId) && (!filter.ccmId || i.eq.ccmId === filter.ccmId) &&
    (!q || i.eq.name.toLowerCase().includes(q) || String(i.eq.typeLabel || "").toLowerCase().includes(q) || (ccmName[i.eq.ccmId] || "").includes(q) || (plantName[i.eq.plantId] || "").includes(q)));
}
export function FilterBar({ ctx, placeholder = "Buscar por equipo o CCM…", count }) {
  const { filter, setFilter, data } = ctx;
  const plants = data.plants.slice().sort(byName);
  const ccms = data.ccms.filter((c) => !filter.plantId || c.plantId === filter.plantId).sort(byName);
  const active = filter.plantId || filter.ccmId || filter.q;
  return (
    <div className="filters in" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {(plants.length > 0 || ccms.length > 0) && (
        <div className="row" style={{ gap: 8 }}>
          <select className="select grow" value={filter.plantId} onChange={(e) => setFilter({ ...filter, plantId: e.target.value, ccmId: "" })} aria-label="Planta" style={{ height: 46, fontSize: 14 }}>
            <option value="">Todas las plantas</option>
            {plants.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <select className="select grow" value={filter.ccmId} onChange={(e) => setFilter({ ...filter, ccmId: e.target.value })} aria-label="CCM o ubicación" style={{ height: 46, fontSize: 14 }}>
            <option value="">Todos los CCM</option>
            {ccms.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      )}
      <label className="row card" style={{ padding: "0 6px 0 14px", height: 48 }}>
        <Icon n="search" size={18} style={{ color: "var(--muted)" }} />
        <input className="grow" type="search" value={filter.q} onChange={(e) => setFilter({ ...filter, q: e.target.value })} placeholder={placeholder} aria-label="Buscar equipo" style={{ background: "none", border: 0, height: 46, outline: "none", fontSize: 16, minWidth: 0 }} />
        {count !== undefined && <span className="mono muted" style={{ fontSize: 12, padding: "0 6px" }}>{count}</span>}
        {active && <button className="icon-btn press" style={{ width: 36, height: 36 }} onClick={() => setFilter({ plantId: "", ccmId: "", q: "" })} aria-label="Limpiar filtros"><Icon n="close" size={15} /></button>}
      </label>
    </div>
  );
}

export function ShowMore({ total, shown, onMore }) {
  if (shown >= total) return null;
  return <button className="btn sec press" style={{ height: 44, width: "100%" }} onClick={onMore}>Mostrar más ({total - shown})</button>;
}

/* ───────── Chispa: el asistente, en vidrio (tema Cristal) ─────────
   mood: "ok" · "listen" · "think" · "talk" · "happy" · "worry" · "alert".
   Vida propia: respira, parpadea, mira a los lados, suelta chispazos, se duerme si nadie lo usa.
   Sigue con los ojos el dedo o el mouse y, en el celular, la inclinación del teléfono (sin cámara).
   Gestos de una vez con ref.current.gesture("hop" | "tap" | "nod" | "no" | "tilt" | "zap" | "wink" | "wiggle"). */
const CH = { subs: new Set(), on: false, askedTilt: false };
const chReduce = () => typeof window !== "undefined" && window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
function chStart() {
  if (CH.on || typeof window === "undefined") return;
  CH.on = true;
  let raf = 0, px = 0, py = 0;
  const pt = (e) => { px = e.clientX; py = e.clientY; if (!raf) raf = requestAnimationFrame(() => { raf = 0; CH.subs.forEach((s) => s.point(px, py)); }); };
  window.addEventListener("pointermove", pt, { passive: true });
  window.addEventListener("pointerdown", pt, { passive: true });
  window.addEventListener("deviceorientation", (e) => {
    if (e.gamma == null) return;
    const x = Math.max(-1, Math.min(1, e.gamma / 25)), y = Math.max(-1, Math.min(1, ((e.beta || 0) - 40) / 25));
    CH.subs.forEach((s) => s.tilt(x, y));
  });
}
function chAskTilt() {
  // iPhone pide permiso para leer la inclinación; se pide la primera vez que tocan a Chispa
  if (CH.askedTilt) return;
  CH.askedTilt = true;
  const D = typeof window !== "undefined" && window.DeviceOrientationEvent;
  if (D && typeof D.requestPermission === "function") D.requestPermission().catch(() => {});
}
const CH_MOOD = { ok: "idle", idle: "idle", listen: "listen", think: "think", talk: "talk", happy: "happy", worry: "worry", alert: "alert" };

export const Chispa = React.forwardRef(function Chispa({ mood = "ok", size = 44, label = "Chispa", style, talking = false, alive = true, sleepAfter = 45000, onClick, roam = 3, turn = 18, float = 3, shadow = false }, ref) {
  const k = "ch" + React.useId().replace(/[^a-zA-Z0-9]/g, "");
  const svg = useRef(), gaze = useRef(), wrap = useRef(), shade = useRef();
  // Cuerpo: posición y giro actuales (m.x, m.ry…) y hacia dónde van (m.tx, m.try…); spin = inicio de una vuelta completa
  const M = useRef({ x: 0, y: 0, ry: 0, rx: 0, tx: 0, ty: 0, try: 0, trx: 0, spin: -1, lastPoint: 0, lastTilt: 0 });
  const base = CH_MOOD[mood] || "idle";
  const [sleeping, setSleeping] = useState(false);
  const live = useRef({}); live.current = { base, sleeping, talking };
  const lastAct = useRef(Date.now());
  const gesture = useCallback((g) => {
    const el = svg.current;
    if (!el || chReduce()) return;
    if (g === "spin") { M.current.spin = performance.now(); return; }
    el.classList.remove("g-" + g); void el.getBoundingClientRect(); el.classList.add("g-" + g);
    setTimeout(() => el.classList.remove("g-" + g), g === "tilt" ? 1250 : 900);
  }, []);
  React.useImperativeHandle(ref, () => ({ gesture }), [gesture]);
  const wake = () => { lastAct.current = Date.now(); if (live.current.sleeping) { setSleeping(false); gesture("hop"); } };
  useEffect(() => {
    if (!alive || chReduce()) return;
    chStart();
    let lastPoint = 0;
    const setGaze = (x, y) => { const s = live.current; if (s.sleeping || s.base === "think" || !gaze.current) return; gaze.current.style.transform = `translate(${x.toFixed(2)}px,${y.toFixed(2)}px)`; };
    const sub = {
      point(x, y) {
        const el = wrap.current; if (!el) return;
        const r = el.getBoundingClientRect(); if (!r.width) return;
        const dx = x - (r.left + r.width / 2), dy = y - (r.top + r.height * 0.55), d = Math.hypot(dx, dy) || 1, m = Math.min(1, d / 260);
        lastPoint = Date.now();
        setGaze((dx / d) * 6 * m, (dy / d) * 4.5 * m);
        const c = (v) => Math.max(-1, Math.min(1, v)), nx = c(dx / 220), ny = c(dy / 260), B = M.current;
        // hacia abajo se mueve poco para no tapar lo que hay debajo
        if (!live.current.sleeping) { B.tx = nx * roam; B.ty = ny * roam * (ny > 0 ? 0.18 : 0.5); B.try = nx * turn; B.trx = -ny * turn * 0.6; }
        B.lastPoint = performance.now();
        if (Date.now() - lastAct.current > 800) wake(); else lastAct.current = Date.now();
      },
      tilt(x, y) {
        if (Date.now() - lastPoint < 1500) return;
        setGaze(x * 6, y * 4.5);
        const B = M.current;
        if (!live.current.sleeping) { B.tx = x * roam * 0.6; B.ty = y * roam * 0.3; B.try = x * turn; B.trx = -y * turn * 0.5; }
        B.lastTilt = performance.now();
      }
    };
    CH.subs.add(sub);
    let next = Date.now() + 2500;
    const iv = setInterval(() => {
      const s = live.current, now = Date.now();
      if (document.hidden) return;
      if (!s.sleeping && sleepAfter && now - lastAct.current > sleepAfter && (s.base === "idle" || s.base === "happy")) { setSleeping(true); return; }
      if (s.sleeping || s.base === "think" || now < next) return;
      const r = Math.random();
      if (r < 0.4 && now - lastPoint > 1500 && gaze.current) {
        gaze.current.style.transform = `translate(${Math.random() < 0.5 ? -6 : 6}px,${(Math.random() * 4 - 2).toFixed(1)}px)`;
        setTimeout(() => { if (gaze.current && Date.now() - lastPoint > 1500) gaze.current.style.transform = ""; }, 900);
      } else if (r < 0.62) gesture("zap");
      else if (r < 0.74) gesture("tilt");
      else if (r < 0.8) gesture("spin");
      next = now + 3500 + Math.random() * 4500;
    }, 700);
    // Flotar y seguir con el cuerpo: se mueve suave, se inclina al desplazarse y a veces da una vuelta
    let raf = 0;
    const t0 = performance.now();
    const loop = (now) => {
      raf = requestAnimationFrame(loop);
      if (document.hidden || !svg.current) return;
      const B = M.current, s = live.current, t = (now - t0) / 1000;
      if (now - B.lastPoint > 2500 && now - B.lastTilt > 700) { B.tx = B.ty = B.try = B.trx = 0; }
      const px = B.x, kk = 0.07;
      B.x += (B.tx - B.x) * kk; B.y += (B.ty - B.y) * kk; B.ry += (B.try - B.ry) * kk; B.rx += (B.trx - B.rx) * kk;
      const vx = B.x - px;
      const fa = s.sleeping ? float * 0.4 : s.talking ? float * 1.2 : float;
      const sp = s.sleeping ? 0.5 : s.talking ? 1.9 : 1;
      const fy = Math.sin(t * 1.25 * sp) * fa, fx = Math.sin(t * 0.62 * sp) * fa * 0.9;
      const rz = Math.sin(t * 0.85) * 2.5 + vx * 1.6;
      let spin = 0;
      if (B.spin >= 0) { const p = (now - B.spin) / 950; if (p >= 1) B.spin = -1; else spin = (1 - Math.pow(1 - p, 3)) * 360; }
      svg.current.style.transform = `translate3d(${(B.x + fx).toFixed(2)}px,${(B.y + fy).toFixed(2)}px,0) rotateY(${(B.ry + spin).toFixed(2)}deg) rotateX(${B.rx.toFixed(2)}deg) rotateZ(${rz.toFixed(2)}deg)`;
      if (shade.current) { const lift = fa ? (fa - fy) / (2 * fa) : 0; shade.current.style.transform = `translateX(${(B.x + fx).toFixed(1)}px) scale(${(1 - lift * 0.3).toFixed(3)})`; shade.current.style.opacity = (0.9 - lift * 0.45).toFixed(2); }
    };
    raf = requestAnimationFrame(loop);
    return () => { CH.subs.delete(sub); clearInterval(iv); cancelAnimationFrame(raf); };
  }, [alive, sleepAfter, gesture, roam, turn, float]); // eslint-disable-line
  useEffect(() => { if (base !== "idle" && base !== "happy") { lastAct.current = Date.now(); setSleeping(false); } }, [base]);
  const state = sleeping ? "sleep" : base;
  const tap = (e) => { chAskTilt(); wake(); const r = Math.random(); gesture(r < 0.35 ? "tap" : r < 0.7 ? "hop" : "spin"); setTimeout(() => gesture("zap"), 250); if (onClick) onClick(e); };
  const moving = alive && !chReduce();
  return (
    <span ref={wrap} className={"chispa-wrap" + (moving ? " alive" : "")} style={{ width: size, height: size * 0.94, perspective: Math.round(size * 7) + "px", ...style }}>
    {shadow && <span ref={shade} className="ch-shadow" aria-hidden="true" />}
    <svg ref={svg} className={"chispa" + (talking ? " talking" : "")} data-s={state} viewBox="0 0 160 150" width="100%" height="100%" role="img" aria-label={label || undefined} aria-hidden={label ? undefined : true} onClick={tap}>
      <defs>
        <linearGradient id={k + "b"} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#FFD29A" stopOpacity=".95" /><stop offset=".55" stopColor="#FFAE63" stopOpacity=".88" /><stop offset="1" stopColor="#F0873A" stopOpacity=".82" /></linearGradient>
        <radialGradient id={k + "s"} cx=".3" cy=".18" r=".55"><stop offset="0" stopColor="#fff" stopOpacity=".85" /><stop offset="1" stopColor="#fff" stopOpacity="0" /></radialGradient>
        <linearGradient id={k + "f"} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#1B1D26" /><stop offset="1" stopColor="#090A0E" /></linearGradient>
      </defs>
      <g className="ch-root"><g className="ch-bod">
        <circle className="ch-ring" cx="80" cy="18" r="22" /><circle className="ch-ring" cx="80" cy="18" r="22" />
        <rect className="ch-prong" x="60" y="6" width="11" height="28" rx="5.5" fill="rgba(30,32,40,.9)" stroke="rgba(255,255,255,.45)" strokeWidth="1" />
        <rect className="ch-prong" x="89" y="6" width="11" height="28" rx="5.5" fill="rgba(30,32,40,.9)" stroke="rgba(255,255,255,.45)" strokeWidth="1" />
        <path className="ch-zap" d="M71 15 L76 8 L79 15 L83 6 L89 13" />
        <rect x="22" y="28" width="116" height="102" rx="36" fill={`url(#${k}b)`} />
        <rect x="22" y="28" width="116" height="102" rx="36" fill={`url(#${k}s)`} />
        <rect x="22.75" y="28.75" width="114.5" height="100.5" rx="35.25" fill="none" stroke="rgba(255,255,255,.7)" strokeWidth="1.5" />
        <path d="M40 124c18 6 62 6 80 0" stroke="rgba(120,50,0,.22)" strokeWidth="3" fill="none" strokeLinecap="round" />
        <rect x="38" y="52" width="84" height="58" rx="20" fill={`url(#${k}f)`} stroke="rgba(255,255,255,.18)" strokeWidth="1" />
        <path d="M46 60c8-4 22-5 32-4" stroke="rgba(255,255,255,.14)" strokeWidth="3" fill="none" strokeLinecap="round" />
        <g className="ch-face"><g className="ch-gaze" ref={gaze}>
          <path className="ch-brow ch-bl" d="M54 62 L68 66" /><path className="ch-brow ch-br" d="M106 62 L92 66" />
          <g className="ch-en"><rect className="ch-eye" x="57" y="68" width="12" height="20" rx="6" /><rect className="ch-eye" x="91" y="68" width="12" height="20" rx="6" /></g>
          <path className="ch-eh" d="M57 81 Q63 70 69 81 M91 81 Q97 70 103 81" />
          <path className="ch-es" d="M57 80 Q63 84 69 80 M91 80 Q97 84 103 80" />
          <path className="ch-m ch-smile" d="M70 97 Q80 104 90 97" />
          <path className="ch-m ch-flat" d="M70 100 Q80 96 90 100" />
          <ellipse className="ch-m ch-open" cx="80" cy="99" rx="6" ry="4.5" />
          <path className="ch-m ch-big" d="M68 95 Q80 110 92 95 Z" />
        </g></g>
        <path className="ch-sweat" d="M124 44 q-6 9 0 12 q6 -3 0 -12z" />
        <g className="ch-dots"><circle cx="128" cy="26" r="3.5" /><circle cx="138" cy="18" r="4" /><circle cx="149" cy="9" r="4.5" /></g>
        <g className="ch-zz"><text x="120" y="32" fontSize="12">z</text><text x="130" y="20" fontSize="15">z</text><text x="141" y="7" fontSize="18">z</text></g>
        <g className="ch-spk"><path d="M14 40 l3 7 7 3 -7 3 -3 7 -3 -7 -7 -3 7 -3z" /><path d="M142 62 l2.5 5.5 5.5 2.5 -5.5 2.5 -2.5 5.5 -2.5 -5.5 -5.5 -2.5 5.5 -2.5z" /><path d="M24 112 l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2z" /><path d="M136 118 l2 4.5 4.5 2 -4.5 2 -2 4.5 -2 -4.5 -4.5 -2 4.5 -2z" /></g>
        <rect x="46" y="126" width="18" height="12" rx="6" fill="rgba(30,32,40,.9)" /><rect x="96" y="126" width="18" height="12" rx="6" fill="rgba(30,32,40,.9)" />
      </g></g>
    </svg>
    </span>
  );
});
