// publico/js/modulos/perfil.js
// Gestión de perfil de usuario, fotografía y cambio de contraseña

import { montarPlantilla } from '../nucleo/plantilla.js';
import * as api from '../nucleo/api.js';
import * as ui from '../nucleo/ui.js';
import * as util from '../nucleo/util.js';
import { usuarioActual } from '../nucleo/sesion.js';
import { logrosDe } from '../nucleo/gamificacion.js';
import { generarDiploma } from '../nucleo/pdf.js';

await montarPlantilla({ titulo: "Mi perfil", roles: ["sesion"] });

// Referencias del DOM
const formPerfil = document.getElementById("formPerfil");
const formClave = document.getElementById("formClave");

const avatarContenedor = document.getElementById("avatarContenedor");
const avatarIcono = document.getElementById("avatarIcono");
const avatarImg = document.getElementById("avatarImg");
const campoArchivoFoto = document.getElementById("campoArchivoFoto");
const errorFoto = document.getElementById("errorFoto");

const campoNombre = document.getElementById("campoNombre");
const campoApellido = document.getElementById("campoApellido");
const campoCorreo = document.getElementById("campoCorreo");
const campoRol = document.getElementById("campoRol");
const btnGuardarPerfil = document.getElementById("btnGuardarPerfil");

const errorNombre = document.getElementById("errorNombre");
const errorApellido = document.getElementById("errorApellido");

const claveActual = document.getElementById("claveActual");
const claveNueva = document.getElementById("claveNueva");
const claveRepetir = document.getElementById("claveRepetir");
const btnCambiarClave = document.getElementById("btnCambiarClave");

const errorClaveActual = document.getElementById("errorClaveActual");
const errorClaveNueva = document.getElementById("errorClaveNueva");
const errorClaveRepetir = document.getElementById("errorClaveRepetir");

let fotoActual = "";

function actualizarAvatar(url) {
  if (url) {
    avatarImg.src = url;
    avatarImg.classList.remove("oculto");
    avatarIcono.classList.add("oculto");
  } else {
    avatarImg.src = "";
    avatarImg.classList.add("oculto");
    avatarIcono.classList.remove("oculto");
  }
}

// Cargar datos actuales del usuario
async function cargarDatosPerfil() {
  try {
    ui.cargando(true);
    const usuario = await api.llamar("GET", "/api/auth/yo");
    campoNombre.value = usuario.nombre || "";
    campoApellido.value = usuario.apellido || "";
    campoCorreo.value = usuario.correo || "";
    campoRol.value = usuario.rol || "";
    fotoActual = usuario.foto || "";
    actualizarAvatar(fotoActual);
  } catch (err) {
    ui.aviso(err.message || "Error al cargar datos del perfil", "peligro");
  } finally {
    ui.cargando(false);
  }
}

// Manejar selección y subida de fotografía
campoArchivoFoto.addEventListener("change", async (e) => {
  const archivo = e.target.files?.[0];
  if (!archivo) return;

  errorFoto.textContent = "";
  errorFoto.classList.add("oculto");

  // Validación de tipo y peso en cliente
  const tiposValidos = ["image/jpeg", "image/png", "image/webp"];
  if (!tiposValidos.includes(archivo.type)) {
    errorFoto.textContent = "Formato no válido. Solo JPG, PNG o WEBP.";
    errorFoto.classList.remove("oculto");
    campoArchivoFoto.value = "";
    return;
  }

  if (archivo.size > 2 * 1024 * 1024) {
    errorFoto.textContent = "La imagen supera el límite de 2 MB.";
    errorFoto.classList.remove("oculto");
    campoArchivoFoto.value = "";
    return;
  }

  try {
    ui.cargando(true);
    const res = await api.subir(archivo);
    if (res?.url) {
      fotoActual = res.url;
      actualizarAvatar(fotoActual);
      ui.aviso("Foto subida correctamente. Guarda los cambios para confirmar.", "info");
    }
  } catch (err) {
    errorFoto.textContent = err.message || "Error al subir la imagen";
    errorFoto.classList.remove("oculto");
  } finally {
    ui.cargando(false);
  }
});

// Guardar cambios en perfil (nombre, apellido, foto)
formPerfil.addEventListener("submit", async (e) => {
  e.preventDefault();

  const nombre = campoNombre.value.trim();
  const apellido = campoApellido.value.trim();

  let valido = true;

  if (!nombre) {
    errorNombre.classList.remove("oculto");
    valido = false;
  } else {
    errorNombre.classList.add("oculto");
  }

  if (!apellido) {
    errorApellido.classList.remove("oculto");
    valido = false;
  } else {
    errorApellido.classList.add("oculto");
  }

  if (!valido) return;

  try {
    btnGuardarPerfil.disabled = true;
    ui.cargando(true);

    const respuesta = await api.llamar("PUT", "/api/auth/perfil", {
      nombre,
      apellido,
      foto: fotoActual
    });

    // Actualizar usuario en sessionStorage
    try {
      const usuarioGuardado = JSON.parse(sessionStorage.getItem("usuario") || "{}");
      usuarioGuardado.nombre = respuesta.nombre || nombre;
      usuarioGuardado.apellido = respuesta.apellido || apellido;
      if (respuesta.foto !== undefined) {
        usuarioGuardado.foto = respuesta.foto;
      }
      sessionStorage.setItem("usuario", JSON.stringify(usuarioGuardado));
    } catch (_) {}

    ui.aviso("Perfil actualizado correctamente", "exito");
  } catch (err) {
    ui.aviso(err.message || "Error al actualizar perfil", "peligro");
  } finally {
    btnGuardarPerfil.disabled = false;
    ui.cargando(false);
  }
});

// Validaciones en vivo para cambio de contraseña
function validarClaveNueva() {
  const v = claveNueva.value;
  const esValida = v.length >= 8 && /[a-zA-Z]/.test(v) && /\d/.test(v);
  if (!esValida && v.length > 0) {
    errorClaveNueva.classList.remove("oculto");
  } else {
    errorClaveNueva.classList.add("oculto");
  }
  return esValida;
}

function validarClaveRepetir() {
  const coincide = claveRepetir.value === claveNueva.value;
  if (!coincide && claveRepetir.value.length > 0) {
    errorClaveRepetir.classList.remove("oculto");
  } else {
    errorClaveRepetir.classList.add("oculto");
  }
  return coincide;
}

claveNueva.addEventListener("input", () => {
  validarClaveNueva();
  if (claveRepetir.value) validarClaveRepetir();
});

claveRepetir.addEventListener("input", validarClaveRepetir);

// Cambiar contraseña
formClave.addEventListener("submit", async (e) => {
  e.preventDefault();

  const actual = claveActual.value;
  const nueva = claveNueva.value;
  const repetir = claveRepetir.value;

  let valido = true;

  if (!actual) {
    errorClaveActual.classList.remove("oculto");
    valido = false;
  } else {
    errorClaveActual.classList.add("oculto");
  }

  if (!validarClaveNueva()) {
    errorClaveNueva.classList.remove("oculto");
    valido = false;
  }

  if (nueva !== repetir) {
    errorClaveRepetir.classList.remove("oculto");
    valido = false;
  }

  if (!valido) return;

  try {
    btnCambiarClave.disabled = true;
    ui.cargando(true);

    await api.llamar("POST", "/api/auth/clave", { actual, nueva });

    ui.aviso("Contraseña modificada con éxito", "exito");
    formClave.reset();
    errorClaveActual.classList.add("oculto");
    errorClaveNueva.classList.add("oculto");
    errorClaveRepetir.classList.add("oculto");
  } catch (err) {
    ui.aviso(err.message || "No se pudo cambiar la contraseña", "peligro");
  } finally {
    btnCambiarClave.disabled = false;
    ui.cargando(false);
  }
});

// Cargar y gestionar sección de logros para estudiantes (P05.3)
async function cargarLogrosEstudiante() {
  const seccionLogros = document.getElementById("logros");
  if (!seccionLogros) return;

  const usuario = usuarioActual();
  // Solo se muestra a estudiantes
  if (!usuario || usuario.rol !== "estudiante") {
    seccionLogros.innerHTML = "";
    return;
  }

  try {
    // 1. Puntos totales (logrosDe())
    const logros = await logrosDe("yo");
    const puntosTotales = logros?.puntos || 0;

    // 2. Insignias obtenidas y bloqueadas a partir de api.listar("insignias")
    const todasInsignias = await api.listar("insignias");
    const insigniasUsuario = Array.isArray(logros?.insignias) ? logros.insignias : [];

    const mapaObtenidas = new Map();
    for (const item of insigniasUsuario) {
      if (typeof item === "string") {
        mapaObtenidas.set(item, { fecha: null });
      } else if (item && item.id) {
        mapaObtenidas.set(item.id, item);
      }
    }

    const htmlInsignias = todasInsignias.map((ins) => {
      const obtenida = mapaObtenidas.get(ins.id);
      if (obtenida) {
        const fechaTxt = obtenida.fecha ? util.fechaLarga(obtenida.fecha) : "Obtenida";
        return `
          <div class="insignia-tarjeta insignia-tarjeta--obtenida">
            <span class="insignia-tarjeta__icono" aria-hidden="true">${ui.escapar(ins.icono || "🏅")}</span>
            <span class="insignia-tarjeta__nombre">${ui.escapar(ins.nombre)}</span>
            <span class="insignia-tarjeta__fecha">✓ ${ui.escapar(fechaTxt)}</span>
          </div>
        `;
      } else {
        return `
          <div class="insignia-tarjeta insignia-tarjeta--bloqueada" title="Insignia bloqueada">
            <span class="insignia-tarjeta__icono" aria-hidden="true">${ui.escapar(ins.icono || "🔒")}</span>
            <span class="insignia-tarjeta__nombre">${ui.escapar(ins.nombre)}</span>
            <span class="insignia-tarjeta__condicion">${ui.escapar(ins.descripcion || "Condición no especificada")}</span>
          </div>
        `;
      }
    }).join("");

    // 3. Certificado de cumplimiento: una barra .progreso por condición y botón "Descargar certificado"
    const estado = await api.llamar("GET", "/api/certificados/estado");
    const condiciones = estado?.condiciones || [];
    const cumple = Boolean(estado?.cumple);

    const htmlCondiciones = condiciones.map((c) => {
      let pct = 0;
      if (c.cumple) {
        pct = 100;
      } else if (c.nombre && c.nombre.toLowerCase().includes("porcentaje")) {
        pct = Math.min(100, Math.max(0, Math.round(Number(c.actual || 0))));
      } else if (Number(c.requerido) > 0) {
        pct = Math.min(100, Math.max(0, Math.round((Number(c.actual || 0) / Number(c.requerido)) * 100)));
      }

      const esPct = c.nombre && c.nombre.toLowerCase().includes("porcentaje");
      const textoValores = esPct
        ? `${c.actual}% / ${c.requerido}%`
        : `${c.actual} / ${c.requerido}`;

      return `
        <div class="condicion-barra-item">
          <div class="condicion-barra-encabezado">
            <span class="condicion-barra-nombre">${ui.escapar(c.nombre)}</span>
            <span class="condicion-barra-valores ${c.cumple ? 'condicion-barra-valores--cumple' : ''}">
              ${c.cumple ? '✓ ' : ''}${textoValores}
            </span>
          </div>
          <div class="progreso ${c.cumple ? 'progreso--exito' : ''}">
            <span style="width: ${pct}%;"></span>
          </div>
        </div>
      `;
    }).join("");

    seccionLogros.innerHTML = `
      <section class="tarjeta logros-seccion">
        <div class="logros-cabecera">
          <div>
            <h2>Mis Logros y Reconocimientos</h2>
            <p>Monitorea tu puntuación, insignias desbloqueadas y acreditación oficial.</p>
          </div>
          <div class="puntos-tarjeta" aria-label="Puntos totales acumulados">
            <span class="puntos-icono" aria-hidden="true">⭐</span>
            <div>
              <div class="puntos-cifra">${puntosTotales}</div>
              <div class="puntos-label">Puntos Totales</div>
            </div>
          </div>
        </div>

        <div class="vitrina-contenedor">
          <div class="vitrina-encabezado">
            <h3>Vitrina de Insignias</h3>
            <span class="chip">${mapaObtenidas.size} de ${todasInsignias.length} obtenidas</span>
          </div>
          <div class="insignias-grilla">
            ${htmlInsignias || '<p class="texto-suave">No hay insignias disponibles actualmente.</p>'}
          </div>
        </div>

        <div class="certificado-cumplimiento">
          <div class="certificado-cumplimiento__header">
            <div>
              <h3>Certificado de cumplimiento</h3>
              <p class="texto-suave">Completa los requisitos curriculares para desbloquear tu diploma oficial acreditado.</p>
            </div>
            <button type="button" id="btnDescargarCertificado" class="btn btn--primario" ${cumple ? '' : 'disabled'}>
              Descargar certificado
            </button>
          </div>

          <div class="condiciones-barras">
            ${htmlCondiciones}
          </div>
        </div>
      </section>
    `;

    // Botón "Descargar certificado" (habilitado solo si cumple)
    const btnDescargar = document.getElementById("btnDescargarCertificado");
    if (btnDescargar && cumple) {
      btnDescargar.addEventListener("click", async () => {
        try {
          btnDescargar.disabled = true;
          const textoOriginal = btnDescargar.textContent;
          btnDescargar.textContent = "Generando diploma...";
          ui.cargando(true);
          const { codigo } = await generarDiploma({ tipo: "cumplimiento" });
          ui.aviso(`¡Certificado descargado con éxito! Código: ${codigo}`, "exito");
        } catch (err) {
          ui.aviso(err.message || "Error al generar el certificado", "error");
        } finally {
          btnDescargar.disabled = false;
          btnDescargar.textContent = "Descargar certificado";
          ui.cargando(false);
        }
      });
    }

  } catch (err) {
    console.warn("No se pudo cargar la sección de logros:", err);
  }
}

// Inicializar
cargarDatosPerfil();
cargarLogrosEstudiante();

