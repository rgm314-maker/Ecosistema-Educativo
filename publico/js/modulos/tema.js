// publico/js/modulos/tema.js
// Visualización del tema para el estudiante con recursos multimedia y seguimiento de avance

import { montarPlantilla } from '../nucleo/plantilla.js';
import * as api from '../nucleo/api.js';
import * as ui from '../nucleo/ui.js';
import { parametro, formatoBasico } from '../nucleo/util.js';
import { ACTIVIDADES } from '../nucleo/catalogo-actividades.js';
import { registrarIntento } from '../nucleo/gamificacion.js';

const usuario = await montarPlantilla({ titulo: "Tema", roles: ["estudiante", "docente"] });

const temaId = parametro("id");

if (!temaId) {
  ui.aviso("No se especificó un tema válido", "peligro");
  setTimeout(() => {
    window.location.href = "/paginas/asignaturas.html";
  }, 1200);
}

// Referencias del DOM
const migaAsignatura = document.getElementById("migaAsignatura");
const migaTema = document.getElementById("migaTema");
const chipDificultad = document.getElementById("chipDificultad");
const contenedorBotonRevisado = document.getElementById("contenedorBotonRevisado");
const enlaceTutorTema = document.getElementById("enlaceTutorTema");
const tituloTemaPrincipal = document.getElementById("tituloTemaPrincipal");

if (usuario?.rol === "estudiante" && temaId) {
  enlaceTutorTema.href = `/paginas/tutor.html?temaId=${encodeURIComponent(temaId)}`;
  enlaceTutorTema.hidden = false;
}

const seccionObjetivos = document.getElementById("seccionObjetivos");
const listaObjetivosTema = document.getElementById("listaObjetivosTema");

const cuerpoResumenTema = document.getElementById("cuerpoResumenTema");

const seccionEjemplos = document.getElementById("seccionEjemplos");
const cuerpoEjemplosTema = document.getElementById("cuerpoEjemplosTema");

const seccionRecursos = document.getElementById("seccionRecursos");
const galeriaRecursos = document.getElementById("galeriaRecursos");

const contenedorActividadesTema = document.getElementById("contenedorActividadesTema");

function obtenerEmbedVideoUrl(url) {
  if (!url) return null;

  // YouTube (watch?v=ID o youtu.be/ID o embed/ID)
  const ytMatch = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i);
  if (ytMatch && ytMatch[1]) {
    return `https://www.youtube.com/embed/${ytMatch[1]}`;
  }

  // Vimeo (vimeo.com/ID)
  const vimeoMatch = url.match(/vimeo\.com\/(?:channels\/(?:\w+\/)?|groups\/([^\/]*)\/videos\/|album\/(\d+)\/video\/|)(\d+)/i);
  if (vimeoMatch && vimeoMatch[3]) {
    return `https://player.vimeo.com/video/${vimeoMatch[3]}`;
  }

  return null;
}

async function cargarTemaCompleto() {
  try {
    ui.cargando(true);

    const [tema, progresos] = await Promise.all([
      api.obtener("temas", temaId),
      api.listar("progreso-temas")
    ]);

    // Guardar en localStorage el último tema consultado
    try {
      localStorage.setItem("ultimoTema", JSON.stringify({
        id: tema.id,
        titulo: tema.titulo
      }));
    } catch (_) {}

    // Cargar jerarquía para migas de pan
    let nombreAsignatura = "Asignatura";
    let idAsignatura = "";

    if (tema.unidadId) {
      try {
        const unidad = await api.obtener("unidades", tema.unidadId);
        if (unidad && unidad.asignaturaId) {
          const asig = await api.obtener("asignaturas", unidad.asignaturaId);
          if (asig) {
            nombreAsignatura = asig.nombre;
            idAsignatura = asig.id;
          }
        }
      } catch (_) {}
    }

    // Configurar migas de pan y títulos
    if (idAsignatura) {
      migaAsignatura.innerHTML = `<a href="/paginas/asignatura.html?id=${encodeURIComponent(idAsignatura)}">${ui.escapar(nombreAsignatura)}</a>`;
    } else {
      migaAsignatura.textContent = nombreAsignatura;
    }
    migaTema.textContent = tema.titulo;
    document.title = `${tema.titulo} · ${nombreAsignatura} · Ecosistema Educativo`;

    tituloTemaPrincipal.textContent = tema.titulo;
    chipDificultad.textContent = tema.dificultad || "Intermedio";

    // Botón "Marcar como revisado" / "Revisado ✓"
    const estaRevisado = Array.isArray(progresos) && progresos.some((p) => p.temaId === temaId);
    if (estaRevisado) {
      contenedorBotonRevisado.innerHTML = `
        <span class="chip chip--primario" style="font-size: var(--texto-s);">Revisado ✓</span>
      `;
    } else {
      contenedorBotonRevisado.innerHTML = `
        <button type="button" class="btn btn--primario" id="btnMarcarRevisado">
          Marcar como revisado
        </button>
      `;
      const btnMarcar = document.getElementById("btnMarcarRevisado");
      btnMarcar.addEventListener("click", async () => {
        try {
          btnMarcar.disabled = true;
          ui.cargando(true);
          await api.crear("progreso-temas", { temaId });
          try {
            await registrarIntento({ actividad: "tema-revisado", temaId, puntaje: 1, maximo: 1 });
          } catch {
            // Ignorar silenciosamente si ya fue registrado previamente
          }
          contenedorBotonRevisado.innerHTML = `
            <span class="chip chip--primario" style="font-size: var(--texto-s);">Revisado ✓</span>
          `;
          ui.aviso("¡Tema marcado como revisado!", "exito");
        } catch (err) {
          btnMarcar.disabled = false;
          ui.aviso(err.message || "Error al registrar avance", "peligro");
        } finally {
          ui.cargando(false);
        }
      });
    }

    // Objetivos
    if (Array.isArray(tema.objetivos) && tema.objetivos.length > 0) {
      seccionObjetivos.style.display = "";
      listaObjetivosTema.innerHTML = tema.objetivos
        .map((obj) => `<li>${ui.escapar(obj)}</li>`)
        .join("");
    } else {
      seccionObjetivos.style.display = "none";
    }

    // Resumen pedagógico
    cuerpoResumenTema.innerHTML = formatoBasico(tema.resumen || "Este tema aún no incluye un resumen teórico.");

    // Ejemplos prácticos
    if (Array.isArray(tema.ejemplos) && tema.ejemplos.length > 0) {
      seccionEjemplos.style.display = "";
      cuerpoEjemplosTema.innerHTML = tema.ejemplos
        .map((ej, idx) => `
          <div class="tarjeta" style="background-color: var(--fondo); border: var(--borde-fino) solid var(--borde);">
            <strong>Ejemplo ${idx + 1}:</strong>
            <p style="margin: var(--espacio-xs) 0 0 0; line-height: var(--interlineado-base);">${ui.escapar(ej)}</p>
          </div>
        `)
        .join("");
    } else {
      seccionEjemplos.style.display = "none";
    }

    // Recursos didácticos multimedia
    if (Array.isArray(tema.recursos) && tema.recursos.length > 0) {
      seccionRecursos.style.display = "";
      const recursosVideos = [];
      const recursosArchivos = [];

      tema.recursos.forEach((r) => {
        const embedUrl = obtenerEmbedVideoUrl(r.url);
        if (r.tipo === "video" && embedUrl) {
          recursosVideos.push(`
            <div class="pila" style="gap: var(--espacio-xs);">
              ${r.titulo ? `<strong style="color: var(--primario);">${ui.escapar(r.titulo)}</strong>` : ""}
              <div class="recurso-video-contenedor">
                <iframe
                  src="${ui.escapar(embedUrl)}"
                  title="Video: ${ui.escapar(r.titulo || 'Recurso audiovisual')}"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowfullscreen
                ></iframe>
              </div>
            </div>
          `);
        } else if (r.tipo === "imagen") {
          recursosArchivos.push(`
            <figure style="margin: 0; max-width: 600px;">
              <img
                src="${ui.escapar(r.url)}"
                alt="${ui.escapar(r.titulo || 'Ilustración del tema')}"
                style="max-width: 100%; border-radius: var(--radio-m); border: var(--borde-fino) solid var(--borde);"
              >
              ${r.titulo ? `<figcaption style="font-size: var(--texto-xs); color: var(--texto-suave); margin-top: var(--espacio-xs);">${ui.escapar(r.titulo)}</figcaption>` : ""}
            </figure>
          `);
        } else if (r.tipo === "pdf") {
          recursosArchivos.push(`
            <a
              href="${ui.escapar(r.url)}"
              target="_blank"
              rel="noopener noreferrer"
              class="btn btn--secundario btn--pequeno"
              style="align-self: flex-start;"
            >
              📄 ${ui.escapar(r.titulo || "Descargar documento PDF")}
            </a>
          `);
        } else {
          recursosArchivos.push(`
            <a
              href="${ui.escapar(r.url)}"
              target="_blank"
              rel="noopener noreferrer"
              class="btn btn--secundario btn--pequeno"
              style="align-self: flex-start;"
            >
              🔗 ${ui.escapar(r.titulo || "Abrir enlace externo")}
            </a>
          `);
        }
      });

      galeriaRecursos.innerHTML = `
        ${recursosVideos.join("")}
        <div class="recursos-enlaces-grid">
          ${recursosArchivos.join("")}
        </div>
      `;
    } else {
      seccionRecursos.style.display = "none";
    }

    // Bloque "Practica este tema" con ACTIVIDADES
    if (Array.isArray(ACTIVIDADES) && ACTIVIDADES.length > 0) {
      contenedorActividadesTema.innerHTML = `
        <div class="grid-actividades">
          ${ACTIVIDADES.map((act) => `
            <a href="${ui.escapar(act.href)}?temaId=${encodeURIComponent(temaId)}" class="tarjeta-actividad">
              <span class="chip chip--primario" style="align-self: flex-start; font-size: var(--texto-xs);">Actividad</span>
              <h3 style="margin: var(--espacio-xs) 0; font-size: var(--texto-m); color: var(--primario);">${ui.escapar(act.texto)}</h3>
              <p style="margin: 0; font-size: var(--texto-s); color: var(--texto-suave);">${ui.escapar(act.descripcion || "")}</p>
            </a>
          `).join("")}
        </div>
      `;
    } else {
      contenedorActividadesTema.innerHTML = `
        <div class="vacio" style="padding: var(--espacio-l);">
          <span class="vacio__icono">🎮</span>
          <h3 class="vacio__titulo">Próximamente actividades interactivas</h3>
          <p class="vacio__texto">Las actividades lúdicas y juegos para este tema estarán disponibles muy pronto.</p>
        </div>
      `;
    }
  } catch (err) {
    ui.aviso(err.message || "Error al cargar el tema", "peligro");
    tituloTemaPrincipal.textContent = "Tema no encontrado";
    cuerpoResumenTema.innerHTML = `<p style="color: var(--error);">No se pudo cargar la información de este tema.</p>`;
  } finally {
    ui.cargando(false);
  }
}

cargarTemaCompleto();
