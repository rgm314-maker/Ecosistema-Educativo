// publico/js/modulos/noticia.js
// Detalle de la noticia y registro automático de lectura

import { montarPlantilla } from "../nucleo/plantilla.js";
import { usuarioActual } from "../nucleo/sesion.js";
import * as api from "../nucleo/api.js";
import * as ui from "../nucleo/ui.js";
import * as util from "../nucleo/util.js";

await montarPlantilla({
  titulo: "Noticia",
  roles: ["sesion"]
});

const usuario = usuarioActual() || {};

const contenedor = document.getElementById("contenido");
const noticiaId = util.parametro("id");

async function iniciar() {
  if (!noticiaId) {
    ui.aviso("No se especificó ninguna noticia para ver", "error");
    mostrarError("Parámetro de noticia faltante.");
    return;
  }

  try {
    ui.cargando(true);

    const noticia = await api.obtener("noticias", noticiaId);
    if (!noticia) {
      throw new Error("La noticia solicitada no fue encontrada.");
    }

    // Registrar lectura automáticamente si el usuario no la ha registrado
    registrarLecturaSilenciosa(noticiaId);

    // Obtener información adicional de tema si corresponde
    let tema = null;
    if (noticia.temaId) {
      try {
        tema = await api.obtener("temas", noticia.temaId);
      } catch {
        // Ignorar si no se puede leer el tema
      }
    }

    renderizarNoticia(noticia, tema);
  } catch (err) {
    ui.aviso(err.message || "Error al cargar la noticia", "error");
    mostrarError(err.message || "No se pudo cargar la noticia.");
  } finally {
    ui.cargando(false);
  }
}

async function registrarLecturaSilenciosa(id) {
  try {
    await api.crear("lecturas-noticias", { noticiaId: id });
  } catch {
    // Si ya fue registrada previamente, el gancho o la API rechaza y lo ignoramos limpiamente
  }
}

function renderizarNoticia(noticia, tema) {
  const esDocenteOAdmin = usuario.rol === "docente" || usuario.rol === "admin";
  const fechaTexto = noticia.fechaPublicacion
    ? util.fechaLarga(noticia.fechaPublicacion)
    : (noticia.fecha ? util.fechaLarga(noticia.fecha) : "Sin fecha registrada");

  const cuerpoHtml = util.formatoBasico(noticia.cuerpo || "");

  contenedor.innerHTML = `
    <!-- Migas de pan y retorno -->
    <div class="fila" style="justify-content: space-between; margin-bottom: var(--espacio-l);">
      <nav aria-label="Migas de pan" style="font-size: var(--texto-s);">
        <a href="/paginas/noticias.html">Noticias</a>
        <span style="color: var(--texto-suave); margin-inline: var(--espacio-xs);">/</span>
        <span style="color: var(--texto-suave);">${ui.escapar(noticia.categoria || "General")}</span>
      </nav>
      <a href="/paginas/noticias.html" class="btn btn--secundario btn--pequeno">← Volver al listado</a>
    </div>

    <article class="articulo-noticia">
      <header class="articulo-cabecera">
        <div class="articulo-etiquetas">
          <span class="chip chip--primario">${ui.escapar(noticia.categoria || "General")}</span>
          ${noticia.destacada ? `<span class="chip chip--acento">★ Noticia destacada</span>` : ""}
          ${noticia.estado === "borrador" ? `<span class="chip">Borrador</span>` : ""}
          ${
            tema
              ? `<a href="/paginas/tema.html?id=${ui.escapar(tema.id)}" class="chip" title="Ver tema de estudio relacionado">📚 ${ui.escapar(tema.titulo)}</a>`
              : ""
          }
        </div>

        <h1 class="articulo-titulo">${ui.escapar(noticia.titulo)}</h1>

        <div class="articulo-meta">
          <span>📅 Publicado: <strong>${ui.escapar(fechaTexto)}</strong></span>
          ${noticia.autorId ? `<span>✍️ Autor ID: <small>${ui.escapar(noticia.autorId)}</small></span>` : ""}
        </div>
      </header>

      ${
        noticia.imagen
          ? `
            <div class="articulo-imagen-wrapper">
              <img src="${ui.escapar(noticia.imagen)}" alt="${ui.escapar(noticia.titulo)}" class="articulo-imagen">
            </div>
          `
          : ""
      }

      ${
        noticia.resumen
          ? `<blockquote class="articulo-resumen">${ui.escapar(noticia.resumen)}</blockquote>`
          : ""
      }

      <div class="articulo-cuerpo">
        ${cuerpoHtml}
      </div>

      <footer class="articulo-pie">
        <a href="/paginas/noticias.html" class="btn btn--secundario">← Volver a Noticias</a>
        ${
          esDocenteOAdmin
            ? `<a href="/paginas/editor-noticia.html?id=${ui.escapar(noticia.id)}" class="btn btn--primario">Editar noticia</a>`
            : ""
        }
      </footer>
    </article>
  `;
}

function mostrarError(mensaje) {
  contenedor.innerHTML = `
    <div class="vacio">
      <span class="vacio__icono">⚠️</span>
      <h2 class="vacio__titulo">No se pudo cargar la noticia</h2>
      <p class="vacio__texto">${ui.escapar(mensaje)}</p>
      <a href="/paginas/noticias.html" class="btn btn--primario" style="margin-top: var(--espacio-m);">Volver a Noticias</a>
    </div>
  `;
}

iniciar();
