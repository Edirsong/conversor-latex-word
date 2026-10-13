// Registro de conversores disponibles.
// Para agregar uno nuevo en el futuro: crear un archivo nuevo en esta carpeta que
// exporte { id, label, toPreviewHtml, toDocx (o el metodo que corresponda) },
// y agregarlo a la lista de abajo. La interfaz y el servidor lo detectan solos.
"use strict";

const latexToWord = require("./latex-to-word");

const CONVERTERS = [latexToWord];

function getConverter(id) {
  return CONVERTERS.find((c) => c.id === id);
}

module.exports = { CONVERTERS, getConverter };
