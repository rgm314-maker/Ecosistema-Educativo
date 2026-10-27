// publico/js/modulos/editor-contenidos.js
// Editor curricular: gestión jerárquica de unidades y temas académicos

import { montarPlantilla } from '../nucleo/plantilla.js';
import * as api from '../nucleo/api.js';
import * as ui from '../nucleo/ui.js';
import { parametro } from '../nucleo/util.js';

await montarPlantilla({ titulo: "Editor de Contenidos", roles: ["docente", "admin"] });

// Referencias del DOM
const selectAsignatura = document.getElementById("selectAsignatura");
const infoAsignatura = document.getElementById("infoAsignatura");
const btnNuevaUnidad = document.getElementById("btnNuevaUnidad");
const listaUnidades = document.getElementById("listaUnidades");
const tituloTemas = document.getElementById("tituloTemas");
const btnNuevoTema = document.getElementById("btnNuevoTema");
const listaTemas = document.getElementById("listaTemas");

const inputSubirMaterialContenidos = document.getElementById("inputSubirMaterialContenidos");

let asignaturas = [];
let asignaturaActual = null;
let unidades = [];
let unidadSeleccionada = null;
let temas = [];
let temaSeleccionadoParaMaterial = null;
let unidadSeleccionadaParaMaterial = null;

// Carga inicial de asignaturas
async function inicializar() {
  try {
    ui.cargando(true);
    asignaturas = await api.listar("asignaturas");

    if (!Array.isArray(asignaturas) || asignaturas.length === 0) {
      selectAsignatura.innerHTML = `<option value="">No tienes asignaturas asignadas</option>`;
      selectAsignatura.disabled = true;
      btnNuevaUnidad.disabled = true;
      btnNuevoTema.disabled = true;
      listaUnidades.innerHTML = `
        <li style="padding: var(--espacio-l); text-align: center; color: var(--texto-suave);">
          No se encontraron asignaturas disponibles para tu usuario.
        </li>
      `;
      return;
    }

    selectAsignatura.innerHTML = asignaturas
      .map((a) => `<option value="${ui.escapar(a.id)}">${ui.escapar(a.nombre)} (Nivel ${ui.escapar(a.nivel || "1")})</option>`)
      .join("");

    const idParam = parametro("asignaturaId");
    const asigInicial = asignaturas.find((a) => a.id === idParam) || asignaturas[0];

    selectAsignatura.value = asigInicial.id;
    await cambiarAsignatura(asigInicial.id);
  } catch (err) {
    ui.aviso(err.message || "Error al cargar asignaturas", "peligro");
  } finally {
    ui.cargando(false);
  }
}

// Cambiar la asignatura activa
async function cambiarAsignatura(id) {
  asignaturaActual = asignaturas.find((a) => a.id === id);
  if (!asignaturaActual) return;

  infoAsignatura.textContent = asignaturaActual.descripcion || "Sin descripción adicional";
  unidadSeleccionada = null;
  btnNuevoTema.disabled = true;
  tituloTemas.textContent = "Temas";
  listaTemas.innerHTML = `
    <li style="padding: var(--espacio-l); text-align: center; color: var(--texto-suave);">
      Selecciona una unidad para ver y gestionar sus temas.
    </li>
  `;

  await cargarUnidades();
}

// Cargar y ordenar las unidades de la asignatura
async function cargarUnidades() {
  try {
    ui.cargando(true);
    const todasUnidades = await api.listar("unidades");
    unidades = (todasUnidades || [])
      .filter((u) => u.asignaturaId === asignaturaActual.id)
      .sort((a, b) => (a.orden || 0) - (b.orden || 0));

    renderizarUnidades();

    // Mantener seleccionada la unidad si sigue existiendo o elegir la primera si hay
    if (unidadSeleccionada) {
      const existe = unidades.find((u) => u.id === unidadSeleccionada.id);
      if (existe) {
        await seleccionarUnidad(existe);
      } else if (unidades.length > 0) {
        await seleccionarUnidad(unidades[0]);
      }
    } else if (unidades.length > 0) {
      await seleccionarUnidad(unidades[0]);
    }
  } catch (err) {
    ui.aviso(err.message || "Error al cargar unidades", "peligro");
  } finally {
    ui.cargando(false);
  }
}

// Renderizar la lista de unidades
function renderizarUnidades() {
  if (unidades.length === 0) {
    listaUnidades.innerHTML = `
      <li style="padding: var(--espacio-l); text-align: center; color: var(--texto-suave);">
        <p style="margin-bottom: var(--espacio-s);">Esta asignatura no tiene unidades registradas.</p>
        <button type="button" class="btn btn--primario btn--pequeno" id="btnCrearPrimeraUnidad">
          + Crear primera unidad
        </button>
      </li>
    `;
    const btnCrear = document.getElementById("btnCrearPrimeraUnidad");
    if (btnCrear) {
      btnCrear.addEventListener("click", () => btnNuevaUnidad.click());
    }
    return;
  }

  listaUnidades.innerHTML = unidades
    .map((u, index) => {
      const esActiva = unidadSeleccionada?.id === u.id;
      const claseActiva = esActiva ? " item-editor--activo" : "";
      const esPrimera = index === 0;
      const esUltima = index === unidades.length - 1;
      const badgeVisibilidad = u.visible !== false
        ? `<span class="badge-estado-tema badge-estado--publicado">Visible</span>`
        : `<span class="badge-estado-tema badge-estado--borrador">Oculta</span>`;

      return `
        <li class="item-editor${claseActiva}" data-id="${ui.escapar(u.id)}">
          <div class="item-editor__info btn-seleccionar-unidad" style="cursor: pointer;" title="Ver temas de esta unidad">
            <span class="item-editor__titulo">
              <strong>${index + 1}.</strong> ${ui.escapar(u.titulo)}
            </span>
            <div class="item-editor__meta">
              ${badgeVisibilidad}
            </div>
          </div>

          <div class="item-editor__controles">
            <button
              type="button"
              class="btn-icono btn-subir-material-unidad"
              data-id="${ui.escapar(u.id)}"
              title="Cargar archivo / PDF en esta unidad"
              aria-label="Cargar material en ${ui.escapar(u.titulo)}"
            >📄</button>

            <button
              type="button"
              class="btn-icono btn-subir-unidad"
              data-id="${ui.escapar(u.id)}"
              title="Subir orden"
              aria-label="Subir orden de ${ui.escapar(u.titulo)}"
              ${esPrimera ? "disabled" : ""}
            >▲</button>

            <button
              type="button"
              class="btn-icono btn-bajar-unidad"
              data-id="${ui.escapar(u.id)}"
              title="Bajar orden"
              aria-label="Bajar orden de ${ui.escapar(u.titulo)}"
              ${esUltima ? "disabled" : ""}
            >▼</button>

            <button
              type="button"
              class="btn-icono btn-visibilidad-unidad"
              data-id="${ui.escapar(u.id)}"
              title="${u.visible !== false ? 'Ocultar unidad a estudiantes' : 'Hacer visible a estudiantes'}"
              aria-label="Cambiar visibilidad de ${ui.escapar(u.titulo)}"
            >${u.visible !== false ? '👁️' : '🚫'}</button>

            <button
              type="button"
              class="btn-icono btn-renombrar-unidad"
              data-id="${ui.escapar(u.id)}"
              title="Renombrar unidad"
              aria-label="Renombrar ${ui.escapar(u.titulo)}"
            >✏️</button>
          </div>
        </li>
      `;
    })
    .join("");
}

// Seleccionar unidad y cargar sus temas
async function seleccionarUnidad(unidad) {
  unidadSeleccionada = unidad;
  tituloTemas.textContent = `Temas de: ${unidad.titulo}`;
  btnNuevoTema.disabled = false;

  // Actualizar clase activa en la lista
  const items = listaUnidades.querySelectorAll(".item-editor");
  items.forEach((item) => {
    if (item.dataset.id === unidad.id) {
      item.classList.add("item-editor--activo");
    } else {
      item.classList.remove("item-editor--activo");
    }
  });

  await cargarTemas();
}

// Cargar y ordenar los temas de la unidad seleccionada
async function cargarTemas() {
  if (!unidadSeleccionada) return;

  try {
    ui.cargando(true);
    const todosTemas = await api.listar("temas");
    temas = (todosTemas || [])
      .filter((t) => t.unidadId === unidadSeleccionada.id)
      .sort((a, b) => (a.orden || 0) - (b.orden || 0));

    renderizarTemas();
  } catch (err) {
    ui.aviso(err.message || "Error al cargar temas", "peligro");
  } finally {
    ui.cargando(false);
  }
}

// Renderizar la lista de temas
function renderizarTemas() {
  if (temas.length === 0) {
    listaTemas.innerHTML = `
      <li style="padding: var(--espacio-l); text-align: center; color: var(--texto-suave);">
        Esta unidad aún no tiene temas. Pulsa "+ Nuevo Tema" para agregar uno.
      </li>
    `;
    return;
  }

  listaTemas.innerHTML = temas
    .map((t, index) => {
      const esPrimero = index === 0;
      const esUltimo = index === temas.length - 1;
      const esPublicado = t.estado === "publicado";
      const recursos = Array.isArray(t.recursos) ? t.recursos : [];
      const recursosHtml = recursos.length > 0
        ? `<div class="item-editor__recursos" style="display: flex; flex-wrap: wrap; gap: 4px; margin-top: 4px;">
            ${recursos.map(r => `
              <a href="${ui.escapar(r.url)}" target="_blank" rel="noopener" class="chip chip--primario" style="font-size: var(--texto-xs);" title="Ver material: ${ui.escapar(r.titulo)}">
                📄 ${ui.escapar(r.titulo || "Material")}
              </a>
            `).join("")}
          </div>`
        : '';

      return `
        <li class="item-editor" data-id="${ui.escapar(t.id)}">
          <div class="item-editor__info">
            <span class="item-editor__titulo">
              <strong>${index + 1}.</strong> ${ui.escapar(t.titulo)}
            </span>
            <div class="item-editor__meta">
              <label class="sr-only" for="estadoTema-${ui.escapar(t.id)}">Estado de ${ui.escapar(t.titulo)}</label>
              <select
                id="estadoTema-${ui.escapar(t.id)}"
                class="select-estado-tema badge-estado-tema ${esPublicado ? 'badge-estado--publicado' : 'badge-estado--borrador'}"
                data-id="${ui.escapar(t.id)}"
                style="cursor: pointer; border-radius: var(--radio-s); padding: 2px 6px;"
              >
                <option value="borrador" ${!esPublicado ? 'selected' : ''}>Borrador</option>
                <option value="publicado" ${esPublicado ? 'selected' : ''}>Publicado</option>
              </select>
            </div>
            ${recursosHtml}
          </div>

          <div class="item-editor__controles">
            <button
              type="button"
              class="btn btn--primario btn--pequeno btn-cargar-material"
              data-id="${ui.escapar(t.id)}"
              title="Cargar archivo PDF o documento a este tema"
            >
              📎 Cargar material
            </button>

            <button
              type="button"
              class="btn-icono btn-subir-tema"
              data-id="${ui.escapar(t.id)}"
              title="Subir orden"
              aria-label="Subir orden de ${ui.escapar(t.titulo)}"
              ${esPrimero ? "disabled" : ""}
            >▲</button>

            <button
              type="button"
              class="btn-icono btn-bajar-tema"
              data-id="${ui.escapar(t.id)}"
              title="Bajar orden"
              aria-label="Bajar orden de ${ui.escapar(t.titulo)}"
              ${esUltimo ? "disabled" : ""}
            >▼</button>

            <a
              href="/paginas/editor-tema.html?id=${encodeURIComponent(t.id)}"
              class="btn btn--secundario btn--pequeno"
              title="Editar ficha pedagógica completa y glosario"
            >
              Editar ficha
            </a>
          </div>
        </li>
      `;
    })
    .join("");
}

// Selector de asignatura
selectAsignatura.addEventListener("change", (e) => {
  cambiarAsignatura(e.target.value);
});

// Eventos en lista de Unidades
listaUnidades.addEventListener("click", async (e) => {
  const itemEl = e.target.closest(".item-editor");
  if (!itemEl) return;
  const id = itemEl.dataset.id;
  const unidad = unidades.find((u) => u.id === id);
  if (!unidad) return;

  // Clic en la información para seleccionar
  if (e.target.closest(".btn-seleccionar-unidad")) {
    await seleccionarUnidad(unidad);
    return;
  }

  // Cargar material a la unidad
  if (e.target.closest(".btn-subir-material-unidad")) {
    unidadSeleccionadaParaMaterial = unidad;
    temaSeleccionadoParaMaterial = null;
    if (inputSubirMaterialContenidos) inputSubirMaterialContenidos.click();
    return;
  }

  // Renombrar unidad
  if (e.target.closest(".btn-renombrar-unidad")) {
    const inputHtml = `
      <div class="campo">
        <label for="inputNuevoTitulo">Título de la unidad *</label>
        <input type="text" id="inputNuevoTitulo" value="${ui.escapar(unidad.titulo)}" required>
      </div>
    `;

    const formRenombrar = document.createElement("div");
    formRenombrar.innerHTML = inputHtml;

    ui.modal({
      titulo: "Renombrar Unidad",
      contenido: formRenombrar,
      acciones: [
        { texto: "Cancelar", valor: false, clase: "btn-secundario" },
        { texto: "Guardar", valor: true, clase: "btn-primario" }
      ]
    }).then(async (confirmado) => {
      if (!confirmado) return;
      const nuevoTitulo = formRenombrar.querySelector("#inputNuevoTitulo").value.trim();
      if (!nuevoTitulo) {
        ui.aviso("El título de la unidad no puede estar vacío", "advertencia");
        return;
      }
      try {
        ui.cargando(true);
        await api.actualizar("unidades", unidad.id, { titulo: nuevoTitulo });
        ui.aviso("Unidad renombrada exitosamente", "exito");
        await cargarUnidades();
      } catch (err) {
        ui.aviso(err.message || "Error al renombrar unidad", "peligro");
      } finally {
        ui.cargando(false);
      }
    });
    return;
  }

  // Cambiar visibilidad (visible/oculta)
  if (e.target.closest(".btn-visibilidad-unidad")) {
    const nuevaVisibilidad = unidad.visible === false;
    try {
      ui.cargando(true);
      await api.actualizar("unidades", unidad.id, { visible: nuevaVisibilidad });
      ui.aviso(nuevaVisibilidad ? "Unidad ahora visible para estudiantes" : "Unidad ocultada a estudiantes", "info");
      await cargarUnidades();
    } catch (err) {
      ui.aviso(err.message || "Error al actualizar visibilidad", "peligro");
    } finally {
      ui.cargando(false);
    }
    return;
  }

  // Subir orden de unidad
  if (e.target.closest(".btn-subir-unidad")) {
    const idx = unidades.findIndex((u) => u.id === id);
    if (idx <= 0) return;
    const anterior = unidades[idx - 1];
    await intercambiarOrdenUnidades(unidad, anterior);
    return;
  }

  // Bajar orden de unidad
  if (e.target.closest(".btn-bajar-unidad")) {
    const idx = unidades.findIndex((u) => u.id === id);
    if (idx < 0 || idx >= unidades.length - 1) return;
    const siguiente = unidades[idx + 1];
    await intercambiarOrdenUnidades(unidad, siguiente);
  }
});

async function intercambiarOrdenUnidades(u1, u2) {
  try {
    ui.cargando(true);
    const orden1 = u1.orden || 1;
    const orden2 = u2.orden || 2;
    // Si tenían el mismo orden por alguna razón, forzar separación
    const nuevoOrden1 = orden1 === orden2 ? orden2 + 1 : orden2;
    const nuevoOrden2 = orden1;

    await Promise.all([
      api.actualizar("unidades", u1.id, { orden: nuevoOrden1 }),
      api.actualizar("unidades", u2.id, { orden: nuevoOrden2 })
    ]);
    await cargarUnidades();
  } catch (err) {
    ui.aviso(err.message || "Error al cambiar orden", "peligro");
  } finally {
    ui.cargando(false);
  }
}

// Botón Agregar Unidad
btnNuevaUnidad.addEventListener("click", () => {
  if (!asignaturaActual) return;

  const formNuevaUnidad = document.createElement("div");
  formNuevaUnidad.innerHTML = `
    <div class="campo">
      <label for="inputTituloUnidad">Título de la nueva unidad *</label>
      <input type="text" id="inputTituloUnidad" placeholder="Ej. Unidad 1: Marco Conceptual" required>
    </div>
  `;

  ui.modal({
    titulo: "Nueva Unidad",
    contenido: formNuevaUnidad,
    acciones: [
      { texto: "Cancelar", valor: false, clase: "btn-secundario" },
      { texto: "Crear unidad", valor: true, clase: "btn-primario" }
    ]
  }).then(async (guardar) => {
    if (!guardar) return;
    const titulo = formNuevaUnidad.querySelector("#inputTituloUnidad").value.trim();
    if (!titulo) {
      ui.aviso("El título es obligatorio", "advertencia");
      return;
    }

    try {
      ui.cargando(true);
      const maxOrden = unidades.length > 0 ? Math.max(...unidades.map((u) => u.orden || 0)) : 0;
      const nueva = await api.crear("unidades", {
        asignaturaId: asignaturaActual.id,
        titulo,
        orden: maxOrden + 1,
        visible: true
      });
      ui.aviso("Unidad creada exitosamente", "exito");
      unidadSeleccionada = nueva;
      await cargarUnidades();
    } catch (err) {
      ui.aviso(err.message || "Error al crear la unidad", "peligro");
    } finally {
      ui.cargando(false);
    }
  });
});

// Eventos en lista de Temas
listaTemas.addEventListener("click", async (e) => {
  const itemEl = e.target.closest(".item-editor");
  if (!itemEl) return;
  const id = itemEl.dataset.id;
  const tema = temas.find((t) => t.id === id);
  if (!tema) return;

  // Subir orden de tema
  if (e.target.closest(".btn-subir-tema")) {
    const idx = temas.findIndex((t) => t.id === id);
    if (idx <= 0) return;
    const anterior = temas[idx - 1];
    await intercambiarOrdenTemas(tema, anterior);
    return;
  }

  // Cargar material al tema
  if (e.target.closest(".btn-cargar-material")) {
    temaSeleccionadoParaMaterial = tema;
    unidadSeleccionadaParaMaterial = null;
    if (inputSubirMaterialContenidos) inputSubirMaterialContenidos.click();
    return;
  }

  // Bajar orden de tema
  if (e.target.closest(".btn-bajar-tema")) {
    const idx = temas.findIndex((t) => t.id === id);
    if (idx < 0 || idx >= temas.length - 1) return;
    const siguiente = temas[idx + 1];
    await intercambiarOrdenTemas(tema, siguiente);
  }
});

// Cambio reactivo de estado de tema (borrador / publicado)
listaTemas.addEventListener("change", async (e) => {
  const selectEstado = e.target.closest(".select-estado-tema");
  if (!selectEstado) return;

  const id = selectEstado.dataset.id;
  const nuevoEstado = selectEstado.value;
  const tema = temas.find((t) => t.id === id);
  const estadoPrevio = tema ? tema.estado : "borrador";

  try {
    selectEstado.disabled = true;
    await api.actualizar("temas", id, { estado: nuevoEstado });
    if (tema) tema.estado = nuevoEstado;
    ui.aviso(`Tema marcado como "${nuevoEstado}"`, "exito");

    // Actualizar estilos del select
    if (nuevoEstado === "publicado") {
      selectEstado.classList.add("badge-estado--publicado");
      selectEstado.classList.remove("badge-estado--borrador");
    } else {
      selectEstado.classList.add("badge-estado--borrador");
      selectEstado.classList.remove("badge-estado--publicado");
    }
  } catch (err) {
    selectEstado.value = estadoPrevio;
    ui.aviso(err.message || "Error al cambiar estado del tema", "peligro");
  } finally {
    selectEstado.disabled = false;
  }
});

async function intercambiarOrdenTemas(t1, t2) {
  try {
    ui.cargando(true);
    const orden1 = t1.orden || 1;
    const orden2 = t2.orden || 2;
    const nuevoOrden1 = orden1 === orden2 ? orden2 + 1 : orden2;
    const nuevoOrden2 = orden1;

    await Promise.all([
      api.actualizar("temas", t1.id, { orden: nuevoOrden1 }),
      api.actualizar("temas", t2.id, { orden: nuevoOrden2 })
    ]);
    await cargarTemas();
  } catch (err) {
    ui.aviso(err.message || "Error al cambiar orden del tema", "peligro");
  } finally {
    ui.cargando(false);
  }
}

// Botón Agregar Tema
btnNuevoTema.addEventListener("click", () => {
  if (!unidadSeleccionada) return;

  const formNuevoTema = document.createElement("div");
  formNuevoTema.innerHTML = `
    <div class="campo">
      <label for="inputTituloTema">Título del tema *</label>
      <input type="text" id="inputTituloTema" placeholder="Ej. Definición y Principios Contables" required>
      <small style="color: var(--texto-suave);">El tema se creará en tu unidad activa.</small>
    </div>
    <div class="campo" style="margin-top: var(--espacio-s);">
      <label for="inputArchivoTema">Adjuntar material didáctico inicial (PDF o documento opcional)</label>
      <input type="file" id="inputArchivoTema" accept=".pdf,.doc,.docx,.mp3,image/*">
    </div>
  `;

  ui.modal({
    titulo: `Nuevo Tema en "${unidadSeleccionada.titulo}"`,
    contenido: formNuevoTema,
    acciones: [
      { texto: "Cancelar", valor: false, clase: "btn-secundario" },
      { texto: "Crear tema", valor: true, clase: "btn-primario" }
    ]
  }).then(async (guardar) => {
    if (!guardar) return;
    const titulo = formNuevoTema.querySelector("#inputTituloTema").value.trim();
    if (!titulo) {
      ui.aviso("El título del tema es obligatorio", "advertencia");
      return;
    }

    try {
      ui.cargando(true);
      const inputArchivo = formNuevoTema.querySelector("#inputArchivoTema");
      const archivo = inputArchivo?.files?.[0];
      const recursos = [];

      if (archivo) {
        const subida = await api.subir(archivo);
        if (subida?.url) {
          recursos.push({
            tipo: archivo.name.endsWith(".pdf") ? "pdf" : (archivo.type.startsWith("audio") ? "audio" : "doc"),
            titulo: archivo.name.replace(/\.[^/.]+$/, ""),
            url: subida.url
          });
        }
      }

      const maxOrden = temas.length > 0 ? Math.max(...temas.map((t) => t.orden || 0)) : 0;
      await api.crear("temas", {
        unidadId: unidadSeleccionada.id,
        titulo,
        orden: maxOrden + 1,
        objetivos: [],
        resumen: "",
        ejemplos: [],
        erroresFrecuentes: [],
        preguntasGuia: [],
        recursos,
        palabrasClave: [],
        dificultad: "intermedio",
        fuentes: "",
        estado: recursos.length > 0 ? "publicado" : "borrador"
      });
      ui.aviso(recursos.length > 0 ? "Tema creado con material adjunto y publicado" : "Tema creado en estado borrador", "exito");
      await cargarTemas();
    } catch (err) {
      ui.aviso(err.message || "Error al crear el tema", "peligro");
    } finally {
      ui.cargando(false);
    }
  });
});

// Manejador centralizado para subida directa de archivos a unidad o tema
if (inputSubirMaterialContenidos) {
  inputSubirMaterialContenidos.addEventListener("change", async (e) => {
    const archivo = e.target.files?.[0];
    if (!archivo) return;

    try {
      ui.cargando(true);
      const subida = await api.subir(archivo);
      if (!subida?.url) {
        throw new Error("No se pudo obtener la URL del archivo subido");
      }

      const tipo = archivo.name.endsWith(".pdf") ? "pdf" : (archivo.type.startsWith("audio") ? "audio" : "doc");
      const tituloArchivo = archivo.name.replace(/\.[^/.]+$/, "");

      if (temaSeleccionadoParaMaterial) {
        const recursosActuales = Array.isArray(temaSeleccionadoParaMaterial.recursos)
          ? [...temaSeleccionadoParaMaterial.recursos]
          : [];
        recursosActuales.push({
          tipo,
          titulo: tituloArchivo,
          url: subida.url
        });
        await api.actualizar("temas", temaSeleccionadoParaMaterial.id, { recursos: recursosActuales });
        ui.aviso(`Material "${archivo.name}" cargado exitosamente en "${temaSeleccionadoParaMaterial.titulo}"`, "exito");
        await cargarTemas();
      } else if (unidadSeleccionadaParaMaterial) {
        const maxOrden = temas.length > 0 ? Math.max(...temas.map((t) => t.orden || 0)) : 0;
        await api.crear("temas", {
          unidadId: unidadSeleccionadaParaMaterial.id,
          titulo: tituloArchivo,
          orden: maxOrden + 1,
          objetivos: [],
          resumen: `Material pedagógico adjunto: ${archivo.name}`,
          ejemplos: [],
          erroresFrecuentes: [],
          preguntasGuia: [],
          recursos: [{
            tipo,
            titulo: tituloArchivo,
            url: subida.url
          }],
          palabrasClave: [],
          dificultad: "intermedio",
          fuentes: "",
          estado: "publicado"
        });
        ui.aviso(`Material "${archivo.name}" subido e integrado como tema en "${unidadSeleccionadaParaMaterial.titulo}"`, "exito");
        if (unidadSeleccionada?.id === unidadSeleccionadaParaMaterial.id) {
          await cargarTemas();
        } else {
          await seleccionarUnidad(unidadSeleccionadaParaMaterial);
        }
      }
    } catch (err) {
      ui.aviso(err.message || "Error al cargar el material", "peligro");
    } finally {
      ui.cargando(false);
      inputSubirMaterialContenidos.value = "";
      temaSeleccionadoParaMaterial = null;
      unidadSeleccionadaParaMaterial = null;
    }
  });
}

// Inicializar la vista
inicializar();
