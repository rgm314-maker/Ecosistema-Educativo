// publico/js/modulos/asignatura.js
// Temario detallado por unidades y seguimiento de temas revisados o pendientes

import { montarPlantilla } from '../nucleo/plantilla.js';
import * as api from '../nucleo/api.js';
import * as ui from '../nucleo/ui.js';
import { parametro } from '../nucleo/util.js';
import { calcularAvance } from './asignaturas.js';

import { usuarioActual } from '../nucleo/sesion.js';

await montarPlantilla({ titulo: "Asignatura", roles: ["estudiante", "docente", "admin"] });

const asigId = parametro("id");

if (!asigId) {
  ui.aviso("No se indicó una asignatura válida", "peligro");
  setTimeout(() => {
    window.location.href = "/paginas/asignaturas.html";
  }, 1200);
}

// Referencias del DOM
const chipNivelMateria = document.getElementById("chipNivelMateria");
const tituloMateria = document.getElementById("tituloMateria");
const descMateria = document.getElementById("descMateria");
const porcentajeMateria = document.getElementById("porcentajeMateria");
const barraProgresoMateria = document.getElementById("barraProgresoMateria");
const rellenoProgresoMateria = document.getElementById("rellenoProgresoMateria");
const contenedorUnidades = document.getElementById("contenedorUnidades");

async function cargarContenido() {
  try {
    ui.cargando(true);

    const [asig, todasUnidades, todosTemas, progresos, avance] = await Promise.all([
      api.obtener("asignaturas", asigId),
      api.listar("unidades"),
      api.listar("temas"),
      api.listar("progreso-temas"),
      calcularAvance(asigId)
    ]);

    // Actualizar cabecera
    tituloMateria.textContent = asig.nombre;
    document.title = `${asig.nombre} · Ecosistema Educativo`;
    descMateria.textContent = asig.descripcion || "Materia curricular de formación integral.";
    chipNivelMateria.textContent = `Nivel ${asig.nivel || "1"}`;

    const pct = avance.porcentaje || 0;
    porcentajeMateria.textContent = `${pct}%`;
    barraProgresoMateria.setAttribute("aria-valuenow", String(pct));
    rellenoProgresoMateria.style.width = `${pct}%`;

    const usr = usuarioActual();
    const esProfesorOAdmin = usr?.rol === 'docente' || usr?.rol === 'admin';
    const filaCabecera = document.querySelector(".asignatura-cabecera__fila");
    if (filaCabecera && esProfesorOAdmin && !document.getElementById("btnGestionarContenidos")) {
      const btnGestionar = document.createElement("a");
      btnGestionar.id = "btnGestionarContenidos";
      btnGestionar.href = `/paginas/editor-contenidos.html?asignaturaId=${encodeURIComponent(asigId)}`;
      btnGestionar.className = "btn btn--primario btn--pequeno";
      btnGestionar.style.marginLeft = "auto";
      btnGestionar.innerHTML = "✏️ Cargar material y editar unidades";
      filaCabecera.appendChild(btnGestionar);
    }

    // Unidades de esta asignatura
    const unidades = (todasUnidades || [])
      .filter((u) => u.asignaturaId === asigId && u.visible !== false)
      .sort((a, b) => (a.orden || 0) - (b.orden || 0));

    if (unidades.length === 0) {
      const usr = usuarioActual();
      const botonCargar = (usr?.rol === 'docente' || usr?.rol === 'admin')
        ? `<div style="margin-top: var(--espacio-m);">
             <a href="/paginas/editor-contenidos.html?asignaturaId=${encodeURIComponent(asigId)}" class="btn btn--primario">
               + Crear primera unidad y cargar material
             </a>
           </div>`
        : '';
      contenedorUnidades.innerHTML = `
        <div class="vacio">
          <span class="vacio__icono">📖</span>
          <h2 class="vacio__titulo">Sin unidades disponibles</h2>
          <p class="vacio__texto">Esta asignatura aún no cuenta con unidades didácticas visibles.</p>
          ${botonCargar}
        </div>
      `;
      return;
    }

    const revisadosSet = new Set((progresos || []).map((p) => p.temaId));

    contenedorUnidades.innerHTML = unidades
      .map((unidad, idxUnidad) => {
        const temasUnidad = (todosTemas || [])
          .filter((t) => t.unidadId === unidad.id && t.estado === "publicado")
          .sort((a, b) => (a.orden || 0) - (b.orden || 0));

        let contenidoTemasHtml = "";

        if (temasUnidad.length === 0) {
          contenidoTemasHtml = `
            <li style="padding: var(--espacio-m); text-align: center; color: var(--texto-suave);">
              No hay temas publicados en esta unidad.
            </li>
          `;
        } else {
          contenidoTemasHtml = temasUnidad
            .map((tema, idxTema) => {
              const estaRevisado = revisadosSet.has(tema.id);
              const chipEstado = estaRevisado
                ? `<span class="chip chip--primario" style="font-size: var(--texto-xs);">Revisado ✓</span>`
                : `<span class="chip chip--secundario" style="font-size: var(--texto-xs);">Pendiente</span>`;

              return `
                <li>
                  <a href="/paginas/tema.html?id=${encodeURIComponent(tema.id)}" class="item-tema-estudiante">
                    <div class="item-tema-estudiante__info">
                      <span style="font-weight: var(--peso-negrita); color: var(--primario);">${idxUnidad + 1}.${idxTema + 1}</span>
                      <span class="item-tema-estudiante__titulo">${ui.escapar(tema.titulo)}</span>
                    </div>
                    <div>
                      ${chipEstado}
                    </div>
                  </a>
                </li>
              `;
            })
            .join("");
        }

        return `
          <section class="unidad-bloque" data-id="${ui.escapar(unidad.id)}">
            <h2 class="unidad-bloque__titulo">
              <span>Unidad ${idxUnidad + 1}:</span>
              <span>${ui.escapar(unidad.titulo)}</span>
            </h2>

            <ul class="lista-temas-estudiante">
              ${contenidoTemasHtml}
            </ul>
          </section>
        `;
      })
      .join("");
  } catch (err) {
    ui.aviso(err.message || "Error al cargar la asignatura", "peligro");
    contenedorUnidades.innerHTML = `
      <div class="tarjeta" style="text-align: center; color: var(--error);">
        No se pudo cargar el temario. Revisa tus permisos.
      </div>
    `;
  } finally {
    ui.cargando(false);
  }
}

cargarContenido();
