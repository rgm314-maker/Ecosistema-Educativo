// publico/js/modulos/banco-preguntas.js
// Gestión del banco de preguntas de evaluación por nivel cognitivo de Bloom

import { montarPlantilla } from '../nucleo/plantilla.js';
import * as api from '../nucleo/api.js';
import * as ui from '../nucleo/ui.js';
import * as util from '../nucleo/util.js';

await montarPlantilla({ titulo: "Banco de preguntas", roles: ["docente", "admin"] });

// Estado reactivo
let temaSeleccionadoId = null;
let nivelActivo = 1;
let todasPreguntasTema = [];
let propuestasIAGeneradas = [];

// Elementos del DOM
const selectAsignatura = document.getElementById("select-asignatura");
const selectTema = document.getElementById("select-tema");
const panelBanco = document.getElementById("panel-banco");
const alertaCantidad = document.getElementById("alerta-cantidad");
const alertaCantidadTexto = document.getElementById("alerta-cantidad-texto");
const listaPreguntas = document.getElementById("lista-preguntas");
const tituloNivelActivo = document.getElementById("titulo-nivel-activo");
const totalPreguntasNivel = document.getElementById("total-preguntas-nivel");

const btnNuevaPregunta = document.getElementById("btn-nueva-pregunta");
const btnGenerarIA = document.getElementById("btn-generar-ia");

const modalPregunta = document.getElementById("modal-pregunta");
const formPregunta = document.getElementById("form-pregunta");
const modalPreguntaTitulo = document.getElementById("modal-pregunta-titulo");
const btnCerrarModal = document.getElementById("btn-cerrar-modal");
const btnCancelarPregunta = document.getElementById("btn-cancelar-pregunta");

const campoId = document.getElementById("pregunta-id");
const campoNivel = document.getElementById("campo-nivel");
const campoTipo = document.getElementById("campo-tipo");
const campoEnunciado = document.getElementById("campo-enunciado");
const campoRetro = document.getElementById("campo-retroalimentacion");
const campoEstado = document.getElementById("campo-estado");
const contenedorOpciones = document.getElementById("contenedor-opciones-dinamicas");
const legendOpciones = document.getElementById("legend-opciones");
const ayudaEnunciado = document.getElementById("ayuda-enunciado");

const modalIA = document.getElementById("modal-ia");
const btnCerrarModalIA = document.getElementById("btn-cerrar-modal-ia");
const btnFinalizarIA = document.getElementById("btn-finalizar-ia");
const btnAprobarTodasIA = document.getElementById("btn-aprobar-todas-ia");
const contenedorPropuestasIA = document.getElementById("contenedor-propuestas-ia");
const iaResumenContador = document.getElementById("ia-resumen-contador");

// Nombres pedagógicos de Bloom
const NOMBRES_BLOOM = {
  1: "Nivel 1 · Recordar",
  2: "Nivel 2 · Comprender",
  3: "Nivel 3 · Aplicar",
  4: "Nivel 4 · Analizar",
  5: "Nivel 5 · Evaluar"
};

// Cargar selectores de asignatura y tema
async function inicializarSelectores() {
  try {
    ui.cargando(true);
    const asignaturas = await api.listar("asignaturas");

    selectAsignatura.innerHTML = '<option value="">Selecciona una asignatura...</option>';
    for (const asig of asignaturas) {
      const opt = document.createElement("option");
      opt.value = asig.id;
      opt.textContent = `${asig.nombre} (${asig.nivel || 'General'})`;
      selectAsignatura.appendChild(opt);
    }

    const temaParam = util.parametro("temaId");
    if (temaParam) {
      await autoSeleccionarPorTema(temaParam);
    }
  } catch (err) {
    ui.aviso(err.message || "Error al cargar asignaturas", "error");
  } finally {
    ui.cargando(false);
  }
}

async function autoSeleccionarPorTema(temaId) {
  try {
    const tema = await api.obtener("temas", temaId);
    if (!tema) return;
    const unidad = await api.obtener("unidades", tema.unidadId);
    if (!unidad) return;

    selectAsignatura.value = unidad.asignaturaId;
    await cargarTemasDeAsignatura(unidad.asignaturaId);
    selectTema.value = temaId;
    await cambiarTema(temaId);
  } catch (err) {
    console.warn("No se pudo autoseleccionar el tema:", err);
  }
}

async function cargarTemasDeAsignatura(asignaturaId) {
  if (!asignaturaId) {
    selectTema.innerHTML = '<option value="">Primero selecciona una asignatura...</option>';
    selectTema.disabled = true;
    panelBanco.classList.add("oculto");
    return;
  }

  try {
    const unidades = await api.listar("unidades", { asignaturaId });
    const uIds = new Set(unidades.map((u) => u.id));

    const todosTemas = await api.listar("temas");
    const temasAsig = todosTemas.filter((t) => uIds.has(t.unidadId));

    selectTema.innerHTML = '<option value="">Selecciona un tema...</option>';
    for (const t of temasAsig) {
      const opt = document.createElement("option");
      opt.value = t.id;
      opt.textContent = t.titulo;
      selectTema.appendChild(opt);
    }
    selectTema.disabled = false;
  } catch (err) {
    ui.aviso("Error al cargar temas de la asignatura", "error");
  }
}

async function cambiarTema(temaId) {
  temaSeleccionadoId = temaId;
  if (!temaId) {
    panelBanco.classList.add("oculto");
    return;
  }

  panelBanco.classList.remove("oculto");
  await cargarPreguntasTema();
}

// Cargar todas las preguntas del tema y refrescar vista
async function cargarPreguntasTema() {
  if (!temaSeleccionadoId) return;

  try {
    ui.cargando(true);
    todasPreguntasTema = await api.listar("preguntas", { temaId: temaSeleccionadoId });
    actualizarContadoresPestanas();
    renderizarListaNivel();
  } catch (err) {
    ui.aviso(err.message || "Error al cargar preguntas del tema", "error");
  } finally {
    ui.cargando(false);
  }
}

// Actualizar contadores de preguntas aprobadas en las pestañas Nivel 1 a 5
function actualizarContadoresPestanas() {
  for (let n = 1; n <= 5; n++) {
    const contadorElem = document.getElementById(`contador-nivel-${n}`);
    if (contadorElem) {
      const aprobadas = todasPreguntasTema.filter(
        (p) => Number(p.nivel) === n && p.estado === "aprobado"
      ).length;
      contadorElem.textContent = `${aprobadas} aprobadas`;
      if (aprobadas >= 20) {
        contadorElem.className = "pestana-nivel__contador badge badge--exito";
      } else {
        contadorElem.className = "pestana-nivel__contador badge badge--advertencia";
      }
    }
  }
}

// Renderizar la lista de preguntas para el nivel activo
function renderizarListaNivel() {
  tituloNivelActivo.textContent = NOMBRES_BLOOM[nivelActivo] || `Nivel ${nivelActivo}`;

  const preguntasNivel = todasPreguntasTema.filter((p) => Number(p.nivel) === nivelActivo);
  const aprobadasNivel = preguntasNivel.filter((p) => p.estado === "aprobado").length;

  totalPreguntasNivel.textContent = `${preguntasNivel.length} pregunta${preguntasNivel.length === 1 ? '' : 's'} (${aprobadasNivel} aprobada${aprobadasNivel === 1 ? '' : 's'})`;

  // Aviso si hay menos de 20 preguntas aprobadas en el nivel
  if (aprobadasNivel < 20) {
    alertaCantidad.classList.remove("oculto");
    alertaCantidadTexto.textContent = `Este nivel cuenta actualmente con ${aprobadasNivel} pregunta${aprobadasNivel === 1 ? '' : 's'} aprobada${aprobadasNivel === 1 ? '' : 's'}. Se recomienda un mínimo de 20 preguntas aprobadas para garantizar variedad en las pruebas dinámicas.`;
  } else {
    alertaCantidad.classList.add("oculto");
  }

  if (preguntasNivel.length === 0) {
    listaPreguntas.innerHTML = `
      <div class="vacio" style="text-align: center; padding: var(--espacio-xl);">
        <p class="texto-suave">Aún no hay preguntas registradas en este nivel.</p>
        <div style="display: flex; gap: var(--espacio-s); justify-content: center; margin-top: var(--espacio-m);">
          <button type="button" class="boton boton--primario boton--pequeno btn-crear-vacio">
            + Crear manualmente
          </button>
          <button type="button" class="boton boton--acento boton--pequeno btn-ia-vacio">
            ⚡ Generar con IA
          </button>
        </div>
      </div>
    `;

    listaPreguntas.querySelector(".btn-crear-vacio")?.addEventListener("click", () => abrirModalCreacion());
    listaPreguntas.querySelector(".btn-ia-vacio")?.addEventListener("click", () => iniciarGeneracionIA());
    return;
  }

  listaPreguntas.innerHTML = preguntasNivel.map((p) => {
    const badgeTipoTexto = {
      opcion: "Opción múltiple",
      vf: "Verdadero / Falso",
      completar: "Completar texto"
    }[p.tipo] || p.tipo;

    const badgeEstadoClase = p.estado === "aprobado" ? "badge--exito" : "badge--advertencia";
    const badgeOrigenTexto = p.origen === "ia" ? "🤖 Asistido IA" : "👤 Docente";

    let htmlOpciones = "";
    if (p.tipo === "opcion" && Array.isArray(p.opciones)) {
      htmlOpciones = `
        <ul class="tarjeta-pregunta-opciones">
          ${p.opciones.map((op, idx) => `
            <li class="opcion-item ${Number(p.correcta) === idx ? 'opcion-item--correcta' : ''}">
              <span>${Number(p.correcta) === idx ? '✓' : '○'}</span>
              <span>${ui.escapar(op)}</span>
            </li>
          `).join("")}
        </ul>
      `;
    } else if (p.tipo === "vf") {
      const esVerdadero = p.correcta === true || p.correcta === "true" || Number(p.correcta) === 0;
      htmlOpciones = `
        <div class="opcion-item opcion-item--correcta" style="margin: var(--espacio-xs) 0;">
          <span>✓ Respuesta correcta: <strong>${esVerdadero ? 'Verdadero' : 'Falso'}</strong></span>
        </div>
      `;
    } else if (p.tipo === "completar") {
      htmlOpciones = `
        <div class="opcion-item opcion-item--correcta" style="margin: var(--espacio-xs) 0;">
          <span>✓ Palabra esperada: <strong>${ui.escapar(String(p.correcta))}</strong></span>
        </div>
      `;
    }

    return `
      <article class="tarjeta-pregunta" data-id="${p.id}">
        <div class="tarjeta-pregunta-header">
          <div class="tarjeta-pregunta-badges">
            <span class="chip">${badgeTipoTexto}</span>
            <span class="badge ${badgeEstadoClase}">${ui.escapar(p.estado || 'aprobado')}</span>
            <span class="chip">${badgeOrigenTexto}</span>
          </div>
          <div class="tarjeta-pregunta-acciones">
            <button type="button" class="boton boton--secundario boton--pequeno btn-editar-pregunta" data-id="${p.id}">
              Editar
            </button>
            <button type="button" class="boton boton--peligro boton--pequeno btn-eliminar-pregunta" data-id="${p.id}">
              Eliminar
            </button>
          </div>
        </div>

        <div class="tarjeta-pregunta-enunciado">
          ${ui.escapar(p.enunciado)}
        </div>

        ${htmlOpciones}

        ${p.retroalimentacion ? `
          <div class="tarjeta-pregunta-retro">
            <strong>Retroalimentación:</strong> ${ui.escapar(p.retroalimentacion)}
          </div>
        ` : ''}
      </article>
    `;
  }).join("");

  // Asignar eventos de edición y eliminación
  listaPreguntas.querySelectorAll(".btn-editar-pregunta").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-id");
      const pregunta = todasPreguntasTema.find((p) => p.id === id);
      if (pregunta) abrirModalEdicion(pregunta);
    });
  });

  listaPreguntas.querySelectorAll(".btn-eliminar-pregunta").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-id");
      const confirmado = await ui.confirmar("¿Estás seguro de que deseas eliminar esta pregunta del banco?");
      if (confirmado) {
        try {
          ui.cargando(true);
          await api.eliminar("preguntas", id);
          ui.aviso("Pregunta eliminada con éxito", "exito");
          await cargarPreguntasTema();
        } catch (err) {
          ui.aviso(err.message || "Error al eliminar la pregunta", "error");
        } finally {
          ui.cargando(false);
        }
      }
    });
  });
}

// Configurar formulario dinámico de opciones según el tipo
function renderizarCamposOpciones(tipo, datosPregunta = null) {
  contenedorOpciones.innerHTML = "";

  if (tipo === "opcion") {
    legendOpciones.textContent = "Opciones de respuesta (marca el radio de la correcta)";
    ayudaEnunciado.textContent = "Formula una pregunta clara con 4 opciones estructuradas.";

    const opciones = datosPregunta?.opciones || ["", "", "", ""];
    const correctaIndex = datosPregunta && datosPregunta.correcta !== undefined ? Number(datosPregunta.correcta) : 0;

    for (let i = 0; i < 4; i++) {
      const fila = document.createElement("div");
      fila.style.display = "flex";
      fila.style.alignItems = "center";
      fila.style.gap = "var(--espacio-s)";

      const radio = document.createElement("input");
      radio.type = "radio";
      radio.name = "opcion_correcta";
      radio.value = i;
      radio.checked = i === correctaIndex;
      radio.required = true;
      radio.setAttribute("aria-label", `Opción ${i + 1} como correcta`);

      const input = document.createElement("input");
      input.type = "text";
      input.className = "campo-texto campo-opcion";
      input.placeholder = `Opción ${i + 1}`;
      input.value = opciones[i] || "";
      input.required = true;

      fila.appendChild(radio);
      fila.appendChild(input);
      contenedorOpciones.appendChild(fila);
    }
  } else if (tipo === "vf") {
    legendOpciones.textContent = "Respuesta correcta para Verdadero / Falso";
    ayudaEnunciado.textContent = "Redacta una afirmación categórica que sea inequívocamente verdadera o falsa.";

    const esVerdadero = datosPregunta ? (datosPregunta.correcta === true || datosPregunta.correcta === "true" || Number(datosPregunta.correcta) === 0) : true;

    contenedorOpciones.innerHTML = `
      <div style="display: flex; gap: var(--espacio-l); padding: var(--espacio-xs) 0;">
        <label style="display: flex; align-items: center; gap: var(--espacio-xs); cursor: pointer;">
          <input type="radio" name="vf_correcta" value="true" ${esVerdadero ? 'checked' : ''}>
          <span>Verdadero</span>
        </label>
        <label style="display: flex; align-items: center; gap: var(--espacio-xs); cursor: pointer;">
          <input type="radio" name="vf_correcta" value="false" ${!esVerdadero ? 'checked' : ''}>
          <span>Falso</span>
        </label>
      </div>
    `;
  } else if (tipo === "completar") {
    legendOpciones.textContent = "Palabra o frase clave esperada";
    ayudaEnunciado.textContent = 'Incluye "_____" en el enunciado donde deba completarse la respuesta.';

    const valorCorrecto = datosPregunta && datosPregunta.correcta !== undefined ? String(datosPregunta.correcta) : "";

    contenedorOpciones.innerHTML = `
      <div class="campo">
        <input type="text" id="campo-completar-correcta" class="campo-texto" placeholder="Escribe la palabra exacta que completa el enunciado..." value="${ui.escapar(valorCorrecto)}" required>
      </div>
    `;
  }
}

// Abrir modal para crear
function abrirModalCreacion() {
  if (!temaSeleccionadoId) {
    ui.aviso("Primero selecciona una asignatura y un tema", "advertencia");
    return;
  }

  modalPreguntaTitulo.textContent = "Nueva Pregunta";
  campoId.value = "";
  campoNivel.value = nivelActivo;
  campoTipo.value = "opcion";
  campoEnunciado.value = "";
  campoRetro.value = "";
  campoEstado.value = "aprobado";

  renderizarCamposOpciones("opcion");
  modalPregunta.showModal();
}

// Abrir modal para editar
function abrirModalEdicion(pregunta) {
  modalPreguntaTitulo.textContent = "Editar Pregunta";
  campoId.value = pregunta.id || "";
  campoNivel.value = pregunta.nivel || nivelActivo;
  campoTipo.value = pregunta.tipo || "opcion";
  campoEnunciado.value = pregunta.enunciado || "";
  campoRetro.value = pregunta.retroalimentacion || "";
  campoEstado.value = pregunta.estado || "aprobado";

  renderizarCamposOpciones(pregunta.tipo || "opcion", pregunta);
  modalPregunta.showModal();
}

// Procesar guardado del formulario de pregunta
formPregunta.addEventListener("submit", async (e) => {
  e.preventDefault();

  if (!temaSeleccionadoId) return;

  const id = campoId.value;
  const nivel = Number(campoNivel.value);
  const tipo = campoTipo.value;
  const enunciado = campoEnunciado.value.trim();
  const retroalimentacion = campoRetro.value.trim();
  const estado = campoEstado.value;

  if (!enunciado) {
    ui.aviso("El enunciado no puede estar vacío", "advertencia");
    return;
  }

  let opciones = [];
  let correcta = null;

  if (tipo === "opcion") {
    const inputsOpciones = contenedorOpciones.querySelectorAll(".campo-opcion");
    opciones = Array.from(inputsOpciones).map((inp) => inp.value.trim());

    if (opciones.some((op) => !op)) {
      ui.aviso("Debes completar las 4 opciones de respuesta", "advertencia");
      return;
    }

    const radioChecked = contenedorOpciones.querySelector("input[name='opcion_correcta']:checked");
    correcta = radioChecked ? Number(radioChecked.value) : 0;
  } else if (tipo === "vf") {
    opciones = ["Verdadero", "Falso"];
    const radioVF = contenedorOpciones.querySelector("input[name='vf_correcta']:checked");
    correcta = radioVF ? (radioVF.value === "true") : true;
  } else if (tipo === "completar") {
    opciones = [];
    const inputComp = document.getElementById("campo-completar-correcta");
    correcta = inputComp ? inputComp.value.trim() : "";
    if (!correcta) {
      ui.aviso("Debes ingresar la palabra clave que completa la oración", "advertencia");
      return;
    }
  }

  const payload = {
    temaId: temaSeleccionadoId,
    nivel,
    tipo,
    enunciado,
    opciones,
    correcta,
    retroalimentacion,
    estado,
    origen: id ? undefined : "docente"
  };

  try {
    ui.cargando(true);
    if (id) {
      await api.actualizar("preguntas", id, payload);
      ui.aviso("Pregunta actualizada con éxito", "exito");
    } else {
      await api.crear("preguntas", payload);
      ui.aviso("Pregunta creada con éxito", "exito");
    }
    modalPregunta.close();
    await cargarPreguntasTema();
  } catch (err) {
    ui.aviso(err.message || "Error al guardar la pregunta", "error");
  } finally {
    ui.cargando(false);
  }
});

// Generar con IA
async function iniciarGeneracionIA() {
  if (!temaSeleccionadoId) {
    ui.aviso("Primero selecciona una asignatura y un tema", "advertencia");
    return;
  }

  try {
    ui.cargando(true);
    const resultado = await api.ia("generar-preguntas", {
      temaId: temaSeleccionadoId,
      nivel: nivelActivo,
      cantidad: 5
    });

    if (!Array.isArray(resultado) || resultado.length === 0) {
      throw new Error("La IA no devolvió preguntas válidas en este momento");
    }

    propuestasIAGeneradas = resultado.map((p, index) => ({
      ...p,
      tempId: `propuesta_${Date.now()}_${index}`,
      nivel: nivelActivo,
      temaId: temaSeleccionadoId,
      origen: "ia",
      estado: "aprobado"
    }));

    renderizarPropuestasIA();
    modalIA.showModal();
  } catch (err) {
    ui.aviso(err.message || "No se pudo generar con IA", "error");
  } finally {
    ui.cargando(false);
  }
}

function renderizarPropuestasIA() {
  iaResumenContador.textContent = `${propuestasIAGeneradas.length} propuesta${propuestasIAGeneradas.length === 1 ? '' : 's'} disponible${propuestasIAGeneradas.length === 1 ? '' : 's'}`;

  if (propuestasIAGeneradas.length === 0) {
    contenedorPropuestasIA.innerHTML = `
      <div class="vacio" style="text-align: center; padding: var(--espacio-l);">
        <p class="texto-suave">Todas las propuestas generadas han sido procesadas.</p>
      </div>
    `;
    btnAprobarTodasIA.disabled = true;
    return;
  }

  btnAprobarTodasIA.disabled = false;

  contenedorPropuestasIA.innerHTML = propuestasIAGeneradas.map((p) => {
    let htmlOpciones = "";
    if (p.tipo === "opcion" && Array.isArray(p.opciones)) {
      htmlOpciones = `
        <ul class="tarjeta-pregunta-opciones">
          ${p.opciones.map((op, idx) => `
            <li class="opcion-item ${Number(p.correcta) === idx ? 'opcion-item--correcta' : ''}">
              <span>${Number(p.correcta) === idx ? '✓' : '○'}</span>
              <span>${ui.escapar(op)}</span>
            </li>
          `).join("")}
        </ul>
      `;
    } else if (p.tipo === "vf") {
      const esV = p.correcta === true || p.correcta === "true" || Number(p.correcta) === 0;
      htmlOpciones = `
        <div class="opcion-item opcion-item--correcta">
          <span>✓ Respuesta esperada: <strong>${esV ? 'Verdadero' : 'Falso'}</strong></span>
        </div>
      `;
    } else if (p.tipo === "completar") {
      htmlOpciones = `
        <div class="opcion-item opcion-item--correcta">
          <span>✓ Palabra esperada: <strong>${ui.escapar(String(p.correcta))}</strong></span>
        </div>
      `;
    }

    return `
      <div class="propuesta-ia-item" data-tempid="${p.tempId}">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span class="chip chip--primario">${p.tipo}</span>
          <div style="display: flex; gap: var(--espacio-xs);">
            <button type="button" class="boton boton--exito boton--pequeno btn-aprobar-propuesta" data-tempid="${p.tempId}">
              ✓ Aprobar
            </button>
            <button type="button" class="boton boton--secundario boton--pequeno btn-editar-propuesta" data-tempid="${p.tempId}">
              ✏️ Editar
            </button>
            <button type="button" class="boton boton--peligro boton--pequeno btn-descartar-propuesta" data-tempid="${p.tempId}">
              ✕ Descartar
            </button>
          </div>
        </div>

        <div style="font-weight: var(--peso-seminegrita);">${ui.escapar(p.enunciado)}</div>

        ${htmlOpciones}

        ${p.retroalimentacion ? `
          <div class="tarjeta-pregunta-retro">
            <strong>Retroalimentación:</strong> ${ui.escapar(p.retroalimentacion)}
          </div>
        ` : ''}
      </div>
    `;
  }).join("");

  // Eventos individuales
  contenedorPropuestasIA.querySelectorAll(".btn-aprobar-propuesta").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const tempId = btn.getAttribute("data-tempid");
      const prop = propuestasIAGeneradas.find((item) => item.tempId === tempId);
      if (prop) await aprobarUnaPropuesta(prop);
    });
  });

  contenedorPropuestasIA.querySelectorAll(".btn-editar-propuesta").forEach((btn) => {
    btn.addEventListener("click", () => {
      const tempId = btn.getAttribute("data-tempid");
      const prop = propuestasIAGeneradas.find((item) => item.tempId === tempId);
      if (prop) {
        modalIA.close();
        abrirModalEdicion({
          ...prop,
          origen: "ia",
          estado: "aprobado"
        });
      }
    });
  });

  contenedorPropuestasIA.querySelectorAll(".btn-descartar-propuesta").forEach((btn) => {
    btn.addEventListener("click", () => {
      const tempId = btn.getAttribute("data-tempid");
      propuestasIAGeneradas = propuestasIAGeneradas.filter((item) => item.tempId !== tempId);
      renderizarPropuestasIA();
      ui.aviso("Propuesta descartada", "info");
    });
  });
}

async function aprobarUnaPropuesta(propuesta) {
  try {
    ui.cargando(true);
    await api.crear("preguntas", {
      temaId: propuesta.temaId,
      nivel: propuesta.nivel,
      tipo: propuesta.tipo,
      enunciado: propuesta.enunciado,
      opciones: propuesta.opciones,
      correcta: propuesta.correcta,
      retroalimentacion: propuesta.retroalimentacion,
      origen: "ia",
      estado: "aprobado"
    });

    propuestasIAGeneradas = propuestasIAGeneradas.filter((item) => item.tempId !== propuesta.tempId);
    renderizarPropuestasIA();
    ui.aviso("Pregunta aprobada y guardada en el banco", "exito");
    await cargarPreguntasTema();
  } catch (err) {
    ui.aviso(err.message || "Error al aprobar la pregunta", "error");
  } finally {
    ui.cargando(false);
  }
}

btnAprobarTodasIA.addEventListener("click", async () => {
  if (propuestasIAGeneradas.length === 0) return;

  try {
    ui.cargando(true);
    let guardadas = 0;
    for (const p of [...propuestasIAGeneradas]) {
      await api.crear("preguntas", {
        temaId: p.temaId,
        nivel: p.nivel,
        tipo: p.tipo,
        enunciado: p.enunciado,
        opciones: p.opciones,
        correcta: p.correcta,
        retroalimentacion: p.retroalimentacion,
        origen: "ia",
        estado: "aprobado"
      });
      guardadas++;
    }

    propuestasIAGeneradas = [];
    modalIA.close();
    ui.aviso(`¡${guardadas} preguntas aprobadas e incorporadas al banco!`, "exito");
    await cargarPreguntasTema();
  } catch (err) {
    ui.aviso(err.message || "Error al aprobar preguntas", "error");
  } finally {
    ui.cargando(false);
  }
});

// Eventos de interfaz
selectAsignatura.addEventListener("change", (e) => {
  cargarTemasDeAsignatura(e.target.value);
});

selectTema.addEventListener("change", (e) => {
  cambiarTema(e.target.value);
});

btnNuevaPregunta.addEventListener("click", () => abrirModalCreacion());
btnGenerarIA.addEventListener("click", () => iniciarGeneracionIA());

btnCerrarModal.addEventListener("click", () => modalPregunta.close());
btnCancelarPregunta.addEventListener("click", () => modalPregunta.close());

btnCerrarModalIA.addEventListener("click", () => modalIA.close());
btnFinalizarIA.addEventListener("click", () => modalIA.close());

campoTipo.addEventListener("change", (e) => {
  renderizarCamposOpciones(e.target.value);
});

// Manejo de pestañas Nivel 1 a 5
document.querySelectorAll(".pestana-nivel").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".pestana-nivel").forEach((t) => {
      t.classList.remove("pestana-nivel--activa");
      t.setAttribute("aria-selected", "false");
    });
    tab.classList.add("pestana-nivel--activa");
    tab.setAttribute("aria-selected", "true");

    nivelActivo = Number(tab.getAttribute("data-nivel"));
    renderizarListaNivel();
  });
});

// Inicializar
inicializarSelectores();
