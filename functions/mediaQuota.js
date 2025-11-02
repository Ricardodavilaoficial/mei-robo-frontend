// MEI Robô — mediaQuota.js (v1.0.1)
// Documento de quota em: profissionais/{uid}/quota/current
// Atualiza bytesUsed e filesCount em finalize/delete do Storage (2 GB).

const { onObjectFinalized, onObjectDeleted } = require("firebase-functions/v2/storage");
const admin = require("firebase-admin");

try { admin.app(); } catch (e) { admin.initializeApp(); }

const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

const REGION = "us-central1";
const LIMIT_BYTES_DEFAULT = 2147483648; // 2 GB

function extractUid(objectName) {
  // Caminhos esperados: users/{uid}/media/...
  const m = /^users\/([^/]+)\/media\/.+/.exec(objectName || "");
  return m ? m[1] : null;
}

function quotaRef(uid) {
  // collection/doc/collection/doc (válido)
  return db.doc(`profissionais/${uid}/quota/current`);
}

async function ensureQuotaDoc(uid) {
  const ref = quotaRef(uid);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) {
      tx.set(ref, {
        limitBytes: LIMIT_BYTES_DEFAULT,
        bytesUsed: 0,
        filesCount: 0,
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
    }
  });
  return ref;
}

exports.mediaQuotaOnFinalize = onObjectFinalized({ region: REGION }, async (event) => {
  const { name = "", size = "0", contentType = "" } = event.data || {};
  const uid = extractUid(name);
  if (!uid) {
    console.log("[mediaQuotaOnFinalize] Ignorado: fora do padrão users/{uid}/media/*", name);
    return;
  }
  const bytes = Number(size) || 0;
  const ref = await ensureQuotaDoc(uid);
  await ref.set({
    limitBytes: LIMIT_BYTES_DEFAULT,
    updatedAt: FieldValue.serverTimestamp(),
    lastMime: contentType,
    lastPath: name,
  }, { merge: true });
  await ref.update({
    bytesUsed: FieldValue.increment(bytes),
    filesCount: FieldValue.increment(1),
  });
  console.log("[mediaQuotaOnFinalize] OK", { uid, bytes, name });
});

exports.mediaQuotaOnDelete = onObjectDeleted({ region: REGION }, async (event) => {
  const { name = "", size = "0" } = event.data || {};
  const uid = extractUid(name);
  if (!uid) {
    console.log("[mediaQuotaOnDelete] Ignorado: fora do padrão users/{uid}/media/*", name);
    return;
  }
  const bytes = Number(size) || 0;
  const ref = quotaRef(uid);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) {
      tx.set(ref, {
        limitBytes: LIMIT_BYTES_DEFAULT,
        bytesUsed: 0,
        filesCount: 0,
        updatedAt: FieldValue.serverTimestamp(),
        lastDeletedPath: name,
      }, { merge: true });
      return;
    }
    const data = snap.data() || {};
    const nextBytes = Math.max(0, (data.bytesUsed || 0) - bytes);
    const nextFiles = Math.max(0, (data.filesCount || 0) - 1);
    tx.set(ref, {
      bytesUsed: nextBytes,
      filesCount: nextFiles,
      updatedAt: FieldValue.serverTimestamp(),
      lastDeletedPath: name,
    }, { merge: true });
  });
  console.log("[mediaQuotaOnDelete] OK", { uid, bytes, name });
});
