// Informes: HTML imprimible (Guardar como PDF) y Excel modelado para Power BI.
// Alcance: general, por CCM o por equipo. Fechas siempre en hora LOCAL.
import { LEVELS, fmt, fmtDate, fmtShort, localDay, num } from "./calc.js";
import { TYPES, evaluate } from "./templates.js";
import { analyze } from "./analysis.js";
import { diagnoseItem } from "./ai.js";

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const inkOf = (lvl) => ({ normal: "#1d8a4a", baja: "#8a8a12", precaucion: "#b86a00", media: "#b86a00", mayor: "#c2410c", critico: "#be123c", none: "#777" }[lvl] || "#777");
export const PLAZO = { critico: "Inmediato (24 h)", mayor: "Antes de 1 semana", media: "Próxima parada (≤ 1 mes)", precaucion: "Próxima parada (≤ 1 mes)", baja: "Vigilar en próxima ruta", normal: "Rutina", none: "—" };

/* Prepara el alcance: equipos, lecturas del periodo y su análisis */
export function scopeData({ items, readings, from, to, th, scope }) {
  const pick = items.filter((i) =>
    (!scope.plantId || i.eq.plantId === scope.plantId) &&
    (scope.kind !== "ccm" || i.eq.ccmId === scope.ccmId) &&
    (scope.kind !== "eq" || i.eq.id === scope.eqId));
  const ids = new Set(pick.map((i) => i.eq.id));
  const rs = readings.filter((r) => ids.has(r.equipmentId) && r.date.slice(0, 10) >= from && r.date.slice(0, 10) <= to);
  const withData = new Set(rs.map((r) => r.equipmentId));
  const eqs = pick.filter((i) => withData.has(i.eq.id)).map((i) => i.eq);
  const list = analyze(eqs, rs, th).map((it) => ({ ...it, diag: diagnoseItem(it, th) }));
  return { list, readings: rs };
}

/* ───────── Gráfica SVG para el informe (curva suave, impresión) ───────── */
function smooth(pts) {
  if (pts.length < 3) return "M" + pts.map((p) => p.join(",")).join(" L");
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
    const lo = Math.min(p1[1], p2[1]), hi = Math.max(p1[1], p2[1]);
    const c1y = Math.min(hi, Math.max(lo, p1[1] + (p2[1] - p0[1]) / 6)), c2y = Math.min(hi, Math.max(lo, p2[1] - (p3[1] - p1[1]) / 6));
    d += ` C${p1[0] + (p2[0] - p0[0]) / 6},${c1y} ${p2[0] - (p3[0] - p1[0]) / 6},${c2y} ${p2[0]},${p2[1]}`;
  }
  return d;
}
function svgChart({ title, labels, series, bands = [], unit }) {
  const W = 520, H = 170, pl = 38, pr = 10, pt = 22, pb = 24;
  const all = series.flatMap((s) => s.values).filter((v) => v !== null && Number.isFinite(v));
  if (all.length < 2) return "";
  let mn = Math.min(...all), mx = Math.max(...all);
  bands.forEach((b) => { if (b.y < mx * 1.6 + 1) mx = Math.max(mx, b.y); });
  const pad = (mx - mn) * 0.12 || 1; mn = Math.max(all.every((v) => v >= 0) ? 0 : -Infinity, mn - pad); mx += pad;
  const n = labels.length;
  const X = (k) => pl + (n === 1 ? (W - pl - pr) / 2 : (k / (n - 1)) * (W - pl - pr));
  const Y = (v) => pt + (1 - (v - mn) / (mx - mn)) * (H - pt - pb);
  const ticks = [mn, (mn + mx) / 2, mx];
  const step = Math.max(1, Math.ceil(n / 7));
  let s = `<svg viewBox="0 0 ${W} ${H}" width="100%" xmlns="http://www.w3.org/2000/svg" font-family="Arial" font-size="9">`;
  s += `<text x="0" y="11" font-size="10" font-weight="bold" fill="#333">${esc(title)}${unit ? " · " + esc(unit) : ""}</text>`;
  ticks.forEach((t) => { s += `<line x1="${pl}" x2="${W - pr}" y1="${Y(t)}" y2="${Y(t)}" stroke="#e5e5e5"/><text x="${pl - 4}" y="${Y(t) + 3}" text-anchor="end" fill="#888">${t.toFixed(mx - mn < 10 ? 1 : 0)}</text>`; });
  bands.filter((b) => b.y > mn && b.y < mx).forEach((b) => { s += `<line x1="${pl}" x2="${W - pr}" y1="${Y(b.y)}" y2="${Y(b.y)}" stroke="${b.color}" stroke-dasharray="4 3"/><text x="${W - pr}" y="${Y(b.y) - 3}" text-anchor="end" fill="${b.color}">${esc(b.label)}</text>`; });
  labels.forEach((l, k) => { if (k % step === 0 || k === n - 1) s += `<text x="${X(k)}" y="${H - 8}" text-anchor="middle" fill="#888">${esc(l)}</text>`; });
  series.forEach((sr) => {
    const pts = sr.values.map((v, k) => (v === null || !Number.isFinite(v) ? null : [X(k), Y(v)])).filter(Boolean);
    if (!pts.length) return;
    if (series.length === 1 && pts.length > 1) s += `<path d="${smooth(pts)} L${pts[pts.length - 1][0]},${H - pb} L${pts[0][0]},${H - pb} Z" fill="${sr.color}" opacity=".12"/>`;
    if (pts.length > 1) s += `<path d="${smooth(pts)}" fill="none" stroke="${sr.color}" stroke-width="2"/>`;
    pts.forEach((p, k) => { s += `<circle cx="${p[0]}" cy="${p[1]}" r="${k === pts.length - 1 ? 3 : 2}" fill="${sr.color}"/>`; });
  });
  if (series.length > 1) {
    let x = pl;
    series.forEach((sr) => { s += `<rect x="${x}" y="${H - 4}" width="10" height="3" fill="${sr.color}"/><text x="${x + 13}" y="${H - 1}" fill="#555">${esc(sr.name)}</text>`; x += 50; });
  }
  return s + "</svg>";
}
const PH = ["#d4a106", "#2f6fd6", "#d9412e"], MAXC = "#222";

/* ───────── Informe PDF ───────── */
export function htmlReport({ orgName, items, readings, from, to, th, scope, ccms = [], plants = [] }) {
  const { list, readings: rs } = scopeData({ items, readings, from, to, th, scope });
  const ccmName = (id) => (ccms.find((c) => c.id === id) || {}).name || "Sin CCM";
  const plantName = (id) => (plants.find((p) => p.id === id) || {}).name || "";
  const scopeLabel = scope.kind === "eq" ? "Equipo: " + ((list[0] && list[0].eq.name) || "") : scope.kind === "ccm" ? "CCM: " + ccmName(scope.ccmId) : "General" + (scope.plantId ? " · " + plantName(scope.plantId) : "");
  const byRisk = list.slice().sort((a, b) => b.rank - a.rank || (b.dtTrend || 0) - (a.dtTrend || 0));
  const cnt = (f) => list.filter(f).length;
  const kpis = [
    [rs.length, "lecturas"], [list.length, "equipos"],
    [cnt((i) => i.rank >= 3), "intervenir"], [cnt((i) => i.rank === 2), "precaución"],
    [cnt((i) => i.monthsToMajor !== null && i.monthsToMajor < 6), "tendencia al alza"], [cnt((i) => i.rank <= 1), "normales"]
  ];

  // Tabla de prioridades
  const prio = byRisk.filter((i) => i.rank >= 1 || (i.monthsToMajor !== null && i.monthsToMajor < 6));
  const prioRows = prio.map((i) => {
    const d = i.diag[0];
    return `<tr><td><span class="dot" style="background:${LEVELS[i.level].color}"></span><b>${esc(i.eq.name)}</b><br><small>${esc(ccmName(i.eq.ccmId))}</small></td>
      <td style="color:${inkOf(i.level)}"><b>${esc(LEVELS[i.level].label)}</b></td>
      <td>${esc(d ? d.title : "Tendencia")}<br><small>${esc(d ? d.detail : "")}</small></td>
      <td>${esc(i.level === "baja" || i.level === "normal" ? "Verificar en la próxima ruta" + (i.monthsToMajor !== null && i.monthsToMajor < 6 ? " y adelantar intervención por tendencia" : "") : d && d.rec[0] ? d.rec[0] : "Vigilar")}</td><td>${esc(PLAZO[i.level])}</td></tr>`;
  }).join("");

  // Secciones por equipo, agrupadas por CCM
  const groups = {};
  byRisk.forEach((i) => { (groups[i.eq.ccmId || "_"] = groups[i.eq.ccmId || "_"] || []).push(i); });
  const sections = Object.entries(groups).map(([cid, arr]) => {
    const head = scope.kind === "eq" ? "" : `<h2 class="ccm">${esc(cid === "_" ? "Sin CCM" : ccmName(cid))} <small>${arr.length} equipos</small></h2>`;
    return head + arr.map((i) => {
      const R = i.readings;
      const last = i.last;
      const ev = i.ev;
      const labels = R.map((r) => fmtShort(r.date));
      const V = (k) => R.map((r) => num(r.values && r.values[k]));
      const E = i.T.evalKeys;
      const charts = R.length >= 2 ? [
        svgChart({ title: "ΔT entre fases", unit: "°C", labels, series: [{ name: "ΔT", color: "#e0682c", values: i.series.map((s) => s.dT) }], bands: [{ y: th.deltaTMedia, color: "#b86a00", label: "probable" }, { y: th.deltaTMayor, color: "#c2410c", label: "mayor" }] }),
        svgChart({ title: "Temperatura por fase", unit: "°C", labels, series: [...["tL1", "tL2", "tL3"].map((k, n) => ({ name: "L" + (n + 1), color: PH[n], values: V(k) })), { name: "Máx", color: MAXC, values: V("tMax") }] }),
        E.current ? svgChart({ title: "Corriente por fase", unit: "A", labels, series: E.current.map((k, n) => ({ name: "L" + (n + 1), color: PH[n], values: V(k) })), bands: num((i.eq.plate || {}).in) ? [{ y: num(i.eq.plate.in), color: "#888", label: "nominal" }] : [] }) : "",
        svgChart({ title: "Desbalance", unit: "%", labels, series: [{ name: "Corriente", color: "#7c5cff", values: i.series.map((s) => s.dI) }, ...(E.voltage ? [{ name: "Tensión", color: "#1b9bd1", values: i.series.map((s) => s.dV) }] : [])] })
      ].filter(Boolean) : [];
      const trendTxt = [];
      if (i.dtTrend !== null) trendTxt.push(`ΔT ${i.dtTrend > 0 ? "sube" : "baja"} ${fmt(Math.abs(i.dtTrend))} °C/mes`);
      if (i.tTrend !== null) trendTxt.push(`temperatura máxima ${i.tTrend > 0 ? "sube" : "baja"} ${fmt(Math.abs(i.tTrend))} °C/mes`);
      if (i.monthsToMajor !== null) trendTxt.push(`<b style="color:#c2410c">proyección: llega a ${th.deltaTMayor} °C (deficiencia mayor) en ~${Math.max(1, Math.round(i.monthsToMajor))} meses</b>`);
      const tableKeys = [...(E.current || []), ...(E.voltage || []), "tL1", "tL2", "tL3", "tMax"];
      const tbl = `<table class="rd"><tr><th>Fecha</th>${tableKeys.map((k) => `<th>${esc(k.replace(/^i/, "I ").replace(/^v/, "V ").replace(/^t/, "T ").replace("Max", "máx").replace(/S(L\d)/, " sec $1").replace(/AC(L\d)/, " AC $1"))}</th>`).join("")}<th>ΔT</th><th>Estado</th></tr>${R.slice().reverse().slice(0, 12).map((r) => {
        const e = evaluate(i.eq.type, r.values || {}, th, i.eq.plate || {});
        return `<tr><td>${fmtDate(r.date)}</td>${tableKeys.map((k) => `<td>${r.values && r.values[k] !== undefined ? esc(String(r.values[k]).replace(".", ",")) : ""}</td>`).join("")}<td>${e.dT ? fmt(e.dT.value) : ""}</td><td style="color:${inkOf(e.worst)}">${esc(LEVELS[e.worst].short)}</td></tr>`;
      }).join("")}</table>${R.length > 12 ? `<p class="n">Se muestran las últimas 12 de ${R.length} lecturas del periodo (todas están en el Excel).</p>` : ""}`;
      return `<section class="eq">
        <h3><span class="dot" style="background:${LEVELS[i.level].color}"></span>${esc(i.eq.name)} <span class="pill" style="border-color:${inkOf(i.level)};color:${inkOf(i.level)}">${esc(LEVELS[i.level].label)}</span></h3>
        <p class="meta">${esc(i.eq.typeLabel || TYPES[i.eq.type].label)} · ${esc(ccmName(i.eq.ccmId))}${plantName(i.eq.plantId) ? " · " + esc(plantName(i.eq.plantId)) : ""} · ${R.length} lecturas · última ${fmtDate(last.date)} (${esc(last.userName || "")})</p>
        <table><tr>${ev.rows.map((r) => `<th>${esc(r.name)}</th>`).join("")}</tr><tr>${ev.rows.map((r) => `<td><b>${esc(r.value)}</b><br><span style="color:${inkOf(r.level)}">${esc(LEVELS[r.level].label)}</span></td>`).join("")}</tr></table>
        ${charts.length ? `<div class="charts">${charts.map((c) => `<div>${c}</div>`).join("")}</div>` : `<p class="n">Se necesitan al menos 2 lecturas en el periodo para graficar tendencias.</p>`}
        ${trendTxt.length ? `<p><b>Tendencia:</b> ${trendTxt.join(" · ")}.</p>` : ""}
        ${i.diag.length ? `<div class="diag"><b>Diagnóstico y recomendaciones</b>${i.diag.map((d) => `<div class="dg"><span style="color:${inkOf(d.level)}">■</span> <b>${esc(d.title)}.</b> ${esc(d.detail)}${d.causes.length ? `<br><small>Causas probables: ${esc(d.causes.join("; "))}.</small>` : ""}${d.rec.length ? `<ul>${d.rec.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}<small>Plazo sugerido: ${esc(PLAZO[d.level])}</small></div>`).join("")}</div>` : `<p style="color:#1d8a4a"><b>Sin hallazgos:</b> la última lectura está dentro de los umbrales. Mantener la frecuencia de inspección.</p>`}
        ${last.notes ? `<p class="n">Nota del técnico: ${esc(last.notes)}</p>` : ""}
        ${tbl}
      </section>`;
    }).join("");
  }).join("");

  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Informe ${esc(scopeLabel)} ${from} a ${to}</title>
<style>
body{font:12.5px/1.45 Arial,Helvetica,sans-serif;color:#1b1c20;max-width:900px;margin:20px auto;padding:0 18px}
h1{font-size:22px;margin:0 0 2px}h2.ccm{font-size:16px;margin:26px 0 6px;padding:6px 10px;background:#f2f1ee;border-left:4px solid #1b1c20;break-after:avoid}h2.ccm small{font-weight:400;color:#666}
h3{font-size:15px;margin:0 0 2px;display:flex;align-items:center;gap:8px;flex-wrap:wrap}.meta{color:#666;margin:0 0 8px}
.dot{width:10px;height:10px;border-radius:50%;display:inline-block;margin-right:4px}.pill{font-size:11px;border:1px solid;border-radius:20px;padding:1px 8px;font-weight:600}
table{border-collapse:collapse;width:100%;font-size:11.5px;margin:6px 0}th,td{border:1px solid #ddd;padding:5px 6px;text-align:left;vertical-align:top}th{background:#f4f4f6}
table.rd td,table.rd th{padding:3px 5px;font-size:10.5px;text-align:right}table.rd td:first-child,table.rd th:first-child{text-align:left}
.kpi{display:grid;grid-template-columns:repeat(6,1fr);gap:8px;margin:14px 0}.kpi div{border:1px solid #ddd;border-radius:10px;padding:8px 10px}.kpi b{font-size:20px;display:block}
.charts{display:grid;grid-template-columns:1fr 1fr;gap:8px 16px;margin:8px 0}.diag{background:#faf8f3;border:1px solid #eee3cc;border-radius:10px;padding:10px 12px;margin:8px 0}.dg{margin-top:6px}.dg ul{margin:3px 0 2px;padding-left:18px}
.n{color:#666;font-style:italic;font-size:11px}section.eq{border-top:2px solid #1b1c20;padding-top:10px;margin-top:22px;break-inside:auto}
.cover{border-bottom:3px solid #1b1c20;padding-bottom:10px}.btn{position:fixed;right:16px;top:16px;padding:10px 16px;border-radius:10px;border:0;background:#1b1c20;color:#fff;font-weight:600;cursor:pointer}
@media print{.btn{display:none}body{margin:0;max-width:none}section.eq{break-before:page}section.eq:first-of-type{break-before:auto}}
@media(max-width:640px){.kpi{grid-template-columns:repeat(3,1fr)}.charts{grid-template-columns:1fr}}
</style></head><body>
<button class="btn" onclick="print()">Guardar PDF / Imprimir</button>
<div class="cover"><h1>Informe de mantenimiento predictivo</h1>
<p><b>${esc(orgName)}</b> · ${esc(scopeLabel)} · ${fmtDate(from, false)} al ${fmtDate(to, false)} · generado el ${fmtDate(localDay(), false)}</p></div>
<div class="kpi">${kpis.map(([v, l]) => `<div><b>${v}</b>${l}</div>`).join("")}</div>
<h2 class="ccm">Prioridades y recomendaciones</h2>
${prio.length ? `<table><tr><th>Equipo</th><th>Estado</th><th>Hallazgo</th><th>Acción recomendada</th><th>Plazo</th></tr>${prioRows}</table>` : `<p>Ningún equipo del alcance presenta hallazgos ni tendencias de riesgo en el periodo.</p>`}
${sections || "<p>No hay lecturas en el periodo seleccionado.</p>"}
<p class="n" style="margin-top:24px">Criterios: desbalance de corriente y tensión NEMA MG1 (máxima desviación respecto al promedio; precaución ${th.currentWarn} % / crítico ${th.currentCrit} % en corriente, ${th.voltageWarn} % / ${th.voltageCrit} % en tensión). ΔT entre fases NETA MTS (${th.deltaTBaja}/${th.deltaTMedia}/${th.deltaTMayor}/${th.deltaTCritico} °C). Tendencias por regresión lineal mensual. Generado con FASE·3 Pro.</p>
</body></html>`;
}

export function openHtml(html) {
  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const w = window.open(url, "_blank");
  if (!w) { const a = document.createElement("a"); a.href = url; a.download = "informe.html"; a.click(); }
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

/* ───────── Excel modelado para Power BI ─────────
   Tablas planas, una fila por registro, con claves para relacionar:
   Lecturas (hechos) · Mediciones (formato largo) · Equipos (dimensión) · Hallazgos · Umbrales */
const asDate = (iso) => { const [d, t = "00:00"] = iso.split("T"); const [y, m, dd] = d.split("-").map(Number); const [h, mi] = t.split(":").map(Number); return new Date(Date.UTC(y, m - 1, dd, h || 0, mi || 0)); };
const cellN = (x) => (x === null || x === undefined || !Number.isFinite(x) ? null : { type: Number, value: Math.round(x * 1000) / 1000 });
const cellS = (x) => (x === null || x === undefined || x === "" ? null : { type: String, value: String(x) });
const cellD = (iso, f = "yyyy-mm-dd hh:mm") => ({ type: Date, value: asDate(iso), format: f });
const H = (arr) => arr.map((v) => ({ value: v, fontWeight: "bold" }));
const MAG = { "°C": "Temperatura", A: "Corriente", V: "Tensión", kV: "Tensión", "%": "Porcentaje", Hz: "Frecuencia", kW: "Potencia", h: "Horas", "": "Cantidad" };

export async function excelReport({ items, readings, from, to, th, orgName, scope, ccms = [], plants = [] }) {
  const { default: writeXlsxFile } = await import("write-excel-file");
  const { list, readings: rs } = scopeData({ items, readings, from, to, th, scope });
  const ccmName = (id) => (ccms.find((c) => c.id === id) || {}).name || "Sin CCM";
  const plantName = (id) => (plants.find((p) => p.id === id) || {}).name || "";
  const eqMap = Object.fromEntries(list.map((i) => [i.eq.id, i]));
  const sorted = rs.slice().sort((a, b) => (a.date < b.date ? -1 : 1));

  // Columnas de valores: todas las que aparezcan en el periodo, con su sección
  const fieldInfo = {};
  Object.entries(TYPES).forEach(([, T]) => T.sections.forEach((s) => s.groups.forEach((g) => g.fields.forEach((f) => {
    if (!fieldInfo[f.k]) fieldInfo[f.k] = { ...f, section: s.title, group: g.title || "" };
  }))));
  const used = Object.keys(fieldInfo).filter((k) => sorted.some((r) => r.values && r.values[k] !== undefined && r.values[k] !== ""));
  const colName = (k) => { const f = fieldInfo[k]; return (k + (f.unit ? "_" + f.unit.replace("°C", "C").replace("%", "pct") : "")).replace(/[^\w]/g, "_"); };

  // 1) Lecturas (tabla de hechos)
  const lect = [H(["ID_Lectura", "Fecha", "Dia", "Anio", "Mes", "ID_Equipo", "Equipo", "Tipo", "ID_CCM", "CCM", "Planta", "Tecnico", "Estado", "Severidad", "Desb_Corriente_pct", "Desb_Tension_pct", "DeltaT_C", "Carga_pct", ...used.map(colName), "Notas"])];
  // 2) Mediciones (formato largo, ideal para segmentar en Power BI)
  const med = [H(["ID_Lectura", "Fecha", "ID_Equipo", "Equipo", "CCM", "Planta", "Magnitud", "Seccion", "Punto", "Variable", "Valor", "Unidad"])];
  sorted.forEach((r) => {
    const it = eqMap[r.equipmentId];
    if (!it) return;
    const ev = evaluate(it.eq.type, r.values || {}, th, it.eq.plate || {});
    const load = ev.rows.find((x) => x.id === "load");
    const d = asDate(r.date);
    lect.push([
      cellS(r.id), cellD(r.date), cellD(r.date.slice(0, 10), "yyyy-mm-dd"), cellN(d.getUTCFullYear()), cellN(d.getUTCMonth() + 1),
      cellS(it.eq.id), cellS(it.eq.name), cellS(it.eq.typeLabel || it.T.label), cellS(it.eq.ccmId), cellS(ccmName(it.eq.ccmId)), cellS(plantName(it.eq.plantId)),
      cellS(r.userName), cellS(LEVELS[ev.worst].label), cellN(LEVELS[ev.worst].rank),
      cellN(ev.cI && ev.cI.value), cellN(ev.cV && ev.cV.value), cellN(ev.dT && ev.dT.value), cellN(load && load.raw && load.raw.value),
      ...used.map((k) => { const x = num(r.values && r.values[k]); return x !== null ? cellN(x) : cellS(r.values && r.values[k]); }),
      cellS(r.notes)
    ]);
    used.forEach((k) => {
      const raw = r.values && r.values[k];
      if (raw === undefined || raw === "") return;
      const f = fieldInfo[k];
      const x = num(raw);
      med.push([cellS(r.id), cellD(r.date), cellS(it.eq.id), cellS(it.eq.name), cellS(ccmName(it.eq.ccmId)), cellS(plantName(it.eq.plantId)),
        cellS(f.kind === "choice" ? "Inspección" : MAG[f.unit] || "Otro"), cellS(f.section + (f.group ? " · " + f.group : "")), cellS(f.tag || f.name), cellS(k), x !== null ? cellN(x) : cellS(raw), cellS(f.unit || "")]);
    });
  });

  // 3) Equipos (dimensión con estado y tendencia)
  const eqs = [H(["ID_Equipo", "Equipo", "Tipo", "ID_CCM", "CCM", "Planta", "Estado", "Severidad", "Ultima_lectura", "Lecturas_periodo", "DeltaT_actual_C", "Tendencia_DeltaT_C_mes", "Tendencia_Tmax_C_mes", "Meses_a_def_mayor", "Hallazgo_principal", "Recomendacion", "Plazo"])];
  // 4) Hallazgos (uno por fila)
  const hall = [H(["ID_Equipo", "Equipo", "CCM", "Planta", "Nivel", "Severidad", "Hallazgo", "Detalle", "Causas_probables", "Recomendacion", "Plazo"])];
  list.forEach((i) => {
    const d0 = i.diag[0];
    eqs.push([cellS(i.eq.id), cellS(i.eq.name), cellS(i.eq.typeLabel || i.T.label), cellS(i.eq.ccmId), cellS(ccmName(i.eq.ccmId)), cellS(plantName(i.eq.plantId)),
      cellS(LEVELS[i.level].label), cellN(i.rank), i.last ? cellD(i.last.date) : null, cellN(i.readings.length), cellN(i.ev && i.ev.dT && i.ev.dT.value),
      cellN(i.dtTrend), cellN(i.tTrend), cellN(i.monthsToMajor), cellS(d0 ? d0.title : "Sin hallazgos"), cellS(d0 && d0.rec[0] ? d0.rec[0] : "Mantener rutina"), cellS(PLAZO[i.level])]);
    i.diag.forEach((d) => hall.push([cellS(i.eq.id), cellS(i.eq.name), cellS(ccmName(i.eq.ccmId)), cellS(plantName(i.eq.plantId)), cellS(LEVELS[d.level].label), cellN(LEVELS[d.level].rank),
      cellS(d.title), cellS(d.detail), cellS(d.causes.join("; ")), cellS(d.rec.join("; ")), cellS(PLAZO[d.level])]));
  });
  // 5) Umbrales
  const um = [H(["Parametro", "Valor", "Unidad"]),
    ...[["Desbalance corriente · precaución", th.currentWarn, "%"], ["Desbalance corriente · crítico", th.currentCrit, "%"], ["Desbalance tensión · precaución", th.voltageWarn, "%"], ["Desbalance tensión · crítico", th.voltageCrit, "%"],
      ["ΔT posible deficiencia", th.deltaTBaja, "°C"], ["ΔT deficiencia probable", th.deltaTMedia, "°C"], ["ΔT deficiencia mayor", th.deltaTMayor, "°C"], ["ΔT crítico", th.deltaTCritico, "°C"]].map(([a, b, c]) => [cellS(a), cellN(b), cellS(c)])];

  const w = (row, def = 14) => row.map((c) => ({ width: /Notas|Detalle|Hallazgo|Recomend|Causas|Equipo$/.test(c.value) ? 32 : /Fecha|Ultima/.test(c.value) ? 17 : def }));
  const safe = String(scope.kind === "eq" ? (list[0] && list[0].eq.name) || "equipo" : scope.kind === "ccm" ? ccmName(scope.ccmId) : orgName || "General").replace(/[^\w-]+/g, "_").slice(0, 40);
  await writeXlsxFile([lect, med, eqs, hall, um], {
    sheets: ["Lecturas", "Mediciones", "Equipos", "Hallazgos", "Umbrales"],
    columns: [w(lect[0]), w(med[0]), w(eqs[0]), w(hall[0]), [{ width: 34 }, { width: 10 }, { width: 8 }]],
    stickyRowsCount: 1,
    fileName: `FASE3_${safe}_${from}_a_${to}.xlsx`
  });
}
