// publico/js/modulos/distributivo.js
// Panel de administración del distributivo académico, docentes y grupos de estudiantes

import { montarPlantilla } from '../nucleo/plantilla.js';
import * as api from '../nucleo/api.js';
import * as ui from '../nucleo/ui.js';

await montarPlantilla({ titulo: "Distributivo", roles: ["admin"] });

const cuerpoTablaDistributivo = document.getElementById("cuerpoTablaDistributivo");
const btnNuevoGrupo = document.getElementById("btnNuevoGrupo");

let distributivo = [];
let asignaturas = [];
let usuarios = [];

async function cargarDatos() {
  try {
    ui.cargando(true);
    const [listaDist, listaAsig, listaUsu] = await Promise.all([
      api.listar("distributivo"),
      api.listar("asignaturas"),
      api.listar("usuarios")
    ]);
    distributivo = listaDist || [];
    asignaturas = listaAsig || [];
    usuarios = listaUsu || [];
    renderizarDistributivo();
  } catch (err) {
    ui.aviso(err.message || "Error al cargar datos del distributivo", "peligro");
    cuerpoTablaDistributivo.innerHTML = `
      <tr>
        <td colspan="6" style="text-align: center; color: var(--error); padding: var(--espacio-l);">
          No se pudieron cargar los datos. Revisa la conexión y tus permisos.
        </td>
      </tr>
    `;
  } finally {
    ui.cargando(false);
  }
}

function renderizarDistributivo() {
  if (distributivo.length === 0) {
    cuerpoTablaDistributivo.innerHTML = `
      <tr>
        <td colspan="6" style="text-align: center; color: var(--texto-suave); padding: var(--espacio-2xl);">
          No hay grupos registrados en el distributivo.
        </td>
      </tr>
    `;
    return;
  }

  cuerpoTablaDistributivo.innerHTML = distributivo
    .map((g) => {
      const asignatura = asignaturas.find((a) => a.id === g.asignaturaId);
      const nombreAsignatura = asignatura ? asignatura.nombre : g.asignaturaId;
      const docente = usuarios.find((u) => u.id === g.docenteId);
      const nombreDocente = docente ? `${docente.nombre} ${docente.apellido}` : "(Sin docente asignado)";
      const numEstudiantes = Array.isArray(g.estudiantes) ? g.estudiantes.length : 0;

      return `
        <tr data-id="${ui.escapar(g.id)}">
          <td>
            <strong>${ui.escapar(nombreAsignatura)}</strong>
          </td>
          <td><span class="chip chip--secundario">${ui.escapar(g.paralelo || "A")}</span></td>
          <td>${ui.escapar(g.periodo || "Sin período")}</td>
          <td>
            <span>👨‍🏫 ${ui.escapar(nombreDocente)}</span>
          </td>
          <td>
            <span>👥 ${numEstudiantes} estudiante(s)</span>
          </td>
          <td style="text-align: right;">
            <div style="display: inline-flex; gap: var(--espacio-s);">
              <button
                type="button"
                class="btn btn--secundario btn--pequeno btn-editar"
                data-id="${ui.escapar(g.id)}"
                aria-label="Editar grupo ${ui.escapar(g.paralelo)}"
              >
                Editar
              </button>
              <button
                type="button"
                class="btn btn--secundario btn--pequeno btn-eliminar"
                data-id="${ui.escapar(g.id)}"
                aria-label="Eliminar grupo ${ui.escapar(g.paralelo)}"
              >
                Eliminar
              </button>
            </div>
          </td>
        </tr>
      `;
    })
    .join("");
}

// Delegación de eventos en la tabla
cuerpoTablaDistributivo.addEventListener("click", async (e) => {
  const btnEditar = e.target.closest(".btn-editar");
  const btnEliminar = e.target.closest(".btn-eliminar");

  if (btnEditar) {
    const id = btnEditar.dataset.id;
    const grupo = distributivo.find((g) => g.id === id);
    if (grupo) abrirModalGrupo(grupo);
    return;
  }

  if (btnEliminar) {
    const id = btnEliminar.dataset.id;
    const grupo = distributivo.find((g) => g.id === id);
    if (!grupo) return;

    const seguro = await ui.confirmar(
      `¿Deseas eliminar el grupo de paralelo "${grupo.paralelo}" (${grupo.periodo})?`
    );
    if (!seguro) return;

    try {
      ui.cargando(true);
      await api.eliminar("distributivo", id);
      ui.aviso("Grupo eliminado del distributivo", "exito");
      await cargarDatos();
    } catch (err) {
      ui.aviso(err.message || "Error al eliminar el grupo", "peligro");
    } finally {
      ui.cargando(false);
    }
  }
});

btnNuevoGrupo.addEventListener("click", () => {
  abrirModalGrupo();
});

// Modal para Crear o Editar Grupo
function abrirModalGrupo(grupo = null) {
  const esEdicion = Boolean(grupo);
  const tituloModal = esEdicion ? "Editar Grupo en Distributivo" : "Nuevo Grupo en Distributivo";

  // Listas de docentes y estudiantes activos
  const docentes = usuarios.filter((u) => u.rol === "docente" && u.activo !== false);
  const todosEstudiantes = usuarios.filter((u) => u.rol === "estudiante" && u.activo !== false);

  // Set en memoria con los estudiantes seleccionados inicialmente
  const seleccionados = new Set(Array.isArray(grupo?.estudiantes) ? grupo.estudiantes : []);

  const formEl = document.createElement("form");
  formEl.className = "pila";
  formEl.noValidate = true;

  // Opciones de asignaturas
  const opcionesAsig = asignaturas
    .map((a) => {
      const selected = grupo?.asignaturaId === a.id ? "selected" : "";
      return `<option value="${ui.escapar(a.id)}" ${selected}>${ui.escapar(a.nombre)} (Nivel ${ui.escapar(a.nivel || "1")})</option>`;
    })
    .join("");

  // Opciones de docentes
  const opcionesDocentes = docentes
    .map((d) => {
      const selected = grupo?.docenteId === d.id ? "selected" : "";
      return `<option value="${ui.escapar(d.id)}" ${selected}>${ui.escapar(d.nombre)} ${ui.escapar(d.apellido)} (${ui.escapar(d.correo)})</option>`;
    })
    .join("");

  formEl.innerHTML = `
    <div class="campo">
      <label for="grupoAsignatura">Asignatura *</label>
      <select id="grupoAsignatura" required>
        <option value="">Selecciona una asignatura</option>
        ${opcionesAsig}
      </select>
    </div>

    <div class="fila" style="gap: var(--espacio-m);">
      <div class="campo" style="flex: 1;">
        <label for="grupoParalelo">Paralelo *</label>
        <input
          type="text"
          id="grupoParalelo"
          required
          value="${ui.escapar(grupo?.paralelo || "A")}"
          placeholder="Ej. A, B, C..."
        >
      </div>

      <div class="campo" style="flex: 1.5;">
        <label for="grupoPeriodo">Período académico *</label>
        <input
          type="text"
          id="grupoPeriodo"
          required
          value="${ui.escapar(grupo?.periodo || "2026-2027")}"
          placeholder="Ej. 2026-2027"
        >
      </div>
    </div>

    <div class="campo">
      <label for="grupoDocente">Docente responsable *</label>
      <select id="grupoDocente" required>
        <option value="">Selecciona al docente</option>
        ${opcionesDocentes}
      </select>
    </div>

    <div class="campo">
      <label>Nómina de Estudiantes</label>
      <div class="estudiantes-seleccionador">
        <div class="estudiantes-buscador-fila">
          <input
            type="search"
            id="buscadorEstudiantes"
            placeholder="Buscar por nombre o correo..."
            style="flex: 1; min-width: 180px;"
          >
          <span class="chip chip--secundario" id="contadorEstudiantes">
            ${seleccionados.size} seleccionados
          </span>
        </div>

        <div class="estudiantes-lista-scroll" id="listaEstudiantesCheckboxes">
          <!-- Renderizado dinámico de casillas -->
        </div>
      </div>
    </div>
  `;

  const listaCheckboxesEl = formEl.querySelector("#listaEstudiantesCheckboxes");
  const buscadorEstudiantes = formEl.querySelector("#buscadorEstudiantes");
  const contadorEstudiantes = formEl.querySelector("#contadorEstudiantes");

  function renderizarCheckboxesEstudiantes(filtro = "") {
    const q = filtro.trim().toLowerCase();
    const filtrados = todosEstudiantes.filter((e) => {
      if (!q) return true;
      const texto = `${e.nombre || ""} ${e.apellido || ""} ${e.correo || ""}`.toLowerCase();
      return texto.includes(q);
    });

    if (filtrados.length === 0) {
      listaCheckboxesEl.innerHTML = `
        <div style="padding: var(--espacio-s); text-align: center; color: var(--texto-suave);">
          No se encontraron estudiantes coincidentes.
        </div>
      `;
      return;
    }

    listaCheckboxesEl.innerHTML = filtrados
      .map((e) => {
        const checked = seleccionados.has(e.id) ? "checked" : "";
        return `
          <label class="item-estudiante">
            <input type="checkbox" value="${ui.escapar(e.id)}" ${checked}>
            <span>${ui.escapar(e.nombre)} ${ui.escapar(e.apellido)}</span>
            <small style="color: var(--texto-suave);">(${ui.escapar(e.correo)})</small>
          </label>
        `;
      })
      .join("");
  }

  // Filtrado reactivo en el buscador de estudiantes
  buscadorEstudiantes.addEventListener("input", () => {
    renderizarCheckboxesEstudiantes(buscadorEstudiantes.value);
  });

  // Escuchar cambios en los checkboxes
  listaCheckboxesEl.addEventListener("change", (e) => {
    const checkbox = e.target.closest("input[type='checkbox']");
    if (!checkbox) return;

    const id = checkbox.value;
    if (checkbox.checked) {
      seleccionados.add(id);
    } else {
      seleccionados.delete(id);
    }
    contadorEstudiantes.textContent = `${seleccionados.size} seleccionados`;
  });

  // Render inicial de la lista
  renderizarCheckboxesEstudiantes();

  ui.modal({
    titulo: tituloModal,
    contenido: formEl,
    acciones: [
      { texto: "Cancelar", valor: false, clase: "btn-secundario" },
      { texto: esEdicion ? "Guardar cambios" : "Crear grupo", valor: true, clase: "btn-primario" }
    ]
  }).then(async (guardar) => {
    if (!guardar) return;

    const asignaturaId = formEl.querySelector("#grupoAsignatura").value;
    const paralelo = formEl.querySelector("#grupoParalelo").value.trim().toUpperCase();
    const periodo = formEl.querySelector("#grupoPeriodo").value.trim();
    const docenteId = formEl.querySelector("#grupoDocente").value;
    const listaEstudiantes = Array.from(seleccionados);

    if (!asignaturaId || !paralelo || !periodo || !docenteId) {
      ui.aviso("Por favor completa todos los campos requeridos (*)", "advertencia");
      return;
    }

    try {
      ui.cargando(true);
      const datosGrupo = {
        asignaturaId,
        paralelo,
        periodo,
        docenteId,
        estudiantes: listaEstudiantes
      };

      if (esEdicion) {
        await api.actualizar("distributivo", grupo.id, datosGrupo);
        ui.aviso("Grupo actualizado correctamente", "exito");
      } else {
        await api.crear("distributivo", datosGrupo);
        ui.aviso("Grupo creado correctamente", "exito");
      }
      await cargarDatos();
    } catch (err) {
      ui.aviso(err.message || "Error al guardar el grupo en el distributivo", "peligro");
    } finally {
      ui.cargando(false);
    }
  });
}

// Carga inicial
cargarDatos();
