// Informes: HTML imprimible (Guardar como PDF) y Excel. Nombres con fecha LOCAL.
import { LEVELS, fmtDate, localDay, num } from "./calc.js";
import { TYPES, allFields, evaluate } from "./templates.js";
import { diagnoseItem } from "./ai.js";

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

export function htmlReport({ orgName, items, readings, from, to, th, plantName }) {
  const inRange = (r) => r.date.slice(0, 10) >= from && r.date.slice(0, 10) <= to;
  const rs = readings.filter(inRange);
  const eqIds = new Set(rs.map((r) => r.equipmentId));
  const list = items.filter((i) => eqIds.has(i.eq.id)).sort((a, b) => b.rank - a.rank);
  const count = (k) => list.filter((i) => i.level === k).length;
  const rows = list.map((i) => {
    const last = rs.filter((r) => r.equipmentId === i.eq.id).sort((a, b) => (a.date < b.date ? 1 : -1))[0];
    const ev = evaluate(i.eq.type, last.values || {}, th, i.eq.plate || {});
    const d = diagnoseItem({ ...i, ev }, th);
    const L = LEVELS[ev.worst];
    return `<section><h3><span class="dot" style="background:${L.color}"></span>${esc(i.eq.name)} <small>${esc(TYPES[i.eq.type].label)} · ${fmtDate(last.date)} · ${esc(last.userName || "")}</small></h3>
      <table><tr>${ev.rows.map((r) => `<th>${esc(r.name)}</th>`).join("")}</tr><tr>${ev.rows.map((r) => `<td><b>${esc(r.value)}</b><br><span style="color:${LEVELS[r.level].color === "#7BE0A0" ? "#1d8a4a" : LEVELS[r.level].color}">${esc(LEVELS[r.level].label)}</span></td>`).join("")}</tr></table>
      ${d.length ? `<ul>${d.map((x) => `<li><b>${esc(x.title)}.</b> ${esc(x.detail)}${x.rec[0] ? ` <i>Acción: ${esc(x.rec[0])}.</i>` : ""}</li>`).join("")}</ul>` : ""}
      ${last.notes ? `<p class="n">Nota: ${esc(last.notes)}</p>` : ""}</section>`;
  }).join("");
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Informe ${esc(orgName)} ${from} a ${to}</title>
<style>body{font:14px/1.45 system-ui,sans-serif;color:#16171A;max-width:880px;margin:24px auto;padding:0 16px}h1{font-size:24px;margin:0}h3{font-size:15px;margin:18px 0 6px;display:flex;align-items:center;gap:8px;flex-wrap:wrap}h3 small{color:#666;font-weight:400}.dot{width:10px;height:10px;border-radius:50%;display:inline-block}table{border-collapse:collapse;width:100%;font-size:12px}th,td{border:1px solid #ddd;padding:6px;text-align:left;vertical-align:top}th{background:#f4f4f6}.kpi{display:flex;gap:10px;margin:14px 0;flex-wrap:wrap}.kpi div{border:1px solid #ddd;border-radius:10px;padding:8px 12px}.kpi b{font-size:20px;display:block}ul{margin:6px 0;padding-left:18px}.n{color:#555;font-style:italic}section{break-inside:avoid;border-bottom:1px solid #eee;padding-bottom:10px}.btn{position:fixed;right:16px;top:16px;padding:10px 16px;border-radius:10px;border:0;background:#16171A;color:#fff;font-weight:600}@media print{.btn{display:none}}</style></head><body>
<button class="btn" onclick="print()">Guardar PDF / Imprimir</button>
<h1>Informe de mantenimiento predictivo</h1><p>${esc(orgName)}${plantName ? " · " + esc(plantName) : ""} · ${fmtDate(from, false)} al ${fmtDate(to, false)} · generado ${fmtDate(localDay(), false)}</p>
<div class="kpi"><div><b>${rs.length}</b>lecturas</div><div><b>${list.length}</b>equipos</div><div><b>${count("critico") + count("mayor")}</b>intervenir</div><div><b>${count("precaucion") + count("media")}</b>precaución</div><div><b>${count("normal") + count("baja")}</b>normales</div></div>
${rows || "<p>No hay lecturas en el rango.</p>"}
<p style="color:#888;font-size:11px;margin-top:24px">Criterios: desbalance NEMA MG1 (máx. desviación del promedio); ΔT entre fases NETA MTS. Generado con FASE·3 Pro.</p></body></html>`;
}

export function openHtml(html) {
  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const w = window.open(url, "_blank");
  if (!w) { const a = document.createElement("a"); a.href = url; a.download = "informe.html"; a.click(); }
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

export async function excelReport({ items, readings, from, to, th, orgName }) {
  const { default: writeXlsxFile } = await import("write-excel-file");
  const eqMap = Object.fromEntries(items.map((i) => [i.eq.id, i.eq]));
  const rs = readings.filter((r) => r.date.slice(0, 10) >= from && r.date.slice(0, 10) <= to).sort((a, b) => (a.date < b.date ? -1 : 1));
  const keys = [];
  const seen = new Set();
  Object.keys(TYPES).forEach((t) => allFields(t).forEach((f) => { if (!seen.has(f.k)) { seen.add(f.k); keys.push(f); } }));
  const used = keys.filter((f) => rs.some((r) => r.values && r.values[f.k] !== undefined && r.values[f.k] !== ""));
  const B = (v) => ({ value: v, fontWeight: "bold" });
  const header = [B("Fecha"), B("Equipo"), B("Tipo"), B("Técnico"), B("Estado"), B("Desb. I %"), B("Desb. V %"), B("ΔT °C"), ...used.map((f) => B(`${f.name || f.tag} ${f.unit ? "(" + f.unit + ")" : ""}`.trim())), B("Notas")];
  const data = [header];
  rs.forEach((r) => {
    const eq = eqMap[r.equipmentId];
    if (!eq) return;
    const ev = evaluate(eq.type, r.values || {}, th, eq.plate || {});
    const n = (x) => (x === null || x === undefined ? null : { type: Number, value: Math.round(x * 100) / 100 });
    data.push([
      { type: String, value: r.date.replace("T", " ") }, { type: String, value: eq.name }, { type: String, value: TYPES[eq.type].label },
      { type: String, value: r.userName || "" }, { type: String, value: LEVELS[ev.worst].label },
      n(ev.cI && ev.cI.value), n(ev.cV && ev.cV.value), n(ev.dT && ev.dT.value),
      ...used.map((f) => { const v = r.values ? r.values[f.k] : null; const x = num(v); return x !== null ? { type: Number, value: x } : v ? { type: String, value: String(v) } : null; }),
      { type: String, value: r.notes || "" }
    ]);
  });
  const safe = String(orgName || "FASE3").replace(/[^\w-]+/g, "_");
  await writeXlsxFile(data, { fileName: `Lecturas_${safe}_${from}_a_${to}.xlsx`, columns: header.map((_, k) => ({ width: k === 1 ? 30 : k === header.length - 1 ? 40 : 14 })) });
}
