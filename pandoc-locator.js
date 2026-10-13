// Busca un Pandoc utilizable en el sistema, en este orden:
//   1. Variable de entorno PANDOC_PATH (ruta completa al ejecutable)
//   2. Carpeta bin/ dentro del proyecto (copia portable de Pandoc)
//   3. "pandoc" disponible en el PATH del sistema
//   4. Ubicaciones habituales de Windows (instalador de Pandoc, Zettlr)
"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const EXE = process.platform === "win32" ? "pandoc.exe" : "pandoc";

const CANDIDATES = [
  process.env.PANDOC_PATH,
  path.join(__dirname, "bin", EXE),
  path.join(os.homedir(), "AppData", "Local", "Pandoc", EXE),
  "C:\\Program Files\\Pandoc\\pandoc.exe",
  "C:\\Program Files (x86)\\Pandoc\\pandoc.exe",
  path.join(os.homedir(), "AppData", "Local", "Programs", "Zettlr", "resources", "pandoc.exe"),
].filter(Boolean);

const NOT_FOUND_MESSAGE =
  "No se encontró Pandoc. Instálalo desde https://pandoc.org/installing.html " +
  "(o define la variable PANDOC_PATH con la ruta de pandoc) y reinicia el conversor.";

let cached = null;

function worksInPath() {
  try {
    return spawnSync("pandoc", ["--version"], { timeout: 5000 }).status === 0;
  } catch (e) {
    return false;
  }
}

function findPandoc() {
  if (cached) return cached;
  const explicit = CANDIDATES[0] === process.env.PANDOC_PATH ? CANDIDATES[0] : null;
  if (explicit && fs.existsSync(explicit)) return (cached = explicit);
  const local = path.join(__dirname, "bin", EXE);
  if (fs.existsSync(local)) return (cached = local);
  if (worksInPath()) return (cached = "pandoc");
  for (const candidate of CANDIDATES) {
    if (fs.existsSync(candidate)) return (cached = candidate);
  }
  throw new Error(NOT_FOUND_MESSAGE);
}

module.exports = { findPandoc, CANDIDATES, NOT_FOUND_MESSAGE };
