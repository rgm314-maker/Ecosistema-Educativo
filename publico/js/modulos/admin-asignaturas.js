// publico/js/modulos/admin-asignaturas.js
// Gestión de asignaturas institucionales, creación, edición y eliminación controlada

import { montarPlantilla } from '../nucleo/plantilla.js';
import * as api from '../nucleo/api.js';
import * as ui from '../nucleo/ui.js';

await montarPlantilla({ titulo: "Asignaturas", roles: ["admin"] });

const gridAsignaturas = document.getElementById("gridAsignaturas");
const btnNuevaAsignatura = document.getElementById("btnNuevaAsignatura");

let asignaturas = [];
let distributivo = [];

async function cargarDatos() {
  try {
    ui.cargando(true);
    const [listaAsig, listaDist] = await Promise.all([
      api.listar("asignaturas"),
      api.listar("distributivo")
    ]);
    asignaturas = listaAsig || [];
    distributivo = listaDist || [];
    renderizarAsignaturas();
  } catch (err) {
    ui.aviso(err.message || "Error al cargar asignaturas", "peligro");
    gridAsignaturas.innerHTML = `
      <div class="tarjeta" style="grid-column: 1 / -1; text-align: center; color: var(--error);">
        No se pudieron cargar las asignaturas. Revisa tu conexión y permisos.
      </div>
    `;
  } finally {
    ui.cargando(false);
  }
}

function contarGrupos(asignaturaId) {
  return distributivo.filter((g) => g.asignaturaId === asignaturaId).length;
}

function renderizarAsignaturas() {
  if (asignaturas.length === 0) {
    gridAsignaturas.innerHTML = `
      <div class="tarjeta" style="grid-column: 1 / -1; text-align: center; padding: var(--espacio-2xl);">
        <p style="color: var(--texto-suave);">No hay asignaturas registradas en el sistema.</p>
        <button type="button" class="btn btn--primario btn--pequeno" id="btnCrearPrimera">
          Crear la primera asignatura
        </button>
      </div>
    `;
    const btnCrearPrimera = document.getElementById("btnCrearPrimera");
    if (btnCrearPrimera) {
      btnCrearPrimera.addEventListener("click", () => abrirModalAsignatura());
    }
    return;
  }

  gridAsignaturas.innerHTML = asignaturas
    .map((asig) => {
      const numGrupos = contarGrupos(asig.id);
      const textoGrupos = numGrupos === 1 ? "1 paralelo activo" : `${numGrupos} paralelos activos`;

      return `
        <article class="tarjeta-asignatura" data-id="${ui.escapar(asig.id)}">
          <div class="tarjeta-asignatura__arriba">
            <span class="chip chip--primario tarjeta-asignatura__nivel">
              Nivel ${ui.escapar(asig.nivel || "1")}
            </span>
            <h2 class="tarjeta-asignatura__titulo">${ui.escapar(asig.nombre)}</h2>
            <p class="tarjeta-asignatura__desc">
              ${ui.escapar(asig.descripcion || "Sin descripción.")}
            </p>
            <div class="tarjeta-asignatura__meta">
              <span>📚 ${textoGrupos}</span>
            </div>
          </div>

          <div class="tarjeta-asignatura__acciones">
            <a
              href="/paginas/editor-contenidos.html?asignaturaId=${encodeURIComponent(asig.id)}"
              class="btn btn--primario btn--pequeno"
              title="Cargar unidades, temas y material didáctico"
            >
              📚 Contenidos
            </a>
            <button
              type="button"
              class="btn btn--secundario btn--pequeno btn-editar"
              data-id="${ui.escapar(asig.id)}"
              aria-label="Editar ${ui.escapar(asig.nombre)}"
            >
              Editar
            </button>
            <button
              type="button"
              class="btn btn--secundario btn--pequeno btn-eliminar"
              data-id="${ui.escapar(asig.id)}"
              aria-label="Eliminar ${ui.escapar(asig.nombre)}"
            >
              Eliminar
            </button>
          </div>
        </article>
      `;
    })
    .join("");
}

// Delegación de eventos en las tarjetas
gridAsignaturas.addEventListener("click", async (e) => {
  const btnEditar = e.target.closest(".btn-editar");
  const btnEliminar = e.target.closest(".btn-eliminar");

  if (btnEditar) {
    const id = btnEditar.dataset.id;
    const asig = asignaturas.find((a) => a.id === id);
    if (asig) abrirModalAsignatura(asig);
    return;
  }

  if (btnEliminar) {
    const id = btnEliminar.dataset.id;
    const asig = asignaturas.find((a) => a.id === id);
    if (!asig) return;

    // Validación de integridad referencial: solo si no tiene grupos
    const gruposAsociados = contarGrupos(id);
    if (gruposAsociados > 0) {
      ui.aviso(
        `No se puede eliminar "${asig.nombre}" porque tiene ${gruposAsociados} grupo(s) asignado(s) en el distributivo.`,
        "advertencia"
      );
      return;
    }

    const confirmado = await ui.confirmar(`¿Estás seguro de eliminar la asignatura "${asig.nombre}"?`);
    if (!confirmado) return;

    try {
      ui.cargando(true);
      await api.eliminar("asignaturas", id);
      ui.aviso("Asignatura eliminada correctamente", "exito");
      await cargarDatos();
    } catch (err) {
      ui.aviso(err.message || "No se pudo eliminar la asignatura", "peligro");
    } finally {
      ui.cargando(false);
    }
  }
});

btnNuevaAsignatura.addEventListener("click", () => {
  abrirModalAsignatura();
});

// Modal para crear o editar asignatura
function abrirModalAsignatura(asig = null) {
  const esEdicion = Boolean(asig);
  const tituloModal = esEdicion ? "Editar Asignatura" : "Nueva Asignatura";

  const formEl = document.createElement("form");
  formEl.className = "pila";
  formEl.noValidate = true;

  formEl.innerHTML = `
    <div class="campo">
      <label for="asigNombre">Nombre de la asignatura *</label>
      <input
        type="text"
        id="asigNombre"
        required
        value="${ui.escapar(asig?.nombre || "")}"
        placeholder="Ej. Contabilidad Básica"
      >
      <span id="errAsigNombre" class="campo__error oculto">El nombre es obligatorio.</span>
    </div>

    <div class="campo">
      <label for="asigNivel">Nivel formativo *</label>
      <input
        type="text"
        id="asigNivel"
        required
        value="${ui.escapar(asig?.nivel || "1")}"
        placeholder="Ej. 1, 2, Básico, Inicial..."
      >
      <span id="errAsigNivel" class="campo__error oculto">El nivel es obligatorio.</span>
    </div>

    <div class="campo">
      <label for="asigDesc">Descripción</label>
      <textarea
        id="asigDesc"
        rows="3"
        placeholder="Breve resumen temático y objetivos..."
      >${ui.escapar(asig?.descripcion || "")}</textarea>
    </div>
  `;

  ui.modal({
    titulo: tituloModal,
    contenido: formEl,
    acciones: [
      { texto: "Cancelar", valor: false, clase: "btn-secundario" },
      { texto: esEdicion ? "Guardar cambios" : "Crear asignatura", valor: true, clase: "btn-primario" }
    ]
  }).then(async (guardar) => {
    if (!guardar) return;

    const nombre = formEl.querySelector("#asigNombre").value.trim();
    const nivel = formEl.querySelector("#asigNivel").value.trim();
    const descripcion = formEl.querySelector("#asigDesc").value.trim();

    if (!nombre || !nivel) {
      ui.aviso("El nombre y nivel son campos obligatorios", "advertencia");
      return;
    }

    try {
      ui.cargando(true);
      if (esEdicion) {
        await api.actualizar("asignaturas", asig.id, {
          nombre,
          nivel,
          descripcion
        });
        ui.aviso("Asignatura actualizada exitosamente", "exito");
      } else {
        const nueva = await api.crear("asignaturas", {
          nombre,
          nivel,
          descripcion
        });
        ui.aviso("Asignatura creada. Redirigiendo a contenidos y material...", "exito");
        setTimeout(() => {
          window.location.href = `/paginas/editor-contenidos.html?asignaturaId=${encodeURIComponent(nueva.id)}`;
        }, 600);
        return;
      }
      await cargarDatos();
    } catch (err) {
      ui.aviso(err.message || "Error al guardar la asignatura", "peligro");
    } finally {
      ui.cargando(false);
    }
  });
}

// Carga inicial
cargarDatos();
