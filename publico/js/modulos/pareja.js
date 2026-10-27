// publico/js/modulos/pareja.js
// Actividad interactiva de memoria: relación de conceptos y definiciones curriculares

import { montarPlantilla } from "../nucleo/plantilla.js";
import { obtenerTemaActividad } from "../nucleo/selector-tema.js";
import { mostrarRetro, mostrarResumen } from "../nucleo/retroalimentacion.js";
import { registrarIntento } from "../nucleo/gamificacion.js";
import * as api from "../nucleo/api.js";
import * as ui from "../nucleo/ui.js";
import * as util from "../nucleo/util.js";

await montarPlantilla({
  titulo: "Encuentra la pareja",
  roles: ["estudiante", "docente"]
});

const contenedor = document.getElementById("contenido");

let temaActual = null;
let todosTerminosValidos = [];

let dificultadObjetivo = 6; // 6, 8 o 10 parejas
let parejasTotal = 0;
let parejasEncontradas = 0;
let intentos = 0;
let tiempoInicio = 0;
let timerInterval = null;
let bloquearTablero = false;
let cartasSeleccionadas = [];

async function iniciar() {
  ui.cargando(true);
  temaActual = await obtenerTemaActividad();

  if (!temaActual) {
    ui.cargando(false);
    contenedor.innerHTML = `
      <div class="vacio">
        <span class="vacio__icono">🃏</span>
        <h2 class="vacio__titulo">No se seleccionó ningún tema</h2>
        <p class="vacio__texto">Debes seleccionar un tema de estudio para practicar con el juego de parejas.</p>
        <a href="/paginas/actividades.html" class="btn btn--primario" style="margin-top: var(--espacio-m);">Volver a actividades</a>
      </div>
    `;
    return;
  }

  try {
    const glosario = await api.listar("glosario", { temaId: temaActual.id });

    // Filtrar términos que tengan término y definición válidos
    todosTerminosValidos = (glosario || []).filter(
      (t) => t.termino && t.definicion && (!t.estado || t.estado === "aprobado")
    );
  } catch (err) {
    ui.aviso(err.message || "Error al cargar el glosario", "peligro");
  } finally {
    ui.cargando(false);
  }

  // Mínimo 4 términos requeridos
  if (todosTerminosValidos.length < 4) {
    mostrarEstadoInsuficiente();
    return;
  }

  comenzarPartida();
}

function mostrarEstadoInsuficiente() {
  contenedor.innerHTML = `
    <div class="fila" style="justify-content: space-between; margin-bottom: var(--espacio-l);">
      <a href="/paginas/actividades.html" class="btn btn--secundario btn--pequeno">← Volver a actividades</a>
      <a href="/paginas/tema.html?id=${encodeURIComponent(temaActual.id)}" class="btn btn--secundario btn--pequeno">Ver ficha del tema</a>
    </div>

    <div class="vacio">
      <span class="vacio__icono">📚</span>
      <h2 class="vacio__titulo">Términos insuficientes</h2>
      <p class="vacio__texto">
        El tema "<strong>${ui.escapar(temaActual.titulo)}</strong>" cuenta con ${todosTerminosValidos.length} término(s).
        Se requieren al menos <strong>4 términos</strong> completos con definición para jugar a Encuentra la Pareja.
      </p>
      <div class="fila" style="gap: var(--espacio-s); margin-top: var(--espacio-m);">
        <a href="/paginas/tema.html?id=${encodeURIComponent(temaActual.id)}" class="btn btn--primario">
          Revisar el tema
        </a>
        <button type="button" id="btnCambiarTemaInsuficiente" class="btn btn--secundario">
          Elegir otro tema
        </button>
      </div>
    </div>
  `;

  document.getElementById("btnCambiarTemaInsuficiente")?.addEventListener("click", () => {
    iniciar();
  });
}

function comenzarPartida() {
  if (timerInterval) clearInterval(timerInterval);

  // Determinar número de parejas según dificultad y disponibilidad
  parejasTotal = Math.min(dificultadObjetivo, todosTerminosValidos.length);
  parejasEncontradas = 0;
  intentos = 0;
  bloquearTablero = false;
  cartasSeleccionadas = [];
  tiempoInicio = Date.now();

  // Seleccionar términos al azar y generar cartas de concepto y definición
  const seleccionados = util.barajar(todosTerminosValidos).slice(0, parejasTotal);
  const cartas = [];

  seleccionados.forEach((t) => {
    cartas.push({
      id: `${t.id}_concepto`,
      terminoId: t.id,
      tipo: "concepto",
      texto: t.termino,
      definicion: t.definicion,
      retro: t.retroalimentacion || ""
    });
    cartas.push({
      id: `${t.id}_definicion`,
      terminoId: t.id,
      tipo: "definicion",
      texto: t.definicion,
      definicion: t.definicion,
      retro: t.retroalimentacion || ""
    });
  });

  const cartasBarajadas = util.barajar(cartas);

  renderizarEstructuraJuego(cartasBarajadas);
  iniciarCronometro();
}

function renderizarEstructuraJuego(cartas) {
  contenedor.innerHTML = `
    <div class="fila" style="justify-content: space-between; align-items: center; margin-bottom: var(--espacio-m); flex-wrap: wrap; gap: var(--espacio-s);">
      <div>
        <nav aria-label="Migas de pan" style="font-size: var(--texto-xs); color: var(--texto-suave);">
          <a href="/paginas/actividades.html">Actividades</a> / <span>Encuentra la pareja</span>
        </nav>
        <h1 style="margin: 0; font-size: var(--texto-xl);">${ui.escapar(temaActual.titulo)}</h1>
      </div>

      <div class="fila" style="gap: var(--espacio-s); align-items: center;">
        <label for="selectDificultad" style="font-size: var(--texto-xs); font-weight: var(--peso-negrita); color: var(--texto-suave);">
          Dificultad:
        </label>
        <select id="selectDificultad" class="input" style="padding-block: var(--espacio-xs); width: auto;">
          <option value="6"${dificultadObjetivo === 6 ? " selected" : ""}>6 parejas</option>
          <option value="8"${dificultadObjetivo === 8 ? " selected" : ""}>8 parejas</option>
          <option value="10"${dificultadObjetivo === 10 ? " selected" : ""}>10 parejas</option>
        </select>
        <button type="button" id="btnCambiarTema" class="btn btn--secundario btn--pequeno">Cambiar tema</button>
      </div>
    </div>

    <div class="pareja-contenedor">
      <!-- Marcador superior -->
      <header class="pareja-marcador">
        <div class="pareja-metricas">
          <div class="metrica-item">
            <strong id="marcadorParejas">0 / ${parejasTotal}</strong>
            <small>Parejas</small>
          </div>
          <div class="metrica-item">
            <strong id="marcadorIntentos">0</strong>
            <small>Intentos</small>
          </div>
          <div class="metrica-item">
            <strong id="marcadorTiempo">00:00</strong>
            <small>Tiempo</small>
          </div>
        </div>

        <button type="button" id="btnReiniciar" class="btn btn--secundario btn--pequeno">
          🔄 Reiniciar
        </button>
      </header>

      <!-- Panel dinámico de retroalimentación de aciertos -->
      <div id="panelRetroParejas" style="width: 100%;"></div>

      <!-- Cuadrícula interactiva de tarjetas -->
      <div class="pareja-grid" id="gridTarjetas" role="grid" aria-label="Tablero de tarjetas de memoria">
        ${cartas.map((c, i) => `
          <button
            type="button"
            class="tarjeta-pareja tarjeta-pareja--${c.tipo}"
            data-id="${ui.escapar(c.id)}"
            data-termino-id="${ui.escapar(c.terminoId)}"
            data-tipo="${c.tipo}"
            aria-label="Tarjeta ${i + 1} boca abajo. Presiona para voltear."
          >
            <div class="tarjeta-pareja__interior">
              <div class="tarjeta-pareja__dorso" aria-hidden="true">
                <span>✦</span>
              </div>
              <div class="tarjeta-pareja__frente">
                <span class="tarjeta-pareja__tipo-chip">${c.tipo === "concepto" ? "Concepto" : "Definición"}</span>
                <p class="tarjeta-pareja__texto">${ui.escapar(c.texto)}</p>
              </div>
            </div>
          </button>
        `).join("")}
      </div>
    </div>
  `;

  vincularEventosJuego(cartas);
}

function vincularEventosJuego(cartas) {
  const selDificultad = document.getElementById("selectDificultad");
  const btnReiniciar = document.getElementById("btnReiniciar");
  const btnCambiarTema = document.getElementById("btnCambiarTema");

  selDificultad?.addEventListener("change", (e) => {
    dificultadObjetivo = parseInt(e.target.value, 10);
    comenzarPartida();
  });

  btnReiniciar?.addEventListener("click", () => {
    comenzarPartida();
  });

  btnCambiarTema?.addEventListener("click", () => {
    iniciar();
  });

  const mapaCartas = new Map(cartas.map((c) => [c.id, c]));
  const botonesTarjetas = document.querySelectorAll(".tarjeta-pareja");

  botonesTarjetas.forEach((btn) => {
    btn.addEventListener("click", () => {
      manejarClickTarjeta(btn, mapaCartas.get(btn.dataset.id));
    });
  });
}

function manejarClickTarjeta(btnEl, cartaData) {
  if (bloquearTablero) return;
  if (btnEl.classList.contains("volteada") || btnEl.classList.contains("acertada")) return;

  // Voltear tarjeta
  btnEl.classList.add("volteada");
  btnEl.setAttribute("aria-label", `${cartaData.tipo === "concepto" ? "Concepto" : "Definición"}: ${cartaData.texto}`);
  cartasSeleccionadas.push({ elemento: btnEl, data: cartaData });

  if (cartasSeleccionadas.length === 2) {
    intentos++;
    document.getElementById("marcadorIntentos").textContent = String(intentos);

    const [c1, c2] = cartasSeleccionadas;

    // Verificar si forman pareja (mismo terminoId y distinto tipo)
    if (c1.data.terminoId === c2.data.terminoId) {
      parejasEncontradas++;
      document.getElementById("marcadorParejas").textContent = `${parejasEncontradas} / ${parejasTotal}`;

      c1.elemento.classList.add("acertada");
      c2.elemento.classList.add("acertada");

      // Mostrar retroalimentación formativa inmediata
      const panelRetro = document.getElementById("panelRetroParejas");
      mostrarRetro({
        correcto: true,
        explicacion: `¡Pareja correcta! ${c1.data.definicion}`,
        sugerencia: c1.data.retro || "",
        enlaceTema: `/paginas/tema.html?id=${encodeURIComponent(temaActual.id)}`,
        contenedor: panelRetro
      });

      cartasSeleccionadas = [];

      // Verificar victoria
      if (parejasEncontradas === parejasTotal) {
        finalizarPartida();
      }
    } else {
      // No forman pareja: voltear de nuevo a los 1.2 segundos
      bloquearTablero = true;
      setTimeout(() => {
        c1.elemento.classList.remove("volteada");
        c2.elemento.classList.remove("volteada");
        c1.elemento.setAttribute("aria-label", "Tarjeta boca abajo");
        c2.elemento.setAttribute("aria-label", "Tarjeta boca abajo");
        cartasSeleccionadas = [];
        bloquearTablero = false;
      }, 1200);
    }
  }
}

function iniciarCronometro() {
  const elTiempo = document.getElementById("marcadorTiempo");
  timerInterval = setInterval(() => {
    const transcurridoSeg = Math.floor((Date.now() - tiempoInicio) / 1000);
    if (elTiempo) {
      elTiempo.textContent = util.fechaRelativa ? formatearMinSeg(transcurridoSeg) : `${transcurridoSeg}s`;
    }
  }, 1000);
}

function formatearMinSeg(totalSeg) {
  const min = Math.floor(totalSeg / 60);
  const seg = totalSeg % 60;
  return `${String(min).padStart(2, "0")}:${String(seg).padStart(2, "0")}`;
}

async function finalizarPartida() {
  if (timerInterval) clearInterval(timerInterval);

  const duracionSeg = Math.max(1, Math.round((Date.now() - tiempoInicio) / 1000));
  const errores = Math.max(0, intentos - parejasTotal);
  const puntaje = Math.max(0, 10 - errores);

  // Registrar intento en el motor de gamificación
  try {
    await registrarIntento({
      actividad: "pareja",
      temaId: temaActual.id,
      puntaje,
      maximo: 10,
      errores,
      duracionSeg
    });
  } catch (err) {
    console.warn("No se pudo registrar intento de gamificación:", err);
  }

  // Mostrar resumen con opciones de repetir o salir
  const decision = await mostrarResumen({
    titulo: "¡Todas las parejas encontradas!",
    aciertos: parejasTotal,
    errores,
    recomendaciones: errores === 0
      ? "¡Excelente memoria y comprensión de los conceptos!"
      : "Buen trabajo. Repite la actividad para mejorar tus tiempos y cometer menos errores.",
    enlaceTema: `/paginas/tema.html?id=${encodeURIComponent(temaActual.id)}`
  });

  if (decision === "repetir") {
    comenzarPartida();
  }
}

iniciar();
