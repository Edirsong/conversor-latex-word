// Conversor: LaTeX -> Word (.docx)
// Usa el Pandoc real instalado en el sistema (no depende de ningun paquete npm).
"use strict";

const { execFile } = require("child_process");
const { findPandoc, NOT_FOUND_MESSAGE } = require("../pandoc-locator");

const TIMEOUT_MS = 20000; // evita que un pegado con un error raro deje el servidor colgado

function runPandoc(args, inputText, wantBuffer) {
  return new Promise((resolve, reject) => {
    let pandocPath;
    try {
      pandocPath = findPandoc();
    } catch (e) {
      return reject(e);
    }
    const child = execFile(
      pandocPath,
      args,
      {
        encoding: wantBuffer ? "buffer" : "utf8",
        maxBuffer: 1024 * 1024 * 100,
        timeout: TIMEOUT_MS,
      },
      (err, stdout, stderr) => {
        const stderrText = stderr ? stderr.toString() : "";
        if (err) {
          if (err.killed || err.signal === "SIGTERM") {
            return reject(new Error("Pandoc tardó demasiado en procesar este contenido (revisa que no tenga un entorno mal cerrado)."));
          }
          if (err.code === "ENOENT") return reject(new Error(NOT_FOUND_MESSAGE));
          return reject(new Error(stderrText || err.message));
        }
        resolve({ stdout, stderrText });
      }
    );
    child.stdin.write(inputText, "utf8");
    child.stdin.end();
  });
}

// Revision propia (sin Pandoc): cuenta \begin{...} vs \end{...} bien formados.
// Un entorno mal cerrado (ej. "\end{enumerate>" en vez de "\end{enumerate}") a veces
// hace que Pandoc descarte todo el resto del documento SIN avisar nada por stderr.
// Esta revision detecta ese desbalance antes de que pase desapercibido.
function checkEnvironmentBalance(latexText) {
  const beginMatches = latexText.match(/\\begin\{[a-zA-Z*]+\}/g) || [];
  const endMatches = latexText.match(/\\end\{[a-zA-Z*]+\}/g) || [];
  if (beginMatches.length === endMatches.length) return "";

  // Busca las lineas con un \end sospechoso (que no cierra bien con "}")
  const sospechosos = [];
  latexText.split("\n").forEach((line, i) => {
    if (/\\end\{[a-zA-Z*]*[^a-zA-Z*}][^\n]*/.test(line) && !/\\end\{[a-zA-Z*]+\}/.test(line)) {
      sospechosos.push(`  línea ${i + 1}: ${line.trim()}`);
    }
  });

  let msg =
    `[AVISO DEL CONVERSOR] Se encontraron ${beginMatches.length} "\\begin{...}" pero ${endMatches.length} "\\end{...}" bien cerrados en tu código.\n` +
    `Esto puede hacer que Pandoc descarte en silencio todo el contenido posterior a un entorno mal cerrado (sin mostrar ningún error).`;
  if (sospechosos.length) {
    msg += `\nRevisa especialmente:\n` + sospechosos.join("\n");
  }
  return msg;
}


// Envuelve en $$...$$ los bloques que son matematica "suelta" (sin delimitadores).
// Pandoc descarta \frac, \partial, etc. si no estan dentro de $...$ o $$...$$,
// asi que quien pega una ecuacion sola obtiene un resultado vacio.
// Solo actua sobre bloques (separados por lineas en blanco) que estan fuera de
// cualquier \begin{...}...\end{...}, que no tienen ya delimitadores y que no parecen prosa.
const STRUCTURAL =
  /^\s*\\(documentclass|usepackage|begin|end|section|subsection|subsubsection|chapter|paragraph|item|title|author|date|maketitle|newcommand|renewcommand|def|label|caption|includegraphics|textbf|textit|emph|text|hline)\b/;
const DELIMITED = /\$|\\\[|\\\(|\\begin\{|\\end\{/;
const WORD = "[A-Za-zÁÉÍÓÚáéíóúñÑ]{3,}";
const PROSE = new RegExp(`${WORD}\\s+${WORD}\\s+${WORD}`);

function looksLikeBareMath(block) {
  if (!block.trim() || DELIMITED.test(block) || STRUCTURAL.test(block)) return false;
  const withoutCommands = block.replace(/\\[a-zA-Z]+/g, " ");
  if (PROSE.test(withoutCommands)) return false; // parece prosa, no una ecuacion
  const hasCommand = /\\[a-zA-Z]+/.test(block);
  const hasScriptsAndEquals = /[\^_]/.test(block) && block.includes("=");
  return hasCommand || hasScriptsAndEquals;
}

function countMatches(text, re) {
  return (text.match(re) || []).length;
}

function autoWrapMath(latexText) {
  const parts = latexText.split(/(\r?\n[ \t]*\r?\n)/); // conserva los separadores
  let depth = 0;
  return parts
    .map((part, i) => {
      if (i % 2 === 1) return part; // separador
      const wasOutside = depth === 0;
      depth += countMatches(part, /\\begin\{/g) - countMatches(part, /\\end\{/g);
      if (depth < 0) depth = 0;
      if (!wasOutside || !looksLikeBareMath(part)) return part;
      const body = part.trim();
      const inner = body.includes("&") ? "\\begin{aligned}\n" + body + "\n\\end{aligned}" : body;
      return "$$\n" + inner + "\n$$";
    })
    .join("");
}

// Vista previa: HTML con las ecuaciones en MathML (el navegador las renderiza nativamente).
// Tambien devuelve las advertencias de Pandoc (equivalente al log de errores de Overleaf),
// mas la revision propia de entornos mal cerrados.
async function toPreviewHtml(latexText) {
  const balanceWarning = checkEnvironmentBalance(latexText);
  const { stdout, stderrText } = await runPandoc(
    ["-f", "latex", "-t", "html", "--mathml"],
    autoWrapMath(latexText),
    false
  );
  const warnings = [balanceWarning, stderrText.trim()].filter(Boolean).join("\n\n");
  return { html: stdout, warnings };
}

// Conversion final: documento Word real, con ecuaciones nativas editables
async function toDocx(latexText) {
  const { stdout } = await runPandoc(["-f", "latex", "-t", "docx", "-o", "-"], autoWrapMath(latexText), true);
  return stdout;
}

module.exports = {
  id: "latex-to-word",
  label: "LaTeX → Word",
  toPreviewHtml,
  toDocx,
  autoWrapMath, // exportado para pruebas
};
