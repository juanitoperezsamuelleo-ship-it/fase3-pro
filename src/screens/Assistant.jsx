import React, { useEffect, useRef, useState } from "react";
import { daySummary, localAnswer, askGemini, askWithImage, hasGemini, speak, listen, canListen, diagnoseItem } from "../lib/ai.js";
import { compressImage } from "../lib/image.js";
import { LEVELS } from "../lib/calc.js";
import { Icon } from "../ui.jsx";

/* Orbe de partículas: gira lento en reposo, se agita al escuchar o pensar. */
function Orb({ state }) {
  const ref = useRef();
  const st = useRef(state);
  st.current = state;
  useEffect(() => {
    const c = ref.current;
    const ctx = c.getContext("2d");
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    c.width = 150 * dpr; c.height = 150 * dpr;
    ctx.scale(dpr, dpr);
    const N = 220;
    const pts = Array.from({ length: N }, (_, i) => {
      const y = 1 - (i / (N - 1)) * 2, r = Math.sqrt(1 - y * y), th = i * 2.39996;
      return [Math.cos(th) * r, y, Math.sin(th) * r];
    });
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let a = 0, amp = 0, raf;
    const draw = () => {
      const s = st.current;
      const target = s === "listen" ? 1 : s === "think" ? 0.6 : s === "speak" ? 0.8 : 0.12;
      amp += (target - amp) * 0.08;
      a += reduce ? 0 : 0.004 + amp * 0.02;
      ctx.clearRect(0, 0, 150, 150);
      const t = performance.now() / 1000;
      pts.forEach(([x, y, z], i) => {
        const ca = Math.cos(a), sa = Math.sin(a);
        let X = x * ca - z * sa, Z = x * sa + z * ca;
        const wob = 1 + amp * 0.12 * Math.sin(t * 5 + i * 0.7);
        const R = 52 * wob;
        const px = 75 + X * R, py = 75 + y * R * 0.98;
        const d = (Z + 1) / 2;
        ctx.globalAlpha = 0.15 + d * 0.85;
        ctx.fillStyle = i % 5 === 0 ? "#8FD3FF" : i % 7 === 0 ? "#FFC6A8" : "#B9A6FF";
        ctx.beginPath(); ctx.arc(px, py, 0.6 + d * 1.5, 0, 6.283); ctx.fill();
      });
      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, []);
  return <div className="orb" aria-hidden="true"><canvas ref={ref} /></div>;
}

export default function Assistant({ ctx }) {
  const { items, data, th, go, route } = ctx;
  const eqIt = route.eqId && items.find((i) => i.eq.id === route.eqId);
  const [msgs, setMsgs] = useState(() => {
    if (eqIt) {
      const d = diagnoseItem(eqIt, th);
      return [{ ai: true, text: `${eqIt.eq.name}: ${LEVELS[eqIt.level].label}. ${d.length ? d.slice(0, 2).map((x) => x.title + ": " + x.detail.replace(/\.$/, "") + ".").join(" ") : "Sin hallazgos en la última lectura."} ¿Qué quieres saber?` }];
    }
    return [{ ai: true, text: daySummary(items, data.readings, data.users).lines.join(" ") }];
  });
  const [q, setQ] = useState("");
  const [state, setState] = useState("idle");
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
      setTimeout(() => setState("idle"), Math.min(9000, 1200 + answer.length * 45));
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
    setMsgs((m) => [...m, { ai: true, text: answer }]);
    setState("speak");
    speak(answer);
    setTimeout(() => setState("idle"), Math.min(8000, 1200 + answer.length * 45));
  };

  const mic = () => {
    if (state === "listen") { recRef.current && recRef.current.stop(); return; }
    window.speechSynthesis && window.speechSynthesis.cancel();
    setState("listen");
    let final = "";
    recRef.current = listen((t, isFinal) => { setQ(t); if (isFinal) final = t; }, () => { setState("idle"); if (final) ask(final); });
  };

  const SUG = eqIt ? ["¿Qué causa el problema?", "¿Qué hago primero?", "¿Cómo va la tendencia?"] : ["Resumen del día", "¿Qué intervengo primero?", "Tendencias", "Equipos pendientes"];

  return (
    <main className="screen" style={{ paddingBottom: "calc(16px + var(--safe-b))" }}>
      <div className="hdr in">
        <button className="icon-btn press" onClick={() => go(eqIt ? "hist" : "home", eqIt ? { eqId: eqIt.eq.id } : {})} aria-label="Volver"><Icon n="back" /></button>
        <span className="muted" style={{ fontSize: 12, fontWeight: 600 }}>{hasGemini() ? "IA local + Gemini" : "IA local · sin costo"}</span>
        <button className="icon-btn press" onClick={() => window.speechSynthesis && window.speechSynthesis.cancel()} aria-label="Silenciar"><Icon n="mute" size={18} /></button>
      </div>
      <Orb state={state} />
      <p className="display" style={{ textAlign: "center", fontSize: 18, marginTop: -4 }}>{state === "listen" ? "Te escucho…" : state === "think" ? "Pensando…" : eqIt ? eqIt.eq.name.split(" · ")[0] : "Asistente"}</p>

      <div style={{ display: "flex", flexDirection: "column", gap: 8, flex: 1 }} aria-live="polite">
        {msgs.map((m, k) => <div key={k} className={"bubble in " + (m.ai ? "ai" : "me")} style={{ whiteSpace: "pre-wrap" }}>{m.img && <img src={m.img} alt="" style={{ display: "block", width: "100%", maxWidth: 220, borderRadius: 12, marginBottom: 6 }} />}{m.text}</div>)}
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
        <input className="input grow" value={q} onChange={(e) => setQ(e.target.value)} placeholder={img ? "¿Qué quieres saber de la foto?" : "Pregunta o envía una foto"} aria-label="Pregunta" style={{ minWidth: 0 }} />
        {canListen() && <button type="button" className="icon-btn press" onClick={mic} aria-label={state === "listen" ? "Detener" : "Hablar"} style={{ width: 50, height: 50, background: state === "listen" ? "var(--lilac)" : undefined, color: state === "listen" ? "#111214" : undefined }}><Icon n="mic" /></button>}
        <button className="icon-btn light press" style={{ width: 50, height: 50 }} aria-label="Enviar"><Icon n="send" size={18} /></button>
      </form>
    </main>
  );
}
