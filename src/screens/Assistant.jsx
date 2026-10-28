import React, { useEffect, useRef, useState } from "react";
import { daySummary, localAnswer, askGemini, askWithImage, hasGemini, speak, listen, canListen, diagnoseItem } from "../lib/ai.js";
import { compressImage } from "../lib/image.js";
import { LEVELS, fmt, fmtShort } from "../lib/calc.js";
import { Icon, Chispa, Pill, LineChart } from "../ui.jsx";

/* Tarjeta de un equipo dentro de la conversación: estado, números clave y la tendencia del ΔT */
function EqCard({ it, th, go }) {
  const rs = it.readings;
  const L = LEVELS[it.level];
  return (
    <div className="card in" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
        <b className="display" style={{ fontSize: 16, textTransform: "uppercase", minWidth: 0 }}>{it.eq.name}</b>
        <Pill level={it.level} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
        {[
          { l: "ΔT actual", v: it.ev && it.ev.dT ? fmt(it.ev.dT.value) + "°" : "—" },
          { l: "Tendencia", v: it.dtTrend !== null ? (it.dtTrend > 0 ? "+" : "") + fmt(it.dtTrend) + "/m" : "—" },
          { l: "A " + th.deltaTMayor + " °C", v: it.monthsToMajor !== null && it.monthsToMajor < 24 ? "~" + Math.max(1, Math.round(it.monthsToMajor)) + " m" : "—" }
        ].map((k) => <div key={k.l} className="card" style={{ padding: "8px 10px", borderRadius: 14 }}><div className="mono" style={{ fontSize: 15, fontWeight: 600 }}>{k.v}</div><div className="muted" style={{ fontSize: 10.5, fontWeight: 600 }}>{k.l}</div></div>)}
      </div>
      {rs.length > 1 && <LineChart height={130} delay={150} labels={rs.map((r) => fmtShort(r.date))} series={[{ name: "ΔT", color: L.rank >= 2 ? "var(--warn)" : "var(--peach)", area: true, values: it.series.map((x) => x.dT) }]}
        bands={[{ y: th.deltaTMedia, color: "#FFB05C", label: "probable" }, { y: th.deltaTMayor, color: "#FF7A59", label: "mayor" }]} />}
      <div className="row" style={{ gap: 6 }}>
        <button className="btn press" style={{ flex: 1, height: 42, fontSize: 13 }} onClick={() => go("hist", { eqId: it.eq.id })}>Ver histórico</button>
        <button className="btn sec press" style={{ flex: 1, height: 42, fontSize: 13 }} onClick={() => go("read", { eqId: it.eq.id })}>Nueva lectura</button>
      </div>
    </div>
  );
}

export default function Assistant({ ctx }) {
  const { items, data, th, go, route } = ctx;
  const eqIt = route.eqId && items.find((i) => i.eq.id === route.eqId);
  const [msgs, setMsgs] = useState(() => {
    if (eqIt) {
      const d = diagnoseItem(eqIt, th);
      return [{ ai: true, text: `${eqIt.eq.name}: ${LEVELS[eqIt.level].label}. ${d.length ? d.slice(0, 2).map((x) => x.title + ": " + x.detail.replace(/\.$/, "") + ".").join(" ") : "Sin hallazgos en la última lectura."} ¿Qué quieres saber?` }, { card: eqIt.eq.id }];
    }
    return [{ ai: true, text: daySummary(items, data.readings, data.users).lines.join(" ") }];
  });
  const [q, setQ] = useState("");
  const [focusId, setFocusId] = useState(eqIt ? eqIt.eq.id : null);
  const findItem = (text) => {
    const t = String(text || "").toLowerCase();
    return items.find((i) => { const code = i.eq.name.split(" · ")[0].toLowerCase().trim(); return code.length >= 2 && t.includes(code); });
  };
  const [state, setState] = useState("idle");
  const chRef = useRef();
  const gest = (g) => chRef.current && chRef.current.gesture(g);
  // Al abrir: Chispa saluda con un salto y un chispazo
  useEffect(() => { const t = setTimeout(() => { gest("hop"); setTimeout(() => gest("zap"), 350); }, 350); return () => clearTimeout(t); }, []); // eslint-disable-line
  const recRef = useRef();
  const endRef = useRef();
  useEffect(() => { endRef.current && endRef.current.scrollIntoView({ behavior: "smooth", block: "end" }); }, [msgs]);
  useEffect(() => () => { window.speechSynthesis && window.speechSynthesis.cancel(); recRef.current && recRef.current.abort && recRef.current.abort(); }, []);

  const [img, setImg] = useState(null);
  const fileRef = useRef();
  const pick = async (f) => {
    if (!f) return;
    try { setImg(await compressImage(f, 1400, 350 * 1024)); } catch (e) { /* */ }
    if (fileRef.current) fileRef.current.value = "";
  };
  const ask = async (text) => {
    const question = (text || q).trim();
    if (!question && !img) return;
    setQ("");
    const photo = img;
    setImg(null);
    setMsgs((m) => [...m, { text: question || "¿Qué es esto?", img: photo }]);
    setState("think");
    if (photo) {
      let answer;
      if (!hasGemini()) answer = "Para analizar fotos necesito la IA de Gemini. Conéctala en Más → IA y voz.";
      else { try { answer = await askWithImage(photo, question, eqIt, th); } catch (e) { answer = "No pude analizar la foto: " + e.message; } }
      setMsgs((m) => [...m, { ai: true, text: answer }]);
      setState("speak"); speak(answer);
      setTimeout(() => { setState("idle"); gest("nod"); }, Math.min(9000, 1200 + answer.length * 45));
      return;
    }
    const scoped = eqIt && !/resumen|todos|planta|prioridad/i.test(question) ? `${question} (sobre ${eqIt.eq.name.split(" · ")[0]})` : question;
    let answer;
    if (hasGemini()) {
      try { answer = await askGemini(scoped, items, th); } catch (e) { answer = localAnswer(scoped, items, data.readings, th) + " (IA en la nube no disponible: " + e.message + ")"; }
    } else {
      await new Promise((r) => setTimeout(r, 350));
      answer = localAnswer(scoped, items, data.readings, th);
    }
    const hit = findItem(question) || findItem(answer) || eqIt;
    if (hit) setFocusId(hit.eq.id);
    setMsgs((m) => { const last = [...m].reverse().find((x) => x.card); return [...m, { ai: true, text: answer }, ...(hit && (!last || last.card !== hit.eq.id) ? [{ card: hit.eq.id }] : [])]; });
    setState("speak");
    speak(answer);
    // Al terminar de hablar: niega si no encontró algo, baila si el equipo va bien, si no asiente
    const after = /no (encontr|tengo|s[eé]\b|hay (datos|lecturas))/i.test(answer) ? "no" : hit && hit.rank <= 0 ? "wiggle" : "nod";
    setTimeout(() => { setState("idle"); gest(after); }, Math.min(8000, 1200 + answer.length * 45));
  };

  const mic = () => {
    if (state === "listen") { recRef.current && recRef.current.stop(); return; }
    window.speechSynthesis && window.speechSynthesis.cancel();
    setState("listen");
    let final = "";
    recRef.current = listen((t, isFinal) => { setQ(t); if (isFinal) final = t; }, () => { setState("idle"); if (final) ask(final); });
  };

  const focus = items.find((i) => i.eq.id === focusId);
  // Cara de Chispa según el equipo del que se habla: crítico = alarma, revisar = preocupado, bien = contento
  const tone = focus ? (focus.rank >= 3 ? "alert" : focus.rank >= 2 ? "worry" : focus.rank <= 0 ? "happy" : "ok") : items.some((i) => i.rank >= 3) ? "worry" : "ok";
  const mood = state === "listen" ? "listen" : state === "think" ? "think" : state === "speak" ? tone : tone === "alert" ? "worry" : tone;
  const moodLabel = state === "listen" ? "te escucho" : state === "think" ? "pensando" : mood === "alert" ? "¡atención!" : mood === "worry" ? (focus ? "esto hay que revisarlo" : "hay equipos por revisar") : mood === "happy" ? "todo en orden" : "lista";
  const moodColor = mood === "alert" ? "var(--crit)" : mood === "worry" ? "var(--warn)" : mood === "happy" ? "var(--ok)" : undefined;

  const SUG = eqIt ? ["¿Qué causa el problema?", "¿Qué hago primero?", "¿Cómo va la tendencia?"] : ["Resumen del día", "¿Qué intervengo primero?", "Tendencias", "Equipos pendientes"];

  return (
    <main className="screen" style={{ paddingBottom: "calc(16px + var(--safe-b))" }}>
      <div className="hdr in">
        <button className="icon-btn press" onClick={() => go(eqIt ? "hist" : "home", eqIt ? { eqId: eqIt.eq.id } : {})} aria-label="Volver"><Icon n="back" /></button>
        <span className="muted" style={{ fontSize: 12, fontWeight: 600 }}>{hasGemini() ? "Chispa · IA local + Gemini" : "Chispa · IA local, sin costo"}</span>
        <button className="icon-btn press" onClick={() => window.speechSynthesis && window.speechSynthesis.cancel()} aria-label="Silenciar"><Icon n="mute" size={18} /></button>
      </div>
      <div className="ai-head in" aria-live="polite">
        <Chispa ref={chRef} size={msgs.filter((x) => !x.card).length > 1 ? 78 : 118} mood={mood} talking={state === "speak"} sleepAfter={60000} label={"Chispa · " + moodLabel} />
        <span className="ai-state" style={{ color: moodColor }}>Chispa · {moodLabel}</span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8, flex: 1 }} aria-live="polite">
        {msgs.map((m, k) => {
          if (m.card) { const it = items.find((i) => i.eq.id === m.card); return it ? <EqCard key={k} it={it} th={th} go={go} /> : null; }
          return <div key={k} className={"bubble in " + (m.ai ? "ai" : "me")} style={{ whiteSpace: "pre-wrap" }}>{m.img && <img src={m.img} alt="" style={{ display: "block", width: "100%", maxWidth: 220, borderRadius: 12, marginBottom: 6 }} />}{m.text}</div>;
        })}
        <div ref={endRef} />
      </div>

      <div className="row" style={{ gap: 6, overflowX: "auto", margin: "0 -16px", padding: "0 16px", flexShrink: 0 }}>
        {SUG.map((s) => <button key={s} className="chip press" onClick={() => ask(s)}>{s}</button>)}
      </div>
      {img && (
        <div className="row fade" style={{ gap: 10, flexShrink: 0 }}>
          <img src={img} alt="Foto adjunta" style={{ width: 56, height: 56, objectFit: "cover", borderRadius: 12 }} />
          <span className="grow muted" style={{ fontSize: 13 }}>Foto lista. Escribe una pregunta o toca enviar.</span>
          <button className="icon-btn press" onClick={() => setImg(null)} aria-label="Quitar foto"><Icon n="close" size={15} /></button>
        </div>
      )}
      <form className="row" style={{ gap: 6, flexShrink: 0 }} onSubmit={(e) => { e.preventDefault(); ask(); }}>
        <button type="button" className="icon-btn press" style={{ width: 50, height: 50 }} onClick={() => fileRef.current.click()} aria-label="Adjuntar foto"><Icon n="camera" /></button>
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => pick(e.target.files[0])} />
        <input className="input grow" value={q} onChange={(e) => { if (!q && e.target.value) gest("tilt"); setQ(e.target.value); }} placeholder={img ? "¿Qué quieres saber de la foto?" : "Pregunta o envía una foto"} aria-label="Pregunta" style={{ minWidth: 0 }} />
        {canListen() && <button type="button" className="icon-btn press" onClick={mic} aria-label={state === "listen" ? "Detener" : "Hablar"} style={{ width: 50, height: 50, background: state === "listen" ? "var(--lilac)" : undefined, color: state === "listen" ? "#111214" : undefined }}><Icon n="mic" /></button>}
        <button className="icon-btn light press" style={{ width: 50, height: 50 }} aria-label="Enviar"><Icon n="send" size={18} /></button>
      </form>
    </main>
  );
}
