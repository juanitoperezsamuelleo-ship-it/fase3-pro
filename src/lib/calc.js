// Cálculos técnicos y utilidades comunes.
// Criterios: desbalance NEMA MG1 (máx. desviación respecto al promedio),
// Delta T comparativo NETA MTS.

export const DEFAULT_THRESHOLDS = {
  currentWarn: 10, currentCrit: 20,
  voltageWarn: 2, voltageCrit: 3,
  deltaTBaja: 1, deltaTMedia: 4, deltaTMayor: 16, deltaTCritico: 40
};

export const LEVELS = {
  none:       { label: "Sin dato",             short: "Sin dato",     color: "#5E5E66", rank: -1 },
  normal:     { label: "Normal",               short: "Normal",       color: "#7BE0A0", rank: 0 },
  baja:       { label: "Posible deficiencia",  short: "Posible def.", color: "#D8E86B", rank: 1 },
  precaucion: { label: "Precaución",           short: "Precaución",   color: "#FFB05C", rank: 2 },
  media:      { label: "Deficiencia probable", short: "Def. probable",color: "#FFB05C", rank: 2 },
  mayor:      { label: "Deficiencia mayor",    short: "Def. mayor",   color: "#FF7A59", rank: 3 },
  critico:    { label: "Crítico",              short: "Crítico",      color: "#FF5C7A", rank: 4 }
};

export const DT_ACTION = {
  normal: "Sin diferencias relevantes.",
  baja: "Posible deficiencia — investigar.",
  media: "Deficiencia probable — reparar según programación.",
  mayor: "Deficiencia mayor — reparar de inmediato.",
  critico: "Crítico — falla inminente, actuar de inmediato."
};

/** Coma → punto, un solo punto, "-" solo al inicio. Funciona con el teclado de iPhone. */
export function sanitizeDecimal(raw) {
  let v = String(raw ?? "").replace(",", ".").replace(/[^0-9.\-]/g, "");
  v = v.replace(/(\..*)\./g, "$1");
  if (v.indexOf("-") > 0) v = v.replace(/-/g, "");
  return v;
}

export function num(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = parseFloat(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

export function fmt(n, d = 1) {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  return n.toFixed(d).replace(".", ",");
}

export function imbalance(values, warn, crit) {
  const v = values.map(num);
  if (v.length < 3 || v.some((x) => x === null)) return null;
  const avg = v.reduce((a, b) => a + b, 0) / v.length;
  if (!avg) return null;
  const dev = Math.max(...v.map((x) => Math.abs(x - avg)));
  const pct = (dev / avg) * 100;
  return { value: pct, avg, level: pct >= crit ? "critico" : pct >= warn ? "precaucion" : "normal" };
}

export function deltaT(values, th = DEFAULT_THRESHOLDS) {
  const v = values.map(num).filter((x) => x !== null);
  if (v.length < 2) return null;
  const d = Math.max(...v) - Math.min(...v);
  const level = d > th.deltaTCritico ? "critico" : d >= th.deltaTMayor ? "mayor"
    : d >= th.deltaTMedia ? "media" : d >= th.deltaTBaja ? "baja" : "normal";
  return { value: d, level, min: Math.min(...v), max: Math.max(...v) };
}

export function worstOf(levels) {
  return levels.filter(Boolean).reduce((a, b) => (LEVELS[b].rank > LEVELS[a].rank ? b : a), "normal");
}

/* Fechas SIEMPRE en hora local (evita el desfase de 5 h de toISOString) */
const pad = (n) => String(n).padStart(2, "0");
export function localISO(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
export function localDay(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
const MES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
export function fmtDate(iso, withTime = true) {
  if (!iso) return "";
  const [d, t] = iso.split("T");
  const [y, m, day] = d.split("-");
  return `${parseInt(day, 10)} ${MES[parseInt(m, 10) - 1]} ${y}${withTime && t ? " · " + t.slice(0, 5) : ""}`;
}
export function fmtShort(iso) {
  if (!iso) return "";
  const [, m, day] = iso.split("T")[0].split("-");
  return `${parseInt(day, 10)} ${MES[parseInt(m, 10) - 1]}`;
}
export function monthLabel(iso) {
  return iso ? MES[parseInt(iso.slice(5, 7), 10) - 1] : "";
}
export function relDays(iso) {
  if (!iso) return "sin lecturas";
  const a = new Date(iso.slice(0, 10) + "T00:00");
  const b = new Date(localDay() + "T00:00");
  const d = Math.round((b - a) / 86400000);
  if (d <= 0) return "hoy";
  if (d === 1) return "ayer";
  if (d < 30) return `hace ${d} d`;
  return fmtShort(iso);
}

export function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

/** Pendiente por mes (regresión lineal simple) para alertas por tendencia. */
export function trendPerMonth(points) {
  // points: [{ t: ms, v: number }]
  const p = points.filter((x) => Number.isFinite(x.v));
  if (p.length < 3) return null;
  const n = p.length;
  const mx = p.reduce((a, b) => a + b.t, 0) / n;
  const my = p.reduce((a, b) => a + b.v, 0) / n;
  let num_ = 0, den = 0;
  p.forEach((x) => { num_ += (x.t - mx) * (x.v - my); den += (x.t - mx) ** 2; });
  if (!den) return null;
  const perMs = num_ / den;
  return perMs * 1000 * 60 * 60 * 24 * 30;
}
