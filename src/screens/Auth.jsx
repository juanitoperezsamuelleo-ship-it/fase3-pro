import React, { useState } from "react";
import { Field, Icon, Seg } from "../ui.jsx";

const ERR = {
  "auth/invalid-credential": "Correo o contraseña incorrectos.",
  "auth/wrong-password": "Contraseña incorrecta.",
  "auth/user-not-found": "No existe una cuenta con ese correo.",
  "auth/email-already-in-use": "Ese correo ya tiene cuenta. Inicia sesión.",
  "auth/weak-password": "La contraseña debe tener al menos 6 caracteres.",
  "auth/invalid-email": "El correo no es válido.",
  "auth/network-request-failed": "Sin conexión. Intenta de nuevo."
};

export default function Auth({ ctx }) {
  const { store, session, demo } = ctx;
  const [mode, setMode] = useState("in");
  const [how, setHow] = useState("crear");
  const [f, setF] = useState({ name: "", email: "", password: "", orgName: "", inviteCode: "" });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(session && session.pending ? "Tu cuenta existe pero no pertenece a ninguna empresa. Contacta al administrador." : session && session.error ? "No se pudo cargar tu perfil. Revisa la conexión." : "");
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setMsg("");
    if (mode === "reset") {
      if (!f.email) return setMsg("Escribe tu correo.");
      setBusy(true);
      try { await store.resetPassword(f.email.trim()); setMsg("Te enviamos un correo para restablecer la contraseña."); } catch (er) { setMsg(ERR[er.code] || er.message); }
      return setBusy(false);
    }
    if (!demo && (!f.email || !f.password)) return setMsg("Completa correo y contraseña.");
    if (mode === "up") {
      if (!f.name.trim()) return setMsg("Escribe tu nombre.");
      if (how === "crear" && !f.orgName.trim()) return setMsg("Escribe el nombre de tu empresa.");
      if (how === "unir" && !f.inviteCode.trim()) return setMsg("Escribe el código de tu empresa.");
    }
    setBusy(true);
    try {
      if (mode === "in") await store.signIn(f.email.trim(), f.password);
      else await store.signUp({ name: f.name.trim(), email: f.email.trim(), password: f.password, orgName: how === "crear" ? f.orgName.trim() : "", inviteCode: how === "unir" ? f.inviteCode : "" });
    } catch (er) { setMsg(ERR[er.code] || er.message || "No se pudo completar."); }
    setBusy(false);
  };

  return (
    <form className="screen" onSubmit={submit} style={{ paddingBottom: 30, justifyContent: "center" }}>
      <div className="in" style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 10 }}>
        <div className="row" style={{ gap: 10 }}>
          <span style={{ width: 40, height: 40, borderRadius: 12, background: "var(--lilac)", color: "#111214", display: "flex", alignItems: "center", justifyContent: "center" }}><Icon d="M13 2 4 14h7l-1 8 9-12h-7z" /></span>
          <span className="display" style={{ fontSize: 20, fontWeight: 700 }}>FASE·3 <span style={{ color: "var(--lilac)" }}>Pro</span></span>
        </div>
        <h1 className="title" style={{ fontSize: 34 }}>{mode === "in" ? "Hola de nuevo" : mode === "up" ? "Crea tu cuenta" : "Recuperar acceso"}</h1>
        <p className="muted">Termografía, desbalance y tendencias de tus equipos en un solo lugar.</p>
      </div>

      {demo && (
        <div className="card" style={{ background: "var(--tint-ai)", fontSize: 13 }}>
          <b style={{ color: "var(--lilac)" }}>Modo demo.</b> Los datos son de ejemplo y quedan solo en este dispositivo. Toca <b>Entrar</b> sin llenar nada.
        </div>
      )}

      {mode === "up" && (
        <>
          <Field label="Tu nombre"><input className="input" value={f.name} onChange={set("name")} autoComplete="name" /></Field>
          <Seg options={[{ v: "crear", l: "Crear empresa" }, { v: "unir", l: "Unirme con código" }]} value={how} onChange={setHow} />
          {how === "crear"
            ? <Field label="Nombre de la empresa"><input className="input" value={f.orgName} onChange={set("orgName")} /></Field>
            : <Field label="Código de la empresa (te lo da tu administrador)"><input className="input mono" value={f.inviteCode} onChange={set("inviteCode")} style={{ textTransform: "uppercase", letterSpacing: ".12em" }} autoCapitalize="characters" /></Field>}
        </>
      )}
      <Field label="Correo"><input className="input" type="email" value={f.email} onChange={set("email")} autoComplete="email" inputMode="email" /></Field>
      {mode !== "reset" && <Field label="Contraseña"><input className="input" type="password" value={f.password} onChange={set("password")} autoComplete={mode === "in" ? "current-password" : "new-password"} /></Field>}

      {msg && <div className="card fade" style={{ background: "var(--tint-bad)", color: "var(--on-bad)", fontSize: 13 }} role="alert">{msg}</div>}

      <button className="btn press" type="submit" aria-disabled={busy} disabled={busy} style={{ marginTop: 6 }}>
        {busy ? "Un momento…" : mode === "in" ? "Entrar" : mode === "up" ? "Crear cuenta" : "Enviar correo"}
      </button>
      <div className="row" style={{ justifyContent: "space-between", fontSize: 14 }}>
        {store.mode === "legacy" ? <span className="muted" style={{ fontSize: 13 }}>Entra con tu cuenta de la app inicial.</span> : <button type="button" className="btn ghost" style={{ height: 40, padding: 0 }} onClick={() => { setMode(mode === "in" ? "up" : "in"); setMsg(""); }}>
          {mode === "in" ? "Crear cuenta" : "Ya tengo cuenta"}
        </button>}
        {mode === "in" && !demo && <button type="button" className="btn ghost muted" style={{ height: 40, padding: 0, fontWeight: 500 }} onClick={() => setMode("reset")}>Olvidé la contraseña</button>}
      </div>
    </form>
  );
}
