// Estado de cada equipo a partir de sus lecturas (se recalcula en vivo, así que
// un cambio de umbrales aplica también a lecturas pasadas).
import { DEFAULT_THRESHOLDS, LEVELS, num, trendPerMonth } from "./calc.js";
import { TYPES, evaluate } from "./templates.js";

export const tsOf = (iso) => new Date(iso.length <= 10 ? iso + "T00:00" : iso).getTime();

export function thresholdsOf(settings) {
  return { ...DEFAULT_THRESHOLDS, ...((settings && settings.thresholds) || {}) };
}

export function analyze(equipment, readings, th) {
  const byEq = {};
  readings.forEach((r) => { (byEq[r.equipmentId] = byEq[r.equipmentId] || []).push(r); });
  return equipment.map((eq) => {
    const rs = (byEq[eq.id] || []).slice().sort((a, b) => (a.date < b.date ? -1 : 1));
    const last = rs[rs.length - 1] || null;
    const ev = last ? evaluate(eq.type, last.values || {}, th, eq.plate || {}) : null;
    const series = rs.map((r) => {
      const e = evaluate(eq.type, r.values || {}, th, eq.plate || {});
      return { t: tsOf(r.date), date: r.date, dT: e.dT ? e.dT.value : null, dI: e.cI ? e.cI.value : null, dV: e.cV ? e.cV.value : null, tMax: num((r.values || {}).tMax), level: e.worst };
    });
    const dtTrend = trendPerMonth(series.filter((s) => s.dT !== null).map((s) => ({ t: s.t, v: s.dT })));
    const tTrend = trendPerMonth(series.filter((s) => s.tMax !== null).map((s) => ({ t: s.t, v: s.tMax })));
    // Proyección: meses hasta que ΔT alcance "deficiencia mayor"
    let monthsToMajor = null;
    const lastDT = ev && ev.dT ? ev.dT.value : null;
    if (dtTrend && dtTrend > 0.15 && lastDT !== null && lastDT < th.deltaTMayor) monthsToMajor = (th.deltaTMayor - lastDT) / dtTrend;
    const level = ev ? ev.worst : "none";
    const rising = !!(dtTrend && dtTrend > 0.5) || !!(tTrend && tTrend > 1.5);
    return { eq, T: TYPES[eq.type] || TYPES.tablero, readings: rs, last, ev, series, level, rank: LEVELS[level].rank, dtTrend, tTrend, monthsToMajor, rising };
  });
}

export function sortByRisk(list) {
  return list.slice().sort((a, b) => b.rank - a.rank || (b.rising ? 1 : 0) - (a.rising ? 1 : 0) || (b.last ? b.last.date : "").localeCompare(a.last ? a.last.date : ""));
}
