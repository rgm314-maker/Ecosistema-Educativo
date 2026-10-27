// publico/js/modulos/editor-tema.js
// Ficha pedagógica de tema y gestión del glosario interactivo con métricas para juegos

import { montarPlantilla } from '../nucleo/plantilla.js';
import * as api from '../nucleo/api.js';
import * as ui from '../nucleo/ui.js';
import { parametro, normalizar, formatoBasico } from '../nucleo/util.js';

await montarPlantilla({ titulo: "Ficha del Tema", roles: ["docente", "admin"] });

const temaId = parametro("id");

if (!temaId) {
  ui.aviso("No se indicó un identificador de tema válido", "peligro");
  setTimeout(() => {
    window.location.href = "/paginas/editor-contenidos.html";
  }, 1200);
}

// Referencias del DOM
const btnVolver = document.getElementById("btnVolver");
const chipEstadoTema = document.getElementById("chipEstadoTema");
const btnGuardarFicha = document.getElementById("btnGuardarFicha");
const btnGuardarFichaInferior = document.getElementById("btnGuardarFichaInferior");
const btnGenerarIA = document.getElementById("btn-generar-ia");
const formFichaTema = document.getElementById("formFichaTema");

const temaTitulo = document.getElementById("temaTitulo");
const temaDificultad = document.getElementById("temaDificultad");
const temaEstado = document.getElementById("temaEstado");
const temaResumen = document.getElementById("temaResumen");
const contadorPalabrasResumen = document.getElementById("contadorPalabrasResumen");
const btnTogglePreviewResumen = document.getElementById("btnTogglePreviewResumen");
const previewResumen = document.getElementById("previewResumen");

const listaObjetivos = document.getElementById("listaObjetivos");
const btnAgregarObjetivo = document.getElementById("btnAgregarObjetivo");

const listaEjemplos = document.getElementById("listaEjemplos");
const btnAgregarEjemplo = document.getElementById("btnAgregarEjemplo");

const listaErrores = document.getElementById("listaErrores");
const btnAgregarError = document.getElementById("btnAgregarError");

const listaPreguntas = document.getElementById("listaPreguntas");
const btnAgregarPregunta = document.getElementById("btnAgregarPregunta");

const listaRecursos = document.getElementById("listaRecursos");
const btnAgregarRecurso = document.getElementById("btnAgregarRecurso");
const btnSubirPdfDirecto = document.getElementById("btnSubirPdfDirecto");
const inputPdfDirecto = document.getElementById("inputPdfDirecto");

const temaPalabrasClave = document.getElementById("temaPalabrasClave");
const temaFuentes = document.getElementById("temaFuentes");

// Glosario
const btnAgregarTermino = document.getElementById("btnAgregarTermino");
const metricaTotalTerminos = document.getElementById("metricaTotalTerminos");
const metricaSeisLetras = document.getElementById("metricaSeisLetras");
const indicadorAptoJuegos = document.getElementById("indicadorAptoJuegos");
const cuerpoTablaGlosario = document.getElementById("cuerpoTablaGlosario");

let temaActual = null;
let glosario = [];
let hayCambios = false;

// Cargar tema y términos
async function cargarDatos() {
  try {
    ui.cargando(true);
    const [tema, todosGlosario] = await Promise.all([
      api.obtener("temas", temaId),
      api.listar("glosario")
    ]);

    temaActual = tema;
    glosario = (todosGlosario || []).filter((g) => g.temaId === temaId);

    poblarFicha(temaActual);
    renderizarGlosario();
    actualizarMetricasGlosario();
    hayCambios = false;
  } catch (err) {
    ui.aviso(err.message || "Error al cargar la ficha del tema", "peligro");
  } finally {
    ui.cargando(false);
  }
}

function contarPalabras(texto) {
  if (!texto) return 0;
  return texto.trim().split(/\s+/).filter(Boolean).length;
}

function actualizarContadorResumen() {
  const palabras = contarPalabras(temaResumen.value);
  const optimo = palabras >= 300 && palabras <= 800;

  contadorPalabrasResumen.className = `contador-palabras ${optimo ? "contador-palabras--optimo" : "contador-palabras--aviso"}`;
  contadorPalabrasResumen.innerHTML = `
    <span>${palabras} palabras ${optimo ? "✓ (Longitud óptima recomendada)" : "(Recomendado: 300 a 800 palabras)"}</span>
  `;
}

function poblarFicha(tema) {
  temaTitulo.value = tema.titulo || "";
  temaDificultad.value = tema.dificultad || "intermedio";
  temaEstado.value = tema.estado || "borrador";
  actualizarChipEstado(tema.estado || "borrador");

  temaResumen.value = tema.resumen || "";
  actualizarContadorResumen();

  poblarListaSimple(listaObjetivos, tema.objetivos || [], "Objetivo de aprendizaje...");
  poblarListaSimple(listaEjemplos, tema.ejemplos || [], "Ejemplo práctico de aplicación...");
  poblarListaSimple(listaErrores, tema.erroresFrecuentes || [], "Error frecuente o malentendido...");
  poblarListaSimple(listaPreguntas, tema.preguntasGuia || [], "Pregunta reflexiva o guía...");

  poblarRecursos(tema.recursos || []);

  temaPalabrasClave.value = Array.isArray(tema.palabrasClave) ? tema.palabrasClave.join(", ") : "";
  temaFuentes.value = tema.fuentes || "";
}

function actualizarChipEstado(estado) {
  chipEstadoTema.textContent = estado === "publicado" ? "Publicado" : "Borrador";
  if (estado === "publicado") {
    chipEstadoTema.className = "chip chip--primario";
  } else {
    chipEstadoTema.className = "chip chip--acento";
  }
}

// Manejo de listas simples (objetivos, ejemplos, errores, preguntas)
function poblarListaSimple(contenedor, items, placeholder) {
  contenedor.innerHTML = "";
  const lista = items.length > 0 ? items : [""];
  lista.forEach((texto) => {
    agregarItemSimple(contenedor, texto, placeholder);
  });
}

function agregarItemSimple(contenedor, valor = "", placeholder = "") {
  const li = document.createElement("li");
  li.className = "item-dinamico";
  li.innerHTML = `
    <input type="text" class="input-item-dinamico" value="${ui.escapar(valor)}" placeholder="${ui.escapar(placeholder)}">
    <button type="button" class="btn-icono btn-quitar-item" title="Eliminar fila" aria-label="Eliminar elemento">✕</button>
  `;

  li.querySelector(".btn-quitar-item").addEventListener("click", () => {
    li.remove();
    hayCambios = true;
  });

  li.querySelector("input").addEventListener("input", () => {
    hayCambios = true;
  });

  contenedor.appendChild(li);
}

function obtenerValoresLista(contenedor) {
  const inputs = contenedor.querySelectorAll(".input-item-dinamico");
  return Array.from(inputs)
    .map((inp) => inp.value.trim())
    .filter(Boolean);
}

// Manejo de Recursos (videos, pdf, imagenes, enlaces)
function poblarRecursos(recursos) {
  listaRecursos.innerHTML = "";
  if (!Array.isArray(recursos) || recursos.length === 0) {
    agregarFilaRecurso();
    return;
  }
  recursos.forEach((rec) => {
    agregarFilaRecurso(rec);
  });
}

function agregarFilaRecurso(rec = { tipo: "pdf", titulo: "", url: "" }) {
  const div = document.createElement("div");
  div.className = "item-recurso";

  div.innerHTML = `
    <div>
      <select class="rec-tipo" style="width: 100%;">
        <option value="pdf" ${rec.tipo === "pdf" ? "selected" : ""}>📄 PDF</option>
        <option value="video" ${rec.tipo === "video" ? "selected" : ""}>🎥 Video</option>
        <option value="imagen" ${rec.tipo === "imagen" ? "selected" : ""}>🖼️ Imagen</option>
        <option value="enlace" ${rec.tipo === "enlace" ? "selected" : ""}>🔗 Enlace</option>
      </select>
    </div>

    <div>
      <input type="text" class="rec-titulo" placeholder="Título descriptivo del recurso" value="${ui.escapar(rec.titulo || "")}">
    </div>

    <div>
      <input type="text" class="rec-url" placeholder="URL o enlace del recurso" value="${ui.escapar(rec.url || "")}">
    </div>

    <div>
      <button type="button" class="btn btn--primario btn--pequeno btn-subir-archivo" title="Subir archivo PDF o imagen desde el equipo">
        📤 Subir
      </button>
      <input type="file" class="oculto input-archivo-recurso" accept=".pdf,application/pdf,image/jpeg,image/png,image/webp">
    </div>

    <div>
      <button type="button" class="btn-icono btn-quitar-item" title="Eliminar recurso">✕</button>
    </div>
  `;

  const tipoSelect = div.querySelector(".rec-tipo");
  const inputTitulo = div.querySelector(".rec-titulo");
  const inputUrl = div.querySelector(".rec-url");
  const btnSubir = div.querySelector(".btn-subir-archivo");
  const inputFile = div.querySelector(".input-archivo-recurso");
  const btnQuitar = div.querySelector(".btn-quitar-item");

  btnSubir.addEventListener("click", () => {
    inputFile.click();
  });

  inputFile.addEventListener("change", async (e) => {
    const archivo = e.target.files?.[0];
    if (!archivo) return;

    try {
      ui.cargando(true);
      const res = await api.subir(archivo);
      if (res?.url) {
        inputUrl.value = res.url;
        // Autoseleccionar tipo según extensión
        const ext = archivo.name.toLowerCase();
        if (ext.endsWith(".pdf")) {
          tipoSelect.value = "pdf";
        } else if (ext.endsWith(".jpg") || ext.endsWith(".jpeg") || ext.endsWith(".png") || ext.endsWith(".webp")) {
          tipoSelect.value = "imagen";
        }
        if (!inputTitulo.value.trim()) {
          inputTitulo.value = archivo.name.replace(/\.[^/.]+$/, "");
        }
        hayCambios = true;
        ui.aviso(`Archivo "${archivo.name}" cargado exitosamente`, "exito");
      }
    } catch (err) {
      ui.aviso(err.message || "Error al subir archivo", "peligro");
    } finally {
      ui.cargando(false);
      inputFile.value = "";
    }
  });

  btnQuitar.addEventListener("click", () => {
    div.remove();
    hayCambios = true;
  });

  div.querySelectorAll("input, select").forEach((el) => {
    el.addEventListener("input", () => { hayCambios = true; });
    el.addEventListener("change", () => { hayCambios = true; });
  });

  listaRecursos.appendChild(div);
}

function obtenerRecursos() {
  const filas = listaRecursos.querySelectorAll(".item-recurso");
  const resultado = [];
  filas.forEach((f) => {
    const tipo = f.querySelector(".rec-tipo").value;
    const titulo = f.querySelector(".rec-titulo").value.trim();
    const url = f.querySelector(".rec-url").value.trim();
    if (titulo || url) {
      resultado.push({ tipo, titulo, url });
    }
  });
  return resultado;
}

// Botones de agregar elementos
btnAgregarObjetivo.addEventListener("click", () => {
  agregarItemSimple(listaObjetivos, "", "Objetivo de aprendizaje...");
  hayCambios = true;
});

btnAgregarEjemplo.addEventListener("click", () => {
  agregarItemSimple(listaEjemplos, "", "Ejemplo práctico de aplicación...");
  hayCambios = true;
});

btnAgregarError.addEventListener("click", () => {
  agregarItemSimple(listaErrores, "", "Error frecuente o malentendido...");
  hayCambios = true;
});

btnAgregarPregunta.addEventListener("click", () => {
  agregarItemSimple(listaPreguntas, "", "Pregunta reflexiva o guía...");
  hayCambios = true;
});

btnAgregarRecurso.addEventListener("click", () => {
  agregarFilaRecurso();
  hayCambios = true;
});

if (btnSubirPdfDirecto && inputPdfDirecto) {
  btnSubirPdfDirecto.addEventListener("click", () => {
    inputPdfDirecto.click();
  });

  inputPdfDirecto.addEventListener("change", async (e) => {
    const archivo = e.target.files?.[0];
    if (!archivo) return;

    try {
      ui.cargando(true);
      const res = await api.subir(archivo);
      if (res?.url) {
        agregarFilaRecurso({
          tipo: "pdf",
          titulo: archivo.name.replace(/\.[^/.]+$/, ""),
          url: res.url
        });
        hayCambios = true;
        ui.aviso(`PDF "${archivo.name}" subido e integrado a los recursos`, "exito");
      }
    } catch (err) {
      ui.aviso(err.message || "Error al subir el archivo PDF", "peligro");
    } finally {
      ui.cargando(false);
      inputPdfDirecto.value = "";
    }
  });
}

// Eventos del formulario
temaResumen.addEventListener("input", () => {
  actualizarContadorResumen();
  hayCambios = true;
});

btnTogglePreviewResumen.addEventListener("click", () => {
  const oculto = previewResumen.classList.toggle("oculto");
  if (!oculto) {
    previewResumen.innerHTML = formatoBasico(temaResumen.value);
    btnTogglePreviewResumen.textContent = "Ocultar previsualización";
  } else {
    btnTogglePreviewResumen.textContent = "Previsualizar formato";
  }
});

temaEstado.addEventListener("change", () => {
  actualizarChipEstado(temaEstado.value);
  hayCambios = true;
});

formFichaTema.addEventListener("input", () => {
  hayCambios = true;
});

// Guardar ficha completa desde cualquiera de sus dos botones.
async function guardarFicha() {
  const titulo = temaTitulo.value.trim();
  const resumen = temaResumen.value.trim();

  if (!titulo) {
    ui.aviso("El título del tema es obligatorio", "advertencia");
    temaTitulo.focus();
    return;
  }

  const datosActualizados = {
    titulo,
    dificultad: temaDificultad.value,
    estado: temaEstado.value,
    resumen,
    objetivos: obtenerValoresLista(listaObjetivos),
    ejemplos: obtenerValoresLista(listaEjemplos),
    erroresFrecuentes: obtenerValoresLista(listaErrores),
    preguntasGuia: obtenerValoresLista(listaPreguntas),
    recursos: obtenerRecursos(),
    palabrasClave: temaPalabrasClave.value
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean),
    fuentes: temaFuentes.value.trim()
  };

  try {
    btnGuardarFicha.disabled = true;
    if (btnGuardarFichaInferior) btnGuardarFichaInferior.disabled = true;
    ui.cargando(true);
    await api.actualizar("temas", temaId, datosActualizados);
    hayCambios = false;
    ui.aviso("Ficha pedagógica guardada con éxito", "exito");
  } catch (err) {
    const mensaje = err.estado === 403
      ? "Tu sesión no tiene asignado este tema. Vuelve a ingresar o solicita al administrador revisar el distributivo."
      : (err.message || "Error al guardar el tema");
    ui.aviso(mensaje, "peligro");
  } finally {
    btnGuardarFicha.disabled = false;
    if (btnGuardarFichaInferior) btnGuardarFichaInferior.disabled = false;
    ui.cargando(false);
  }
}

btnGuardarFicha.addEventListener("click", guardarFicha);
btnGuardarFichaInferior?.addEventListener("click", guardarFicha);

// Navegación segura si hay cambios sin guardar
btnVolver.addEventListener("click", async () => {
  if (hayCambios) {
    const seguro = await ui.confirmar("Tienes cambios sin guardar en la ficha del tema. ¿Deseas salir de todas formas?");
    if (!seguro) return;
  }
  window.location.href = "/paginas/editor-contenidos.html";
});

window.addEventListener("beforeunload", (e) => {
  if (hayCambios) {
    e.preventDefault();
    e.returnValue = "";
  }
});

// ==========================================
// GLOSARIO Y MÉTRICAS PARA GAMIFICACIÓN
// ==========================================

function actualizarMetricasGlosario() {
  const total = glosario.length;
  const seisLetras = glosario.filter((g) => normalizar(g.termino).length === 6).length;

  metricaTotalTerminos.textContent = total;
  metricaSeisLetras.textContent = seisLetras;

  const esApto = total >= 12 && seisLetras >= 3;

  if (esApto) {
    indicadorAptoJuegos.innerHTML = `
      <span class="indicador-apto indicador-apto--si">
        🎮 Apto para juegos (${total} términos, ${seisLetras} de 6 letras)
      </span>
    `;
  } else {
    indicadorAptoJuegos.innerHTML = `
      <span class="indicador-apto indicador-apto--no">
        ⚠️ No apto para juegos (requiere ≥ 12 términos y ≥ 3 de 6 letras)
      </span>
    `;
  }
}

function renderizarGlosario() {
  if (glosario.length === 0) {
    cuerpoTablaGlosario.innerHTML = `
      <tr>
        <td colspan="5" style="text-align: center; color: var(--texto-suave); padding: var(--espacio-l);">
          No hay términos registrados en el glosario para este tema.
        </td>
      </tr>
    `;
    return;
  }

  cuerpoTablaGlosario.innerHTML = glosario
    .map((item) => {
      const longitudNorm = normalizar(item.termino).length;
      const chipLetras = longitudNorm === 6
        ? `<span class="chip chip--primario" style="font-size: 0.7rem; padding: 1px 4px;">6 letras</span>`
        : "";

      return `
        <tr data-id="${ui.escapar(item.id)}">
          <td>
            <strong>${ui.escapar(item.termino)}</strong>
            ${chipLetras}
          </td>
          <td>${ui.escapar(item.definicion)}</td>
          <td><small>${ui.escapar(item.pista || "—")}</small></td>
          <td><small>${ui.escapar(item.retroalimentacion || "—")}</small></td>
          <td style="text-align: right;">
            <div style="display: inline-flex; gap: var(--espacio-xs);">
              <button
                type="button"
                class="btn-icono btn-editar-termino"
                data-id="${ui.escapar(item.id)}"
                title="Editar término"
                aria-label="Editar ${ui.escapar(item.termino)}"
              >✏️</button>
              <button
                type="button"
                class="btn-icono btn-eliminar-termino"
                data-id="${ui.escapar(item.id)}"
                title="Eliminar término"
                aria-label="Eliminar ${ui.escapar(item.termino)}"
              >🗑️</button>
            </div>
          </td>
        </tr>
      `;
    })
    .join("");
}

// Agregar y Editar término en Glosario
btnAgregarTermino.addEventListener("click", () => {
  abrirModalTermino();
});

cuerpoTablaGlosario.addEventListener("click", async (e) => {
  const btnEditar = e.target.closest(".btn-editar-termino");
  const btnEliminar = e.target.closest(".btn-eliminar-termino");

  if (btnEditar) {
    const id = btnEditar.dataset.id;
    const item = glosario.find((g) => g.id === id);
    if (item) abrirModalTermino(item);
    return;
  }

  if (btnEliminar) {
    const id = btnEliminar.dataset.id;
    const item = glosario.find((g) => g.id === id);
    if (!item) return;

    const seguro = await ui.confirmar(`¿Deseas eliminar el término "${item.termino}" del glosario?`);
    if (!seguro) return;

    try {
      ui.cargando(true);
      await api.eliminar("glosario", id);
      glosario = glosario.filter((g) => g.id !== id);
      renderizarGlosario();
      actualizarMetricasGlosario();
      ui.aviso("Término eliminado", "exito");
    } catch (err) {
      ui.aviso(err.message || "Error al eliminar término", "peligro");
    } finally {
      ui.cargando(false);
    }
  }
});

function abrirModalTermino(item = null) {
  const esEdicion = Boolean(item);
  const tituloModal = esEdicion ? "Editar Término del Glosario" : "Nuevo Término del Glosario";

  const formModal = document.createElement("form");
  formModal.className = "pila";
  formModal.noValidate = true;

  formModal.innerHTML = `
    <div class="campo">
      <label for="inputTerminoPalabra">Término (una sola palabra) *</label>
      <input
        type="text"
        id="inputTerminoPalabra"
        required
        value="${ui.escapar(item?.termino || "")}"
        placeholder="Ej. Activo"
      >
      <small style="color: var(--texto-suave);">Debe constar de una sola palabra sin espacios.</small>
    </div>

    <div class="campo">
      <div class="fila" style="justify-content: space-between;">
        <label for="inputTerminoDef">Definición (máximo 25 palabras) *</label>
        <span id="conteoPalabrasDef" style="font-size: var(--texto-xs); color: var(--texto-suave);">0/25 palabras</span>
      </div>
      <textarea id="inputTerminoDef" rows="3" required placeholder="Concepto conciso y preciso...">${ui.escapar(item?.definicion || "")}</textarea>
    </div>

    <div class="campo">
      <div class="fila" style="justify-content: space-between;">
        <label for="inputTerminoPista">Pista para juegos (máximo 10 palabras)</label>
        <span id="conteoPalabrasPista" style="font-size: var(--texto-xs); color: var(--texto-suave);">0/10 palabras</span>
      </div>
      <input
        type="text"
        id="inputTerminoPista"
        value="${ui.escapar(item?.pista || "")}"
        placeholder="Ej. Bienes y derechos que posee la empresa."
      >
    </div>

    <div class="campo">
      <label for="inputTerminoRetro">Retroalimentación pedagógica</label>
      <input
        type="text"
        id="inputTerminoRetro"
        value="${ui.escapar(item?.retroalimentacion || "")}"
        placeholder="Ej. ¡Correcto! Es el conjunto de recursos controlados."
      >
    </div>
  `;

  const inputTermino = formModal.querySelector("#inputTerminoPalabra");
  const inputDef = formModal.querySelector("#inputTerminoDef");
  const inputPista = formModal.querySelector("#inputTerminoPista");
  const conteoDef = formModal.querySelector("#conteoPalabrasDef");
  const conteoPista = formModal.querySelector("#conteoPalabrasPista");

  function actualizarContadoresModal() {
    const numDef = contarPalabras(inputDef.value);
    const numPista = contarPalabras(inputPista.value);

    conteoDef.textContent = `${numDef}/25 palabras`;
    conteoDef.style.color = numDef > 25 ? "var(--error)" : "var(--texto-suave)";

    conteoPista.textContent = `${numPista}/10 palabras`;
    conteoPista.style.color = numPista > 10 ? "var(--error)" : "var(--texto-suave)";
  }

  inputDef.addEventListener("input", actualizarContadoresModal);
  inputPista.addEventListener("input", actualizarContadoresModal);
  actualizarContadoresModal();

  ui.modal({
    titulo: tituloModal,
    contenido: formModal,
    acciones: [
      { texto: "Cancelar", valor: false, clase: "btn-secundario" },
      { texto: esEdicion ? "Guardar cambios" : "Agregar término", valor: true, clase: "btn-primario" }
    ]
  }).then(async (guardar) => {
    if (!guardar) return;

    const termino = inputTermino.value.trim();
    const definicion = inputDef.value.trim();
    const pista = inputPista.value.trim();
    const retroalimentacion = formModal.querySelector("#inputTerminoRetro").value.trim();

    if (!termino || !definicion) {
      ui.aviso("El término y la definición son campos obligatorios", "advertencia");
      return;
    }

    if (termino.split(/\s+/).length > 1) {
      ui.aviso("El término debe constar de una sola palabra", "advertencia");
      return;
    }

    if (contarPalabras(definicion) > 25) {
      ui.aviso("La definición no puede superar las 25 palabras", "advertencia");
      return;
    }

    if (contarPalabras(pista) > 10) {
      ui.aviso("La pista no puede superar las 10 palabras", "advertencia");
      return;
    }

    try {
      ui.cargando(true);
      const datosTermino = {
        temaId,
        termino,
        definicion,
        pista,
        retroalimentacion,
        origen: "docente",
        estado: "aprobado"
      };

      if (esEdicion) {
        const actualizado = await api.actualizar("glosario", item.id, datosTermino);
        const idx = glosario.findIndex((g) => g.id === item.id);
        if (idx !== -1) glosario[idx] = actualizado;
        ui.aviso("Término actualizado correctamente", "exito");
      } else {
        const creado = await api.crear("glosario", datosTermino);
        glosario.push(creado);
        ui.aviso("Término agregado al glosario", "exito");
      }

      renderizarGlosario();
      actualizarMetricasGlosario();
    } catch (err) {
      ui.aviso(err.message || "Error al guardar el término", "peligro");
    } finally {
      ui.cargando(false);
    }
  });
}

function propuestaGlosarioValida(item) {
  return item && typeof item.termino === "string" && item.termino.trim() &&
    !/\s/.test(item.termino.trim()) && typeof item.definicion === "string" &&
    item.definicion.trim();
}

function limitarPalabras(texto, maximo) {
  return String(texto || "").trim().split(/\s+/).filter(Boolean).slice(0, maximo).join(" ");
}

btnGenerarIA.addEventListener("click", async () => {
  try {
    ui.cargando(true);
    const resultado = await api.ia("generar-glosario", { temaId, cantidad: 12 });
    const existentes = new Set(glosario.map((item) => normalizar(item.termino)));
    const listaResultado = Array.isArray(resultado)
      ? resultado
      : (resultado?.terminos || resultado?.propuestas || resultado?.datos || []);
    const propuestas = (Array.isArray(listaResultado) ? listaResultado : [])
      .filter(propuestaGlosarioValida)
      .filter((item) => !existentes.has(normalizar(item.termino)));

    if (propuestas.length === 0) {
      throw new Error("No se generaron términos nuevos válidos para este tema");
    }

    const contenido = document.createElement("div");
    contenido.className = "pila";
    contenido.innerHTML = `
      <p>Revisa las propuestas. Al aprobarlas quedarán disponibles para los juegos del estudiante.</p>
      <div class="tabla-contenedor">
        <table class="tabla">
          <thead><tr><th>Término</th><th>Definición</th><th>Pista</th></tr></thead>
          <tbody>${propuestas.map((item) => `<tr>
            <td><strong>${ui.escapar(item.termino)}</strong></td>
            <td>${ui.escapar(item.definicion)}</td>
            <td>${ui.escapar(item.pista || "—")}</td>
          </tr>`).join("")}</tbody>
        </table>
      </div>`;

    ui.cargando(false);
    const aprobar = await ui.modal({
      titulo: "Material generado para juegos",
      contenido,
      acciones: [
        { texto: "Descartar", valor: false, clase: "btn--secundario" },
        { texto: `Aprobar ${propuestas.length} términos`, valor: true, clase: "btn--primario" }
      ]
    });
    if (!aprobar) return;

    ui.cargando(true);
    const creados = [];
    for (const item of propuestas) {
      creados.push(await api.crear("glosario", {
        temaId,
        termino: item.termino.trim(),
        definicion: limitarPalabras(item.definicion, 25),
        pista: limitarPalabras(item.pista, 10),
        retroalimentacion: String(item.retroalimentacion || "").trim(),
        origen: "ia",
        estado: "aprobado"
      }));
    }
    glosario.push(...creados);
    renderizarGlosario();
    actualizarMetricasGlosario();
    ui.aviso(`${creados.length} términos aprobados; los juegos ya pueden utilizarlos`, "exito");
  } catch (err) {
    ui.aviso(err.message || "No se pudo generar material para los juegos", "peligro");
  } finally {
    ui.cargando(false);
  }
});

// Carga inicial
cargarDatos();
