// IA de FASE·3 Pro
//  1) Motor de reglas LOCAL (gratis, sin internet): diagnóstico, revisión de
//     lecturas, resumen del día y respuestas del asistente.
//  2) Gemini OPCIONAL (capa gratuita de Google) con la clave que el usuario
//     pega en Más → IA. La clave queda solo en este dispositivo.
import { LEVELS, DT_ACTION, fmt, num, localDay, relDays } from "./calc.js";
import { TYPES, allFields } from "./templates.js";

/* ───────── Diagnóstico por reglas ───────── */
const CAUSES = {
  dI: {
    txt: "Desbalance de corriente",
    causes: ["Conexión floja o con alta resistencia en una fase", "Desbalance de tensión de la red (se multiplica 6–10 veces en la corriente)", "Devanado con espiras en corto o daño en el aislamiento"],
    rec: ["Medir tensión por fase en el mismo momento: si también está desbalanceada, el origen es la alimentación", "Revisar y reapretar bornes, contactor y breaker de la fase alta", "Si persiste con tensión balanceada: prueba de resistencia de devanados y megger"]
  },
  dV: {
    txt: "Desbalance de tensión",
    causes: ["Cargas monofásicas mal repartidas", "Conexión deficiente aguas arriba", "Fusible o contacto de banco de capacitores abierto"],
    rec: ["Verificar la tensión en el tablero de origen", "Revisar el reparto de cargas monofásicas", "NEMA MG1: sobre 1 % de desbalance hay que reducir la carga del motor (derating)"]
  },
  dT: {
    txt: "ΔT alto entre fases",
    causes: ["Conexión floja, oxidada o con torque insuficiente", "Terminal subdimensionado o dañado", "Carga desbalanceada entre fases"],
    rec: ["Desenergizar, limpiar y reapretar al torque del fabricante", "Reemplazar terminales con signos de sobrecalentamiento", "Repetir la termografía con al menos 40 % de carga para confirmar"]
  },
  load: {
    txt: "Carga fuera de rango",
    causes: ["Sobrecarga mecánica o proceso por encima del diseño", "Tensión baja (sube la corriente)"],
    rec: ["Comparar con la corriente de placa", "Verificar el acople y la carga mecánica"]
  },
  rod: {
    txt: "Rodamientos con temperaturas distintas",
    causes: ["Falta o exceso de lubricación", "Desalineación o tensión excesiva de correas", "Desgaste del rodamiento"],
    rec: ["Revisar el plan de lubricación", "Medir vibraciones y alineación"]
  },
  insp: {
    txt: "Hallazgo en la inspección visual",
    causes: ["Condición física anormal reportada por el técnico"],
    rec: ["Programar intervención y registrar con foto"]
  },
  rip: {
    txt: "Rizado DC alto",
    causes: ["Capacitores del filtro degradados", "Diodo o tiristor del puente abierto"],
    rec: ["Medir capacitancia/ESR del filtro", "Revisar el puente rectificador con termografía"]
  }
};

export function diagnoseItem(item, th) {
  const out = [];
  if (!item.ev) return out;
  item.ev.rows.forEach((r) => {
    if (!r.level || r.level === "none" || r.level === "normal") return;
    const c = CAUSES[r.id] || { txt: r.name, causes: [], rec: [] };
    let detail = `${r.name}${r.value ? ": " + r.value : ""}`;
    if (r.id === "dT") detail += ` — ${(DT_ACTION[r.level] || "").replace(/\.$/, "")}`;
    out.push({ id: r.id, level: r.level, title: c.txt, detail, causes: c.causes, rec: c.rec });
  });
  if (item.monthsToMajor !== null && item.monthsToMajor < 6) {
    out.push({
      id: "trend", level: "precaucion", title: "Tendencia de calentamiento",
      detail: `El ΔT sube ${fmt(item.dtTrend)} °C por mes. A este ritmo llega a deficiencia mayor (${th.deltaTMayor} °C) en ~${Math.max(1, Math.round(item.monthsToMajor))} ${Math.round(item.monthsToMajor) === 1 ? "mes" : "meses"}.`,
      causes: ["Conexión que se degrada con cada ciclo térmico"], rec: ["Adelantar la intervención antes de la fecha proyectada", "Aumentar la frecuencia de inspección a mensual"]
    });
  } else if (item.tTrend && item.tTrend > 1.5) {
    out.push({ id: "trendT", level: "baja", title: "Temperatura máxima en aumento", detail: `Sube ${fmt(item.tTrend)} °C por mes.`, causes: ["Aumento de carga o deterioro progresivo"], rec: ["Vigilar en las próximas rutas"] });
  }
  if (item.ev.rows.find((r) => r.note)) {
    const n = item.ev.rows.find((r) => r.note);
    out.push({ id: "note", level: "baja", title: "Condición de medición", detail: n.note, causes: [], rec: [] });
  }
  return out.sort((a, b) => LEVELS[b.level].rank - LEVELS[a.level].rank);
}

/* ───────── Revisión de una lectura antes de guardar ───────── */
export function reviewReading(type, values, prev, plate, th) {
  const notes = [];
  const fields = allFields(type).filter((f) => f.kind !== "choice");
  const missing = fields.filter((f) => !f.optional && num(values[f.k]) === null);
  if (missing.length) notes.push({ level: "precaucion", text: `Faltan ${missing.length} valores obligatorios (${missing.slice(0, 4).map((f) => f.name || f.tag + " " + f.unit).join(", ")}${missing.length > 4 ? "…" : ""}).` });
  if (prev) {
    fields.forEach((f) => {
      const a = num(values[f.k]), b = num(prev.values && prev.values[f.k]);
      if (a === null || b === null || !b) return;
      const ch = Math.abs(a - b) / Math.abs(b);
      if (ch > 0.35 && Math.abs(a - b) > 3) notes.push({ level: "baja", text: `${f.name || f.tag} (${f.unit}) cambió ${fmt(ch * 100, 0)} % respecto a la lectura anterior (${fmt(b)} → ${fmt(a)}). ¿Es correcto?` });
    });
  }
  const tmax = num(values.tMax);
  const phases = ["tL1", "tL2", "tL3"].map((k) => num(values[k])).filter((x) => x !== null);
  if (tmax !== null && phases.length && tmax < Math.max(...phases)) notes.push({ level: "baja", text: "El punto máximo es menor que una de las fases. El máximo debería ser la temperatura más alta encontrada." });
  const vn = num(plate && plate.vn);
  ["vL1", "vL2", "vL3"].forEach((k) => {
    const v = num(values[k]);
    if (vn && v !== null && Math.abs(v - vn) / vn > 0.1) notes.push({ level: "precaucion", text: `${k.slice(1)}: ${fmt(v, 0)} V está a más de 10 % de la tensión de placa (${fmt(vn, 0)} V).` });
  });
  fields.forEach((f) => {
    const v = num(values[f.k]);
    if (v !== null && f.unit === "°C" && (v > 250 || v < -20)) notes.push({ level: "precaucion", text: `${f.name || f.tag}: ${fmt(v)} °C parece un error de digitación.` });
  });
  if (!notes.length) notes.push({ level: "normal", text: "Todo se ve coherente. Puedes guardar." });
  return notes;
}

/* ───────── Resumen del día ───────── */
export function daySummary(items, readings, users) {
  const today = localDay();
  const todays = readings.filter((r) => (r.date || "").slice(0, 10) === today);
  const byUser = {};
  todays.forEach((r) => { byUser[r.userName || "—"] = (byUser[r.userName || "—"] || 0) + 1; });
  const crit = items.filter((i) => i.rank >= 3);
  const warn = items.filter((i) => i.rank === 2);
  const rising = items.filter((i) => i.monthsToMajor !== null && i.monthsToMajor < 6);
  const stale = items.filter((i) => !i.last || (Date.now() - new Date(i.last.date).getTime()) / 86400000 > 45);
  const lines = [];
  lines.push(todays.length ? `Hoy se registraron ${todays.length} ${todays.length === 1 ? "lectura" : "lecturas"}${Object.keys(byUser).length > 1 ? " (" + Object.entries(byUser).map(([n, c]) => `${n.split(" ")[0]} ${c}`).join(", ") + ")" : ""}.` : "Hoy todavía no hay lecturas.");
  if (crit.length) lines.push(`${crit.length} ${crit.length === 1 ? "equipo requiere" : "equipos requieren"} intervención: ${crit.map((i) => i.eq.name.split(" · ")[0]).join(", ")}.`);
  if (warn.length) lines.push(`${warn.length} en precaución: ${warn.map((i) => i.eq.name.split(" · ")[0]).join(", ")}.`);
  if (rising.length) lines.push(`Tendencia a vigilar: ${rising.map((i) => `${i.eq.name.split(" · ")[0]} (~${Math.max(1, Math.round(i.monthsToMajor))} m)`).join(", ")}.`);
  if (stale.length) lines.push(`${stale.length} sin lectura en más de 45 días.`);
  if (!crit.length && !warn.length) lines.push("Ningún equipo en precaución o peor.");
  return { lines, todays: todays.length, crit: crit.length, warn: warn.length, rising: rising.length, stale: stale.length };
}

/* ───────── Asistente (reglas) ───────── */
const norm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

export function localAnswer(q, items, readings, th) {
  const t = norm(q);
  const findEq = () => items.find((i) => {
    const code = norm(i.eq.name.split(" · ")[0]);
    const full = norm(i.eq.name);
    return t.includes(code) || t.includes(code.replace(/-/g, " ")) || t.includes(code.replace(/-/g, "")) || full.split(" · ")[1] && t.includes(full.split(" · ")[1]);
  });
  const it = findEq();
  if (it) {
    if (!it.last) return `${it.eq.name} no tiene lecturas todavía.`;
    const d = diagnoseItem(it, th);
    const head = `${it.eq.name}: ${LEVELS[it.level].label}. Última lectura ${relDays(it.last.date)}.`;
    if (!d.length) return `${head} Sin hallazgos relevantes.`;
    return `${head} ${d.slice(0, 2).map((x) => `${["dI", "dV", "dT"].includes(x.id) ? "" : x.title + ": "}${x.detail.replace(/\.$/, "")}. Recomendación: ${(x.rec[0] || "vigilar").replace(/\.$/, "")}.`).join(" ")}`;
  }
  if (/resumen|hoy|dia|como vamos|estado/.test(t)) return daySummary(items, readings).lines.join(" ");
  if (/critic|urgente|prioridad|primero|peor|intervenir/.test(t)) {
    const top = items.filter((i) => i.rank >= 2).sort((a, b) => b.rank - a.rank).slice(0, 3);
    if (!top.length) return "No hay equipos en precaución ni críticos. Buen trabajo.";
    return "Prioridades: " + top.map((i, k) => `${k + 1}. ${i.eq.name.split(" · ")[0]} — ${LEVELS[i.level].label}`).join(". ") + ".";
  }
  if (/tendencia|subiendo|proyec|calentando/.test(t)) {
    const r = items.filter((i) => i.rising);
    return r.length ? "Con tendencia al alza: " + r.map((i) => `${i.eq.name.split(" · ")[0]} (${fmt(i.dtTrend || i.tTrend)} °C/mes)`).join(", ") + "." : "Ningún equipo muestra tendencia de calentamiento.";
  }
  if (/pendiente|sin lectura|falta|ruta/.test(t)) {
    const s = items.filter((i) => !i.last || (Date.now() - new Date(i.last.date).getTime()) / 86400000 > 30);
    return s.length ? `Sin lectura en el último mes: ${s.map((i) => i.eq.name.split(" · ")[0]).join(", ")}.` : "Todos los equipos tienen lectura del último mes.";
  }
  if (/desbalance/.test(t)) return "El desbalance se calcula como la máxima desviación respecto al promedio (NEMA MG1). Corriente: precaución desde " + th.currentWarn + " %, crítico desde " + th.currentCrit + " %. Tensión: " + th.voltageWarn + " % y " + th.voltageCrit + " %.";
  if (/delta|diferencia de temp|neta/.test(t)) return `ΔT entre fases (NETA): ${th.deltaTBaja}–${th.deltaTMedia - 1} °C posible deficiencia, ${th.deltaTMedia}–${th.deltaTMayor - 1} °C deficiencia probable, ${th.deltaTMayor}–${th.deltaTCritico} °C mayor, más de ${th.deltaTCritico} °C crítico.`;
  return "Puedo darte el resumen del día, las prioridades, las tendencias, los equipos pendientes o el estado de un equipo (dime su código, por ejemplo M-114). Con una clave de Gemini en Más → IA puedo responder preguntas abiertas y analizar fotos.";
}

/* ───────── Gemini (opcional) ───────── */
const KEY = "fase3pro-ai";
export function getAIConfig() {
  try { return { model: "", voice: true, ...JSON.parse(localStorage.getItem(KEY) || "{}") }; } catch (e) { return { model: "", voice: true }; }
}
export function setAIConfig(c) { try { localStorage.setItem(KEY, JSON.stringify(c)); } catch (e) { /* */ } }
export const hasGemini = () => !!getAIConfig().apiKey;

/* Elige solo el mejor modelo "flash" disponible para esa clave (Google cambia
   los nombres de modelos con el tiempo; así la app no se queda desactualizada). */
/* Lista de modelos "flash" disponibles para esa clave, del más nuevo al más antiguo
   (incluye los "lite", más livianos y con menos demanda). Google cambia los nombres
   con el tiempo; así la app no se queda desactualizada. */
let modelCache = null;
export async function listModels(apiKey) {
  if (modelCache && modelCache.key === apiKey) return modelCache.list;
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?pageSize=200&key=${encodeURIComponent(apiKey)}`);
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(/API key/i.test((d.error && d.error.message) || "") ? "La clave no es válida. Revísala en Más → IA y voz." : (d.error && d.error.message) || `Google respondió ${r.status}`);
  const names = (d.models || [])
    .filter((m) => (m.supportedGenerationMethods || []).includes("generateContent"))
    .map((m) => m.name.replace("models/", ""))
    .filter((n) => /^gemini-[\d.]+-flash(-lite)?(-latest)?$/.test(n) || /^gemini-flash(-lite)?-latest$/.test(n));
  if (!names.length) throw new Error("Tu clave no tiene modelos Flash disponibles.");
  const ver = (n) => parseFloat((n.match(/gemini-([\d.]+)/) || [0, 99])[1]);
  names.sort((a, b) => (a.includes("lite") ? 1 : 0) - (b.includes("lite") ? 1 : 0) || ver(b) - ver(a));
  modelCache = { key: apiKey, list: names };
  return names;
}
export async function pickModel(apiKey) { return (await listModels(apiKey))[0]; }

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function gemini(parts, { json = false } = {}) {
  const cfg = getAIConfig();
  const { apiKey } = cfg;
  if (!apiKey) throw new Error("Falta la clave de Gemini (Más → IA y voz).");
  const all = await listModels(apiKey);
  const order = cfg.model && all.includes(cfg.model) ? [cfg.model, ...all.filter((m) => m !== cfg.model)] : all;
  let lastErr = "";
  for (let i = 0; i < Math.min(order.length, 5); i++) {
    const model = order[i];
    for (let attempt = 0; attempt < 2; attempt++) {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ role: "user", parts }], generationConfig: { temperature: 0.3, ...(json ? { responseMimeType: "application/json" } : {}) } })
      }).catch(() => null);
      if (!res) { lastErr = "Sin conexión a internet."; break; }
      if (res.ok) {
        if (cfg.model !== model) setAIConfig({ ...getAIConfig(), model });
        const data = await res.json();
        return ((data.candidates || [])[0]?.content?.parts || []).map((p) => p.text || "").join("");
      }
      const e = await res.json().catch(() => ({}));
      const msg = (e.error && e.error.message) || `Gemini respondió ${res.status}`;
      if (res.status === 400 && /API key/i.test(msg)) throw new Error("La clave no es válida. Revísala en Más → IA y voz.");
      lastErr = msg;
      // 503 saturado / 500: esperar un poco y reintentar; luego probar otro modelo
      if ((res.status === 503 || res.status === 500) && attempt === 0) { await sleep(1500); continue; }
      break; // 404, 429 o segundo fallo → siguiente modelo
    }
  }
  if (/quota|rate|429|exhausted/i.test(lastErr)) throw new Error("Se alcanzó el límite gratuito por ahora. Intenta en unos minutos.");
  if (/high demand|overloaded|unavailable|503/i.test(lastErr)) throw new Error("Los modelos gratuitos de Google están saturados en este momento. Intenta de nuevo en unos minutos.");
  throw new Error(lastErr || "No se pudo consultar la IA.");
}
const imgPart = (dataUrl) => ({ inlineData: { mimeType: dataUrl.slice(5, dataUrl.indexOf(";")), data: dataUrl.split(",")[1] } });

const ROLE = "Eres un ingeniero de mantenimiento predictivo eléctrico (termografía NETA MTS, desbalance NEMA MG1, calidad de energía IEEE 519). Respondes en español, breve y práctico, con causas probables y acciones concretas. No inventes datos que no estén en el contexto.";

export function contextFor(items, th) {
  return items.map((i) => ({
    equipo: i.eq.name, tipo: i.T.label, estado: LEVELS[i.level].label, placa: i.eq.plate || {},
    ultima: i.last ? { fecha: i.last.date, valores: i.last.values, notas: i.last.notes || "" } : null,
    evaluacion: i.ev ? i.ev.rows.map((r) => `${r.name}: ${r.value} (${LEVELS[r.level].label})`) : [],
    tendenciaDT_Cmes: i.dtTrend ? +i.dtTrend.toFixed(2) : null
  })).concat([{ umbrales: th }]);
}

export async function testGemini() {
  const t = await gemini([{ text: "Responde solo: Conectado" }]);
  return { ok: true, model: getAIConfig().model, text: t.trim() };
}

export async function askGemini(question, items, th) {
  const ctx = JSON.stringify(contextFor(items, th));
  return gemini([{ text: `${ROLE}\n\nDatos de la planta (JSON):\n${ctx}\n\nPregunta del técnico: ${question}\n\nResponde en máximo 6 frases, sin markdown.` }]);
}

export async function analyzeFluke(images, item, values, th) {
  const ctx = item ? JSON.stringify(contextFor([item], th)[0]) : "sin equipo asociado";
  const parts = images.slice(0, 12).map((u) => imgPart(u));
  parts.push({ text: `${ROLE}\n\nSon pantallas guardadas de un analizador de calidad de energía Fluke 435-II (osciloscopio, eventos de fluctuación, tendencias, armónicos, potencia, etc.). Equipo: ${ctx}. Valores anotados por el técnico: ${JSON.stringify(values || {})}.\n\nResponde en español, sin markdown, con estas secciones en líneas separadas:\nLECTURAS: tensiones, corrientes, frecuencia y demás valores que se lean en las pantallas.\nHALLAZGOS: desbalances, distorsión de forma de onda o armónicos, caídas/huecos (fecha, fase, nivel y duración), y qué los produce probablemente.\nRIESGOS: qué fallas puede causar en motores, variadores, transformadores o capacitores.\nRECOMENDACIONES: acciones concretas y prioridad.\nSé breve (máximo 14 líneas).` });
  return gemini(parts);
}

export async function analyzePhoto(dataUrl, item, th) {
  const ctx = item ? JSON.stringify(contextFor([item], th)[0]) : "sin datos";
  return gemini([imgPart(dataUrl), { text: `${ROLE}\n\nAnaliza esta imagen (puede ser termográfica o visual) del equipo. Contexto: ${ctx}\n\nIndica: 1) qué se observa, 2) posibles fallas, 3) recomendación y prioridad. Máximo 6 frases, sin markdown.` }]);
}

export async function readNameplate(dataUrl) {
  const txt = await gemini([imgPart(dataUrl), { text: `Lee la placa de datos del equipo eléctrico de la foto. Devuelve SOLO JSON con: {"type": uno de "motor","tablero","trafo","gen","cap","rect", "name": texto corto (marca + modelo), "plate": {claves según tipo: motor→hp,vn,in,rpm; trafo→kva,vp(kV),vs(V),in; gen→kw,vn,in; cap→kvar,vn,pasos; rect→vac,vdc,in; tablero→vn,in} con números como texto usando punto decimal}. Si un dato no se lee, omítelo.` }], { json: true });
  const m = txt.match(/\{[\s\S]*\}/);
  const obj = JSON.parse(m ? m[0] : txt);
  if (!TYPES[obj.type]) obj.type = "motor";
  return obj;
}

export async function aiReview(type, values, prev, plate) {
  return gemini([{ text: `${ROLE}\n\nRevisa esta lectura de un ${TYPES[type].label} antes de guardarla. Placa: ${JSON.stringify(plate || {})}. Lectura: ${JSON.stringify(values)}. Anterior: ${JSON.stringify(prev ? prev.values : null)}. Señala posibles errores de digitación y hallazgos. Máximo 4 frases, sin markdown.` }]);
}

/* ───────── Voz (Web Speech API, gratis en el navegador) ───────── */
export function speak(text) {
  if (!("speechSynthesis" in window) || !getAIConfig().voice) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text.replace(/·/g, ","));
  u.lang = "es-ES";
  const v = window.speechSynthesis.getVoices().find((x) => x.lang && x.lang.startsWith("es"));
  if (v) u.voice = v;
  u.rate = 1.03;
  window.speechSynthesis.speak(u);
}
export const canListen = () => !!(window.SpeechRecognition || window.webkitSpeechRecognition);
export function listen(onText, onEnd) {
  const R = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!R) return null;
  const r = new R();
  r.lang = "es-CO";
  r.interimResults = true;
  r.onresult = (e) => onText(Array.from(e.results).map((x) => x[0].transcript).join(" "), e.results[e.results.length - 1].isFinal);
  r.onend = onEnd;
  r.onerror = onEnd;
  r.start();
  return r;
}
