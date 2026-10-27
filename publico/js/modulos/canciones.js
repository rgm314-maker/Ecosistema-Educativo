// publico/js/modulos/canciones.js
// Catálogo de canciones educativas con reproductor accesible y letras sincronizadas (LRC)

import { montarPlantilla } from "../nucleo/plantilla.js";
import { usuarioActual } from "../nucleo/sesion.js";
import * as api from "../nucleo/api.js";
import * as ui from "../nucleo/ui.js";
import * as util from "../nucleo/util.js";

await montarPlantilla({
  titulo: "Canciones",
  roles: ["sesion"]
});

const usuario = usuarioActual() || {};
const contenedor = document.getElementById("contenido");
const temaIdUrl = util.parametro("temaId");

let todasLasCanciones = [];
let asignaturas = [];
let unidades = [];
let temas = [];

let mapaTemas = new Map();
let mapaUnidades = new Map();
let mapaAsignaturas = new Map();

let asignaturaFiltro = "todas";
let temaFiltro = "todos";
let cancionActual = null;
let lineasLrcParseadas = [];
let indiceLrcActivo = -1;

async function iniciar() {
  try {
    ui.cargando(true);

    const [cancionesRes, temasRes, unidadesRes, asignaturasRes] = await Promise.all([
      api.listar("canciones"),
      api.listar("temas"),
      api.listar("unidades"),
      api.listar("asignaturas")
    ]);

    todasLasCanciones = cancionesRes || [];
    temas = temasRes || [];
    unidades = unidadesRes || [];
    asignaturas = asignaturasRes || [];

    temas.forEach((t) => mapaTemas.set(t.id, t));
    unidades.forEach((u) => mapaUnidades.set(u.id, u));
    asignaturas.forEach((a) => mapaAsignaturas.set(a.id, a));

    // Si viene ?temaId= en la URL, ajustar filtros iniciales
    if (temaIdUrl && mapaTemas.has(temaIdUrl)) {
      temaFiltro = temaIdUrl;
      const t = mapaTemas.get(temaIdUrl);
      const u = mapaUnidades.get(t.unidadId);
      if (u?.asignaturaId) {
        asignaturaFiltro = u.asignaturaId;
      }
    }
  } catch (err) {
    ui.aviso(err.message || "Error al cargar las canciones", "error");
  } finally {
    ui.cargando(false);
  }

  renderizarEstructura();
  vincularEventosGenerales();
  actualizarListaCanciones();

  // Seleccionar la primera canción si existe
  const filtradas = obtenerCancionesFiltradas();
  if (filtradas.length > 0) {
    seleccionarCancion(filtradas[0]);
  } else {
    mostrarReproductorVacio();
  }
}

function renderizarEstructura() {
  const esDocenteOAdmin = usuario.rol === "docente" || usuario.rol === "admin";

  contenedor.innerHTML = `
    <div class="fila" style="justify-content: space-between; margin-bottom: var(--espacio-l); flex-wrap: wrap; gap: var(--espacio-m);">
      <div>
        <h1 style="margin: 0;">Canciones Educativas</h1>
        <p style="color: var(--texto-suave); margin: 0;">Aprende y refuerza tus temas de estudio a través de la música</p>
      </div>
      ${
        esDocenteOAdmin
          ? `<a href="/paginas/editor-cancion.html" class="btn btn--primario">+ Nueva canción</a>`
          : ""
      }
    </div>

    <div class="canciones-layout">
      <!-- Columna izquierda: Filtros y listado -->
      <section class="panel-canciones-lista">
        <div class="filtros-canciones">
          <div class="campo" style="margin: 0;">
            <label for="filtroAsignatura"><strong>Asignatura</strong></label>
            <select id="filtroAsignatura" class="input">
              <option value="todas">Todas las asignaturas</option>
              ${asignaturas.map((a) => `<option value="${ui.escapar(a.id)}"${asignaturaFiltro === a.id ? " selected" : ""}>${ui.escapar(a.nombre)}</option>`).join("")}
            </select>
          </div>

          <div class="campo" style="margin: 0;">
            <label for="filtroTema"><strong>Tema relacionado</strong></label>
            <select id="filtroTema" class="input">
              <option value="todos">Todos los temas</option>
            </select>
          </div>
        </div>

        <div id="contenedorListaCanciones" class="lista-canciones-items"></div>
      </section>

      <!-- Columna derecha: Reproductor de audio y Letra -->
      <section class="panel-reproductor-letra">
        <!-- Audio oculto subyacente -->
        <audio id="audioReproductor" preload="metadata"></audio>

        <!-- Interfaz del reproductor -->
        <div id="cajaReproductor" class="caja-reproductor">
          <div class="reproductor-cabecera">
            <div>
              <h2 id="repTitulo" class="reproductor-titulo">Selecciona una canción</h2>
              <span id="repMeta" class="reproductor-autoria">Elige una pista del listado para comenzar</span>
            </div>
            <div id="repAcciones" class="fila" style="gap: var(--espacio-xs);"></div>
          </div>

          <!-- Barra de progreso -->
          <div class="reproductor-progreso-fila">
            <span id="tiempoActual" class="reproductor-tiempo">00:00</span>
            <input type="range" id="barraProgreso" class="reproductor-slider" min="0" max="100" value="0" step="0.1" aria-label="Progreso de la pista">
            <span id="tiempoTotal" class="reproductor-tiempo">00:00</span>
          </div>

          <!-- Controles de Play, Pausa y Volumen -->
          <div class="reproductor-botones">
            <div class="fila" style="gap: var(--espacio-s);">
              <button type="button" id="btnPlayPause" class="btn-play-pause" title="Reproducir (Espacio)" aria-label="Reproducir pista">
                ▶
              </button>
              <button type="button" id="btnReiniciar" class="btn btn--secundario btn--pequeno" title="Reiniciar pista">
                ⏮
              </button>
            </div>

            <div class="control-volumen">
              <button type="button" id="btnMute" class="btn btn--texto btn--pequeno" title="Silenciar / Activar sonido" aria-label="Silenciar">
                🔊
              </button>
              <input type="range" id="sliderVolumen" class="volumen-slider" min="0" max="1" step="0.05" value="1" aria-label="Control de volumen">
            </div>
          </div>
        </div>

        <!-- Panel de letra de la canción -->
        <div class="caja-letra">
          <div class="caja-letra__cabecera">
            <h3 style="margin: 0; font-size: var(--texto-m); color: var(--primario);">Letra de la canción</h3>
            <span id="badgeLrc" class="chip chip--acento oculto">Sincronizada LRC</span>
          </div>
          <div id="cuerpoLetra" class="caja-letra__cuerpo">
            <p style="color: var(--texto-suave); font-style: italic;">Selecciona una canción para ver su letra.</p>
          </div>
        </div>
      </section>
    </div>
  `;

  actualizarSelectTemas();
}

function actualizarSelectTemas() {
  const selTema = document.getElementById("filtroTema");
  if (!selTema) return;

  let temasFiltrados = [...temas];
  if (asignaturaFiltro !== "todas") {
    const unidadesDeAsig = new Set(
      unidades.filter((u) => u.asignaturaId === asignaturaFiltro).map((u) => u.id)
    );
    temasFiltrados = temas.filter((t) => unidadesDeAsig.has(t.unidadId));
  }

  selTema.innerHTML = `
    <option value="todos">Todos los temas</option>
    ${temasFiltrados.map((t) => `<option value="${ui.escapar(t.id)}"${temaFiltro === t.id ? " selected" : ""}>${ui.escapar(t.titulo)}</option>`).join("")}
  `;
}

function vincularEventosGenerales() {
  const selAsig = document.getElementById("filtroAsignatura");
  const selTema = document.getElementById("filtroTema");

  selAsig.addEventListener("change", (e) => {
    asignaturaFiltro = e.target.value;
    temaFiltro = "todos";
    actualizarSelectTemas();
    actualizarListaCanciones();
  });

  selTema.addEventListener("change", (e) => {
    temaFiltro = e.target.value;
    actualizarListaCanciones();
  });

  // Controles de audio
  const audio = document.getElementById("audioReproductor");
  const btnPlayPause = document.getElementById("btnPlayPause");
  const btnReiniciar = document.getElementById("btnReiniciar");
  const barraProgreso = document.getElementById("barraProgreso");
  const tiempoActual = document.getElementById("tiempoActual");
  const tiempoTotal = document.getElementById("tiempoTotal");
  const sliderVolumen = document.getElementById("sliderVolumen");
  const btnMute = document.getElementById("btnMute");

  btnPlayPause.addEventListener("click", () => {
    if (!cancionActual) return;
    if (audio.paused) {
      audio.play().catch(() => {});
    } else {
      audio.pause();
    }
  });

  btnReiniciar.addEventListener("click", () => {
    if (!cancionActual) return;
    audio.currentTime = 0;
    audio.play().catch(() => {});
  });

  audio.addEventListener("play", () => {
    btnPlayPause.textContent = "⏸";
    btnPlayPause.title = "Pausar";
  });

  audio.addEventListener("pause", () => {
    btnPlayPause.textContent = "▶";
    btnPlayPause.title = "Reproducir";
  });

  audio.addEventListener("timeupdate", () => {
    if (!audio.duration) return;
    const progreso = (audio.currentTime / audio.duration) * 100;
    barraProgreso.value = progreso;
    tiempoActual.textContent = formatearTiempo(audio.currentTime);

    // Actualizar resaltado de LRC
    actualizarSincronizacionLrc(audio.currentTime);
  });

  audio.addEventListener("loadedmetadata", () => {
    tiempoTotal.textContent = formatearTiempo(audio.duration);
    barraProgreso.value = 0;
  });

  audio.addEventListener("ended", () => {
    btnPlayPause.textContent = "▶";
    barraProgreso.value = 100;
  });

  barraProgreso.addEventListener("input", () => {
    if (!audio.duration) return;
    const nuevoTiempo = (barraProgreso.value / 100) * audio.duration;
    tiempoActual.textContent = formatearTiempo(nuevoTiempo);
  });

  barraProgreso.addEventListener("change", () => {
    if (!audio.duration) return;
    audio.currentTime = (barraProgreso.value / 100) * audio.duration;
  });

  sliderVolumen.addEventListener("input", () => {
    audio.volume = Number(sliderVolumen.value);
    audio.muted = false;
    actualizarIconoVolumen(audio.volume);
  });

  btnMute.addEventListener("click", () => {
    audio.muted = !audio.muted;
    actualizarIconoVolumen(audio.muted ? 0 : audio.volume);
  });
}

function actualizarIconoVolumen(vol) {
  const btnMute = document.getElementById("btnMute");
  if (!btnMute) return;
  if (vol === 0) btnMute.textContent = "🔇";
  else if (vol < 0.5) btnMute.textContent = "🔉";
  else btnMute.textContent = "🔊";
}

function obtenerCancionesFiltradas() {
  let resultado = [...todasLasCanciones];

  if (asignaturaFiltro !== "todas") {
    const unidadesDeAsig = new Set(
      unidades.filter((u) => u.asignaturaId === asignaturaFiltro).map((u) => u.id)
    );
    const temasDeAsig = new Set(
      temas.filter((t) => unidadesDeAsig.has(t.unidadId)).map((t) => t.id)
    );
    resultado = resultado.filter((c) => temasDeAsig.has(c.temaId));
  }

  if (temaFiltro !== "todos") {
    resultado = resultado.filter((c) => c.temaId === temaFiltro);
  }

  return resultado;
}

function actualizarListaCanciones() {
  const listaContenedor = document.getElementById("contenedorListaCanciones");
  if (!listaContenedor) return;

  const filtradas = obtenerCancionesFiltradas();
  const esDocenteOAdmin = usuario.rol === "docente" || usuario.rol === "admin";

  if (filtradas.length === 0) {
    listaContenedor.innerHTML = `
      <div class="vacio">
        <span class="vacio__icono">🎵</span>
        <h3 class="vacio__titulo">No hay canciones disponibles</h3>
        <p class="vacio__texto">No se encontraron pistas de audio para los filtros seleccionados.</p>
      </div>
    `;
    return;
  }

  listaContenedor.innerHTML = filtradas.map((c) => {
    const esActiva = cancionActual && cancionActual.id === c.id;
    const t = mapaTemas.get(c.temaId);
    const temaTitulo = t ? t.titulo : "Tema";

    return `
      <div class="item-cancion${esActiva ? " item-cancion--activa" : ""}" data-id="${ui.escapar(c.id)}">
        <div class="item-cancion__info">
          <h4 class="item-cancion__titulo">${ui.escapar(c.titulo)}</h4>
          <div class="item-cancion__meta">
            <span>📚 ${ui.escapar(temaTitulo)}</span>
            <span>•</span>
            <span>✍️ ${ui.escapar(c.autoria || "Autor")}</span>
            <span>•</span>
            <span>⚖️ ${ui.escapar(c.licencia || "Propia")}</span>
          </div>
        </div>
        <div class="fila" style="gap: var(--espacio-xs);" onclick="event.stopPropagation();">
          ${
            esDocenteOAdmin
              ? `<a href="/paginas/editor-cancion.html?id=${ui.escapar(c.id)}" class="btn btn--secundario btn--pequeno" title="Editar canción">Editar</a>`
              : ""
          }
          <button type="button" class="btn btn--primario btn--pequeno btn-reproducir-item" data-id="${ui.escapar(c.id)}">
            ${esActiva ? "▶ Escuchando" : "▶ Reproducir"}
          </button>
        </div>
      </div>
    `;
  }).join("");

  // Eventos de selección de canción
  listaContenedor.querySelectorAll(".item-cancion").forEach((elem) => {
    elem.addEventListener("click", () => {
      const id = elem.dataset.id;
      const cancion = todasLasCanciones.find((x) => x.id === id);
      if (cancion) seleccionarCancion(cancion, true);
    });
  });

  listaContenedor.querySelectorAll(".btn-reproducir-item").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const id = btn.dataset.id;
      const cancion = todasLasCanciones.find((x) => x.id === id);
      if (cancion) seleccionarCancion(cancion, true);
    });
  });
}

function seleccionarCancion(cancion, iniciarAuto = false) {
  cancionActual = cancion;
  indiceLrcActivo = -1;

  const audio = document.getElementById("audioReproductor");
  const repTitulo = document.getElementById("repTitulo");
  const repMeta = document.getElementById("repMeta");
  const repAcciones = document.getElementById("repAcciones");
  const cuerpoLetra = document.getElementById("cuerpoLetra");
  const badgeLrc = document.getElementById("badgeLrc");

  const tema = mapaTemas.get(cancion.temaId);
  const temaTitulo = tema ? tema.titulo : "Tema";

  repTitulo.textContent = cancion.titulo;
  repMeta.innerHTML = `
    <span>Tema: <strong>${ui.escapar(temaTitulo)}</strong></span> |
    <span>Autoría: ${ui.escapar(cancion.autoria || "Desconocida")}</span> |
    <span>Licencia: ${ui.escapar(cancion.licencia || "Propia")}</span>
  `;

  if (usuario.rol === "docente" || usuario.rol === "admin") {
    repAcciones.innerHTML = `
      <a href="/paginas/editor-cancion.html?id=${ui.escapar(cancion.id)}" class="btn btn--secundario btn--pequeno">Editar</a>
    `;
  } else {
    repAcciones.innerHTML = "";
  }

  // Cargar audio
  audio.src = cancion.audio;
  audio.load();

  if (iniciarAuto) {
    audio.play().catch(() => {});
  }

  // Procesar Letra o LRC
  lineasLrcParseadas = parsearLrc(cancion.lrc);

  if (lineasLrcParseadas.length > 0) {
    badgeLrc.classList.remove("oculto");
    cuerpoLetra.innerHTML = lineasLrcParseadas
      .map(
        (l, i) =>
          `<div class="linea-lrc" data-indice="${i}" data-tiempo="${l.tiempo}">${ui.escapar(l.texto || "♪")}</div>`
      )
      .join("");

    // Clic en línea LRC para saltar a ese tiempo
    cuerpoLetra.querySelectorAll(".linea-lrc").forEach((el) => {
      el.addEventListener("click", () => {
        const tiempo = parseFloat(el.dataset.tiempo);
        if (!isNaN(tiempo)) {
          audio.currentTime = tiempo;
          audio.play().catch(() => {});
        }
      });
    });
  } else {
    badgeLrc.classList.add("oculto");
    cuerpoLetra.innerHTML = `
      <div class="letra-estatica">${ui.escapar(cancion.letra || "*(Sin letra disponible)*")}</div>
    `;
  }

  actualizarListaCanciones();
}

function parsearLrc(textoLrc) {
  if (!textoLrc || typeof textoLrc !== "string") return [];

  const lineas = textoLrc.split(/\r?\n/);
  const regex = /\[(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?\](.*)/;
  const resultado = [];

  lineas.forEach((linea) => {
    const match = linea.match(regex);
    if (match) {
      const min = parseInt(match[1], 10);
      const seg = parseInt(match[2], 10);
      const ms = match[3] ? parseInt(match[3].padEnd(3, "0"), 10) : 0;
      const tiempoSegundos = min * 60 + seg + ms / 1000;
      const texto = match[4].trim();
      resultado.push({ tiempo: tiempoSegundos, texto });
    }
  });

  return resultado.sort((a, b) => a.tiempo - b.tiempo);
}

function actualizarSincronizacionLrc(tiempoActual) {
  if (lineasLrcParseadas.length === 0) return;

  let nuevoIndice = -1;
  for (let i = 0; i < lineasLrcParseadas.length; i++) {
    if (lineasLrcParseadas[i].tiempo <= tiempoActual) {
      nuevoIndice = i;
    } else {
      break;
    }
  }

  if (nuevoIndice !== indiceLrcActivo && nuevoIndice !== -1) {
    indiceLrcActivo = nuevoIndice;

    const cuerpoLetra = document.getElementById("cuerpoLetra");
    if (!cuerpoLetra) return;

    cuerpoLetra.querySelectorAll(".linea-lrc").forEach((el, idx) => {
      if (idx === nuevoIndice) {
        el.classList.add("linea-lrc--activa");
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      } else {
        el.classList.remove("linea-lrc--activa");
      }
    });
  }
}

function mostrarReproductorVacio() {
  const repTitulo = document.getElementById("repTitulo");
  const repMeta = document.getElementById("repMeta");
  const cuerpoLetra = document.getElementById("cuerpoLetra");
  const badgeLrc = document.getElementById("badgeLrc");

  if (repTitulo) repTitulo.textContent = "No hay canciones disponibles";
  if (repMeta) repMeta.textContent = "Prueba seleccionando otra asignatura o tema";
  if (badgeLrc) badgeLrc.classList.add("oculto");
  if (cuerpoLetra) cuerpoLetra.innerHTML = `<p style="color: var(--texto-suave);">No hay letra para mostrar.</p>`;
}

function formatearTiempo(segundos) {
  if (isNaN(segundos) || segundos < 0) return "00:00";
  const m = Math.floor(segundos / 60);
  const s = Math.floor(segundos % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

iniciar();
