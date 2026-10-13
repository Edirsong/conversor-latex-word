# Conversor LaTeX → Word

Aplicación web **local** que convierte código LaTeX en un documento Word (`.docx`) con **ecuaciones nativas y editables**. Incluye vista previa en vivo y avisos cuando Pandoc no logra interpretar algo.

> Funciona en tu propio equipo: tu contenido no se envía a ningún servicio externo.

## Características

- Pega o arrastra un archivo `.tex`, `.txt` o `.md`.
- Vista previa en tiempo real con las ecuaciones renderizadas.
- Descarga de un `.docx` real, con ecuaciones editables en Word.
- **Ecuaciones sueltas**: si pegas una fórmula sin `$...$` (por ejemplo `\frac{x^2}{a^2} = 1`), el conversor la envuelve en `$$...$$` automáticamente.
- Avisos de Pandoc y detección de entornos `\begin{...}` / `\end{...}` mal cerrados, con la línea aproximada marcada en el editor.
- Sin dependencias de npm: solo Node.js y Pandoc.

## Requisitos

1. [Node.js](https://nodejs.org) 18 o superior.
2. [Pandoc](https://pandoc.org/installing.html) instalado.

El conversor busca Pandoc en este orden:

1. Variable de entorno `PANDOC_PATH` (ruta completa al ejecutable).
2. Carpeta `bin/` del proyecto (copia portable de Pandoc).
3. El `PATH` del sistema.
4. Ubicaciones habituales de Windows (instalador de Pandoc, Zettlr).

## Uso

**Windows:** doble clic en `Iniciar_Conversor.bat` (abre el navegador solo). Para cerrar, usa el botón **Apagar servidor** de la página o `Detener_Conversor.bat`.

**Cualquier sistema:**

```bash
npm start
```

y abre <http://localhost:4173>. Para cambiar el puerto: `PORT=5000 npm start`.

## Ejemplo

Pega esto (sin `$`) y obtendrás las ecuaciones en Word:

```latex
\frac{x^2}{a^2} + \frac{y^2}{b^2} = 1

i\hbar \frac{\partial}{\partial t}\Psi(x,t) = \left[ -\frac{\hbar^2}{2m}\frac{\partial^2}{\partial x^2} + V(x) \right] \Psi(x,t)
```

## Limitaciones

Pandoc no entiende todo LaTeX. Pueden fallar los paquetes como `tikz`, `physics` o `siunitx`, las macros propias (`\newcommand`) y algunas tablas complejas. El panel de advertencias te indica cuando algo se descartó.

## ¿Se puede publicar en GitHub Pages?

No: el conversor necesita un servidor Node y Pandoc, y GitHub Pages solo sirve archivos estáticos. Este repositorio es para descargar y ejecutar en tu equipo.

## Seguridad

El servidor escucha solo en `127.0.0.1` (no es accesible desde otros equipos) y limita el tamaño de lo que recibe a 5 MB.

## Estructura

```
server.js            Servidor HTTP (módulos nativos de Node)
pandoc-locator.js    Localiza Pandoc
converters/          Conversores (latex-to-word.js); se pueden agregar más
public/              Interfaz web (HTML, CSS, JS)
```

## Licencia

[MIT](LICENSE) · Edir Gonzano
