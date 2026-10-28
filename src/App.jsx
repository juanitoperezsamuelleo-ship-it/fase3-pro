import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { getStore, COLS, IS_DEMO } from "./lib/store.js";
import { analyze, thresholdsOf } from "./lib/analysis.js";
import { localDay } from "./lib/calc.js";
import { Icon, ToastHost, Chispa } from "./ui.jsx";
import Auth from "./screens/Auth.jsx";
import Home from "./screens/Home.jsx";
import Reading from "./screens/Reading.jsx";
import Equipment from "./screens/Equipment.jsx";
import History from "./screens/History.jsx";
import More from "./screens/More.jsx";
import Assistant from "./screens/Assistant.jsx";
import PowerQuality from "./screens/PowerQuality.jsx";

const NAV = [
  { id: "home", label: "Inicio", icon: "home" },
  { id: "read", label: "Lectura", icon: "plus" },
  { id: "equip", label: "Equipos", icon: "box" },
  { id: "hist", label: "Histórico", icon: "chart" },
  { id: "more", label: "Más", icon: "dots" }
];

const PREFS = "fase3pro-prefs";
const safeGet = (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } };
export function getPrefs() {
  const def = { theme: "cristal", mode: "auto", intro: "ondas" };
  try { return { ...def, ...JSON.parse(localStorage.getItem(PREFS) || "{}") }; } catch (e) { return def; }
}
export function setPrefs(p) { try { localStorage.setItem(PREFS, JSON.stringify(p)); } catch (e) { /* */ } }

function useSystemDark() {
  const q = typeof window !== "undefined" && window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;
  const [dark, setDark] = useState(q ? q.matches : true);
  useEffect(() => {
    if (!q) return;
    const f = (e) => setDark(e.matches);
    q.addEventListener ? q.addEventListener("change", f) : q.addListener(f);
    return () => (q.removeEventListener ? q.removeEventListener("change", f) : q.removeListener(f));
  }, []); // eslint-disable-line
  return dark;
}

/* Barra inferior. En Cristal, una cápsula de vidrio se desliza y se estira:
   el borde que va adelante llega primero y el de atrás lo sigue. */
function Nav({ tab, go, readOnly }) {
  const ref = useRef();
  const last = useRef(null);
  const [pos, setPos] = useState(null);
  const measure = useCallback(() => {
    const box = ref.current;
    const el = box && box.querySelector('[aria-current="page"]');
    if (!el) return setPos(null);
    const l = el.offsetLeft, r = box.clientWidth - el.offsetLeft - el.offsetWidth;
    const dir = last.current === null ? 0 : l > last.current ? 1 : l < last.current ? -1 : 0;
    last.current = l;
    setPos({ l, r, dir });
  }, []);
  useLayoutEffect(measure, [tab, measure, readOnly]);
  useEffect(() => { window.addEventListener("resize", measure); return () => window.removeEventListener("resize", measure); }, [measure]);
  const lead = ".3s var(--spring)", trail = ".46s var(--spring) .03s";
  const tr = !pos || pos.dir === 0 ? "none" : pos.dir > 0 ? `right ${lead}, left ${trail}` : `left ${lead}, right ${trail}`;
  return (
    <nav className="nav" aria-label="Principal" ref={ref}>
      {pos && <span className="nav-glass" aria-hidden="true" style={{ left: pos.l, right: pos.r, transition: tr }} />}
      {NAV.map((n) => (
        <button key={n.id} aria-current={tab === n.id ? "page" : undefined} onClick={() => go(n.id)} aria-label={n.label}>
          <Icon n={n.icon} size={20} /><span className="nav-l">{n.label}</span>
        </button>
      ))}
    </nav>
  );
}

/* Barra del tema Cristal, estilo iOS 26: al mantener el dedo, la cápsula se vuelve una burbuja de vidrio
   que sigue el dedo, se estira con la velocidad y aumenta lo que tiene debajo. Al bajar en una pantalla se
   encoge a un solo botón. Al lado, el botón redondo de Chispa. */
const LW = 84;
function NavGlass({ tab, go, mood }) {
  const bar = useRef(), mag = useRef(), lens = useRef(), sel = useRef();
  const L = useRef({ on: false, x: 0, px: 0, tx: 0, g: 0, gt: 0, raf: 0 });
  const [mini, setMini] = useState(false);
  const idx = NAV.findIndex((n) => n.id === tab);
  const st = useRef({}); st.current = { idx, mini, go };
  const reduce = typeof window !== "undefined" && window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const geo = () => { const bw = bar.current ? bar.current.clientWidth : 300, tw = (bw - 8) / NAV.length; return { bw, tw, cx: (j) => 4 + tw * (j + 0.5) }; };
  const clampX = (x) => { const { bw } = geo(); return Math.max(LW / 2 - 4, Math.min(bw - LW / 2 + 4, x)); };
  const nearest = (x) => { const { tw } = geo(); return Math.max(0, Math.min(NAV.length - 1, Math.floor((x - 4) / tw))); };
  const placeSel = useCallback(() => {
    const s = sel.current, i = st.current.idx;
    if (!s || i < 0) return;
    const g = geo(); s.style.width = g.tw - 2 + "px"; s.style.transform = `translateX(${g.cx(i) - (g.tw - 2) / 2}px)`;
  }, []); // eslint-disable-line
  const paint = () => {
    const l = L.current, g = geo();
    l.x += (l.tx - l.x) * (reduce ? 1 : 0.26);
    const v = l.x - l.px; l.px = l.x;
    l.g += (l.gt - l.g) * (reduce ? 1 : 0.2);
    const stretch = Math.min(0.3, Math.abs(v) * 0.02), sc = 0.6 + 0.4 * l.g;
    if (lens.current) {
      lens.current.style.opacity = Math.max(0, Math.min(1, (l.g - 0.04) * 1.7));
      lens.current.style.transform = `translateX(${l.x - LW / 2}px) scale(${sc * (1 + stretch)},${sc * (1 - stretch * 0.5)})`;
    }
    if (sel.current) sel.current.style.opacity = st.current.mini || st.current.idx < 0 ? 0 : l.g > 0.08 ? Math.max(0, 1 - l.g * 1.6) : 1;
    if (mag.current) {
      mag.current.style.width = g.bw + "px";
      mag.current.style.transformOrigin = `${l.x}px 32px`;
      mag.current.style.transform = `translateX(${-(l.x - LW / 2)}px) scale(1.32)`;
      const h = nearest(l.x);
      Array.from(mag.current.children).forEach((c, j) => c.classList.toggle("hot", j === h));
    }
    const busy = l.on || Math.abs(l.tx - l.x) > 0.3 || Math.abs(l.gt - l.g) > 0.01;
    l.raf = busy ? requestAnimationFrame(paint) : 0;
  };
  const kick = () => { if (!L.current.raf) L.current.raf = requestAnimationFrame(paint); };
  useLayoutEffect(() => { placeSel(); kick(); }, [idx, mini, placeSel]); // eslint-disable-line
  useEffect(() => { const f = () => placeSel(); window.addEventListener("resize", f); return () => { window.removeEventListener("resize", f); cancelAnimationFrame(L.current.raf); }; }, [placeSel]);
  useEffect(() => { setMini(false); }, [tab]);
  useEffect(() => {
    let lastY = 0;
    const f = (e) => {
      const t = e.target;
      if (!t || !t.classList || !t.classList.contains("screen")) return;
      const y = t.scrollTop;
      if (y > 80 && y > lastY + 4) setMini(true);
      else if (y < lastY - 8 || y < 24) setMini(false);
      lastY = y;
    };
    document.addEventListener("scroll", f, true);
    return () => document.removeEventListener("scroll", f, true);
  }, []);
  const relX = (e) => e.clientX - bar.current.getBoundingClientRect().left;
  const press = (x) => { const l = L.current, g = geo(); l.on = true; l.gt = 1; if (l.g < 0.05) l.x = l.px = st.current.idx >= 0 ? g.cx(st.current.idx) : clampX(x); l.tx = clampX(x); kick(); };
  const release = () => {
    const l = L.current; if (!l.on) return;
    const j = nearest(l.tx); l.tx = geo().cx(j); l.on = false; kick();
    setTimeout(() => { l.gt = 0; kick(); if (NAV[j].id !== tab) st.current.go(NAV[j].id); }, reduce ? 0 : 150);
  };
  const tabs = (clone) => NAV.map((n, j) => clone
    ? <span key={n.id} className="tg-tab"><Icon n={n.icon} size={21} /><span>{n.label}</span></span>
    : <button key={n.id} className="tg-tab" role="tab" aria-selected={j === idx} aria-current={j === idx ? "page" : undefined} aria-label={n.label} onClick={(e) => { if (e.detail === 0) go(n.id); }}><Icon n={n.icon} size={21} /><span>{n.label}</span></button>);
  return (
    <>
      <nav ref={bar} className={"tglass" + (mini ? " mini" : "")} aria-label="Principal"
        onPointerDown={(e) => { if (mini || e.button > 0) return; e.preventDefault(); bar.current.setPointerCapture(e.pointerId); press(relX(e)); }}
        onPointerMove={(e) => { if (L.current.on) { L.current.tx = clampX(relX(e)); kick(); } }}
        onPointerUp={() => { if (mini) { setMini(false); return; } release(); }}
        onPointerCancel={release}>
        <span ref={sel} className="tg-sel" aria-hidden="true" />
        <div className="tg-row" role="tablist">{tabs(false)}</div>
        <div ref={lens} className="tg-lens" aria-hidden="true"><div ref={mag} className="tg-mag">{tabs(true)}</div></div>
        <span className="tg-mini" aria-hidden="true">{idx >= 0 && <Icon n={NAV[idx].icon} size={23} />}</span>
      </nav>
      <button className="tg-chispa icon-btn" onClick={() => go("ai")} aria-label="Abrir a Chispa, el asistente"><Chispa size={42} mood={mood} label="" sleepAfter={120000} /></button>
    </>
  );
}

/* Apertura "Ondas": completa una vez al día; después, corta. */
function Intro({ onDone, full }) {
  useEffect(() => { const t = setTimeout(onDone, full ? 2100 : 650); return () => clearTimeout(t); }, [full, onDone]);
  return (
    <div className="intro" onClick={onDone} role="presentation">
      <div className="intro-waves" aria-hidden="true">{[0, 1, 2, 3].map((k) => <span key={k} style={{ animationDelay: k * 180 + "ms" }} />)}</div>
      <div className="intro-mark">
        <svg width="54" height="54" viewBox="0 0 24 24" fill="none" stroke="#111214" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ background: "var(--lilac)", borderRadius: 16, padding: 11 }}><path d="M13 2 4 14h7l-1 8 9-12h-7z" /></svg>
        <div className="display" style={{ fontSize: 28, fontWeight: 700 }}>FASE·3 <span style={{ color: "var(--lilac)" }}>Pro</span></div>
        {full && <div className="muted" style={{ fontSize: 13 }}>Mantenimiento predictivo</div>}
      </div>
    </div>
  );
}

export default function App() {
  const [store, setStore] = useState(null);
  const [session, setSession] = useState(undefined);
  const [data, setData] = useState({ pq: [], plants: [], ccms: [], equipment: [], readings: [], settings: {}, users: [], technicians: [] });
  const [filter, setFilter] = useState({ plantId: "", ccmId: "", q: "" });
  const [route, setRoute] = useState({ tab: "home" });
  const [prefs, setP] = useState(getPrefs);
  const [intro, setIntro] = useState(() => (getPrefs().intro === "ninguna" ? null : safeGet("fase3pro-intro") === localDay() ? "short" : "full"));

  useEffect(() => { getStore().then(setStore).catch((e) => { console.error(e); setSession({ error: true }); }); }, []);
  useEffect(() => { if (store) return store.onAuth(setSession); }, [store]);

  useEffect(() => {
    if (!store || !session || !session.orgId) return;
    const offs = COLS.map((c) => store.sub(c, (rows) => setData((d) => ({ ...d, [c]: rows }))));
    offs.push(store.subSettings((s) => setData((d) => ({ ...d, settings: s || {} }))));
    offs.push(store.subUsers((u) => setData((d) => ({ ...d, users: u }))));
    if (store.subTechnicians) offs.push(store.subTechnicians((t) => setData((d) => ({ ...d, technicians: t }))));
    return () => offs.forEach((f) => f && f());
  }, [store, session && session.orgId]); // eslint-disable-line

  const th = useMemo(() => thresholdsOf(data.settings), [data.settings]);
  const items = useMemo(() => analyze(data.equipment, data.readings, th), [data.equipment, data.readings, th]);

  const ORDER = ["home", "read", "equip", "hist", "more", "pq", "ai"];
  const [navDir, setNavDir] = useState(0);
  const go = useCallback((tab, params = {}) => {
    setRoute((r) => { const a = ORDER.indexOf(r.tab), b = ORDER.indexOf(tab); setNavDir(tab === "ai" ? 2 : r.tab === "ai" ? -2 : b > a ? 1 : b < a ? -1 : 0); return { tab, ...params }; }); const s = document.querySelector(".screen"); if (s) s.scrollTop = 0; }, []);
  const updatePrefs = (p) => { const n = { ...prefs, ...p }; setP(n); setPrefs(n); };
  const endIntro = useCallback(() => { try { localStorage.setItem("fase3pro-intro", localDay()); } catch (e) { /* */ } setIntro(null); }, []);

  const sysDark = useSystemDark();
  const mode = prefs.theme !== "cristal" ? "dark" : prefs.mode === "auto" ? (sysDark ? "dark" : "light") : prefs.mode;
  useEffect(() => {
    const m = document.querySelector('meta[name="theme-color"]');
    const c = prefs.theme === "cristal" ? (mode === "dark" ? "#07080B" : "#EEF0F5") : prefs.theme === "instrumento" ? "#0C0E0C" : "#111214";
    if (m) m.setAttribute("content", c);
    document.documentElement.style.colorScheme = mode;
    document.body.style.background = c;
  }, [prefs.theme, mode]);

  useEffect(() => {
    const down = (e) => {
      const b = e.target.closest && e.target.closest(".btn, .icon-btn, .chip, .tg-chispa");
      if (!b || !b.closest('.app[data-theme="cristal"]')) return;
      const r = b.getBoundingClientRect();
      b.style.setProperty("--px", e.clientX - r.left + "px"); b.style.setProperty("--py", e.clientY - r.top + "px");
      b.classList.add("pressed");
    };
    const up = () => document.querySelectorAll(".pressed").forEach((b) => b.classList.remove("pressed"));
    document.addEventListener("pointerdown", down, true);
    ["pointerup", "pointercancel", "dragstart"].forEach((t) => document.addEventListener(t, up, true));
    return () => { document.removeEventListener("pointerdown", down, true); ["pointerup", "pointercancel", "dragstart"].forEach((t) => document.removeEventListener(t, up, true)); };
  }, []);

  const readOnly = !!(store && store.readOnly);
  const ctx = { filter, setFilter, readOnly, mode, store, session, data, th, items, go, route, prefs, updatePrefs, isAdmin: !!(session && session.role === "admin"), canManage: !readOnly && !!(session && session.role === "admin"), demo: IS_DEMO };

  let body;
  if (intro) body = <Intro full={intro === "full"} onDone={endIntro} />;
  else if (session === undefined || !store) body = <div className="screen" style={{ alignItems: "center", justifyContent: "center" }}><div className="muted">Cargando…</div></div>;
  else if (!session || session.pending || session.error) body = <Auth ctx={ctx} />;
  else {
    const S = { home: Home, read: Reading, equip: Equipment, hist: History, more: More, pq: PowerQuality, ai: Assistant }[route.tab] || Home;
    body = (
      <>
        <S ctx={ctx} key={route.tab + (route.k || "")} />
        {route.tab !== "ai" && (prefs.theme === "cristal"
          ? <NavGlass tab={route.tab} go={go} mood={items.some((i) => i.rank >= 3) ? "worry" : "ok"} />
          : <Nav tab={route.tab} go={go} readOnly={readOnly} />)}
      </>
    );
  }

  return (
    <div className="app" data-theme={prefs.theme} data-mode={mode} data-tab={route.tab} data-dir={navDir}>
      <div className="aura" aria-hidden="true"><i /><i /><i /><i /></div>
      <ToastHost>{body}</ToastHost>
    </div>
  );
}
