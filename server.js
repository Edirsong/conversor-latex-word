// Servidor local del Conversor. Sin dependencias npm: solo modulos nativos de Node.
"use strict";

const http = require("http");
const fs = require("fs");
const path = require("path");
const { getConverter } = require("./converters/index.js");

const PORT = Number(process.env.PORT) || 4173;
const HOST = "127.0.0.1"; // solo accesible desde este equipo
const MAX_BODY = 5 * 1024 * 1024; // 5 MB
const PUBLIC_DIR = path.join(__dirname, "public");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

function serveStatic(req, res) {
  let reqPath = req.url.split("?")[0];
  try {
    reqPath = decodeURIComponent(reqPath);
  } catch (e) {
    res.writeHead(400);
    return res.end("Solicitud invalida");
  }
  if (reqPath === "/") reqPath = "/index.html";
  const filePath = path.join(PUBLIC_DIR, path.normalize(reqPath));

  // Evita salir de la carpeta public/
  if (!filePath.startsWith(PUBLIC_DIR + path.sep)) {
    res.writeHead(403);
    return res.end("Prohibido");
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      return res.end("No encontrado");
    }
    const ext = path.extname(filePath);
    res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
    res.end(data);
  });
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (c) => {
      size += c.length;
      if (size > MAX_BODY) {
        reject(new Error("El contenido es demasiado grande (maximo 5 MB)."));
        return req.destroy();
      }
      chunks.push(c);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

async function handlePreview(req, res) {
  try {
    const body = JSON.parse(await readBody(req));
    const converter = getConverter(body.converter || "latex-to-word");
    if (!converter) throw new Error("Conversor no encontrado: " + body.converter);
    const { html, warnings } = await converter.toPreviewHtml(body.text || "");
    res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ ok: true, html, warnings }));
  } catch (err) {
    res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ ok: false, error: err.message }));
  }
}

async function handleConvert(req, res) {
  try {
    const body = JSON.parse(await readBody(req));
    const converter = getConverter(body.converter || "latex-to-word");
    if (!converter) throw new Error("Conversor no encontrado: " + body.converter);
    const docxBuffer = await converter.toDocx(body.text || "");
    const filename = (body.filename || "documento").replace(/[^\w\-\.]+/g, "_") + ".docx";
    res.writeHead(200, {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${filename}"`,
    });
    res.end(docxBuffer);
  } catch (err) {
    res.writeHead(500, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ ok: false, error: err.message }));
  }
}

function handleShutdown(req, res) {
  const addr = req.socket.remoteAddress;
  if (!["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(addr)) {
    res.writeHead(403, { "Content-Type": "application/json; charset=utf-8" });
    return res.end(JSON.stringify({ ok: false, error: "Solo se puede apagar desde este equipo." }));
  }
  res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify({ ok: true }));
  console.log("Apagado solicitado desde la interfaz. Cerrando servidor...");
  setTimeout(() => process.exit(0), 150);
}

const server = http.createServer((req, res) => {
  if (req.method === "POST" && req.url === "/api/preview") return handlePreview(req, res);
  if (req.method === "POST" && req.url === "/api/convert") return handleConvert(req, res);
  if (req.method === "POST" && req.url === "/api/shutdown") return handleShutdown(req, res);
  if (req.method === "GET") return serveStatic(req, res);
  res.writeHead(405);
  res.end("Metodo no permitido");
});

server.listen(PORT, HOST, () => {
  console.log(`Conversor corriendo en http://localhost:${PORT}`);
});
