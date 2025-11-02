// functions/thumbs.js
const { onObjectFinalized } = require("firebase-functions/v2/storage");
const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");
const sharp = require("sharp");

// garante admin inicializado (respeita seu index.js atual)
if (!admin.apps.length) admin.initializeApp();

const BUCKET = "mei-robo-prod.firebasestorage.app"; // seu bucket
const THUMB_MAX = 256; // lado máx. da miniatura
const THUMB_SUFFIX = ".thumb.jpg"; // sufixo do arquivo gerado
const THUMBS_DIR = "_thumbs"; // subpasta para manter tudo organizado

function isUserMediaPath(name) {
  // users/{uid}/media/...
  return /^users\/[^/]+\/media\//.test(name);
}

function isThumbPath(name) {
  return name.includes(`/${THUMBS_DIR}/`) || name.endsWith(THUMB_SUFFIX);
}

exports.generateThumbnail = onObjectFinalized(
  {
    region: "us-central1", // mesmo region do seu bucket
    bucket: BUCKET,
    memory: "512MiB",
    timeoutSeconds: 120
  },
  async (event) => {
    const object = event.data;
    const name = object.name;              // caminho (Name)
    const contentType = object.contentType || "";

    // filtros rápidos (evitar loops e custo)
    if (!name || !isUserMediaPath(name)) {
      logger.debug("ignorado: fora de users/{uid}/media", { name });
      return;
    }
    if (isThumbPath(name)) {
      logger.debug("ignorado: já é thumbnail", { name });
      return;
    }
    if (!contentType.startsWith("image/")) {
      logger.debug("ignorado: não é imagem", { name, contentType });
      return;
    }
    // opcional: ignore GIF animado (custa bastante)
    if (contentType === "image/gif") {
      logger.debug("ignorado: gif animado", { name });
      return;
    }

    const bucket = admin.storage().bucket(BUCKET);
    const srcFile = bucket.file(name);

    // define destino: users/{uid}/media/.../_thumbs/arquivo.thumb.jpg
    const lastSlash = name.lastIndexOf("/");
    const dir = name.substring(0, lastSlash);
    const base = name.substring(lastSlash + 1)
      .replace(/\.[^.]+$/, ""); // sem extensão
    const dstName = `${dir}/${THUMBS_DIR}/${base}${THUMB_SUFFIX}`;
    const dstFile = bucket.file(dstName);

    try {
      // baixa em buffer
      const [buf] = await srcFile.download();

      // processa
      const out = await sharp(buf)
        .rotate() // respeita exif
        .resize(THUMB_MAX, THUMB_MAX, { fit: "inside", withoutEnlargement: true })
        .jpeg({ quality: 78, mozjpeg: true })
        .toBuffer();

      // garante pasta (GCS não tem pasta real, só prefixo; subir direto resolve)
      await dstFile.save(out, {
        contentType: "image/jpeg",
        metadata: {
          // dica: pode marcar como cacheável por 1h no edge
          cacheControl: "public, max-age=3600"
        }
      });

      logger.info("thumbnail gerada", { src: name, dst: dstName });
    } catch (err) {
      logger.error("erro ao gerar thumbnail", { name, err });
      throw err;
    }
  }
);
