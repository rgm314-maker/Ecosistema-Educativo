// publico/js/modulos/sopa-letras.js
// Sopa de letras educativa accesible con Pointer Events y selección direccional

import { montarPlantilla } from "../nucleo/plantilla.js";
import { obtenerTemaActividad } from "../nucleo/selector-tema.js";
import { mostrarRetro, mostrarResumen } from "../nucleo/retroalimentacion.js";
import { registrarIntento } from "../nucleo/gamificacion.js";
import * as api from "../nucleo/api.js";
import * as ui from "../nucleo/ui.js";
import * as util from "../nucleo/util.js";

let contenedor = null;

const LETRAS_RELLENO = [
  "A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M",
  "N", "Ñ", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z"
];

// Configuraciones por dificultad
const CONFIG_DIFICULTAD = {
  facil: {
    nombre: "Fácil",
    tamano: 10,
    cantPalabras: 8,
    direcciones: [
      [0, 1], // horizontal derecha
      [1, 0]  // vertical abajo
    ]
  },
  media: {
    nombre: "Media",
    tamano: 12,
    cantPalabras: 10,
    direcciones: [
      [0, 1],   // horizontal derecha
      [1, 0],   // vertical abajo
      [1, 1],   // diagonal abajo-derecha
      [-1, 1]   // diagonal arriba-derecha
    ]
  },
  dificil: {
    nombre: "Difícil",
    tamano: 15,
    cantPalabras: 12,
    direcciones: [
      [0, 1],   // horizontal derecha
      [1, 0],   // vertical abajo
      [1, 1],   // diagonal abajo-derecha
      [-1, 1],  // diagonal arriba-derecha
      [0, -1],  // horizontal izquierda (invertida)
      [-1, 0],  // vertical arriba (invertida)
      [-1, -1], // diagonal arriba-izquierda (invertida)
      [1, -1]   // diagonal abajo-izquierda (invertida)
    ]
  }
};

let temaActual = null;
let glosarioTema = [];
let dificultadActual = "facil";

let grillaActual = [];
let ubicacionesActuales = {};
let palabrasActivas = []; // lista de objetos { termino, terminoNorm, definicion, retro }
let palabrasColocadas = [];
let palabrasEncontradas = new Set();

let tiempoInicio = 0;
let timerInterval = null;
let juegoTerminado = false;

// Variables de interacción por puntero
let seleccionando = false;
let celdaOrigen = null;
let celdasSeleccionadas = [];

/**
 * Función pura que genera la matriz y ubica las palabras según tamaño y direcciones permitidas.
 * @param {string[]} palabras - Lista de palabras a ubicar
 * @param {number} tamano - Dimensión de la cuadrícula (tamano x tamano)
 * @param {number[][]} direcciones - Vectores de dirección permitidos [[dFila, dCol], ...]
 * @returns {{ grilla: string[][], ubicaciones: Object }}
 */
export function generarSopa(palabras, tamano, direcciones) {
  // Inicializar grilla vacía
  const grilla = Array.from({ length: tamano }, () => Array(tamano).fill(null));
  const ubicaciones = {};

  // Ordenar de la más larga a la más corta
  const ordenadas = [...palabras].sort((a, b) => b.length - a.length);

  for (const palabra of ordenadas) {
    const len = palabra.length;
    if (len > tamano) continue;

    let colocada = false;
    let intentos = 0;

    while (!colocada && intentos < 200) {
      intentos++;

      // Elegir dirección y punto de partida al azar
      const dir = direcciones[Math.floor(Math.random() * direcciones.length)];
      const [dFila, dCol] = dir;

      const filaInicio = Math.floor(Math.random() * tamano);
      const colInicio = Math.floor(Math.random() * tamano);

      const filaFin = filaInicio + dFila * (len - 1);
      const colFin = colInicio + dCol * (len - 1);

      // Comprobar límites
      if (filaFin < 0 || filaFin >= tamano || colFin < 0 || colFin >= tamano) {
        continue;
      }

      // Comprobar colisiones: cada celda debe estar vacía o coincidir con la misma letra
      let cabe = true;
      for (let i = 0; i < len; i++) {
        const f = filaInicio + dFila * i;
        const c = colInicio + dCol * i;
        const letraActual = grilla[f][c];
        if (letraActual !== null && letraActual !== palabra[i]) {
          cabe = false;
          break;
        }
      }

      // Si cabe, escribir la palabra en la grilla y registrar ubicaciones
      if (cabe) {
        const coords = [];
        for (let i = 0; i < len; i++) {
          const f = filaInicio + dFila * i;
          const c = colInicio + dCol * i;
          grilla[f][c] = palabra[i];
          coords.push({ fila: f, col: c });
        }
        ubicaciones[palabra] = coords;
        colocada = true;
      }
    }
  }

  // Rellenar celdas vacías con letras aleatorias
  for (let f = 0; f < tamano; f++) {
    for (let c = 0; c < tamano; c++) {
      if (grilla[f][c] === null) {
        grilla[f][c] = LETRAS_RELLENO[Math.floor(Math.random() * LETRAS_RELLENO.length)];
      }
    }
  }

  return { grilla, ubicaciones };
}

async function iniciar() {
  ui.cargando(true);
  temaActual = await obtenerTemaActividad();

  if (!temaActual) {
    ui.cargando(false);
    contenedor.innerHTML = `
      <div class="vacio">
        <span class="vacio__icono">🔍</span>
        <h2 class="vacio__titulo">No se seleccionó ningún tema</h2>
        <p class="vacio__texto">Debes seleccionar un tema de estudio para generar la sopa de letras.</p>
        <a href="/paginas/actividades.html" class="btn btn--primario" style="margin-top: var(--espacio-m);">Volver a actividades</a>
      </div>
    `;
    return;
  }

  try {
    const glosario = await api.listar("glosario", { temaId: temaActual.id });
    glosarioTema = glosario || [];
  } catch (err) {
    ui.aviso(err.message || "Error al cargar glosario", "peligro");
  } finally {
    ui.cargando(false);
  }

  prepararPartida();
}

function prepararPartida() {
  const cfg = CONFIG_DIFICULTAD[dificultadActual] || CONFIG_DIFICULTAD.facil;

  // Filtrar términos de una sola palabra, normalizados, de 3 letras hasta el tamaño de la cuadrícula
  const terminosValidos = glosarioTema.filter((t) => {
    if (!t.termino || String(t.termino).trim().includes(" ")) return false;
    const norm = util.normalizar(t.termino);
    return norm.length >= 3 && norm.length <= cfg.tamano && (!t.estado || t.estado === "aprobado");
  });

  if (terminosValidos.length < 4) {
    mostrarEstadoInsuficiente(terminosValidos.length, cfg.tamano);
    return;
  }

  // Seleccionar palabras al azar según la cantidad de la dificultad
  const barajados = util.barajar(terminosValidos).slice(0, cfg.cantPalabras);
  palabrasActivas = barajados.map((t) => ({
    termino: t.termino,
    terminoNorm: util.normalizar(t.termino),
    definicion: t.definicion || "Concepto curricular del tema.",
    retro: t.retroalimentacion || ""
  }));

  const listaNorm = palabrasActivas.map((p) => p.terminoNorm);
  const resultadoSopa = generarSopa(listaNorm, cfg.tamano, cfg.direcciones);

  grillaActual = resultadoSopa.grilla;
  ubicacionesActuales = resultadoSopa.ubicaciones;

  // Filtrar solo las palabras que cupieron en la cuadrícula
  palabrasColocadas = palabrasActivas.filter((p) => Boolean(ubicacionesActuales[p.terminoNorm]));
  palabrasEncontradas.clear();
  juegoTerminado = false;
  tiempoInicio = Date.now();

  renderizarJuego(cfg.tamano);
  iniciarCronometro();
}

function mostrarEstadoInsuficiente(encontrados, tamanoMax) {
  contenedor.innerHTML = `
    <div class="fila" style="justify-content: space-between; margin-bottom: var(--espacio-l);">
      <a href="/paginas/actividades.html" class="btn btn--secundario btn--pequeno">← Volver a actividades</a>
      <a href="/paginas/tema.html?id=${encodeURIComponent(temaActual.id)}" class="btn btn--secundario btn--pequeno">Ver ficha del tema</a>
    </div>

    <div class="vacio">
      <span class="vacio__icono">📝</span>
      <h2 class="vacio__titulo">Términos insuficientes para la sopa</h2>
      <p class="vacio__texto">
        El tema "<strong>${ui.escapar(temaActual.titulo)}</strong>" tiene ${encontrados} término(s) de una sola palabra (de 3 a ${tamanoMax} letras).
        Se requieren al menos <strong>4 términos</strong> aptos para generar la sopa de letras.
      </p>
      <div class="fila" style="gap: var(--espacio-s); margin-top: var(--espacio-m);">
        <a href="/paginas/tema.html?id=${encodeURIComponent(temaActual.id)}" class="btn btn--primario">
          Revisar el tema
        </a>
        <button type="button" id="btnCambiarTemaInsuf" class="btn btn--secundario">
          Elegir otro tema
        </button>
      </div>
    </div>
  `;

  document.getElementById("btnCambiarTemaInsuf")?.addEventListener("click", () => {
    iniciar();
  });
}

function renderizarJuego(tamano) {
  contenedor.innerHTML = `
    <div class="fila" style="justify-content: space-between; align-items: center; margin-bottom: var(--espacio-m); flex-wrap: wrap; gap: var(--espacio-s);">
      <div>
        <nav aria-label="Migas de pan" style="font-size: var(--texto-xs); color: var(--texto-suave);">
          <a href="/paginas/actividades.html">Actividades</a> / <span>Sopa de letras</span>
        </nav>
        <h1 style="margin: 0; font-size: var(--texto-xl);">${ui.escapar(temaActual.titulo)}</h1>
      </div>

      <div class="fila" style="gap: var(--espacio-s); align-items: center;">
        <label for="selectDificultadSopa" style="font-size: var(--texto-xs); font-weight: var(--peso-negrita); color: var(--texto-suave);">
          Dificultad:
        </label>
        <select id="selectDificultadSopa" class="input" style="padding-block: var(--espacio-xs); width: auto;">
          <option value="facil"${dificultadActual === "facil" ? " selected" : ""}>Fácil (10×10)</option>
          <option value="media"${dificultadActual === "media" ? " selected" : ""}>Media (12×12)</option>
          <option value="dificil"${dificultadActual === "dificil" ? " selected" : ""}>Difícil (15×15)</option>
        </select>
        <button type="button" id="btnCambiarTemaSopa" class="btn btn--secundario btn--pequeno">Cambiar tema</button>
      </div>
    </div>

    <div class="sopa-layout">
      <!-- Cuadrícula de la Sopa -->
      <section class="sopa-tablero-caja">
        <div
          id="gridSopa"
          class="sopa-grid"
          style="--tamano-sopa: ${tamano};"
          role="grid"
          aria-label="Cuadrícula interactiva de sopa de letras"
        >
          ${grillaActual.map((fila, r) =>
            fila.map((letra, c) => `
              <div
                class="sopa-celda"
                data-fila="${r}"
                data-col="${c}"
                data-letra="${letra}"
                role="gridcell"
                id="celda-${r}-${c}"
              >${letra}</div>
            `).join("")
          ).join("")}
        </div>
      </section>

      <!-- Panel lateral con palabras, marcador y controles -->
      <aside class="sopa-panel-lateral">
        <div class="sopa-marcador">
          <div>
            <small style="color: var(--texto-suave); display: block;">Encontradas</small>
            <strong id="marcadorProgreso">0 / ${palabrasColocadas.length}</strong>
          </div>
          <div>
            <small style="color: var(--texto-suave); display: block;">Tiempo</small>
            <strong id="marcadorTiempo">00:00</strong>
          </div>
          <button type="button" id="btnRendirse" class="btn btn--peligro btn--pequeno" title="Revelar las palabras restantes y finalizar la partida">
            Rendirse
          </button>
        </div>

        <div class="sopa-palabras-caja">
          <h2 style="margin: 0; font-size: var(--texto-s); color: var(--primario);">
            Palabras a encontrar:
          </h2>
          <ul class="sopa-palabras-lista" id="listaPalabras">
            ${palabrasColocadas.map((p) => `
              <li class="palabra-chip" id="chip-${p.terminoNorm}">
                <span>${ui.escapar(p.termino)}</span>
              </li>
            `).join("")}
          </ul>
        </div>

        <div id="panelRetroSopa" style="width: 100%;"></div>
      </aside>
    </div>
  `;

  vincularEventosInteraccion();
}

function vincularEventosInteraccion() {
  const selDif = document.getElementById("selectDificultadSopa");
  const btnCambiarTema = document.getElementById("btnCambiarTemaSopa");
  const btnRendirse = document.getElementById("btnRendirse");
  const gridEl = document.getElementById("gridSopa");

  selDif?.addEventListener("change", (e) => {
    dificultadActual = e.target.value;
    prepararPartida();
  });

  btnCambiarTema?.addEventListener("click", () => {
    iniciar();
  });

  btnRendirse?.addEventListener("click", () => {
    if (juegoTerminado) return;
    rendirse();
  });

  // Selección en línea recta con Pointer Events (mouse y táctil con touch-action: none)
  gridEl.addEventListener("pointerdown", (e) => {
    if (juegoTerminado) return;
    const celda = e.target.closest(".sopa-celda");
    if (!celda) return;

    gridEl.setPointerCapture(e.pointerId);
    seleccionando = true;
    celdaOrigen = {
      fila: parseInt(celda.dataset.fila, 10),
      col: parseInt(celda.dataset.col, 10)
    };
    actualizarSeleccion(celdaOrigen.fila, celdaOrigen.col);
  });

  gridEl.addEventListener("pointermove", (e) => {
    if (!seleccionando || juegoTerminado) return;
    const elementoBajoPuntero = document.elementFromPoint(e.clientX, e.clientY);
    const celda = elementoBajoPuntero ? elementoBajoPuntero.closest(".sopa-celda") : null;
    if (!celda) return;

    const f = parseInt(celda.dataset.fila, 10);
    const c = parseInt(celda.dataset.col, 10);
    actualizarSeleccion(f, c);
  });

  const finalizarSeleccion = () => {
    if (!seleccionando) return;
    seleccionando = false;
    evaluarSeleccion();
    limpiarResaltadoSeleccion();
  };

  gridEl.addEventListener("pointerup", finalizarSeleccion);
  gridEl.addEventListener("pointercancel", finalizarSeleccion);
}

function calcularLineaRecta(f1, c1, f2, c2) {
  const dF = f2 - f1;
  const dC = c2 - c1;

  const absF = Math.abs(dF);
  const absC = Math.abs(dC);

  // Comprobar si es horizontal, vertical o diagonal a 45 grados
  if (f1 !== f2 && c1 !== c2 && absF !== absC) {
    return null; // No es línea recta
  }

  const pasos = Math.max(absF, absC);
  const pasoF = dF === 0 ? 0 : dF / absF;
  const pasoC = dC === 0 ? 0 : dC / absC;

  const resultado = [];
  for (let i = 0; i <= pasos; i++) {
    resultado.push({
      fila: f1 + pasoF * i,
      col: c1 + pasoC * i
    });
  }

  return resultado;
}

function actualizarSeleccion(fActual, cActual) {
  limpiarResaltadoSeleccion();

  const linea = calcularLineaRecta(celdaOrigen.fila, celdaOrigen.col, fActual, cActual);
  if (!linea) {
    celdasSeleccionadas = [{ fila: celdaOrigen.fila, col: celdaOrigen.col }];
  } else {
    celdasSeleccionadas = linea;
  }

  celdasSeleccionadas.forEach((pos) => {
    const el = document.getElementById(`celda-${pos.fila}-${pos.col}`);
    if (el) el.classList.add("celda--seleccionada");
  });
}

function limpiarResaltadoSeleccion() {
  document.querySelectorAll(".celda--seleccionada").forEach((el) => {
    el.classList.remove("celda--seleccionada");
  });
}

function evaluarSeleccion() {
  if (celdasSeleccionadas.length < 2) return;

  // Construir la palabra formada por las celdas
  const letras = celdasSeleccionadas.map((pos) => grillaActual[pos.fila][pos.col]);
  const palabraIda = letras.join("");
  const palabraVuelta = [...letras].reverse().join("");

  // Buscar coincidencia en las palabras colocadas no encontradas
  const coincidencia = palabrasColocadas.find(
    (p) =>
      !palabrasEncontradas.has(p.terminoNorm) &&
      (p.terminoNorm === palabraIda || p.terminoNorm === palabraVuelta)
  );

  if (coincidencia) {
    palabrasEncontradas.add(coincidencia.terminoNorm);

    // Marcar celdas como encontradas permanentemente
    celdasSeleccionadas.forEach((pos) => {
      const el = document.getElementById(`celda-${pos.fila}-${pos.col}`);
      if (el) el.classList.add("celda--encontrada");
    });

    // Tachar en la lista
    const chip = document.getElementById(`chip-${coincidencia.terminoNorm}`);
    if (chip) {
      chip.classList.add("palabra-chip--encontrada");
      chip.innerHTML = `<span>${ui.escapar(coincidencia.termino)} ✓</span>`;
    }

    // Actualizar marcador
    const marcador = document.getElementById("marcadorProgreso");
    if (marcador) {
      marcador.textContent = `${palabrasEncontradas.size} / ${palabrasColocadas.length}`;
    }

    // Mostrar retroalimentación formativa con la definición
    const panelRetro = document.getElementById("panelRetroSopa");
    mostrarRetro({
      correcto: true,
      explicacion: `¡Encontraste "${coincidencia.termino}"! ${coincidencia.definicion}`,
      sugerencia: coincidencia.retro || "",
      enlaceTema: `/paginas/tema.html?id=${encodeURIComponent(temaActual.id)}`,
      contenedor: panelRetro
    });

    // Verificar si completó todas las palabras
    if (palabrasEncontradas.size === palabrasColocadas.length) {
      finalizarPartida(true);
    }
  }
}

function rendirse() {
  juegoTerminado = true;
  if (timerInterval) clearInterval(timerInterval);

  // Revelar palabras restantes
  palabrasColocadas.forEach((p) => {
    if (!palabrasEncontradas.has(p.terminoNorm)) {
      const coords = ubicacionesActuales[p.terminoNorm] || [];
      coords.forEach((pos) => {
        const el = document.getElementById(`celda-${pos.fila}-${pos.col}`);
        if (el && !el.classList.contains("celda--encontrada")) {
          el.classList.add("celda--revelada");
        }
      });

      const chip = document.getElementById(`chip-${p.terminoNorm}`);
      if (chip) chip.classList.add("palabra-chip--revelada");
    }
  });

  finalizarPartida(false);
}

function iniciarCronometro() {
  if (timerInterval) clearInterval(timerInterval);
  const elTiempo = document.getElementById("marcadorTiempo");

  timerInterval = setInterval(() => {
    const transcurridoSeg = Math.floor((Date.now() - tiempoInicio) / 1000);
    if (elTiempo) {
      const min = Math.floor(transcurridoSeg / 60);
      const seg = transcurridoSeg % 60;
      elTiempo.textContent = `${String(min).padStart(2, "0")}:${String(seg).padStart(2, "0")}`;
    }
  }, 1000);
}

async function finalizarPartida(completo) {
  juegoTerminado = true;
  if (timerInterval) clearInterval(timerInterval);

  const duracionSeg = Math.max(1, Math.round((Date.now() - tiempoInicio) / 1000));
  const encontradas = palabrasEncontradas.size;
  const total = palabrasColocadas.length;
  const errores = total - encontradas;

  // Registrar intento en el motor de gamificación
  try {
    await registrarIntento({
      actividad: "sopa-letras",
      temaId: temaActual.id,
      puntaje: encontradas,
      maximo: total,
      errores,
      duracionSeg
    });
  } catch (err) {
    console.warn("No se pudo registrar intento de gamificación:", err);
  }

  // Mostrar modal de resumen
  const decision = await mostrarResumen({
    titulo: completo ? "¡Sopa de letras completada!" : "Partida finalizada",
    aciertos: encontradas,
    errores,
    recomendaciones: completo
      ? "¡Excelente agudeza visual y dominio de los términos del tema!"
      : "Buen intento. Vuelve a jugar para encontrar todos los términos en menor tiempo.",
    enlaceTema: `/paginas/tema.html?id=${encodeURIComponent(temaActual.id)}`
  });

  if (decision === "repetir") {
    prepararPartida();
  }
}

if (typeof window !== "undefined" && typeof document !== "undefined" && document.getElementById("contenido")) {
  contenedor = document.getElementById("contenido");
  await montarPlantilla({
    titulo: "Sopa de letras",
    roles: ["estudiante", "docente"]
  });
  iniciar();
}
