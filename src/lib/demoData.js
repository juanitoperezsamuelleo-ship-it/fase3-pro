// Datos de ejemplo para el MODO DEMO (ficticios; no son de ninguna planta real).
import { DEFAULT_THRESHOLDS, localISO } from "./calc.js";

function daysAgo(n, h = 9, m = 30) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(h, m, 0, 0);
  return localISO(d);
}

export function buildDemoData() {
  const users = [
    { id: "u1", name: "Técnico Demo", email: "demo@fase3.app", role: "admin", orgId: "demo" },
    { id: "u2", name: "Laura Gómez", email: "laura@ejemplo.com", role: "tecnico", orgId: "demo" },
    { id: "u3", name: "Andrés Pérez", email: "andres@ejemplo.com", role: "tecnico", orgId: "demo" }
  ];
  const plants = [{ id: "p1", name: "Planta Norte" }];
  const ccms = [
    { id: "c1", name: "CCM-02", plantId: "p1" },
    { id: "c2", name: "CCM-05", plantId: "p1" },
    { id: "c3", name: "Subestación", plantId: "p1" }
  ];
  const equipment = [
    { id: "e1", name: "M-114 · Bomba agua fresca", type: "motor", plantId: "p1", ccmId: "c1", plate: { hp: "30", vn: "460", in: "45", rpm: "1780" } },
    { id: "e2", name: "TR-02 · Transformador", type: "trafo", plantId: "p1", ccmId: "c3", plate: { kva: "500", vp: "13.2", vs: "480", in: "600" } },
    { id: "e3", name: "CCM-05 · Tablero secado", type: "tablero", plantId: "p1", ccmId: "c2", plate: { vn: "480", in: "400" } },
    { id: "e4", name: "M-087 · Ventilador caldera", type: "motor", plantId: "p1", ccmId: "c1", plate: { hp: "15", vn: "460", in: "21", rpm: "1750" } },
    { id: "e5", name: "M-201 · Compresor de aire", type: "motor", plantId: "p1", ccmId: "c2", plate: { hp: "50", vn: "460", in: "65", rpm: "3550" } },
    { id: "e6", name: "BC-01 · Banco de capacitores", type: "cap", plantId: "p1", ccmId: "c2", plate: { kvar: "150", vn: "480", pasos: "6" } },
    { id: "e7", name: "GE-01 · Planta de emergencia", type: "gen", plantId: "p1", ccmId: "c3", plate: { kw: "400", vn: "480", in: "600" } },
    { id: "e8", name: "RC-01 · Rectificador 125 VDC", type: "rect", plantId: "p1", ccmId: "c3", plate: { vac: "480", vdc: "125", in: "100" } }
  ];

  const readings = [];
  let n = 0;
  const push = (equipmentId, type, day, values, userId = "u1", notes = "") => {
    const u = users.find((x) => x.id === userId);
    readings.push({ id: "r" + ++n, equipmentId, type, date: daysAgo(day, 8 + (n % 6), (n * 7) % 60), values, userId, userName: u.name, notes, photoIds: [] });
  };
  const s = (x) => String(Math.round(x * 10) / 10);

  // M-114: borne L2 calentándose mes a mes
  [210, 180, 150, 120, 90, 60, 30, 0].forEach((d, k) => {
    push("e1", "motor", d, {
      iL1: s(42 + (k % 3) * 0.3), iL2: s(43 + (k % 2) * 0.2), iL3: s(41.6 + (k % 2) * 0.3),
      vL1: "460", vL2: "458", vL3: "462",
      tL1: s(44 + k * 0.6), tL2: s(45 + k * 1.0), tL3: s(43.8 + k * 0.55), tMax: s(49.8 + k * 1.45),
      tLA: s(41 + k * 0.2), tLOA: s(39 + k * 0.1)
    }, k % 3 === 2 ? "u2" : "u1", k === 4 ? "Se observa calentamiento en borne L2." : k === 6 ? "Programar reapriete de bornes." : "");
  });
  // TR-02: ΔT alto y subiendo
  [150, 120, 90, 60, 30, 4].forEach((d, k) => {
    push("e2", "trafo", d, {
      vPL1: "13.2", vPL2: "13.1", vPL3: "13.2", iPL1: s(17 + k * 0.2), iPL2: s(17.2 + k * 0.2), iPL3: s(16.9 + k * 0.2),
      vSL1: "480", vSL2: "478", vSL3: "481", iSL1: s(410 + k * 5), iSL2: s(418 + k * 5), iSL3: s(405 + k * 5),
      tL1: s(55 + k), tL2: s(57 + k * 1.2), tL3: s(54 + k), tMax: s(64 + k * 1.8), tCuba: s(58 + k * 0.5),
      fuga: "No", nivel: "Normal", ruido: "No"
    }, "u3");
  });
  // CCM-05: desbalance de tensión en precaución
  [60, 30, 8].forEach((d, k) => {
    push("e3", "tablero", d, {
      iL1: "118", iL2: "121", iL3: "116", vL1: s(458 - k), vL2: s(447 - k), vL3: "461",
      tL1: "39", tL2: "40.2", tL3: "38.8", tMax: s(41 + k * 0.3), tBreaker: "37", tContactor: "38"
    }, "u2");
  });
  // Equipos sanos
  [40, 10].forEach((d) => push("e4", "motor", d, { iL1: "14.2", iL2: "14.3", iL3: "14.1", vL1: "460", vL2: "459", vL3: "461", tL1: "36.2", tL2: "36.4", tL3: "36.1", tMax: "36.6" }));
  [35, 12].forEach((d) => push("e5", "motor", d, { iL1: "52.1", iL2: "53.0", iL3: "52.4", vL1: "460", vL2: "459", vL3: "461", tL1: "42", tL2: "42.4", tL3: "41.9", tMax: "42.9" }, "u2"));
  push("e6", "cap", 15, { iL1: "120", iL2: "121", iL3: "119", pasosOn: "4", tL1: "35", tL2: "35.3", tL3: "35.1", tMax: "35.4", abomb: "No", fusOpen: "No" }, "u3");
  push("e7", "gen", 25, { vL1: "480", vL2: "479", vL3: "481", iL1: "210", iL2: "212", iL3: "209", hz: "60.0", kw: "170", tL1: "40", tL2: "40.5", tL3: "40.2", tMax: "41", modo: "Con carga", horas: "1240" }, "u3");
  push("e8", "rect", 28, { vACL1: "480", vACL2: "479", vACL3: "481", iACL1: "32", iACL2: "32.4", iACL3: "31.9", vDC: "125.4", iDC: "88", rip: "1.2", tL1: "38", tL2: "38.6", tL3: "38.2", tMax: "39.1" });

  return {
    org: { name: "Empresa Demo", inviteCode: "DEMO42" },
    users, plants, ccms, equipment, readings,
    settings: { thresholds: { ...DEFAULT_THRESHOLDS } },
    photos: {},
    session: { uid: "u1", email: "demo@fase3.app", name: "Técnico Demo", role: "admin", orgId: "demo", orgName: "Empresa Demo", inviteCode: "DEMO42" }
  };
}
