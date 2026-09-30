import React, { useEffect, useMemo, useState } from "react";
import { LEVELS, fmt, fmtDate, fmtShort, relDays, num } from "../lib/calc.js";
import { evaluate } from "../lib/templates.js";
import { diagnoseItem } from "../lib/ai.js";
import { Icon, Pill, Sheet, Tabs, useToast, Header, LineChart, Empty, CountUp } from "../ui.jsx";
import { EqRow } from "./Home.jsx";
import { sortByRisk } from "../lib/analysis.js";

const PH = { L1: "#F5C518", L2: "#6FA0FF", L3: "#FF6B5A", MAX: "var(--text)" };

function ChartCard({ title, sub, children, delay = 0 }) {
  return (
    <section className="card in chartc" style={{ animationDelay: delay + "ms" }}>
      <div className="row" style={{ justifyContent: "space-between", marginBottom: 6 }}>
        <h2 className="h2">{title}</h2>{sub}
      </div>
      {children}
    </section>
  );
}
const Legend = ({ items }) => (
  <div className="row" style={{ gap: 12, flexWrap: "wrap", fontSize: 11, color: "var(--muted)", marginTop: 4 }}>
    {items.map((i) => <span key={i.n} className="row" style={{ gap: 5 }}><span style={{ width: 10, height: 3, borderRadius: 2, background: i.c }} />{i.n}</span>)}
  </div>
);

function Photo({ id, store, onOpen }) {
  const [url, setUrl] = useState(null);
  useEffect(() => { let on = true; store.getPhoto(id).then((u) => on && setUrl(u)); return () => { on = false; }; }, [id]); // eslint-disable-line
  return <button className="thumb press" onClick={() => url && onOpen(url)} aria-label="Ver foto">{url ? <img src={url} alt="" className="fade" /> : null}</button>;
}

function Detail({ ctx, r, it, onClose }) {
  const { store, isAdmin, go, th, session } = ctx;
  const toast = useToast();
  const [confirm, setConfirm] = useState(false);
  const [big, setBig] = useState(null);
  const ev = evaluate(it.eq.type, r.values || {}, th, it.eq.plate || {});
  const canEdit = !ctx.readOnly && (isAdmin || r.userId === session.uid);
  const del = async () => {
    (r.photoIds || []).forEach((p) => store.removePhoto(p));
    await store.remove("readings", r.id);
    toast("Lectura eliminada");
    onClose();
  };
  return (
    <>
      <div className="row" style={{ alignItems: "flex-start" }}>
        <div className="grow">
          <div className="display" style={{ fontSize: 19, fontWeight: 600 }}>{fmtDate(r.date)}</div>
          <div className="muted" style={{ fontSize: 13 }}>{r.userName || "—"} · {it.eq.name.split(" · ")[0]}</div>
        </div>
        <Pill level={ev.worst} />
      </div>
      <div>
        {ev.rows.map((x) => (
          <div key={x.id} className="row" style={{ minHeight: 34, borderTop: "1px solid var(--s2)", fontSize: 14 }}>
            <span className="grow">{x.name}</span><span className="mono">{x.value}</span>
            <span style={{ width: 8, height: 8, borderRadius: 4, background: LEVELS[x.level].color }} />
          </div>
        ))}
      </div>
      {it.T.sections.map((s) => {
        const fields = s.groups.flatMap((g) => g.fields).filter((f) => r.values && r.values[f.k] !== undefined && r.values[f.k] !== "");
        if (!fields.length) return null;
        return (
          <div key={s.id}>
            <div className="row" style={{ gap: 6, fontSize: 12, fontWeight: 700, color: s.color, marginBottom: 6 }}><Icon d={s.icon} size={14} />{s.title.toUpperCase()}</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(88px,1fr))", gap: 6 }}>
              {fields.map((f) => (
                <div key={f.k} className="card" style={{ background: "var(--s2)", padding: "7px 10px" }}>
                  <div className="muted ellipsis" style={{ fontSize: 11 }}>{f.name || f.tag}</div>
                  <div className="mono" style={{ fontWeight: 600, fontSize: 15 }}>{num(r.values[f.k]) !== null && f.kind !== "choice" ? String(r.values[f.k]).replace(".", ",") : r.values[f.k]} <span className="muted" style={{ fontSize: 11 }}>{f.unit}</span></div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
      {r.notes && <div className="card" style={{ background: "var(--s2)", fontSize: 14 }}><span className="muted" style={{ fontSize: 11, display: "block" }}>NOTAS</span>{r.notes}</div>}
      {(r.photoIds || []).length > 0 && (
        <div className="row" style={{ gap: 8, overflowX: "auto" }}>{r.photoIds.map((p) => <Photo key={p} id={p} store={store} onOpen={setBig} />)}</div>
      )}
      {big && <button onClick={() => setBig(null)} style={{ border: 0, padding: 0, background: "#000", borderRadius: 16 }} aria-label="Cerrar foto"><img src={big} alt="" className="fade" style={{ width: "100%", maxHeight: 420, objectFit: "contain", display: "block" }} /></button>}
      {canEdit && (
        <div className="row" style={{ gap: 8 }}>
          <button className="btn sec press" style={{ flex: 1, height: 44 }} onClick={() => go("read", { editId: r.id })}><Icon n="edit" size={17} /> Editar</button>
          {isAdmin && (!confirm
            ? <button className="btn ghost press" style={{ flex: 1, height: 44, color: "var(--on-bad)" }} onClick={() => setConfirm(true)}><Icon n="trash" size={17} /> Eliminar</button>
            : <button className="btn danger press fade" style={{ flex: 1, height: 44 }} onClick={del}>Confirmar</button>)}
        </div>
      )}
    </>
  );
}

function EquipmentHistory({ ctx, it }) {
  const { go, th, data } = ctx;
  const [tab, setTabRaw] = useState("trend");
  const [dir, setDir] = useState(0);
  const ORDER = ["trend", "rec", "diag"];
  const setTab = (t) => { if (t === tab) return; setDir(ORDER.indexOf(t) > ORDER.indexOf(tab) ? 1 : -1); setTabRaw(t); };
  const touch = React.useRef(null);
  const onTouchStart = (e) => { const t = e.touches[0]; touch.current = { x: t.clientX, y: t.clientY }; };
  const onTouchEnd = (e) => {
    if (!touch.current) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touch.current.x, dy = t.clientY - touch.current.y;
    touch.current = null;
    if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    const i = ORDER.indexOf(tab) + (dx < 0 ? 1 : -1);
    if (ORDER[i]) setTab(ORDER[i]);
  };
  const [sel, setSel] = useState(null);
  const rs = it.readings;
  const labels = rs.map((r) => fmtShort(r.date));
  const V = (k) => rs.map((r) => num(r.values && r.values[k]));
  const E = it.T.evalKeys;
  const diag = diagnoseItem(it, th);
  const ccm = data.ccms.find((c) => c.id === it.eq.ccmId);
  const maxT = Math.max(...rs.map((r) => num(r.values && r.values.tMax) ?? -Infinity));
  const selR = sel && rs.find((r) => r.id === sel);

  return (
    <main className="screen">
      <Header eyebrow={`${it.T.label}${ccm ? " · " + ccm.name : ""}`} title={it.eq.name.split(" · ")[0]} onBack={() => go("hist")}
        right={!ctx.readOnly && <button className="icon-btn light press" onClick={() => go("read", { eqId: it.eq.id })} aria-label="Nueva lectura"><Icon n="plus" /></button>} />
      <div className="row in" style={{ gap: 8, marginTop: -4 }}>
        <Pill level={it.level} />
        <span className="muted" style={{ fontSize: 13 }}>{it.eq.name.split(" · ").slice(1).join(" · ")}</span>
      </div>
      <Tabs value={tab} onChange={setTab} items={[{ id: "trend", label: "Tendencias" }, { id: "rec", label: "Registros", count: rs.length }, { id: "diag", label: "Diagnóstico", count: diag.length || undefined }]} />

      {!rs.length && <Empty icon="chart" title="Sin lecturas" text="Registra la primera para ver tendencias." action={!ctx.readOnly && <button className="btn sec press" style={{ height: 42 }} onClick={() => go("read", { eqId: it.eq.id })}>Nueva lectura</button>} />}

      <div key={tab} className={"tabpanel" + (dir > 0 ? " from-r" : dir < 0 ? " from-l" : "")} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      {tab === "trend" && rs.length > 0 && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
            {[
              { l: "ΔT actual", v: it.ev && it.ev.dT ? fmt(it.ev.dT.value) + "°" : "—" },
              { l: "Máx. histórico", v: Number.isFinite(maxT) ? fmt(maxT) + "°" : "—" },
              { l: "Tendencia ΔT", v: it.dtTrend !== null ? (it.dtTrend > 0 ? "+" : "") + fmt(it.dtTrend) + "/m" : "—", c: it.dtTrend > 0.5 ? "var(--warn)" : undefined }
            ].map((k, i) => (
              <div key={k.l} className="card in kpi" style={{ padding: "10px 12px", animationDelay: i * 60 + "ms" }}>
                <div className="mono" style={{ fontSize: 18, fontWeight: 600, color: k.c }}><CountUp text={k.v} delay={80 + i * 60} /></div>
                <div className="muted" style={{ fontSize: 11 }}>{k.l}</div>
              </div>
            ))}
          </div>
          {it.monthsToMajor !== null && it.monthsToMajor < 12 && (
            <div className="card in sheen" style={{ background: "var(--tint-warn)", fontSize: 14, animationDelay: "180ms" }}>
              <b style={{ color: "var(--warn)" }}>Proyección:</b> a este ritmo el ΔT llega a {th.deltaTMayor} °C (deficiencia mayor) en ~{Math.max(1, Math.round(it.monthsToMajor))} {Math.round(it.monthsToMajor) === 1 ? "mes" : "meses"}.
            </div>
          )}
          <ChartCard title="ΔT ENTRE FASES · °C" delay={220}>
            <LineChart delay={220} labels={labels} series={[{ name: "ΔT", color: "var(--peach)", area: true, values: it.series.map((s) => s.dT) }]}
              bands={[{ y: th.deltaTMedia, color: "#FFB05C", label: "probable" }, { y: th.deltaTMayor, color: "#FF7A59", label: "mayor" }]} />
          </ChartCard>
          <ChartCard title="TEMPERATURA POR FASE · °C" delay={360}>
            <LineChart delay={360} labels={labels} series={[{ name: "L1", color: PH.L1, values: V("tL1") }, { name: "L2", color: PH.L2, values: V("tL2") }, { name: "L3", color: PH.L3, values: V("tL3") }, { name: "Máx", color: PH.MAX, values: V("tMax") }]} />
            <Legend items={[{ n: "L1", c: PH.L1 }, { n: "L2", c: PH.L2 }, { n: "L3", c: PH.L3 }, { n: "Máx", c: PH.MAX }]} />
          </ChartCard>
          {E.current && (
            <ChartCard title="CORRIENTE POR FASE · A" delay={500}>
              <LineChart delay={500} labels={labels} series={E.current.map((k, i) => ({ name: "L" + (i + 1), color: [PH.L1, PH.L2, PH.L3][i], values: V(k) }))}
                bands={num((it.eq.plate || {}).in) ? [{ y: num(it.eq.plate.in), color: "#8B8B93", label: "nominal" }] : null} />
              <Legend items={[{ n: "L1", c: PH.L1 }, { n: "L2", c: PH.L2 }, { n: "L3", c: PH.L3 }]} />
            </ChartCard>
          )}
          <ChartCard title="DESBALANCE · %" delay={640}>
            <LineChart delay={640} labels={labels} series={[{ name: "Corriente", color: "var(--lilac)", values: it.series.map((s) => s.dI) }, ...(E.voltage ? [{ name: "Tensión", color: "var(--sky)", values: it.series.map((s) => s.dV) }] : [])]} />
            <Legend items={[{ n: "Corriente", c: "var(--lilac)" }, ...(E.voltage ? [{ n: "Tensión", c: "var(--sky)" }] : [])]} />
          </ChartCard>
        </>
      )}

      {tab === "rec" && (
        <div>
          {rs.slice().reverse().map((r, k) => {
            const ev = evaluate(it.eq.type, r.values || {}, th, it.eq.plate || {});
            return (
              <button key={r.id} className="hotrow in" style={{ gridTemplateColumns: "minmax(0,1fr) auto auto", animationDelay: 60 + Math.min(k, 10) * 40 + "ms" }} onClick={() => setSel(r.id)}>
                <span className="sev" style={{ width: 3, background: LEVELS[ev.worst].color }} />
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: "block", fontWeight: 700, fontSize: 14 }}>{fmtDate(r.date)}</span>
                  <span className="muted ellipsis" style={{ display: "block", fontSize: 12 }}>{r.userName}{r.notes ? " · " + r.notes : ""}</span>
                </span>
                <span className="row" style={{ gap: 4, color: "var(--muted)" }}>{(r.photoIds || []).length > 0 && <Icon n="image" size={15} />}</span>
                <span className="mono" style={{ fontWeight: 600 }}>{ev.dT ? fmt(ev.dT.value) + "°" : "—"}</span>
              </button>
            );
          })}
        </div>
      )}

      {tab === "diag" && (
        <>
          {!diag.length && rs.length > 0 && <Empty icon="check" title="Sin hallazgos" text="La última lectura está dentro de los umbrales." />}
          {diag.map((d, k) => (
            <section key={d.id} className="card in" style={{ animationDelay: 60 + k * 80 + "ms", display: "flex", flexDirection: "column", gap: 8 }}>
              <div className="row" style={{ justifyContent: "space-between" }}><b>{d.title}</b><Pill level={d.level} /></div>
              <p style={{ fontSize: 14 }}>{d.detail}</p>
              {d.causes.length > 0 && <div><div className="h2" style={{ marginBottom: 4 }}>CAUSAS PROBABLES</div><ul style={{ margin: 0, paddingLeft: 18, fontSize: 14, color: "var(--muted)" }}>{d.causes.map((c) => <li key={c}>{c}</li>)}</ul></div>}
              {d.rec.length > 0 && <div><div className="h2" style={{ marginBottom: 4 }}>QUÉ HACER</div><ul style={{ margin: 0, paddingLeft: 18, fontSize: 14 }}>{d.rec.map((c) => <li key={c}>{c}</li>)}</ul></div>}
            </section>
          ))}
          <button className="btn sec press" onClick={() => go("ai", { eqId: it.eq.id })} style={{ background: "var(--tint-ai)", color: "var(--lilac)" }}><Icon n="spark" size={18} /> Preguntar al asistente</button>
        </>
      )}
      </div>

      <Sheet open={!!selR} onClose={() => setSel(null)} label="Detalle de la lectura">
        {selR && <Detail ctx={ctx} r={selR} it={it} onClose={() => setSel(null)} />}
      </Sheet>
    </main>
  );
}

export default function History({ ctx }) {
  const { route, items, data, go, th } = ctx;
  const it = route.eqId && items.find((i) => i.eq.id === route.eqId);
  const sorted = useMemo(() => sortByRisk(items).filter((i) => i.readings.length), [items]);
  if (it) return <EquipmentHistory ctx={ctx} it={it} />;
  const recent = data.readings.slice().sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 12);
  const eqMap = Object.fromEntries(items.map((i) => [i.eq.id, i]));
  return (
    <main className="screen">
      <Header eyebrow={`${data.readings.length} lecturas`} title="Histórico" />
      {!data.readings.length && <Empty icon="chart" title="Aún no hay lecturas" />}
      {sorted.length > 0 && <h2 className="h2 in" style={{ margin: "4px 2px 0" }}>POR EQUIPO</h2>}
      <div>{sorted.map((i) => <EqRow key={i.eq.id} it={i} ctx={ctx} th={th} onClick={() => go("hist", { eqId: i.eq.id })} />)}</div>
      {recent.length > 0 && <h2 className="h2 in" style={{ margin: "8px 2px 0" }}>ÚLTIMAS LECTURAS</h2>}
      <div>
        {recent.map((r) => {
          const e = eqMap[r.equipmentId];
          if (!e) return null;
          const ev = evaluate(e.eq.type, r.values || {}, th, e.eq.plate || {});
          return (
            <button key={r.id} className="okrow" onClick={() => go("hist", { eqId: e.eq.id })}>
              <span style={{ width: 8, height: 8, borderRadius: 4, background: LEVELS[ev.worst].color }} />
              <span className="grow ellipsis" style={{ fontSize: 14 }}>{e.eq.name.split(" · ")[0]} <span className="muted">· {r.userName}</span></span>
              <span className="muted" style={{ fontSize: 12 }}>{relDays(r.date)}</span>
            </button>
          );
        })}
      </div>
    </main>
  );
}
