// publico/js/modulos/editor-cancion.js
// Editor de canciones educativas para docentes y administradores

import { montarPlantilla } from "../nucleo/plantilla.js";
import { usuarioActual } from "../nucleo/sesion.js";
import * as api from "../nucleo/api.js";
import * as ui from "../nucleo/ui.js";
import * as util from "../nucleo/util.js";

await montarPlantilla({
  titulo: "Editor de Canción",
  roles: ["docente", "admin"]
});

const usuario = usuarioActual() || {};
const contenedor = document.getElementById("contenido");
const cancionId = util.parametro("id");

let temasPermitidos = [];
let cancionOriginal = null;

async function iniciar() {
  try {
    ui.cargando(true);

    // Carga paralela de asignaturas, unidades, temas y distributivo
    const [asignaturas, unidades, temas, distributivo] = await Promise.all([
      api.listar("asignaturas"),
      api.listar("unidades"),
      api.listar("temas"),
      api.listar("distributivo")
    ]);

    // Determinar qué asignaturas puede editar el usuario
    let idsAsignaturasEditables = new Set();
    if (usuario.rol === "admin") {
      idsAsignaturasEditables = new Set(asignaturas.map((a) => a.id));
    } else {
      const misGrupos = distributivo.filter((g) => g.docenteId === usuario.id);
      idsAsignaturasEditables = new Set(misGrupos.map((g) => g.asignaturaId));
    }

    // Filtrar temas que pertenecen a esas asignaturas
    const mapaAsignaturas = new Map(asignaturas.map((a) => [a.id, a.nombre]));
    const mapaUnidades = new Map(unidades.map((u) => [u.id, u]));

    temasPermitidos = temas
      .filter((t) => {
        const u = mapaUnidades.get(t.unidadId);
        return u && idsAsignaturasEditables.has(u.asignaturaId);
      })
      .map((t) => {
        const u = mapaUnidades.get(t.unidadId);
        const asigNombre = mapaAsignaturas.get(u?.asignaturaId) || "Asignatura";
        return {
          id: t.id,
          titulo: t.titulo,
          etiqueta: `${asigNombre} > ${u.titulo} > ${t.titulo}`
        };
      });

    if (cancionId) {
      cancionOriginal = await api.obtener("canciones", cancionId);
    }
  } catch (err) {
    ui.aviso(err.message || "Error al cargar recursos", "error");
  } finally {
    ui.cargando(false);
  }

  renderizarFormulario();
  vincularEventos();
}

function renderizarFormulario() {
  const esEdicion = Boolean(cancionOriginal);
  const c = cancionOriginal || {
    titulo: "",
    temaId: "",
    audio: "",
    letra: "",
    lrc: "",
    autoria: "",
    licencia: "Propia"
  };

  const licenciasEstandar = ["Propia", "CC BY", "CC BY-SA"];
  const esLicenciaOtra = c.licencia && !licenciasEstandar.includes(c.licencia);
  const valorSelectLicencia = esLicenciaOtra ? "Otra" : (c.licencia || "Propia");

  const opcionesTemas = temasPermitidos.length > 0
    ? temasPermitidos.map(
        (t) => `<option value="${ui.escapar(t.id)}"${c.temaId === t.id ? " selected" : ""}>${ui.escapar(t.etiqueta)}</option>`
      ).join("")
    : '<option value="">(No tienes asignaturas o temas disponibles)</option>';

  contenedor.innerHTML = `
    <div class="fila" style="justify-content: space-between; margin-bottom: var(--espacio-l); flex-wrap: wrap; gap: var(--espacio-m);">
      <div>
        <h1 style="margin: 0;">${esEdicion ? "Editar Canción Educativa" : "Nueva Canción Educativa"}</h1>
        <p style="color: var(--texto-suave); margin: 0;">Vincula música y letra a tus temas de estudio para facilitar el aprendizaje</p>
      </div>
      <div class="fila" style="gap: var(--espacio-s);">
        <a href="/paginas/canciones.html" class="btn btn--secundario">Volver a canciones</a>
        <button type="button" id="btnGuardarArriba" class="btn btn--primario">Guardar canción</button>
      </div>
    </div>

    <form id="formCancion" class="editor-cancion-form pila">
      <!-- Título -->
      <div class="campo">
        <label for="inputTitulo"><strong>Título de la canción *</strong></label>
        <input type="text" id="inputTitulo" class="input" required value="${ui.escapar(c.titulo)}" placeholder="Ej: La rima de los elementos químicos">
      </div>

      <!-- Tema relacionado -->
      <div class="campo">
        <label for="selectTema"><strong>Tema de estudio relacionado *</strong></label>
        <select id="selectTema" class="input" required>
          <option value="">Selecciona un tema...</option>
          ${opcionesTemas}
        </select>
      </div>

      <!-- Archivo de audio MP3 -->
      <div class="campo">
        <label for="inputAudio"><strong>Audio MP3 *</strong></label>
        <div class="zona-subida-audio">
          <input type="url" id="inputAudio" class="input" style="flex: 1;" required value="${ui.escapar(c.audio)}" placeholder="URL del audio o sube un archivo MP3">
          <button type="button" id="btnSubirAudio" class="btn btn--secundario" title="Subir archivo MP3">
            📁 Subir MP3
          </button>
          <input type="file" id="archivoAudio" class="oculto" accept="audio/mpeg,audio/mp3,.mp3">
        </div>
        <div id="cajaPreviaAudio" class="previa-audio-caja${c.audio ? "" : " oculto"}">
          <span style="font-size: var(--texto-xs); font-weight: var(--peso-negrita);">Comprobación de audio:</span>
          <audio id="audioPrevia" controls src="${ui.escapar(c.audio || "")}"></audio>
        </div>
      </div>

      <!-- Letras (estándar y LRC) -->
      <div class="editor-grid-letras">
        <div class="campo">
          <label for="textareaLetra">
            <strong>Letra de la canción *</strong>
            <small style="display: block; color: var(--texto-suave);">Texto plano legible de estrofas y coros.</small>
          </label>
          <textarea id="textareaLetra" class="input" rows="12" required placeholder="Escribe o pega aquí la letra completa de la canción...">${ui.escapar(c.letra || "")}</textarea>
        </div>

        <div class="campo">
          <label for="textareaLrc">
            <strong>Letra sincronizada LRC (opcional)</strong>
            <small style="display: block; color: var(--texto-suave);">Formato [mm:ss.xx] para resaltar en tiempo real.</small>
          </label>
          <textarea id="textareaLrc" class="input" rows="12" style="font-family: monospace; font-size: var(--texto-xs);" placeholder="[00:04.20] Primera línea de la estrofa&#10;[00:08.50] Segunda línea cantada&#10;[00:14.00] Coro...">${ui.escapar(c.lrc || "")}</textarea>
        </div>
      </div>

      <!-- Autoría y Licencia -->
      <div class="fila" style="gap: var(--espacio-l); align-items: flex-start; flex-wrap: wrap;">
        <div class="campo" style="flex: 1; min-width: 240px;">
          <label for="inputAutoria"><strong>Autoría *</strong></label>
          <input type="text" id="inputAutoria" class="input" required value="${ui.escapar(c.autoria)}" placeholder="Ej: Prof. Carlos Morales / Grupo de Ciencias">
        </div>

        <div class="campo" style="flex: 1; min-width: 240px;">
          <label for="selectLicencia"><strong>Licencia *</strong></label>
          <select id="selectLicencia" class="input" required>
            <option value="Propia"${valorSelectLicencia === "Propia" ? " selected" : ""}>Propia (del autor o institución)</option>
            <option value="CC BY"${valorSelectLicencia === "CC BY" ? " selected" : ""}>Creative Commons Atribución (CC BY)</option>
            <option value="CC BY-SA"${valorSelectLicencia === "CC BY-SA" ? " selected" : ""}>Creative Commons CompartirIgual (CC BY-SA)</option>
            <option value="Otra"${valorSelectLicencia === "Otra" ? " selected" : ""}>Otra (especificar)</option>
          </select>
        </div>
      </div>

      <!-- Campo condicional para otra licencia -->
      <div id="campoOtraLicencia" class="campo${esLicenciaOtra ? "" : " oculto"}">
        <label for="inputOtraLicencia"><strong>Descripción de la licencia *</strong></label>
        <input type="text" id="inputOtraLicencia" class="input" value="${esLicenciaOtra ? ui.escapar(c.licencia) : ""}" placeholder="Ej: Dominio público, Autorización expresa con fines didácticos, etc.">
      </div>

      <div class="fila" style="justify-content: flex-end; gap: var(--espacio-s); margin-top: var(--espacio-m); border-top: var(--borde-fino) solid var(--borde); padding-top: var(--espacio-m);">
        <a href="/paginas/canciones.html" class="btn btn--secundario">Cancelar</a>
        <button type="submit" id="btnGuardarAbajo" class="btn btn--primario">Guardar canción</button>
      </div>
    </form>
  `;
}

function vincularEventos() {
  const formCancion = document.getElementById("formCancion");
  const btnGuardarArriba = document.getElementById("btnGuardarArriba");
  const inputAudio = document.getElementById("inputAudio");
  const btnSubirAudio = document.getElementById("btnSubirAudio");
  const archivoAudio = document.getElementById("archivoAudio");
  const audioPrevia = document.getElementById("audioPrevia");
  const cajaPreviaAudio = document.getElementById("cajaPreviaAudio");
  const selectLicencia = document.getElementById("selectLicencia");
  const campoOtraLicencia = document.getElementById("campoOtraLicencia");
  const inputOtraLicencia = document.getElementById("inputOtraLicencia");

  // Actualizar reproductor de previa al cambiar URL
  inputAudio.addEventListener("input", () => {
    const url = inputAudio.value.trim();
    if (url) {
      audioPrevia.src = url;
      cajaPreviaAudio.classList.remove("oculto");
    } else {
      audioPrevia.removeAttribute("src");
      cajaPreviaAudio.classList.add("oculto");
    }
  });

  // Subir archivo MP3
  btnSubirAudio.addEventListener("click", () => {
    archivoAudio.click();
  });

  archivoAudio.addEventListener("change", async (e) => {
    const archivo = e.target.files?.[0];
    if (!archivo) return;

    try {
      ui.cargando(true);
      const res = await api.subir(archivo);
      if (res?.url) {
        inputAudio.value = res.url;
        audioPrevia.src = res.url;
        cajaPreviaAudio.classList.remove("oculto");
        ui.aviso("Audio MP3 subido con éxito", "exito");
      }
    } catch (err) {
      ui.aviso(err.message || "Error al subir el audio MP3", "error");
    } finally {
      ui.cargando(false);
      archivoAudio.value = "";
    }
  });

  // Conmutar campo otra licencia
  selectLicencia.addEventListener("change", () => {
    if (selectLicencia.value === "Otra") {
      campoOtraLicencia.classList.remove("oculto");
      inputOtraLicencia.setAttribute("required", "required");
      inputOtraLicencia.focus();
    } else {
      campoOtraLicencia.classList.add("oculto");
      inputOtraLicencia.removeAttribute("required");
    }
  });

  // Guardar desde botón superior o submit
  btnGuardarArriba?.addEventListener("click", guardarCancion);
  formCancion?.addEventListener("submit", (e) => {
    e.preventDefault();
    guardarCancion();
  });
}

async function guardarCancion() {
  const titulo = document.getElementById("inputTitulo").value.trim();
  const temaId = document.getElementById("selectTema").value;
  const audio = document.getElementById("inputAudio").value.trim();
  const letra = document.getElementById("textareaLetra").value.trim();
  const lrc = document.getElementById("textareaLrc").value.trim();
  const autoria = document.getElementById("inputAutoria").value.trim();
  const selectLicencia = document.getElementById("selectLicencia").value;
  const inputOtraLicencia = document.getElementById("inputOtraLicencia").value.trim();

  if (!titulo) {
    ui.aviso("El título de la canción es obligatorio", "error");
    document.getElementById("inputTitulo").focus();
    return;
  }

  if (!temaId) {
    ui.aviso("Debes seleccionar un tema de estudio", "error");
    document.getElementById("selectTema").focus();
    return;
  }

  if (!audio) {
    ui.aviso("El archivo de audio MP3 es obligatorio", "error");
    document.getElementById("inputAudio").focus();
    return;
  }

  if (!letra) {
    ui.aviso("La letra de la canción es obligatoria", "error");
    document.getElementById("textareaLetra").focus();
    return;
  }

  if (!autoria) {
    ui.aviso("La autoría de la canción es obligatoria", "error");
    document.getElementById("inputAutoria").focus();
    return;
  }

  let licenciaFinal = selectLicencia;
  if (selectLicencia === "Otra") {
    if (!inputOtraLicencia) {
      ui.aviso("Debes especificar la descripción de la licencia", "error");
      document.getElementById("inputOtraLicencia").focus();
      return;
    }
    licenciaFinal = inputOtraLicencia;
  }

  const payload = {
    titulo,
    temaId,
    audio,
    letra,
    lrc,
    autoria,
    licencia: licenciaFinal
  };

  try {
    ui.cargando(true);
    if (cancionId) {
      await api.actualizar("canciones", cancionId, payload);
      ui.aviso("Canción actualizada exitosamente", "exito");
    } else {
      await api.crear("canciones", payload);
      ui.aviso("Canción creada exitosamente", "exito");
    }

    setTimeout(() => {
      window.location.href = "/paginas/canciones.html";
    }, 600);
  } catch (err) {
    ui.aviso(err.message || "Error al guardar la canción", "error");
  } finally {
    ui.cargando(false);
  }
}

iniciar();
