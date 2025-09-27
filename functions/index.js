/* MEI Robô - Backend mock: request-optin (inert)
   - POST /api/contacts/:id/request-optin
   - Grava um outbox "queued" e uma auditoria. Não envia mensagem real.
   - ADIÇÃO: GET /media/signed-url (signed URL seguro p/ leitura temporária)
*/
const functions = require('firebase-functions/v1');

const admin = require("firebase-admin");
const express = require("express");
const cors = require("cors");

if (!admin.apps.length) {
  admin.initializeApp();
}
const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

// bucket de mídia (ajuste via env se necessário)
// Se quiser forçar outro bucket, defina MEDIA_BUCKET nas envs do projeto.
// Caso não defina, usa valor de produção informado por você.
const MEDIA_BUCKET = process.env.MEDIA_BUCKET || 'mei-robo-prod.firebasestorage.app';

const app = express();
app.use(cors({ origin: true }));
app.use(express.json());

// Middleware simples de idempotência (opcional)
app.use((req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  next();
});

// --- Middleware de autenticação (Bearer <idToken>) para rotas protegidas ---
async function authenticate(req, res, next) {
  try {
    const authHeader = req.header('Authorization') || '';
    const match = authHeader.match(/^Bearer (.+)$/);
    if (!match) return res.status(401).json({ error: 'missing token' });
    const idToken = match[1];
    const decoded = await admin.auth().verifyIdToken(idToken);
    req.user = decoded;
    return next();
  } catch (err) {
    console.error('[auth] error', err);
    return res.status(401).json({ error: 'invalid token' });
  }
}

app.get("/api/health", (req, res) => {
  return res.status(200).json({ ok: true, ts: Date.now() });
});

app.post("/api/contacts/:id/request-optin", async (req, res) => {
  try {
    const contactId = req.params.id;
    const { uid, reason = "user_click" } = req.body || {};

    if (!uid || !contactId) {
      return res.status(400).json({ ok: false, error: "uid e contactId obrigatórios" });
    }

    // (Opcional) Checagem leve de janela 24h: se existir a chave, só marca auditável
    // Para v1 mock, não bloqueia: registramos 'queued' e deixamos o provider real validar depois.

    const outboxRef = await db.collection("outbox").add({
      type: "request_optin",
      provider: "mock",          // mock/inert
      state: "queued",           // queued -> (no real passaria para sent/accepted)
      uid,
      contactId,
      payload: {
        text: "Oi, {{nome}}! Posso te enviar lembretes? Responda SIM para autorizar. Você pode sair quando quiser enviando SAIR."
      },
      createdAt: FieldValue.serverTimestamp()
    });

    // Auditoria
    await db.collection("audits").add({
      event: "request_optin_queued",
      uid,
      contactId,
      reason,
      outboxId: outboxRef.id,
      createdAt: FieldValue.serverTimestamp()
    });

    return res.status(202).json({
      ok: true,
      capability: "mock",
      state: "queued",
      outboxId: outboxRef.id
    });
  } catch (e) {
    console.error("[request-optin] error", e);
    return res.status(500).json({ ok: false, error: "internal_error" });
  }
});

/**
 * ADIÇÃO — GET /media/signed-url?path=<users/{uid}/media/...>
 * - Autenticado (idToken)
 * - Valida posse: path deve começar com users/{uid}/media/
 * - Gera Signed URL de leitura com expiração (15 min)
 * - Audita em 'audits'
 */
app.get("/media/signed-url", authenticate, async (req, res) => {
  try {
    const path = req.query.path;
    if (!path) return res.status(400).json({ error: 'missing path' });

    // valida formato e extrai ownerUid
    const m = path.match(/^users\/([^/]+)\/media\//);
    if (!m) return res.status(400).json({ error: 'invalid path format' });
    const ownerUid = m[1];

    // valida posse (uid do token === uid do path)
    if (!req.user || ownerUid !== req.user.uid) {
      return res.status(403).json({ error: 'forbidden' });
    }

    const bucket = admin.storage().bucket(MEDIA_BUCKET);
    const file = bucket.file(path);

    // checa se o arquivo existe
    const [exists] = await file.exists();
    if (!exists) return res.status(404).json({ error: 'file not found' });

    const expiresAt = Date.now() + (15 * 60 * 1000); // 15 minutos
    const [url] = await file.getSignedUrl({
      action: 'read',
      expires: expiresAt
    });

    // auditoria
    await db.collection('audits').add({
      event: 'signed_url_issued',
      uid: req.user.uid,
      path,
      expiresAt,
      createdAt: FieldValue.serverTimestamp()
    });

    return res.json({ url, expiresAt });
  } catch (err) {
    console.error('[signed-url] error', err);
    return res.status(500).json({ error: 'internal_error' });
  }
});

// Exporta como uma única Function com roteamento por caminho (v2)
const { onRequest } = require("firebase-functions/v2/https");
exports.api = onRequest({ region: "southamerica-east1" }, app);

// Mantém outras exports existentes
Object.assign(exports, require("./mediaQuota"));
Object.assign(exports, require("./thumbs"));
