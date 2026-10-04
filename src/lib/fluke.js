// Lector de pantallas guardadas del Fluke 435-II (archivos SCREENn.INT de la memoria).
// Formato: cabecera con modelo / serie / firmware, luego "FBRLE2D", fecha (7 bytes),
// paleta de 64 colores RGB y la imagen 320×240 comprimida con RLE 2D:
//   byte con bit 7 → color (7 bits) repetido (siguiente byte + 2) veces
//   byte sin bit 7  → un solo píxel
//   color 127 = igual al píxel de la línea anterior; 126 = igual a dos líneas arriba.

const W = 320, H = 240;
const ascii = (u8, a, b) => String.fromCharCode(...u8.slice(a, b)).replace(/\0/g, "").trim();

export function decodeFlukeScreen(buf) {
  const u8 = new Uint8Array(buf);
  const sig = [70, 66, 82, 76, 69, 50, 68]; // FBRLE2D
  let at = -1;
  for (let i = 0; i < u8.length - 7 && at < 0; i++) if (sig.every((c, k) => u8[i + k] === c)) at = i;
  if (at < 0) throw new Error("No es una pantalla del Fluke 435 (archivo SCREEN.INT).");
  const strings = (ascii(u8, 0, at).match(/[ -~]{4,}/g) || []).map((s) => s.trim());
  const i = at + 8;
  const t = u8.slice(i, i + 7);
  const year = ((t[0] << 8) | t[1]) + 100;
  const pad = (n) => String(n).padStart(2, "0");
  const date = year > 2000 && year < 2100 && t[2] >= 1 && t[2] <= 12 ? `${year}-${pad(t[2])}-${pad(t[3])}T${pad(t[4])}:${pad(t[5])}:${pad(t[6])}` : "";
  const pal = u8.slice(i + 7, i + 7 + 192);
  const data = u8.slice(i + 199);
  const px = new Uint8Array(W * H);
  let k = 0;
  const put = (c) => {
    if (k >= px.length) return;
    px[k] = c === 127 ? (k >= W ? px[k - W] : 0) : c === 126 ? (k >= 2 * W ? px[k - 2 * W] : 0) : c;
    k++;
  };
  for (let j = 0; j < data.length && k < px.length; ) {
    const b = data[j];
    if (b & 0x80) { const n = data[j + 1] + 2; for (let r = 0; r < n; r++) put(b & 0x7f); j += 2; }
    else { put(b); j += 1; }
  }
  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d");
  const img = ctx.createImageData(W, H);
  for (let p = 0; p < px.length; p++) {
    const c = (px[p] % 64) * 3;
    img.data[p * 4] = pal[c]; img.data[p * 4 + 1] = pal[c + 1]; img.data[p * 4 + 2] = pal[c + 2]; img.data[p * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const screen = strings.find((s) => /^SCREEN/i.test(s)) || "";
  return {
    dataUrl: canvas.toDataURL("image/png"),
    date,
    screen,
    serial: strings.find((s) => /^\d{6,}$/.test(s)) || "",
    model: strings.find((s) => /43\d/.test(s) && !/\//.test(s)) || "Fluke 435",
    firmware: strings.find((s) => /^V\d/.test(s)) || ""
  };
}

/* Grabación de la carpeta DATA/DAT0000n (MEAS.ADM). Fechas: segundos desde 1-ene-2010.
   Resumen: Hz @100; V L-L (rms, factor de cresta, pico) @104/116/128; I @152/164/176.
   Eventos: registros de 24 bytes [t u32][u32][f32][f32][nivel f32][f32]. */
const EPOCH = Date.UTC(2010, 0, 1) / 1000;
const isoOf = (t) => { const d = new Date((EPOCH + t) * 1000); const p = (n) => String(n).padStart(2, "0"); return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}T${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}`; };
export function parseMeasADM(buf) {
  const dv = new DataView(buf);
  const u32 = (o) => dv.getUint32(o, true), f32 = (o) => dv.getFloat32(o, true);
  if (buf.byteLength < 200) throw new Error("MEAS.ADM incompleto.");
  const end = u32(24), start = u32(52);
  if (!(start > 3e8 && end >= start && end - start < 400 * 86400)) throw new Error("No se reconoce el formato de MEAS.ADM.");
  const tri = (o) => [0, 1, 2].map((k) => ({ rms: f32(o + k * 12), cf: f32(o + k * 12 + 4), peak: f32(o + k * 12 + 8) }));
  const ok = (x) => Number.isFinite(x) && x >= 0 && x < 1e5;
  const V = tri(104).map((x) => ({ ...x, cf: ok(x.cf) && x.cf < 10 ? x.cf : null }));
  const I = tri(152).map((x) => ({ ...x, cf: ok(x.cf) && x.cf < 10 ? x.cf : null }));
  const hz = f32(100);
  // eventos
  const recs = [];
  const lim = Math.min(buf.byteLength - 24, 200000);
  for (let o = 1000; o < lim; o += 4) {
    const t = u32(o);
    if (t < start - 3600 || t > end + 3600) continue;
    const v = f32(o + 16);
    if (Number.isFinite(v) && v > 0.05 && v < 700) recs.push({ t, v });
  }
  recs.sort((a, b) => a.t - b.t);
  const events = [];
  recs.forEach((r) => {
    const last = events[events.length - 1];
    if (last && r.t - last.tEnd <= 1) { last.tEnd = r.t; last.min = Math.min(last.min, r.v); last.max = Math.max(last.max, r.v); last.values.push(r.v); }
    else events.push({ t: r.t, tEnd: r.t, min: r.v, max: r.v, values: [r.v] });
  });
  return {
    start: isoOf(start), end: isoOf(end), hours: (end - start) / 3600,
    hz: ok(hz) && hz > 40 && hz < 70 ? hz : null,
    V: V.map((x) => (ok(x.rms) ? x : { rms: null })), I: I.map((x) => (ok(x.rms) ? x : { rms: null })),
    events: events.filter((e) => !(e.values.length === 1 && e.t >= end - 2)).map((e) => ({ date: isoOf(e.t), min: e.min, max: e.max, values: e.values.slice(0, 12) }))
  };
}
export function classifyEvent(e, nominal = 480) {
  if (e.min < nominal * 0.05) return { type: "Interrupción", level: "critico" };
  if (e.min < nominal * 0.7) return { type: "Hueco profundo", level: "mayor" };
  if (e.min < nominal * 0.9) return { type: "Hueco", level: "precaucion" };
  if (e.max > nominal * 1.1) return { type: "Sobretensión", level: "precaucion" };
  return { type: "Variación", level: "baja" };
}

export async function readPowerFiles(fileList, compress) {
  const out = [];
  const errors = [];
  const recordings = [];
  let setupName = "", norm = "";
  for (const f of Array.from(fileList || [])) {
    const name = f.name || "";
    try {
      if (/\.idx$/i.test(name)) continue; // índices de la memoria
      if (/^setup\.bin$/i.test(name) || /^limits\.bin$/i.test(name)) {
        const u8 = new Uint8Array(await f.arrayBuffer());
        const strs = (String.fromCharCode(...u8.slice(0, 400)).match(/[ -~]{4,}/g) || []).map((x) => x.trim());
        if (/^setup/i.test(name) && strs[0] && !/^MEAS \d+$/.test(strs[0])) setupName = strs[0].replace(/\s+/g, " ");
        if (/^limits/i.test(name)) norm = strs.find((x) => /EN\s?50160|IEC|IEEE|NTC/i.test(x)) || norm;
        continue;
      }
      if (/\.adm$/i.test(name)) { recordings.push(parseMeasADM(await f.arrayBuffer())); continue; }
      if (/\.int$/i.test(name) || !f.type) {
        const r = decodeFlukeScreen(await f.arrayBuffer());
        out.push({ ...r, name });
      } else if (/^image\//.test(f.type)) {
        out.push({ dataUrl: await compress(f), date: "", screen: name, name });
      }
    } catch (e) { errors.push(`${name}: ${e.message}`); }
  }
  out.sort((a, b) => (a.screen || a.name).localeCompare(b.screen || b.name, "en", { numeric: true }));
  recordings.forEach((r) => { r.name = setupName; r.norm = norm; });
  return { shots: out, errors, recordings };
}

/* Evaluación local de valores medidos (opcionales). Criterios:
   tensión ±10 % de la nominal y frecuencia ±1 % (EN 50160), desbalance de
   tensión NEMA MG1 (>1 % derrateo, >2 % precaución, >3 % crítico),
   THD-V 5 % / 8 % (IEEE 519 / EN 50160) y THD-I 20 % / 40 % orientativo. */
export function evaluatePQ(v, nominalV = 480, nominalHz = 60) {
  const n = (k) => { const x = parseFloat(String(v[k] ?? "").replace(",", ".")); return Number.isFinite(x) ? x : null; };
  const rows = [];
  const tri = (keys) => { const a = keys.map(n); return a.every((x) => x !== null) ? a : null; };
  const unb = (a) => { const m = (a[0] + a[1] + a[2]) / 3; return m ? Math.max(...a.map((x) => Math.abs(x - m))) / m * 100 : null; };
  const V = tri(["v1", "v2", "v3"]);
  if (V) {
    const dev = Math.max(...V.map((x) => Math.abs(x - nominalV) / nominalV * 100));
    rows.push({ id: "vdev", name: `Tensión vs nominal (${nominalV} V)`, value: dev.toFixed(1).replace(".", ",") + " %", level: dev > 10 ? "critico" : dev > 5 ? "baja" : "normal",
      note: dev > 10 ? "Fuera de ±10 %: revisar taps del transformador y caídas en alimentadores." : dev > 5 ? "Dentro de norma, pero cerca del límite." : "" });
    const u = unb(V);
    rows.push({ id: "vunb", name: "Desbalance de tensión", value: u.toFixed(2).replace(".", ",") + " %", level: u > 3 ? "critico" : u > 2 ? "precaucion" : u > 1 ? "baja" : "normal",
      note: u > 1 ? "Por encima de 1 % los motores se deben derratear (NEMA MG1)." : "" });
  }
  const I = tri(["i1", "i2", "i3"]);
  if (I) {
    const u = unb(I);
    rows.push({ id: "iunb", name: "Desbalance de corriente", value: u.toFixed(1).replace(".", ",") + " %", level: u > 20 ? "critico" : u > 10 ? "precaucion" : "normal" });
  }
  const hz = n("hz");
  if (hz !== null) {
    const d = Math.abs(hz - nominalHz) / nominalHz * 100;
    rows.push({ id: "hz", name: "Frecuencia", value: hz.toFixed(3).replace(".", ",") + " Hz", level: d > 1 ? "precaucion" : "normal" });
  }
  const thdv = n("thdv");
  if (thdv !== null) rows.push({ id: "thdv", name: "THD de tensión", value: thdv.toFixed(1).replace(".", ",") + " %", level: thdv > 8 ? "critico" : thdv > 5 ? "precaucion" : "normal",
    note: thdv > 5 ? "Distorsión alta: evaluar filtros de armónicos o reactancias de línea en los variadores." : "" });
  const thdi = n("thdi");
  if (thdi !== null) rows.push({ id: "thdi", name: "THD de corriente", value: thdi.toFixed(1).replace(".", ",") + " %", level: thdi > 40 ? "mayor" : thdi > 20 ? "precaucion" : "normal",
    note: thdi > 20 ? "Típico de variadores o rectificadores de 6 pulsos sin filtro; calienta transformadores y neutros." : "" });
  const pf = n("pf");
  if (pf !== null) rows.push({ id: "pf", name: "Factor de potencia", value: pf.toFixed(2).replace(".", ","), level: pf < 0.85 ? "precaucion" : pf < 0.9 ? "baja" : "normal",
    note: pf < 0.9 ? "Bajo: revisar banco de capacitores (pasos y fusibles)." : "" });
  return rows;
}
