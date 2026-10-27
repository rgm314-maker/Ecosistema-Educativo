// publico/js/modulos/noticias.js
// Listado de noticias con filtros, paginación y marcas de lectura

import { montarPlantilla } from "../nucleo/plantilla.js";
import { usuarioActual } from "../nucleo/sesion.js";
import * as api from "../nucleo/api.js";
import * as ui from "../nucleo/ui.js";
import * as util from "../nucleo/util.js";

await montarPlantilla({
  titulo: "Noticias",
  roles: ["sesion"]
});

const usuario = usuarioActual() || {};

const contenedor = document.getElementById("contenido");

const NOTICIAS_POR_PAGINA = 9;
let todasLasNoticias = [];
let idsLeidas = new Set();
let mapaTemas = new Map();

let categoriaFiltro = "todas";
let temaFiltro = "todos";
let paginaActual = 1;

async function iniciar() {
  try {
    ui.cargando(true);
    const [noticias, lecturas, temas] = await Promise.all([
      api.listar("noticias"),
      api.listar("lecturas-noticias"),
      api.listar("temas")
    ]);

    todasLasNoticias = noticias || [];
    idsLeidas = new Set((lecturas || []).map((l) => l.noticiaId));
    (temas || []).forEach((t) => mapaTemas.set(t.id, t.titulo));
  } catch (err) {
    ui.aviso(err.message || "Error al cargar las noticias", "error");
  } finally {
    ui.cargando(false);
  }

  renderizarEstructura();
  vincularFiltros();
  renderizarTarjetas();
}

function renderizarEstructura() {
  const esDocenteOAdmin = usuario.rol === "docente" || usuario.rol === "admin";

  const opcionesTemas = Array.from(mapaTemas.entries()).map(
    ([id, titulo]) => `<option value="${ui.escapar(id)}">${ui.escapar(titulo)}</option>`
  ).join("");

  contenedor.innerHTML = `
    <div class="fila" style="justify-content: space-between; margin-bottom: var(--espacio-l);">
      <div>
        <h1 style="margin: 0;">Noticias y Novedades</h1>
        <p style="color: var(--texto-suave); margin: 0;">Mantente al día con los acontecimientos institucionales y académicos</p>
      </div>
      ${
        esDocenteOAdmin
          ? `<a href="/paginas/editor-noticia.html" class="btn btn--primario">+ Nueva noticia</a>`
          : ""
      }
    </div>

    <!-- Barra de Filtros -->
    <div class="barra-filtros">
      <div class="filtros-grupo">
        <div class="campo" style="margin: 0; min-width: 180px;">
          <label for="filtroCategoria" class="sr-only">Filtrar por categoría</label>
          <select id="filtroCategoria" class="input">
            <option value="todas">Todas las categorías</option>
            <option value="Institucional">Institucional</option>
            <option value="Académica">Académica</option>
            <option value="Eventos">Eventos</option>
            <option value="Logros">Logros</option>
          </select>
        </div>

        <div class="campo" style="margin: 0; min-width: 200px;">
          <label for="filtroTema" class="sr-only">Filtrar por tema</label>
          <select id="filtroTema" class="input">
            <option value="todos">Todos los temas relacionados</option>
            ${opcionesTemas}
          </select>
        </div>
      </div>

      <div id="contadorResultados" style="font-size: var(--texto-s); color: var(--texto-suave);"></div>
    </div>

    <!-- Rejilla de Noticias -->
    <div id="gridNoticias" class="grid-noticias"></div>

    <!-- Paginación -->
    <div id="paginacion" class="paginacion-contenedor oculto"></div>
  `;
}

function vincularFiltros() {
  const selCat = document.getElementById("filtroCategoria");
  const selTema = document.getElementById("filtroTema");

  selCat.addEventListener("change", (e) => {
    categoriaFiltro = e.target.value;
    paginaActual = 1;
    renderizarTarjetas();
  });

  selTema.addEventListener("change", (e) => {
    temaFiltro = e.target.value;
    paginaActual = 1;
    renderizarTarjetas();
  });
}

function obtenerNoticiasFiltradas() {
  let filtradas = [...todasLasNoticias];

  // Filtro por categoría
  if (categoriaFiltro !== "todas") {
    filtradas = filtradas.filter((n) => n.categoria === categoriaFiltro);
  }

  // Filtro por tema
  if (temaFiltro !== "todos") {
    filtradas = filtradas.filter((n) => n.temaId === temaFiltro);
  }

  // Ordenar: destacadas primero, luego por fechaPublicacion / fecha más reciente descendente
  filtradas.sort((a, b) => {
    const destA = Boolean(a.destacada);
    const destB = Boolean(b.destacada);
    if (destA && !destB) return -1;
    if (!destA && destB) return 1;

    const fechaA = new Date(a.fechaPublicacion || a.fecha || 0).getTime();
    const fechaB = new Date(b.fechaPublicacion || b.fecha || 0).getTime();
    return fechaB - fechaA;
  });

  return filtradas;
}

function renderizarTarjetas() {
  const grid = document.getElementById("gridNoticias");
  const pagContenedor = document.getElementById("paginacion");
  const contador = document.getElementById("contadorResultados");
  const esDocenteOAdmin = usuario.rol === "docente" || usuario.rol === "admin";

  const filtradas = obtenerNoticiasFiltradas();
  const total = filtradas.length;

  contador.textContent = `${total} noticia${total === 1 ? "" : "s"}`;

  if (total === 0) {
    grid.innerHTML = `
      <div class="vacio" style="grid-column: 1 / -1;">
        <span class="vacio__icono">📰</span>
        <h2 class="vacio__titulo">No hay noticias disponibles</h2>
        <p class="vacio__texto">No se encontraron noticias que coincidan con los filtros seleccionados.</p>
      </div>
    `;
    pagContenedor.classList.add("oculto");
    return;
  }

  const totalPaginas = Math.ceil(total / NOTICIAS_POR_PAGINA);
  if (paginaActual > totalPaginas) paginaActual = totalPaginas;

  const inicio = (paginaActual - 1) * NOTICIAS_POR_PAGINA;
  const paginaNoticias = filtradas.slice(inicio, inicio + NOTICIAS_POR_PAGINA);

  grid.innerHTML = paginaNoticias.map((n) => {
    const noLeida = !idsLeidas.has(n.id) && n.estado === "publicado";
    const esBorrador = n.estado === "borrador";
    const temaNombre = n.temaId ? mapaTemas.get(n.temaId) : null;
    const fechaTexto = n.fechaPublicacion
      ? util.fechaRelativa(n.fechaPublicacion)
      : (n.fecha ? util.fechaRelativa(n.fecha) : "Reciente");

    return `
      <article class="tarjeta-noticia${n.destacada ? " tarjeta-noticia--destacada" : ""}">
        <div class="tarjeta-noticia__media">
          ${
            n.imagen
              ? `<img src="${ui.escapar(n.imagen)}" alt="${ui.escapar(n.titulo)}" class="tarjeta-noticia__img" loading="lazy">`
              : `<div class="tarjeta-noticia__placeholder" aria-hidden="true">📰</div>`
          }
          <div class="tarjeta-noticia__etiquetas">
            <span class="chip chip--primario">${ui.escapar(n.categoria || "General")}</span>
            ${n.destacada ? `<span class="chip chip--acento">★ Destacada</span>` : ""}
            ${noLeida ? `<span class="chip chip--acento">Nuevo</span>` : ""}
            ${esBorrador ? `<span class="chip">Borrador</span>` : ""}
          </div>
        </div>

        <div class="tarjeta-noticia__cuerpo">
          <h2 class="tarjeta-noticia__titulo">
            <a href="/paginas/noticia.html?id=${ui.escapar(n.id)}">${ui.escapar(n.titulo)}</a>
          </h2>
          ${temaNombre ? `<small style="color: var(--secundario);">Tema: ${ui.escapar(temaNombre)}</small>` : ""}
          <p class="tarjeta-noticia__resumen">${ui.escapar(n.resumen || "")}</p>
        </div>

        <div class="tarjeta-noticia__pie">
          <span>${ui.escapar(fechaTexto)}</span>
          <div class="fila" style="gap: var(--espacio-s);">
            ${
              esDocenteOAdmin
                ? `<a href="/paginas/editor-noticia.html?id=${ui.escapar(n.id)}" class="btn btn--secundario btn--pequeno">Editar</a>`
                : ""
            }
            <a href="/paginas/noticia.html?id=${ui.escapar(n.id)}" class="btn btn--primario btn--pequeno">Leer más →</a>
          </div>
        </div>
      </article>
    `;
  }).join("");

  // Paginación
  if (totalPaginas > 1) {
    pagContenedor.classList.remove("oculto");
    pagContenedor.innerHTML = `
      <button type="button" class="btn btn--secundario btn--pequeno" id="btnPagAnterior"${paginaActual === 1 ? " disabled" : ""}>
        ← Anterior
      </button>
      <span style="font-size: var(--texto-s); font-weight: var(--peso-medio);">
        Página ${paginaActual} de ${totalPaginas}
      </span>
      <button type="button" class="btn btn--secundario btn--pequeno" id="btnPagSiguiente"${paginaActual === totalPaginas ? " disabled" : ""}>
        Siguiente →
      </button>
    `;

    document.getElementById("btnPagAnterior").addEventListener("click", () => {
      if (paginaActual > 1) {
        paginaActual--;
        renderizarTarjetas();
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    });

    document.getElementById("btnPagSiguiente").addEventListener("click", () => {
      if (paginaActual < totalPaginas) {
        paginaActual++;
        renderizarTarjetas();
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    });
  } else {
    pagContenedor.classList.add("oculto");
  }
}

iniciar();
