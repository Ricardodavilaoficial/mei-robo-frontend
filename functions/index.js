/* MEI Robô - Backend mock: request-optin (inert)
   - POST /api/contacts/:id/request-optin
   - Grava um outbox "queued" e uma auditoria. Não envia mensagem real.
*/
const functions = require("firebase-functions");
const admin = require("firebase-admin");
const express = require("express");

if (!admin.apps.length) {
  admin.initializeApp();
}
const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

const app = express();
app.use(express.json());

// Middleware simples de idempotência (opcional)
app.use((req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  next();
});

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

// Exporta como uma única Function com roteamento por caminho
exports.api = functions
  .region("southamerica-east1") // São Paulo
  .https.onRequest(app);
