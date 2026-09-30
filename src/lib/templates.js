// Plantillas de puntos de medida por tipo de equipo.
import { num, fmt, imbalance, deltaT, worstOf } from "./calc.js";

export const ICON = {
  i: "M13 2 4 14h7l-1 8 9-12h-7z",
  v: "M2 12h4l3-7 6 14 3-7h4",
  t: "M10 13.5V5a2 2 0 1 1 4 0v8.5a4 4 0 1 1-4 0z",
  eye: "M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
  inp: "M3 12h13M11 6l6 6-6 6M21 4v16",
  out: "M3 4v16M8 12h13M15 6l6 6-6 6",
  dc: "M4 9h16M4 15h4M10 15h4M16 15h4"
};

const P3 = (pre, unit, ph = "0.0") => [
  { k: pre + "L1", tag: "L1", unit, ph },
  { k: pre + "L2", tag: "L2", unit, ph },
  { k: pre + "L3", tag: "L3", unit, ph }
];
const TEMP4 = () => [...P3("t", "°C"), { k: "tMax", tag: "MÁX", name: "Punto máximo", unit: "°C", ph: "0.0" }];
const opt = (k, tag, name, unit) => ({ k, tag, name, unit, ph: "—", optional: true });
const choice = (k, name, opts) => ({ k, name, kind: "choice", opts, optional: true });

export const TYPES = {
  motor: {
    label: "Motor", color: "#B9A6FF",
    icon: "M4 8h12v8H4zM16 11h4M8 16v3M12 16v3M7 8V6h6v2",
    plate: [{ k: "hp", label: "Potencia", unit: "HP" }, { k: "vn", label: "Tensión", unit: "V" }, { k: "in", label: "Corriente nominal", unit: "A" }, { k: "rpm", label: "Velocidad", unit: "rpm" }],
    sections: [
      { id: "i", title: "Corriente", hint: "L1 · L2 · L3", color: "#B9A6FF", icon: ICON.i, groups: [{ fields: P3("i", "A") }] },
      { id: "v", title: "Tensión", hint: "L1 · L2 · L3", color: "#8FD3FF", icon: ICON.v, groups: [{ fields: P3("v", "V", "0") }] },
      { id: "t", title: "Temperatura", hint: "Bornes · carcasa · rodamientos", color: "#FFC6A8", icon: ICON.t,
        groups: [{ title: "Caja de bornes", fields: TEMP4() },
          { title: "Cuerpo del motor · opcional", fields: [opt("tCar", "CAR", "Carcasa", "°C"), opt("tLA", "LA", "Rodamiento lado acople", "°C"), opt("tLOA", "LOA", "Rodamiento lado libre", "°C")] },
          { title: "Arrancador · solo referencia", fields: [opt("tBreaker", "BRK", "Breaker", "°C"), opt("tContactor", "CON", "Contactor", "°C")] }],
        note: "Punto máximo: el más caliente que encontraste con la cámara. Entra en el ΔT con L1, L2 y L3." }
    ],
    evalKeys: { current: ["iL1", "iL2", "iL3"], voltage: ["vL1", "vL2", "vL3"], dt: ["tL1", "tL2", "tL3", "tMax"] }
  },
  tablero: {
    label: "Tablero / CCM", color: "#FFB05C",
    icon: "M5 3h14v18H5zM9 7h6M9 11h6M9 15h3",
    plate: [{ k: "vn", label: "Tensión", unit: "V" }, { k: "in", label: "Corriente barraje", unit: "A" }],
    sections: [
      { id: "i", title: "Corriente", hint: "L1 · L2 · L3", color: "#B9A6FF", icon: ICON.i, groups: [{ fields: P3("i", "A") }] },
      { id: "v", title: "Tensión", hint: "L1 · L2 · L3", color: "#8FD3FF", icon: ICON.v, groups: [{ fields: P3("v", "V", "0") }] },
      { id: "t", title: "Temperatura", hint: "Fases · barras · componentes", color: "#FFC6A8", icon: ICON.t,
        groups: [{ title: "Bornes / fases", fields: TEMP4() },
          { title: "Otros puntos · solo referencia", fields: [opt("tBar", "BAR", "Barras", "°C"), opt("tBreaker", "BRK", "Breaker", "°C"), opt("tContactor", "CON", "Contactor", "°C")] }],
        note: "Barras, breaker y contactor no entran en el ΔT de fases ni generan alertas." }
    ],
    evalKeys: { current: ["iL1", "iL2", "iL3"], voltage: ["vL1", "vL2", "vL3"], dt: ["tL1", "tL2", "tL3", "tMax"] }
  },
  trafo: {
    label: "Transformador", color: "#8FD3FF",
    icon: "M7 4v16M17 4v16M7 8c3 0 3 2 0 2M7 12c3 0 3 2 0 2M17 8c-3 0-3 2 0 2M17 12c-3 0-3 2 0 2",
    plate: [{ k: "kva", label: "Potencia", unit: "kVA" }, { k: "vp", label: "Primario", unit: "kV" }, { k: "vs", label: "Secundario", unit: "V" }, { k: "in", label: "Corriente secundario", unit: "A" }],
    sections: [
      { id: "in", title: "Entrada", hint: "Primario · por línea", color: "#8FD3FF", icon: ICON.inp, groups: [{ title: "Tensión primario", fields: P3("vP", "kV") }, { title: "Corriente primario", fields: P3("iP", "A") }] },
      { id: "out", title: "Salida", hint: "Secundario · por línea", color: "#B9A6FF", icon: ICON.out, groups: [{ title: "Tensión secundario", fields: P3("vS", "V", "0") }, { title: "Corriente secundario", fields: P3("iS", "A") }] },
      { id: "t", title: "Temperatura", hint: "Bornes · cuba · disipadores", color: "#FFC6A8", icon: ICON.t,
        groups: [{ title: "Bornes secundario", fields: TEMP4() },
          { title: "Cuerpo · opcional", fields: [opt("tCuba", "CUBA", "Temperatura de cuba", "°C"), opt("tDis", "DIS", "Disipadores / radiadores", "°C")] }] },
      { id: "insp", title: "Inspección", hint: "Visual", color: "#7BE0A0", icon: ICON.eye,
        groups: [{ fields: [choice("fuga", "Fugas de aceite", ["No", "Sí"]), choice("nivel", "Nivel de aceite", ["Normal", "Bajo"]), choice("ruido", "Ruido o vibración anormal", ["No", "Sí"])] }] }
    ],
    evalKeys: { current: ["iSL1", "iSL2", "iSL3"], voltage: ["vSL1", "vSL2", "vSL3"], dt: ["tL1", "tL2", "tL3", "tMax"] }
  },
  gen: {
    label: "Generador", color: "#7BE0A0",
    icon: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM13 7l-4 6h4l-2 4",
    plate: [{ k: "kw", label: "Potencia", unit: "kW" }, { k: "vn", label: "Tensión", unit: "V" }, { k: "in", label: "Corriente nominal", unit: "A" }],
    sections: [
      { id: "e", title: "Salida eléctrica", hint: "V · I · Hz · kW", color: "#B9A6FF", icon: ICON.i,
        groups: [{ title: "Tensión", fields: P3("v", "V", "0") }, { title: "Corriente", fields: P3("i", "A") },
          { fields: [opt("hz", "Hz", "Frecuencia", "Hz"), opt("kw", "kW", "Potencia", "kW")] }] },
      { id: "t", title: "Temperatura", hint: "Bornes · carcasa · rodamiento", color: "#FFC6A8", icon: ICON.t,
        groups: [{ title: "Bornes", fields: TEMP4() }, { title: "Opcional", fields: [opt("tCar", "CAR", "Carcasa del alternador", "°C"), opt("tRod", "ROD", "Rodamiento", "°C")] }] },
      { id: "op", title: "Operación", hint: "Estado", color: "#7BE0A0", icon: ICON.eye,
        groups: [{ fields: [opt("horas", "H", "Horas de operación", "h"), choice("modo", "Condición de la prueba", ["Con carga", "En vacío"])] }] }
    ],
    evalKeys: { current: ["iL1", "iL2", "iL3"], voltage: ["vL1", "vL2", "vL3"], dt: ["tL1", "tL2", "tL3", "tMax"] }
  },
  cap: {
    label: "Banco de capacitores", color: "#FFC6A8",
    icon: "M10 4v16M14 4v16M4 12h6M14 12h6",
    plate: [{ k: "kvar", label: "Potencia", unit: "kVAr" }, { k: "vn", label: "Tensión", unit: "V" }, { k: "pasos", label: "Pasos", unit: "" }],
    sections: [
      { id: "i", title: "Corriente", hint: "Por fase del banco", color: "#B9A6FF", icon: ICON.i,
        groups: [{ fields: P3("i", "A") }, { fields: [opt("pasosOn", "PAS", "Pasos conectados", "")] }] },
      { id: "t", title: "Temperatura", hint: "Fusibles · celdas", color: "#FFC6A8", icon: ICON.t,
        groups: [{ title: "Fusibles por fase", fields: TEMP4() }, { fields: [opt("tCel", "CEL", "Celda más caliente", "°C")] }] },
      { id: "insp", title: "Inspección", hint: "Visual", color: "#7BE0A0", icon: ICON.eye,
        groups: [{ fields: [choice("abomb", "Capacitores abombados", ["No", "Sí"]), choice("fusOpen", "Fusibles abiertos", ["No", "Sí"])] }] }
    ],
    evalKeys: { current: ["iL1", "iL2", "iL3"], voltage: null, dt: ["tL1", "tL2", "tL3", "tMax"] }
  },
  rect: {
    label: "Rectificador", color: "#D8E86B",
    icon: "M4 12h5M15 12h5M9 7v10l6-5zM15 7v10",
    plate: [{ k: "vac", label: "Entrada", unit: "VAC" }, { k: "vdc", label: "Salida", unit: "VDC" }, { k: "in", label: "Corriente", unit: "A" }],
    sections: [
      { id: "ac", title: "Entrada AC", hint: "Por línea", color: "#8FD3FF", icon: ICON.inp, groups: [{ title: "Tensión", fields: P3("vAC", "V", "0") }, { title: "Corriente", fields: P3("iAC", "A") }] },
      { id: "dc", title: "Salida DC", hint: "V · I · rizado", color: "#B9A6FF", icon: ICON.dc,
        groups: [{ fields: [{ k: "vDC", tag: "VDC", name: "Tensión DC", unit: "V", ph: "0.0" }, { k: "iDC", tag: "IDC", name: "Corriente DC", unit: "A", ph: "0.0" }, opt("rip", "RIZ", "Rizado (ripple)", "%")] }] },
      { id: "t", title: "Temperatura", hint: "Puente · disipador", color: "#FFC6A8", icon: ICON.t,
        groups: [{ title: "Bornes de entrada", fields: TEMP4() }, { title: "Opcional", fields: [opt("tPte", "PTE", "Puente (diodos / tiristores)", "°C"), opt("tDis", "DIS", "Disipador", "°C")] }] }
    ],
    evalKeys: { current: ["iACL1", "iACL2", "iACL3"], voltage: ["vACL1", "vACL2", "vACL3"], dt: ["tL1", "tL2", "tL3", "tMax"] }
  }
};

export const TYPE_ORDER = ["motor", "tablero", "trafo", "gen", "cap", "rect"];

export function allFields(type) {
  const T = TYPES[type] || TYPES.tablero;
  return T.sections.flatMap((s) => s.groups.flatMap((g) => g.fields));
}

export function requiredDone(type, values, sectionId) {
  const T = TYPES[type] || TYPES.tablero;
  const secs = sectionId ? T.sections.filter((s) => s.id === sectionId) : T.sections;
  return secs.every((s) => s.groups.every((g) => g.fields.every((f) => f.optional || f.kind === "choice" || num(values[f.k]) !== null)));
}

/** Evalúa una lectura según su tipo. Devuelve filas de evaluación y el peor nivel. */
export function evaluate(type, values, th, plate = {}) {
  const T = TYPES[type] || TYPES.tablero;
  const E = T.evalKeys;
  const rows = [];
  const pick = (keys) => (keys ? keys.map((k) => values[k]) : null);
  const cI = E.current ? imbalance(pick(E.current), th.currentWarn, th.currentCrit) : null;
  const cV = E.voltage ? imbalance(pick(E.voltage), th.voltageWarn, th.voltageCrit) : null;
  const dT = deltaT(pick(E.dt), th);
  rows.push({ id: "dI", name: "Desbalance de corriente", value: cI ? fmt(cI.value) + " %" : "—", level: cI ? cI.level : "none", raw: cI });
  if (E.voltage) rows.push({ id: "dV", name: "Desbalance de tensión", value: cV ? fmt(cV.value) + " %" : "—", level: cV ? cV.level : "none", raw: cV });
  rows.push({ id: "dT", name: "ΔT entre fases", value: dT ? fmt(dT.value) + " °C" : "—", level: dT ? dT.level : "none", raw: dT });

  const In = num(plate.in);
  if (In && cI) {
    const pct = (cI.avg / In) * 100;
    rows.push({ id: "load", name: `% de carga (${fmt(In, 0)} A)`, value: fmt(pct, 0) + " %", level: pct > 105 ? "precaucion" : "normal", note: pct < 40 ? "Carga baja: la termografía puede no mostrar fallas." : "", raw: { value: pct } });
  }
  if (type === "motor") {
    const la = num(values.tLA), loa = num(values.tLOA);
    if (la !== null && loa !== null) {
      const d = Math.abs(la - loa);
      rows.push({ id: "rod", name: "Diferencia entre rodamientos", value: fmt(d) + " °C", level: d > 15 ? "precaucion" : "normal" });
    }
  }
  if (type === "trafo") {
    const bad = values.fuga === "Sí" || values.nivel === "Bajo" || values.ruido === "Sí";
    rows.push({ id: "insp", name: "Inspección visual", value: "", level: bad ? "mayor" : "normal" });
  }
  if (type === "cap") {
    const bad = values.abomb === "Sí" || values.fusOpen === "Sí";
    rows.push({ id: "insp", name: "Inspección del banco", value: "", level: bad ? "mayor" : "normal" });
  }
  if (type === "rect") {
    const r = num(values.rip);
    if (r !== null) rows.push({ id: "rip", name: "Rizado DC", value: fmt(r) + " %", level: r > 5 ? "precaucion" : "normal" });
  }
  const worst = worstOf(rows.map((r) => (r.level === "none" ? null : r.level)));
  return { rows, worst, cI, cV, dT };
}
