// Capa de datos con dos motores intercambiables:
//  - Firebase (multi-empresa): orgs/{orgId}/{colección}/{id}
//  - Demo (sin Firebase): datos de ejemplo en este dispositivo
// Las pantallas solo usan esta API, nunca Firebase directamente.
import { firebaseConfig } from "../firebase-config.js";
import { DEFAULT_THRESHOLDS, uid } from "./calc.js";
import { buildDemoData } from "./demoData.js";

/* global __DEMO_BUILD__, __LEGACY_BUILD__ */
const configured = !String(firebaseConfig.apiKey || "").startsWith("PEGA_AQUI");
export const IS_LEGACY = typeof __LEGACY_BUILD__ !== "undefined" && __LEGACY_BUILD__;
export const IS_DEMO = !IS_LEGACY && ((typeof __DEMO_BUILD__ !== "undefined" && __DEMO_BUILD__) || !configured);
export const READ_ONLY = IS_LEGACY;

export const COLS = ["plants", "ccms", "equipment", "readings"];

/* ─────────────────────────── MODO DEMO ─────────────────────────── */
function createDemoStore() {
  const KEY = "fase3pro-demo-v1";
  let db;
  try { db = JSON.parse(localStorage.getItem(KEY) || "null"); } catch (e) { db = null; }
  if (!db) db = buildDemoData();
  const listeners = {};
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) { /* sin espacio: sigue en memoria */ } };
  const emit = (name) => (listeners[name] || []).forEach((cb) => cb(name === "settings" ? db.settings : name === "users" ? db.users : [...db[name]]));
  const on = (name, cb) => {
    (listeners[name] = listeners[name] || []).push(cb);
    setTimeout(() => cb(name === "settings" ? db.settings : name === "users" ? db.users : [...db[name]]), 0);
    return () => { listeners[name] = listeners[name].filter((x) => x !== cb); };
  };
  let session = db.session;
  const authCbs = [];
  const setSession = (s) => { session = s; db.session = s; save(); authCbs.forEach((cb) => cb(s)); };
  return {
    mode: "demo",
    onAuth(cb) { authCbs.push(cb); setTimeout(() => cb(session), 0); return () => authCbs.splice(authCbs.indexOf(cb), 1); },
    async signIn(email) {
      const u = db.users.find((x) => x.email === email) || db.users[0];
      setSession({ uid: u.id, email: u.email, name: u.name, role: u.role, orgId: "demo", orgName: db.org.name, inviteCode: db.org.inviteCode });
    },
    async signUp({ name, email, orgName }) {
      const id = uid();
      db.users.push({ id, name, email, role: "admin", orgId: "demo" });
      if (orgName) db.org.name = orgName;
      setSession({ uid: id, email, name, role: "admin", orgId: "demo", orgName: db.org.name, inviteCode: db.org.inviteCode });
      emit("users");
    },
    async signOut() { setSession(null); },
    async resetPassword() {},
    sub: on,
    async add(col, data) { const id = uid(); db[col].push({ ...data, id }); save(); emit(col); return id; },
    async update(col, id, patch) { db[col] = db[col].map((x) => (x.id === id ? { ...x, ...patch } : x)); save(); emit(col); },
    async remove(col, id) { db[col] = db[col].filter((x) => x.id !== id); save(); emit(col); },
    subSettings: (cb) => on("settings", cb),
    async saveSettings(patch) { db.settings = { ...db.settings, ...patch }; save(); emit("settings"); },
    async putPhoto(dataUrl) { const id = uid(); db.photos[id] = dataUrl; save(); return id; },
    async getPhoto(id) { return db.photos[id] || null; },
    async removePhoto(id) { delete db.photos[id]; save(); },
    subUsers: (cb) => on("users", cb),
    async setRole(userId, role) {
      db.users = db.users.map((u) => (u.id === userId ? { ...u, role } : u)); save(); emit("users");
      if (session && session.uid === userId) setSession({ ...session, role });
    },
    async resetDemo() { db = buildDemoData(); db.session = session; save(); COLS.forEach(emit); emit("settings"); emit("users"); }
  };
}

/* ─────────────────────────── FIREBASE ─────────────────────────── */
async function createFirebaseStore() {
  const { initializeApp } = await import("firebase/app");
  const fs = await import("firebase/firestore");
  const au = await import("firebase/auth");
  const app = initializeApp(firebaseConfig);
  const db = fs.initializeFirestore(app, { localCache: fs.persistentLocalCache({ tabManager: fs.persistentMultipleTabManager() }) });
  const auth = au.getAuth(app);
  await au.setPersistence(auth, au.browserLocalPersistence).catch(() => {});

  let session = null;
  const orgCol = (c) => fs.collection(db, "orgs", session.orgId, c);
  const orgDoc = (c, id) => fs.doc(db, "orgs", session.orgId, c, id);
  const clean = (o) => JSON.parse(JSON.stringify(o)); // quita undefined

  return {
    mode: "firebase",
    onAuth(cb) {
      let unsubUser = null;
      const off = au.onAuthStateChanged(auth, async (u) => {
        if (unsubUser) { unsubUser(); unsubUser = null; }
        if (!u) { session = null; cb(null); return; }
        unsubUser = fs.onSnapshot(fs.doc(db, "users", u.uid), async (snap) => {
          if (!snap.exists()) { session = { uid: u.uid, email: u.email, pending: true }; cb(session); return; }
          const p = snap.data();
          let org = {};
          try { const o = await fs.getDoc(fs.doc(db, "orgs", p.orgId)); org = o.exists() ? o.data() : {}; } catch (e) { /* sin conexión */ }
          session = { uid: u.uid, email: u.email, name: p.name, role: p.role, orgId: p.orgId, orgName: org.name || "", inviteCode: org.inviteCode || "" };
          cb(session);
        }, () => cb({ uid: u.uid, email: u.email, error: true }));
      });
      return () => { off(); if (unsubUser) unsubUser(); };
    },
    async signIn(email, password) { await au.signInWithEmailAndPassword(auth, email, password); },
    async signUp({ name, email, password, orgName, inviteCode }) {
      const cred = await au.createUserWithEmailAndPassword(auth, email, password);
      const u = cred.user;
      if (orgName) {
        const orgRef = fs.doc(fs.collection(db, "orgs"));
        const code = Math.random().toString(36).slice(2, 8).toUpperCase();
        const b = fs.writeBatch(db);
        b.set(orgRef, { name: orgName, inviteCode: code, ownerUid: u.uid, plan: "prueba", createdAt: fs.serverTimestamp() });
        b.set(fs.doc(db, "invites", code), { orgId: orgRef.id });
        b.set(fs.doc(db, "users", u.uid), { name, email, orgId: orgRef.id, role: "admin", createdAt: fs.serverTimestamp() });
        b.set(fs.doc(db, "orgs", orgRef.id, "settings", "main"), { thresholds: DEFAULT_THRESHOLDS });
        await b.commit();
      } else {
        const code = String(inviteCode || "").trim().toUpperCase();
        const inv = await fs.getDoc(fs.doc(db, "invites", code));
        if (!inv.exists()) { await u.delete().catch(() => {}); throw new Error("Código de empresa no válido."); }
        await fs.setDoc(fs.doc(db, "users", u.uid), { name, email, orgId: inv.data().orgId, role: "tecnico", inviteCode: code, createdAt: fs.serverTimestamp() });
      }
    },
    async signOut() { await au.signOut(auth); },
    async resetPassword(email) { await au.sendPasswordResetEmail(auth, email); },
    sub(col, cb) {
      return fs.onSnapshot(orgCol(col), (qs) => cb(qs.docs.map((d) => ({ ...d.data(), id: d.id }))), (e) => console.error(col, e));
    },
    async add(col, data) { const r = fs.doc(orgCol(col)); await fs.setDoc(r, clean({ ...data, createdBy: session.uid, createdAt: Date.now() })); return r.id; },
    async update(col, id, patch) { await fs.updateDoc(orgDoc(col, id), clean(patch)); },
    async remove(col, id) { await fs.deleteDoc(orgDoc(col, id)); },
    subSettings(cb) {
      return fs.onSnapshot(orgDoc("settings", "main"), (s) => cb(s.exists() ? s.data() : {}), () => cb({}));
    },
    async saveSettings(patch) { await fs.setDoc(orgDoc("settings", "main"), clean(patch), { merge: true }); },
    // Las fotos van en su propia colección (no dentro de la lectura) para que
    // las listas carguen rápido; se descargan solo al abrirlas.
    async putPhoto(dataUrl) { const r = fs.doc(orgCol("photos")); await fs.setDoc(r, { data: dataUrl, by: session.uid, at: Date.now() }); return r.id; },
    async getPhoto(id) { const s = await fs.getDoc(orgDoc("photos", id)); return s.exists() ? s.data().data : null; },
    async removePhoto(id) { await fs.deleteDoc(orgDoc("photos", id)).catch(() => {}); },
    subUsers(cb) {
      const q = fs.query(fs.collection(db, "users"), fs.where("orgId", "==", session.orgId));
      return fs.onSnapshot(q, (qs) => cb(qs.docs.map((d) => ({ ...d.data(), id: d.id }))), () => cb([]));
    },
    async setRole(userId, role) { await fs.updateDoc(fs.doc(db, "users", userId), { role }); },
    async resetDemo() {}
  };
}

/* ─────────── APP INICIAL (solo lectura, mismo Firebase) ───────────
   Lee las colecciones de FASE·3 Predictivo tal como están y las traduce al
   formato de esta app. Ninguna función escribe en esa base de datos. */
const LEGACY_KEYS = ["iL1", "iL2", "iL3", "vL1", "vL2", "vL3", "tL1", "tL2", "tL3", "tMax", "tBreaker", "tContactor"];
function legacyType(t) {
  const x = String(t || "").toLowerCase();
  if (/trafo|transf/.test(x)) return "trafo";
  if (/gener|planta de emerg/.test(x)) return "gen";
  if (/capac/.test(x)) return "cap";
  if (/rectif|cargador/.test(x)) return "rect";
  if (/motor|bomba|ventil|compres|agitad|extract|soplad/.test(x)) return "motor";
  return "tablero";
}
async function createLegacyStore() {
  const { legacyConfig, LEGACY_ORG_NAME } = await import("../legacy-config.js");
  const { initializeApp } = await import("firebase/app");
  const fs = await import("firebase/firestore");
  const au = await import("firebase/auth");
  const app = initializeApp(legacyConfig, "legacy");
  const db = fs.initializeFirestore(app, { localCache: fs.persistentLocalCache({ tabManager: fs.persistentMultipleTabManager() }) });
  const auth = au.getAuth(app);
  await au.setPersistence(auth, au.browserLocalPersistence).catch(() => {});
  const photoCache = {};
  const ro = async () => { throw new Error("Esta versión es de solo lectura: registra y edita en la app inicial."); };
  const mapEq = (d) => {
    const x = d.data();
    if (x.photoBase64) photoCache["eq:" + d.id] = x.photoBase64;
    return { id: d.id, name: x.name || "Sin nombre", type: legacyType(x.type), typeLabel: x.type || "", plantId: x.plantId || "", ccmId: x.ccmId || "", plate: {}, photoId: x.photoBase64 ? "eq:" + d.id : null };
  };
  const mapReading = (d) => {
    const x = d.data();
    const values = {};
    LEGACY_KEYS.forEach((k) => { if (x[k] !== null && x[k] !== undefined && x[k] !== "" && !Number.isNaN(x[k])) values[k] = String(x[k]); });
    const photoIds = [];
    if (x.photoTermoBase64) { photoCache["t:" + d.id] = x.photoTermoBase64; photoIds.push("t:" + d.id); }
    if (x.photoEquipoBase64) { photoCache["e:" + d.id] = x.photoEquipoBase64; photoIds.push("e:" + d.id); }
    return { id: d.id, equipmentId: x.equipmentId, date: String(x.date || "").slice(0, 16), values, notes: x.notes || "", photoIds, userId: x.technicianId || "", userName: x.technicianName || "" };
  };
  const MAP = { plants: (d) => ({ id: d.id, ...d.data() }), ccms: (d) => ({ id: d.id, ...d.data() }), equipment: mapEq, readings: mapReading };
  return {
    mode: "legacy",
    readOnly: true,
    onAuth(cb) {
      let unsubUser = null;
      const off = au.onAuthStateChanged(auth, (u) => {
        if (unsubUser) { unsubUser(); unsubUser = null; }
        if (!u || u.isAnonymous) { cb(null); return; }
        unsubUser = fs.onSnapshot(fs.doc(db, "users", u.uid), (snap) => {
          const p = snap.exists() ? snap.data() : {};
          cb({ uid: u.uid, email: u.email, name: p.displayName || u.email, role: p.role || "tecnico", orgId: "legacy", orgName: LEGACY_ORG_NAME, inviteCode: "" });
        }, () => cb({ uid: u.uid, email: u.email, name: u.email, role: "tecnico", orgId: "legacy", orgName: LEGACY_ORG_NAME, inviteCode: "" }));
      });
      return () => { off(); if (unsubUser) unsubUser(); };
    },
    async signIn(email, password) { await au.signInWithEmailAndPassword(auth, email, password); },
    signUp: ro,
    async signOut() { await au.signOut(auth); },
    async resetPassword(email) { await au.sendPasswordResetEmail(auth, email); },
    sub(col, cb) {
      return fs.onSnapshot(fs.collection(db, col), (qs) => cb(qs.docs.map(MAP[col])), (e) => console.error(col, e));
    },
    add: ro, update: ro, remove: ro,
    subSettings(cb) {
      return fs.onSnapshot(fs.doc(db, "settings", "thresholds"), (s) => cb(s.exists() ? { thresholds: s.data() } : {}), () => cb({}));
    },
    saveSettings: ro,
    putPhoto: ro,
    async getPhoto(id) { return photoCache[id] || null; },
    async removePhoto() {},
    subUsers(cb) {
      return fs.onSnapshot(fs.collection(db, "users"), (qs) => cb(qs.docs.map((d) => ({ id: d.id, name: d.data().displayName || d.data().email, email: d.data().email, role: d.data().role || "tecnico" }))), () => cb([]));
    },
    setRole: ro,
    async resetDemo() {}
  };
}

let storePromise = null;
export function getStore() {
  if (!storePromise) storePromise = IS_LEGACY ? createLegacyStore() : IS_DEMO ? Promise.resolve(createDemoStore()) : createFirebaseStore();
  return storePromise;
}
