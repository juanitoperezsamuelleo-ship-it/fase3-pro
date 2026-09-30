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
        return (
          <g key={si}>
            {s.area && pts.length > 1 && (
              <>
                <defs><linearGradient id={gid + si} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={s.color} stopOpacity=".35" /><stop offset="1" stopColor={s.color} stopOpacity="0" /></linearGradient></defs>
                <path className="areaf" d={`M${pts[0][0]},${H - pb} L${pts.map((p) => p.join(",")).join(" L")} L${last[0]},${H - pb} Z`} fill={`url(#${gid + si})`} style={{ animationDelay: d0 + dur * 0.55 + "ms" }} />
              </>
            )}
            {pts.length > 1 && <polyline className="line" points={pts.map((p) => p.join(",")).join(" ")} stroke={s.color} style={{ animationDelay: d0 + "ms", animationDuration: dur + "ms" }} />}
            {pts.map((p, k) => <circle key={k} className="dot" cx={p[0]} cy={p[1]} r={k === pts.length - 1 ? 3.5 : 2} fill={s.color} style={{ animationDelay: d0 + (pts.length > 1 ? (k / (pts.length - 1)) * dur * 0.9 : 0) + "ms" }} />)}
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
