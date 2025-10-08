/* MEI Robô — Functions index.js (v1.1)
 * Escopo:
 *  - POST /api/contacts/:id/request-optin   → grava outbox "queued" + auditoria (inerte)
 *  - GET  /media/signed-url                 → Signed URL de leitura (TTL curto), valida posse e MIME
 *
 * Pilares: auth (Bearer idToken), CORS controlável por env, rate-limit leve, idempotência, logs
 * Compat: mantém require("./mediaQuota") e require("./thumbs") já existentes.
 *
 * ENV (opcionais):
 *  - ALLOWED_ORIGINS="https://meirobo.com.br,https://www.meirobo.com.br,https://mei-robo-prod.web.app,https://mei-robo-prod.firebaseapp.com"
 *  - MEDIA_BUCKET="mei-robo-prod.appspot.com"   // se não setado, usa bucket default do projeto
 *  - COLLECTION_MODE="global" | "byOwner"       // default "global"
 *  - SIGNED_URL_TTL_MIN=15
 *  - IDEMPOTENCY_WINDOW_MIN=10
 *  - ALLOW_MIME="image/jpeg,image/png,application/pdf"
 */

const functions = require("firebase-functions/v1");
const { onRequest } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const express = require("express");
const cors = require("cors");

if (!admin.apps.length) {
  admin.initializeApp(); // usa config padrão do projeto
}
const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

// ---------- ENV & defaults ----------
const CFG = {
  ALLOWED_ORIGINS: (process.env.ALLOWED_ORIGINS || "").split(",").map(s => s.trim()).filter(Boolean),
  MEDIA_BUCKET: process.env.MEDIA_BUCKET || "", // se vazio, usaremos o bucket default via admin.storage().bucket()
  COLLECTION_MODE: (process.env.COLLECTION_MODE || "global").toLowerCase(), // "global" (default) ou "byowner"
  SIGNED_URL_TTL_MIN: parseInt(process.env.SIGNED_URL_TTL_MIN || "15", 10),
  IDEMPOTENCY_WINDOW_MIN: parseInt(process.env.IDEMPOTENCY_WINDOW_MIN || "10", 10),
  ALLOW_MIME: (process.env.ALLOW_MIME || "image/jpeg,image/png,application/pdf").split(",").map(s => s.trim()).filter(Boolean),
};

// ---------- CORS dinâmico ----------
const corsDynamic = cors({
  origin: function (origin, cb) {
    if (!origin) return cb(null, true); // permitir ferramentas CLI/curl
    if (CFG.ALLOWED_ORIGINS.length === 0) return cb(null, true); // liberado se não configurado
    if (CFG.ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
    return cb(new Error("CORS blocked"));
  },
  credentials: true,
});

const app = express();
app.use(corsDynamic);
app.use(express.json());
app.use((req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  next();
});

// ---------- Auth middleware (Bearer <idToken>) ----------
async function authenticate(req, res, next) {
  try {
    const authHeader = req.header("Authorization") || "";
    const match = authHeader.match(/^Bearer (.+)$/);
    if (!match) return res.status(401).json({ error: "missing token" });
    const idToken = match[1];
    const decoded = await admin.auth().verifyIdToken(idToken);
    req.user = decoded;
    next();
  } catch (err) {
    console.error("[auth] error", err);
    return res.status(401).json({ error: "invalid token" });
  }
}

// ---------- Mini rate-limit em memória (IP+uid) ----------
const rl = new Map(); // key -> { count, ts }
function rateLimit(key, limit, windowMs) {
  const now = Date.now();
  const entry = rl.get(key);
  if (!entry || now - entry.ts > windowMs) {
    rl.set(key, { count: 1, ts: now });
    return true;
  }
  if (entry.count >= limit) return false;
  entry.count += 1;
  return true;
}

// ---------- Utils: collections conforme modo ----------
function colRefs(uid) {
  if (CFG.COLLECTION_MODE === "byowner") {
    return {
      outbox: db.collection("profissionais").doc(uid).collection("outbox"),
      audits: db.collection("profissionais").doc(uid).collection("auditoria"),
    };
  }
  // default: global (compat com versão atual do usuário)
  return {
    outbox: db.collection("outbox"),
    audits: db.collection("audits"),
  };
}

// ---------- Health ----------
app.get("/api/health", (req, res) => {
  return res.status(200).json({ ok: true, ts: Date.now(), mode: CFG.COLLECTION_MODE });
});

// ---------- POST /api/contacts/:id/request-optin ----------
app.post("/api/contacts/:id/request-optin", async (req, res) => {
  try {
    const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress || "unknown";
    const key = `optin:${ip}`;
    if (!rateLimit(key, 20, 60_000)) return res.status(429).json({ ok: false, error: "rate_limited" });

    const contactId = (req.params.id || "").trim();
    const { uid, reason = "user_click" } = req.body || {};

    if (!uid || !contactId) {
      return res.status(400).json({ ok: false, error: "uid e contactId obrigatórios" });
    }

    const { outbox, audits } = colRefs(uid);

    // Idempotência: consulta eventos recentes para o mesmo contato
    const minTs = new Date(Date.now() - CFG.IDEMPOTENCY_WINDOW_MIN * 60_000);
    const snap = await outbox
      .where("type", "==", "request_optin")
      .where("uid", "==", uid)
      .where("contactId", "==", contactId)
      .where("createdAt", ">=", minTs)
      .orderBy("createdAt", "desc")
      .limit(1)
      .get();

    if (!snap.empty) {
      const doc = snap.docs[0];
      await audits.add({
        event: "request_optin_idempotent",
        uid,
        contactId,
        reason,
        outboxId: doc.id,
        createdAt: FieldValue.serverTimestamp(),
      });
      return res.status(202).json({ ok: true, capability: "mock", state: "queued", outboxId: doc.id, idempotent: true });
    }

    // Cria outbox
    const outboxRef = await outbox.add({
      type: "request_optin",
      provider: "mock",
      state: "queued",
      uid,
      contactId,
      payload: {
        text: "Oi, {{nome}}! Posso te enviar lembretes? Responda SIM para autorizar. Você pode sair quando quiser enviando SAIR.",
      },
      createdAt: FieldValue.serverTimestamp(),
    });

    // Auditoria
    await audits.add({
      event: "request_optin_queued",
      uid,
      contactId,
      reason,
      outboxId: outboxRef.id,
      ip,
      ua: (req.headers["user-agent"] || "").slice(0, 200),
      createdAt: FieldValue.serverTimestamp(),
    });

    return res.status(202).json({
      ok: true,
      capability: "mock",
      state: "queued",
      outboxId: outboxRef.id,
    });
  } catch (e) {
    console.error("[request-optin] error", e);
    return res.status(500).json({ ok: false, error: "internal_error" });
  }
});

/**
 * GET /media/signed-url?path=...
 * - Autenticado (idToken)
 * - Valida posse: path deve começar com users/{uid}/media/ OU profissionais/{uid}/media/
 * - Valida MIME permitido (via metadata.contentType)
 * - Gera Signed URL de leitura com expiração (TTL CFG.SIGNED_URL_TTL_MIN)
 * - Audita
 */
app.get("/media/signed-url", authenticate, async (req, res) => {
  try {
    const path = (req.query.path || "").trim();
    if (!path) return res.status(400).json({ error: "missing path" });

    // Suporta dois formatos (compat / evolução):
    // users/{uid}/media/...     OU    profissionais/{uid}/media/...
    const mUsers = path.match(/^users\/([^/]+)\/media\//);
    const mProf = path.match(/^profissionais\/([^/]+)\/media\//);
    const ownerUid = mUsers ? mUsers[1] : (mProf ? mProf[1] : null);
    if (!ownerUid) return res.status(400).json({ error: "invalid path format" });

    if (!req.user || ownerUid !== req.user.uid) {
      return res.status(403).json({ error: "forbidden" });
    }

    const bucket = CFG.MEDIA_BUCKET
      ? admin.storage().bucket(CFG.MEDIA_BUCKET)
      : admin.storage().bucket(); // default do projeto

    const file = bucket.file(path);

    // Existe?
    const [exists] = await file.exists();
    if (!exists) return res.status(404).json({ error: "file not found" });

    // Metadata / contentType
    const [metadata] = await file.getMetadata();
    const contentType = (metadata && metadata.contentType) || "";
    if (CFG.ALLOW_MIME.length && !CFG.ALLOW_MIME.includes(contentType)) {
      return res.status(400).json({ error: "mime_not_allowed", contentType });
    }

    const expiresAt = Date.now() + CFG.SIGNED_URL_TTL_MIN * 60_000;
    const [url] = await file.getSignedUrl({ action: "read", expires: expiresAt });

    // Auditoria
    const { audits } = colRefs(req.user.uid);
    await audits.add({
      event: "signed_url_issued",
      uid: req.user.uid,
      path,
      contentType,
      expiresAt,
      createdAt: FieldValue.serverTimestamp(),
    });

    return res.json({ url, expiresAt, contentType });
  } catch (err) {
    console.error("[signed-url] error", err);
    return res.status(500).json({ error: "internal_error" });
  }
});

// ---------- Export V2 (sul-américa) ----------
exports.api = onRequest({ region: "southamerica-east1" }, app);

// ---------- Mantém outras exports existentes ----------
try {
  Object.assign(exports, require("./mediaQuota"));
} catch (e) {
  console.warn("[warn] mediaQuota not found (ok if not used).");
}
try {
  Object.assign(exports, require("./thumbs"));
} catch (e) {
  console.warn("[warn] thumbs not found (ok if not used).");
}
