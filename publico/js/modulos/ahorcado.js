// publico/js/modulos/ahorcado.js
// Juego educativo del Ahorcado basado en el glosario curricular

import { montarPlantilla } from "../nucleo/plantilla.js";
import { obtenerTemaActividad } from "../nucleo/selector-tema.js";
import { mostrarRetro } from "../nucleo/retroalimentacion.js";
import { registrarIntento } from "../nucleo/gamificacion.js";
import * as api from "../nucleo/api.js";
import * as ui from "../nucleo/ui.js";
import * as util from "../nucleo/util.js";

await montarPlantilla({
  titulo: "Ahorcado",
  roles: ["estudiante", "docente"]
});

const contenedor = document.getElementById("contenido");

const LETRAS_ALFABETO = [
  "A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M",
  "N", "Ñ", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z"
];

let temaActual = null;
let terminosAptos = [];
let terminosUsadosIds = new Set();

let terminoActual = null;
let palabraObjetivo = "";
let letrasAdivinadas = new Set();
let letrasIntentadas = new Set();
let errores = 0;
let tiempoInicio = 0;
let juegoTerminado = false;

async function iniciar() {
  ui.cargando(true);
  temaActual = await obtenerTemaActividad();

  if (!temaActual) {
    ui.cargando(false);
    contenedor.innerHTML = `
      <div class="vacio">
        <span class="vacio__icono">🎈</span>
        <h2 class="vacio__titulo">No se seleccionó ningún tema</h2>
        <p class="vacio__texto">Debes seleccionar un tema de estudio para practicar con el juego del ahorcado.</p>
        <a href="/paginas/actividades.html" class="btn btn--primario" style="margin-top: var(--espacio-m);">Volver a actividades</a>
      </div>
    `;
    return;
  }

  try {
    const glosario = await api.listar("glosario", { temaId: temaActual.id });

    // Filtrar términos de exactamente 6 letras normalizadas
    terminosAptos = (glosario || []).filter((t) => {
      const limpio = util.normalizar(t.termino);
      return limpio.length === 6 && (!t.estado || t.estado === "aprobado");
    });
  } catch (err) {
    ui.aviso(err.message || "Error al cargar términos del tema", "peligro");
  } finally {
    ui.cargando(false);
  }

  if (terminosAptos.length === 0) {
    mostrarEstadoSinTerminos();
    return;
  }

  comenzarNuevaRonda();
}

function mostrarEstadoSinTerminos() {
  contenedor.innerHTML = `
    <div class="fila" style="justify-content: space-between; margin-bottom: var(--espacio-l);">
      <a href="/paginas/actividades.html" class="btn btn--secundario btn--pequeno">← Volver a actividades</a>
      <a href="/paginas/tema.html?id=${encodeURIComponent(temaActual.id)}" class="btn btn--secundario btn--pequeno">Ver ficha del tema</a>
    </div>

    <div class="vacio">
      <span class="vacio__icono">📖</span>
      <h2 class="vacio__titulo">Sin términos aptos de 6 letras</h2>
      <p class="vacio__texto">
        El tema "<strong>${ui.escapar(temaActual.titulo)}</strong>" aún no tiene términos de 6 letras registrados en su glosario.
      </p>
      <div class="fila" style="gap: var(--espacio-s); margin-top: var(--espacio-m);">
        <a href="/paginas/tema.html?id=${encodeURIComponent(temaActual.id)}" class="btn btn--primario">
          Repasar el tema
        </a>
        <button type="button" id="btnCambiarTema" class="btn btn--secundario">
          Elegir otro tema
        </button>
      </div>
    </div>
  `;

  document.getElementById("btnCambiarTema")?.addEventListener("click", () => {
    iniciar();
  });
}

function comenzarNuevaRonda() {
  // Elegir un término no usado en la partida actual
  let disponibles = terminosAptos.filter((t) => !terminosUsadosIds.has(t.id));
  if (disponibles.length === 0) {
    terminosUsadosIds.clear();
    disponibles = terminosAptos;
  }

  const indiceAzar = Math.floor(Math.random() * disponibles.length);
  terminoActual = disponibles[indiceAzar];
  terminosUsadosIds.add(terminoActual.id);

  palabraObjetivo = util.normalizar(terminoActual.termino);
  letrasAdivinadas.clear();
  letrasIntentadas.clear();
  errores = 0;
  juegoTerminado = false;
  tiempoInicio = Date.now();

  renderizarInterfazJuego();
  vincularTecladoFisico();
}

function renderizarInterfazJuego() {
  contenedor.innerHTML = `
    <div class="fila" style="justify-content: space-between; align-items: center; margin-bottom: var(--espacio-l); flex-wrap: wrap; gap: var(--espacio-s);">
      <div>
        <nav aria-label="Migas de pan" style="font-size: var(--texto-xs); color: var(--texto-suave);">
          <a href="/paginas/actividades.html">Actividades</a> / <span>Ahorcado</span>
        </nav>
        <h1 style="margin: 0; font-size: var(--texto-xl);">Ahorcado: ${ui.escapar(temaActual.titulo)}</h1>
      </div>
      <div class="fila" style="gap: var(--espacio-s);">
        <button type="button" id="btnCambiarTemaJuego" class="btn btn--secundario btn--pequeno" title="Elegir otro tema">
          Cambiar tema
        </button>
      </div>
    </div>

    <div class="ahorcado-contenedor">
      <!-- Figura no violenta: Globo que se desinfla en SVG -->
      <div class="ahorcado-visual" aria-label="Ilustración del globo">
        <svg id="svgGlobo" class="svg-globo globo--estado-0" viewBox="0 0 200 200" role="img" aria-label="Globo inflado">
          <!-- Líneas de aire escapando -->
          <g class="globo-aire">
            <path d="M 100 135 Q 85 155 70 170" />
            <path d="M 105 138 Q 105 160 105 180" />
            <path d="M 110 135 Q 125 155 140 170" />
          </g>

          <!-- Cuerda del globo -->
          <path class="globo-cuerda" d="M 100 130 Q 108 150 95 170 T 100 190" />

          <!-- Cuerpo y nudo del globo -->
          <g class="globo-cuerpo">
            <!-- Nudo inferior -->
            <polygon points="95,128 105,128 100,122" />
            <!-- Cuerpo redondo principal -->
            <ellipse cx="100" cy="75" rx="55" ry="62" />
            <!-- Brillo superior -->
            <ellipse cx="80" cy="55" rx="14" ry="24" fill="#ffffff" opacity="0.35" transform="rotate(-25 80 55)" />
          </g>
        </svg>
      </div>

      <!-- Pista del término -->
      <div class="ahorcado-pista">
        <strong>💡 Pista:</strong> ${ui.escapar(terminoActual.pista || "Palabra de 6 letras sobre el tema")}
      </div>

      <!-- 6 Casillas de letras -->
      <div class="ahorcado-casillas" id="casillasContenedor" aria-label="Palabra de 6 letras">
        ${renderizarCasillasHtml()}
      </div>

      <!-- Panel de mensajes o retroalimentación -->
      <div id="panelRetroJuego" style="width: 100%;"></div>

      <!-- Teclado en pantalla -->
      <div class="ahorcado-teclado" id="tecladoEnPantalla" role="group" aria-label="Teclado para adivinar letras">
        ${LETRAS_ALFABETO.map(
          (letra) => `<button type="button" class="tecla-letra" data-letra="${letra}" aria-label="Letra ${letra}">${letra}</button>`
        ).join("")}
      </div>

      <!-- Acciones de fin de juego -->
      <div class="ahorcado-acciones oculto" id="accionesFinJuego">
        <button type="button" id="btnOtraPalabra" class="btn btn--primario">
          🔄 Otra palabra
        </button>
        <a href="/paginas/tema.html?id=${encodeURIComponent(temaActual.id)}" class="btn btn--secundario">
          Repasar el tema
        </a>
      </div>
    </div>
  `;

  vincularTecladoVirtual();

  document.getElementById("btnCambiarTemaJuego")?.addEventListener("click", () => {
    iniciar();
  });

  document.getElementById("btnOtraPalabra")?.addEventListener("click", () => {
    comenzarNuevaRonda();
  });
}

function renderizarCasillasHtml() {
  const letrasObjetivoArr = palabraObjetivo.split("");
  return letrasObjetivoArr
    .map((letra, idx) => {
      const estaRevelada = letrasAdivinadas.has(letra);
      let clase = "casilla-letra";
      let texto = "";

      if (estaRevelada) {
        clase += " casilla-letra--revelada";
        texto = letra;
      } else if (juegoTerminado) {
        clase += " casilla-letra--fallada";
        texto = letra;
      }

      return `<div class="${clase}" id="casilla-${idx}">${texto}</div>`;
    })
    .join("");
}

function vincularTecladoVirtual() {
  const botones = document.querySelectorAll(".tecla-letra");
  botones.forEach((btn) => {
    btn.addEventListener("click", () => {
      const letra = btn.dataset.letra;
      procesarIntentoLetra(letra);
    });
  });
}

function vincularTecladoFisico() {
  window.onkeydown = (e) => {
    if (juegoTerminado) return;
    if (e.target && ["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName)) return;

    const teclaNorm = util.normalizar(e.key);
    if (LETRAS_ALFABETO.includes(teclaNorm)) {
      e.preventDefault();
      procesarIntentoLetra(teclaNorm);
    }
  };
}

function procesarIntentoLetra(letra) {
  if (juegoTerminado || letrasIntentadas.has(letra)) return;

  letrasIntentadas.add(letra);

  const btnTecla = document.querySelector(`.tecla-letra[data-letra="${letra}"]`);
  if (btnTecla) {
    btnTecla.disabled = true;
  }

  // Verificar si la letra está en la palabra
  if (palabraObjetivo.includes(letra)) {
    letrasAdivinadas.add(letra);
    if (btnTecla) btnTecla.classList.add("tecla-letra--acierto");

    // Actualizar casillas
    actualizarCasillas();

    // Comprobar si se completaron las 6 letras
    const todasDescubiertas = palabraObjetivo.split("").every((l) => letrasAdivinadas.has(l));
    if (todasDescubiertas) {
      finalizarPartida(true);
    }
  } else {
    errores++;
    if (btnTecla) btnTecla.classList.add("tecla-letra--fallo");

    // Actualizar figura del globo
    actualizarGlobo();

    // Se permiten 3 errores: el juego termina en el cuarto error
    if (errores >= 4) {
      finalizarPartida(false);
    }
  }
}

function actualizarCasillas() {
  const contenedorCasillas = document.getElementById("casillasContenedor");
  if (contenedorCasillas) {
    contenedorCasillas.innerHTML = renderizarCasillasHtml();
  }
}

function actualizarGlobo() {
  const svg = document.getElementById("svgGlobo");
  if (!svg) return;
  svg.className = `svg-globo globo--estado-${Math.min(errores, 4)}`;
}

async function finalizarPartida(gano) {
  juegoTerminado = true;
  window.onkeydown = null;

  // Desactivar teclado en pantalla y revelar palabra
  document.querySelectorAll(".tecla-letra").forEach((b) => (b.disabled = true));
  actualizarCasillas();

  const duracionSeg = Math.max(1, Math.round((Date.now() - tiempoInicio) / 1000));
  // Puntaje: si ganó: 10 - errores * 2 (mínimo 0); si perdió: 0
  const puntaje = gano ? Math.max(0, 10 - errores * 2) : 0;

  // 1. Mostrar retroalimentación formativa
  const panelRetro = document.getElementById("panelRetroJuego");
  mostrarRetro({
    correcto: gano,
    explicacion: terminoActual.definicion || `La palabra correcta es ${terminoActual.termino}.`,
    sugerencia: terminoActual.retroalimentacion || "",
    enlaceTema: `/paginas/tema.html?id=${encodeURIComponent(temaActual.id)}`,
    contenedor: panelRetro
  });

  // 2. Registrar intento en el motor de gamificación
  try {
    await registrarIntento({
      actividad: "ahorcado",
      temaId: temaActual.id,
      puntaje,
      maximo: 10,
      errores,
      duracionSeg
    });
  } catch (err) {
    console.warn("No se pudo registrar intento de gamificación:", err);
  }

  // 3. Mostrar botón "Otra palabra"
  const accionesFin = document.getElementById("accionesFinJuego");
  if (accionesFin) {
    accionesFin.classList.remove("oculto");
    document.getElementById("btnOtraPalabra")?.focus();
  }
}

iniciar();
