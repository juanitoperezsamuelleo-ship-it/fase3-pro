import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { getStore, COLS, IS_DEMO } from "./lib/store.js";
import { analyze, thresholdsOf } from "./lib/analysis.js";
import { localDay } from "./lib/calc.js";
import { Icon, ToastHost } from "./ui.jsx";
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
        {route.tab !== "ai" && (
          <Nav tab={route.tab} go={go} readOnly={readOnly} />
        )}
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
