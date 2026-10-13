(() => {
  const codeInput = document.getElementById("codeInput");
  const lineGutter = document.getElementById("lineGutter");
  const dropzone = document.getElementById("dropzone");
  const previewFrame = document.getElementById("previewFrame");
  const statusBadge = document.getElementById("statusBadge");
  const btnConvert = document.getElementById("btnConvert");
  const btnOpenFile = document.getElementById("btnOpenFile");
  const btnClear = document.getElementById("btnClear");
  const fileInput = document.getElementById("fileInput");
  const filenameInput = document.getElementById("filenameInput");
  const converterSelect = document.getElementById("converterSelect");
  const toast = document.getElementById("toast");
  const warningsBox = document.getElementById("warningsBox");
  const warningsToggle = document.getElementById("warningsToggle");
  const warningsCount = document.getElementById("warningsCount");
  const warningsDetail = document.getElementById("warningsDetail");
  const btnShutdown = document.getElementById("btnShutdown");

  // El boton solo tiene sentido al usar la app en el propio equipo.
  if (!["localhost", "127.0.0.1", "[::1]"].includes(location.hostname)) btnShutdown.hidden = true;

  btnShutdown.addEventListener("click", async () => {
    const confirmado = confirm(
      "¿Apagar el servidor del Conversor?\n\nTendrás que volver a abrir Iniciar_Conversor.bat la próxima vez que quieras usarlo."
    );
    if (!confirmado) return;
    try {
      await fetch("/api/shutdown", { method: "POST" });
    } catch (e) {
      // El servidor se apaga justo al responder; un error de red aqui es normal.
    }
    document.body.innerHTML =
      '<div style="display:flex;align-items:center;justify-content:center;height:100vh;font-family:Segoe UI,Arial,sans-serif;color:#262626;">' +
      "<div><h2>Servidor apagado</h2><p>Puedes cerrar esta pestaña. Para volver a usarlo, abre <strong>Iniciar_Conversor.bat</strong>.</p></div></div>";
  });

  warningsToggle.addEventListener("click", () => {
    warningsDetail.hidden = !warningsDetail.hidden;
  });

  // ---- Numeros de linea del editor ----
  function updateLineNumbers(warnLines) {
    const lineCount = codeInput.value.split("\n").length;
    const warnSet = new Set(warnLines || []);
    let html = "";
    for (let i = 1; i <= lineCount; i++) {
      html += warnSet.has(i) ? `<span class="warn-line">${i}</span>` : String(i);
      if (i < lineCount) html += "\n";
    }
    lineGutter.innerHTML = html;
  }

  codeInput.addEventListener("scroll", () => {
    lineGutter.scrollTop = codeInput.scrollTop;
  });

  // ---- Intenta ubicar en que linea aproximada cayo cada advertencia ----
  // Pandoc no da el numero de linea absoluto del documento, asi que buscamos
  // el fragmento que menciona en el propio texto para estimarlo. Es un intento
  // aproximado (best-effort), no una garantia exacta.
  function estimateWarningLines(warningsText, sourceText) {
    if (!warningsText) return [];
    const lines = sourceText.split("\n");
    const found = [];
    const re = /Could not convert TeX math\s*\r?\n?([\s\S]*?), rendering as TeX:/g;
    let m;
    while ((m = re.exec(warningsText))) {
      const snippetLines = m[1].split("\n").map((s) => s.trim()).filter(Boolean);
      if (!snippetLines.length) continue;
      const firstLine = snippetLines[0];
      const idx = lines.findIndex((l) => l.includes(firstLine));
      if (idx !== -1) found.push(idx + 1); // 1-indexado
    }
    return found;
  }

  function showWarnings(warningsText) {
    if (!warningsText) {
      warningsBox.hidden = true;
      warningsDetail.hidden = true;
      updateLineNumbers([]);
      return;
    }
    const count = (warningsText.match(/\[WARNING\]/g) || [warningsText]).length;
    const lineHints = estimateWarningLines(warningsText, codeInput.value);
    warningsCount.textContent = count;
    warningsDetail.textContent =
      (lineHints.length
        ? "Línea aproximada: " + lineHints.join(", ") + " (estimado buscando el fragmento; puede no ser exacto)\n\n"
        : "") + warningsText;
    warningsBox.hidden = false;
    updateLineNumbers(lineHints);
  }

  let debounceTimer = null;
  let previewSeq = 0;

  function showToast(message) {
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => toast.classList.remove("show"), 6000);
  }

  function setStatus(text, kind) {
    statusBadge.textContent = text;
    statusBadge.className = "status" + (kind ? " " + kind : "");
  }

  function renderPreview(html) {
    const doc = previewFrame.contentDocument;
    doc.open();
    doc.write(
      "<!DOCTYPE html><html><head><meta charset='utf-8'>" +
        "<style>body{font-family:Georgia,serif;padding:1.2rem 1.5rem;line-height:1.55;color:#1a1a1a;} " +
        "math{font-size:1.05em;} p{margin:0 0 0.9em;} li p{margin:0;}</style>" +
        "</head><body>" +
        html +
        "</body></html>"
    );
    doc.close();
  }

  async function requestPreview() {
    const text = codeInput.value;
    updateLineNumbers([]);
    if (!text.trim()) {
      renderPreview("<p style='color:#888;font-style:italic;'>La vista previa aparecerá aquí…</p>");
      setStatus("esperando contenido…");
      showWarnings("");
      return;
    }
    const mySeq = ++previewSeq;
    setStatus("generando vista previa…");
    try {
      const res = await fetch("/api/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, converter: converterSelect.value }),
      });
      const data = await res.json();
      if (mySeq !== previewSeq) return; // una escritura mas reciente ya esta en curso
      if (!data.ok) {
        setStatus("error al generar vista previa", "error");
        showWarnings("");
        renderPreview(
          "<p style='color:#b3372c;'>No se pudo generar la vista previa:</p><pre style='white-space:pre-wrap;color:#b3372c;font-size:0.85em;'>" +
            escapeHtml(data.error) +
            "</pre>"
        );
        return;
      }
      renderPreview(data.html);
      showWarnings(data.warnings);
      setStatus(data.warnings ? "vista previa actualizada (con advertencias)" : "vista previa actualizada", data.warnings ? "warn" : "ok");
    } catch (err) {
      if (mySeq !== previewSeq) return;
      setStatus("no se pudo conectar con el servidor", "error");
    }
  }

  function escapeHtml(s) {
    const div = document.createElement("div");
    div.textContent = s;
    return div.innerHTML;
  }

  function scheduleUpdate() {
    updateLineNumbers([]);
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(requestPreview, 450);
  }

  codeInput.addEventListener("input", scheduleUpdate);

  // Reemplaza todo el contenido del editor SIN romper el historial de deshacer
  // (Ctrl+Z). Asignar textarea.value directamente borra ese historial; en cambio,
  // seleccionamos todo e insertamos como si fuera una accion de escritura normal.
  function replaceEditorContent(newText) {
    codeInput.focus();
    codeInput.select();
    const inserted =
      document.queryCommandSupported &&
      document.queryCommandSupported("insertText") &&
      document.execCommand("insertText", false, newText);
    if (!inserted) {
      // Respaldo por si el navegador no soporta execCommand
      codeInput.value = newText;
      codeInput.dispatchEvent(new Event("input", { bubbles: true }));
    }
  }

  // ---- Abrir archivo por boton ----
  btnOpenFile.addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", () => {
    if (fileInput.files[0]) loadFile(fileInput.files[0]);
  });

  btnClear.addEventListener("click", () => {
    replaceEditorContent("");
    requestPreview();
    codeInput.focus();
  });

  function loadFile(file) {
    const reader = new FileReader();
    reader.onload = () => {
      replaceEditorContent(reader.result);
      requestPreview();
      const base = file.name.replace(/\.[^/.]+$/, "");
      if (base) filenameInput.value = base;
    };
    reader.onerror = () => showToast("No se pudo leer el archivo.");
    reader.readAsText(file, "utf-8");
  }

  // ---- Arrastrar y soltar ----
  ["dragenter", "dragover"].forEach((evt) =>
    dropzone.addEventListener(evt, (e) => {
      e.preventDefault();
      dropzone.classList.add("dragover");
    })
  );
  ["dragleave", "drop"].forEach((evt) =>
    dropzone.addEventListener(evt, (e) => {
      e.preventDefault();
      if (evt === "dragleave" && e.target !== dropzone) return;
      dropzone.classList.remove("dragover");
    })
  );
  dropzone.addEventListener("drop", (e) => {
    const file = e.dataTransfer.files[0];
    if (file) loadFile(file);
  });

  // ---- Generar Word ----
  btnConvert.addEventListener("click", async () => {
    const text = codeInput.value;
    if (!text.trim()) {
      showToast("Escribe o carga contenido antes de generar el Word.");
      return;
    }
    btnConvert.disabled = true;
    btnConvert.textContent = "Generando…";
    try {
      const res = await fetch("/api/convert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          converter: converterSelect.value,
          filename: filenameInput.value || "documento",
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Error desconocido" }));
        throw new Error(data.error || "Error al generar el documento");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = (filenameInput.value || "documento") + ".docx";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setStatus("Word generado y descargado", "ok");
    } catch (err) {
      showToast("Error: " + err.message);
    } finally {
      btnConvert.disabled = false;
      btnConvert.textContent = "Generar Word";
    }
  });

  // Estado inicial
  updateLineNumbers([]);
  renderPreview("<p style='color:#888;font-style:italic;'>La vista previa aparecerá aquí…</p>");
})();
