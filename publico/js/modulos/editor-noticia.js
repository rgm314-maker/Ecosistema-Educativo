// publico/js/modulos/editor-noticia.js
// Editor de noticias para docentes y administradores

import { montarPlantilla } from "../nucleo/plantilla.js";
import { usuarioActual } from "../nucleo/sesion.js";
import * as api from "../nucleo/api.js";
import * as ui from "../nucleo/ui.js";
import * as util from "../nucleo/util.js";

await montarPlantilla({
  titulo: "Editor de noticia",
  roles: ["docente", "admin"]
});

const usuario = usuarioActual() || {};

const contenedor = document.getElementById("contenido");
const noticiaId = util.parametro("id");
let temasDisponibles = [];
let noticiaOriginal = null;

// Categorías válidas del sistema
const CATEGORIAS = ["Institucional", "Académica", "Eventos", "Logros"];

async function iniciar() {
  try {
    ui.cargando(true);
    temasDisponibles = await api.listar("temas");
    if (noticiaId) {
      noticiaOriginal = await api.obtener("noticias", noticiaId);
    }
  } catch (err) {
    ui.aviso(err.message || "Error al cargar datos", "error");
  } finally {
    ui.cargando(false);
  }

  renderizarInterfaz();
  vincularEventos();
  actualizarVistaPrevia();
}

function renderizarInterfaz() {
  const esEdicion = Boolean(noticiaOriginal);
  const n = noticiaOriginal || {
    titulo: "",
    resumen: "",
    cuerpo: "",
    imagen: "",
    categoria: "Institucional",
    temaId: "",
    destacada: false,
    estado: "publicado"
  };

  const opcionesCategorias = CATEGORIAS.map(
    (cat) => `<option value="${ui.escapar(cat)}"${n.categoria === cat ? " selected" : ""}>${ui.escapar(cat)}</option>`
  ).join("");

  const opcionesTemas = [
    '<option value="">Ninguno (noticia general)</option>',
    ...temasDisponibles.map(
      (t) => `<option value="${ui.escapar(t.id)}"${n.temaId === t.id ? " selected" : ""}>${ui.escapar(t.titulo)}</option>`
    )
  ].join("");

  contenedor.innerHTML = `
    <div class="fila" style="justify-content: space-between; margin-bottom: var(--espacio-l);">
      <div>
        <h1 style="margin: 0;">${esEdicion ? "Editar noticia" : "Nueva noticia"}</h1>
        <p style="color: var(--texto-suave); margin: 0;">Redacta y publica novedades institucionales o académicas</p>
      </div>
      <div class="fila" style="gap: var(--espacio-s);">
        <a href="/paginas/noticias.html" class="btn btn--secundario">Volver al listado</a>
        <button type="button" id="btnGuardar" class="btn btn--primario">Guardar noticia</button>
      </div>
    </div>

    <div class="editor-noticia-grid">
      <!-- Formulario -->
      <form id="formNoticia" class="editor-formulario pila" onsubmit="return false;">
        <div class="campo">
          <label for="inputTitulo"><strong>Título de la noticia *</strong></label>
          <input type="text" id="inputTitulo" class="input" required value="${ui.escapar(n.titulo)}" placeholder="Ej: Nueva feria científica 2026">
        </div>

        <div class="campo">
          <label for="selectCategoria"><strong>Categoría *</strong></label>
          <select id="selectCategoria" class="input">
            ${opcionesCategorias}
          </select>
        </div>

        <div class="campo">
          <label for="selectTema"><strong>Tema relacionado (opcional)</strong></label>
          <select id="selectTema" class="input">
            ${opcionesTemas}
          </select>
        </div>

        <div class="campo">
          <label for="inputResumen"><strong>Resumen (hasta 200 caracteres) *</strong></label>
          <textarea id="inputResumen" class="input" rows="3" maxlength="200" placeholder="Breve síntesis de la noticia para el listado...">${ui.escapar(n.resumen)}</textarea>
          <div id="contadorResumen" class="contador-caracteres">0 / 200 caracteres</div>
        </div>

        <div class="campo">
          <label for="inputImagen"><strong>Imagen destacada (URL o archivo)</strong></label>
          <div class="zona-subida-imagen">
            <input type="url" id="inputImagen" class="input" style="flex: 1;" value="${ui.escapar(n.imagen || "")}" placeholder="https://ejemplo.com/imagen.jpg o sube un archivo">
            <button type="button" id="btnSubirImagen" class="btn btn--secundario" title="Subir imagen desde tu equipo">
              📁 Subir
            </button>
            <input type="file" id="archivoImagen" class="oculto" accept="image/png,image/jpeg,image/webp,image/gif">
          </div>
        </div>

        <div class="campo">
          <label for="textareaCuerpo">
            <strong>Cuerpo de la noticia *</strong>
            <small style="display: block; color: var(--texto-suave);">Usa párrafos separados, **negrita** para resaltar y listas con guión "- ".</small>
          </label>
          <textarea id="textareaCuerpo" class="input" rows="10" placeholder="Escribe el contenido completo de la noticia...">${ui.escapar(n.cuerpo || "")}</textarea>
        </div>

        <div class="fila" style="gap: var(--espacio-l); align-items: center; border-top: var(--borde-fino) solid var(--borde); padding-top: var(--espacio-m);">
          <div class="campo" style="flex: 1;">
            <label for="selectEstado"><strong>Estado de publicación</strong></label>
            <select id="selectEstado" class="input">
              <option value="borrador"${n.estado === "borrador" ? " selected" : ""}>Borrador (solo visible para docentes y admin)</option>
              <option value="publicado"${n.estado === "publicado" ? " selected" : ""}>Publicado (visible para todos los usuarios)</option>
            </select>
          </div>

          <label class="fila" style="gap: var(--espacio-xs); cursor: pointer; user-select: none;">
            <input type="checkbox" id="checkDestacada"${n.destacada ? " checked" : ""}>
            <span><strong>Marcar como destacada</strong> (aparecerá al inicio)</span>
          </label>
        </div>

        <div class="fila" style="justify-content: flex-end; gap: var(--espacio-s); margin-top: var(--espacio-m); border-top: var(--borde-fino) solid var(--borde); padding-top: var(--espacio-m);">
          <a href="/paginas/noticias.html" class="btn btn--secundario">Cancelar</a>
          <button type="submit" id="btnGuardarAbajo" class="btn btn--primario">Guardar noticia</button>
        </div>
      </form>

      <!-- Panel de Vista Previa -->
      <aside class="editor-previa-contenedor">
        <div class="previa-cabecera">
          <h2 style="margin: 0; font-size: var(--texto-m);">Vista previa</h2>
          <span id="badgePreviaEstado" class="chip">Borrador</span>
        </div>

        <div id="contenedorPrevia" class="pila">
          <img id="previaImg" class="previa-imagen oculto" alt="Vista previa de imagen">
          <div class="fila" style="gap: var(--espacio-xs);">
            <span id="previaCategoria" class="chip chip--primario">Categoría</span>
            <span id="previaDestacada" class="chip chip--acento oculto">★ Destacada</span>
            <span id="previaTema" class="chip oculto">Tema</span>
          </div>
          <h3 id="previaTitulo" style="margin: 0; font-size: var(--texto-xl); color: var(--primario);">Título de la noticia</h3>
          <p id="previaResumen" style="font-weight: var(--peso-medio); color: var(--texto-suave); font-style: italic; margin: 0;"></p>
          <div id="previaCuerpo" class="previa-cuerpo"></div>
        </div>
      </aside>
    </div>
  `;
}

function vincularEventos() {
  const inputTitulo = document.getElementById("inputTitulo");
  const inputResumen = document.getElementById("inputResumen");
  const contadorResumen = document.getElementById("contadorResumen");
  const textareaCuerpo = document.getElementById("textareaCuerpo");
  const inputImagen = document.getElementById("inputImagen");
  const selectCategoria = document.getElementById("selectCategoria");
  const selectTema = document.getElementById("selectTema");
  const selectEstado = document.getElementById("selectEstado");
  const checkDestacada = document.getElementById("checkDestacada");
  const btnSubirImagen = document.getElementById("btnSubirImagen");
  const archivoImagen = document.getElementById("archivoImagen");
  const btnGuardar = document.getElementById("btnGuardar");

  // Contador de caracteres para el resumen
  const actualizarContador = () => {
    const cant = inputResumen.value.length;
    contadorResumen.textContent = `${cant} / 200 caracteres`;
    if (cant > 200) {
      contadorResumen.classList.add("excedido");
    } else {
      contadorResumen.classList.remove("excedido");
    }
  };

  inputResumen.addEventListener("input", () => {
    actualizarContador();
    actualizarVistaPrevia();
  });
  actualizarContador();

  // Actualizaciones de vista previa en tiempo real
  [inputTitulo, textareaCuerpo, inputImagen, selectCategoria, selectTema, selectEstado, checkDestacada].forEach((elem) => {
    elem.addEventListener("input", actualizarVistaPrevia);
    elem.addEventListener("change", actualizarVistaPrevia);
  });

  // Subida de imagen
  btnSubirImagen.addEventListener("click", () => {
    archivoImagen.click();
  });

  archivoImagen.addEventListener("change", async (e) => {
    const archivo = e.target.files?.[0];
    if (!archivo) return;

    try {
      ui.cargando(true);
      const res = await api.subir(archivo);
      if (res?.url) {
        inputImagen.value = res.url;
        actualizarVistaPrevia();
        ui.aviso("Imagen subida con éxito", "exito");
      }
    } catch (err) {
      ui.aviso(err.message || "Error al subir la imagen", "error");
    } finally {
      ui.cargando(false);
      archivoImagen.value = "";
    }
  });

  // Guardar noticia
  btnGuardar?.addEventListener("click", guardarNoticia);
  const formNoticia = document.getElementById("formNoticia");
  formNoticia?.addEventListener("submit", (e) => {
    e.preventDefault();
    guardarNoticia();
  });
}

function actualizarVistaPrevia() {
  const inputTitulo = document.getElementById("inputTitulo");
  const inputResumen = document.getElementById("inputResumen");
  const textareaCuerpo = document.getElementById("textareaCuerpo");
  const inputImagen = document.getElementById("inputImagen");
  const selectCategoria = document.getElementById("selectCategoria");
  const selectTema = document.getElementById("selectTema");
  const selectEstado = document.getElementById("selectEstado");
  const checkDestacada = document.getElementById("checkDestacada");

  const previaTitulo = document.getElementById("previaTitulo");
  const previaResumen = document.getElementById("previaResumen");
  const previaCuerpo = document.getElementById("previaCuerpo");
  const previaImg = document.getElementById("previaImg");
  const previaCategoria = document.getElementById("previaCategoria");
  const previaDestacada = document.getElementById("previaDestacada");
  const previaTema = document.getElementById("previaTema");
  const badgePreviaEstado = document.getElementById("badgePreviaEstado");

  if (!previaTitulo) return;

  previaTitulo.textContent = inputTitulo.value.trim() || "Título de la noticia";
  previaResumen.textContent = inputResumen.value.trim() || "";

  if (inputImagen.value.trim()) {
    previaImg.src = inputImagen.value.trim();
    previaImg.classList.remove("oculto");
  } else {
    previaImg.classList.add("oculto");
    previaImg.removeAttribute("src");
  }

  previaCategoria.textContent = selectCategoria.value;

  if (checkDestacada.checked) {
    previaDestacada.classList.remove("oculto");
  } else {
    previaDestacada.classList.add("oculto");
  }

  const temaSelId = selectTema.value;
  if (temaSelId) {
    const t = temasDisponibles.find((x) => x.id === temaSelId);
    previaTema.textContent = t ? `Tema: ${t.titulo}` : "Tema relacionado";
    previaTema.classList.remove("oculto");
  } else {
    previaTema.classList.add("oculto");
  }

  badgePreviaEstado.textContent = selectEstado.value === "publicado" ? "Publicado" : "Borrador";
  badgePreviaEstado.className = `chip ${selectEstado.value === "publicado" ? "chip--primario" : ""}`;

  previaCuerpo.innerHTML = util.formatoBasico(textareaCuerpo.value.trim() || "*(Sin cuerpo redactado aún)*");
}

async function guardarNoticia() {
  const titulo = document.getElementById("inputTitulo").value.trim();
  const resumen = document.getElementById("inputResumen").value.trim();
  const cuerpo = document.getElementById("textareaCuerpo").value.trim();
  const imagen = document.getElementById("inputImagen").value.trim();
  const categoria = document.getElementById("selectCategoria").value;
  const temaId = document.getElementById("selectTema").value || null;
  const estado = document.getElementById("selectEstado").value;
  const destacada = document.getElementById("checkDestacada").checked;

  if (!titulo) {
    ui.aviso("El título de la noticia es obligatorio", "error");
    document.getElementById("inputTitulo").focus();
    return;
  }

  if (!resumen) {
    ui.aviso("El resumen de la noticia es obligatorio", "error");
    document.getElementById("inputResumen").focus();
    return;
  }

  if (resumen.length > 200) {
    ui.aviso("El resumen no puede superar los 200 caracteres", "error");
    document.getElementById("inputResumen").focus();
    return;
  }

  if (!cuerpo) {
    ui.aviso("El cuerpo de la noticia es obligatorio", "error");
    document.getElementById("textareaCuerpo").focus();
    return;
  }

  const payload = {
    titulo,
    resumen,
    cuerpo,
    imagen,
    categoria,
    temaId,
    destacada,
    estado
  };

  try {
    ui.cargando(true);
    if (noticiaId) {
      await api.actualizar("noticias", noticiaId, payload);
      ui.aviso("Noticia actualizada exitosamente", "exito");
    } else {
      await api.crear("noticias", payload);
      ui.aviso("Noticia creada exitosamente", "exito");
    }

    setTimeout(() => {
      window.location.href = "/paginas/noticias.html";
    }, 600);
  } catch (err) {
    ui.aviso(err.message || "Error al guardar la noticia", "error");
  } finally {
    ui.cargando(false);
  }
}

iniciar();
