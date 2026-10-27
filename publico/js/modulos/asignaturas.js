// publico/js/modulos/asignaturas.js
// Catálogo de asignaturas asignadas al estudiante con métricas de avance

import { montarPlantilla } from '../nucleo/plantilla.js';
import * as api from '../nucleo/api.js';
import * as ui from '../nucleo/ui.js';

export async function calcularAvance(asignaturaId) {
  try {
    const [unidades, temas, progresos] = await Promise.all([
      api.listar("unidades"),
      api.listar("temas"),
      api.listar("progreso-temas")
    ]);

    const idsUnidades = new Set(
      (unidades || [])
        .filter((u) => u.asignaturaId === asignaturaId && u.visible !== false)
        .map((u) => u.id)
    );

    const temasValidos = (temas || []).filter(
      (t) => idsUnidades.has(t.unidadId) && t.estado === "publicado"
    );
    const idsTemasValidos = new Set(temasValidos.map((t) => t.id));

    const revisados = (progresos || []).filter((p) => idsTemasValidos.has(p.temaId)).length;
    const total = temasValidos.length;
    const porcentaje = total > 0 ? Math.round((revisados / total) * 100) : 0;

    return { total, revisados, porcentaje };
  } catch {
    return { total: 0, revisados: 0, porcentaje: 0 };
  }
}

async function cargarAsignaturas() {
  try {
    ui.cargando(true);
    const asignaturas = await api.listar("asignaturas");

    if (!Array.isArray(asignaturas) || asignaturas.length === 0) {
      gridMisAsignaturas.innerHTML = `
        <div class="vacio" style="grid-column: 1 / -1;">
          <span class="vacio__icono">📚</span>
          <h2 class="vacio__titulo">Sin asignaturas registradas</h2>
          <p class="vacio__texto">Actualmente no estás matriculado en ninguna materia curricular.</p>
        </div>
      `;
      return;
    }

    // Calcular avances en paralelo para cada asignatura
    const avances = await Promise.all(
      asignaturas.map((asig) => calcularAvance(asig.id))
    );

    gridMisAsignaturas.innerHTML = asignaturas
      .map((asig, index) => {
        const { total, revisados, porcentaje } = avances[index];

        return `
          <article class="tarjeta-materia" data-id="${ui.escapar(asig.id)}">
            <div class="tarjeta-materia__cuerpo">
              <span class="chip chip--primario tarjeta-materia__nivel">
                Nivel ${ui.escapar(asig.nivel || "1")}
              </span>
              <h2 class="tarjeta-materia__titulo">${ui.escapar(asig.nombre)}</h2>
              <p class="tarjeta-materia__desc">
                ${ui.escapar(asig.descripcion || "Materia curricular.")}
              </p>
            </div>

            <div class="tarjeta-materia__avance-bloque">
              <div class="tarjeta-materia__avance-info">
                <span>Avance curricular</span>
                <strong style="color: var(--primario);">${porcentaje}%</strong>
              </div>

              <div class="barra-progreso" role="progressbar" aria-valuenow="${porcentaje}" aria-valuemin="0" aria-valuemax="100" aria-label="Avance en ${ui.escapar(asig.nombre)}">
                <div class="barra-progreso__relleno" style="width: ${porcentaje}%;"></div>
              </div>

              <small style="color: var(--texto-suave);">
                ${revisados} de ${total} temas completados
              </small>

              <a
                href="/paginas/asignatura.html?id=${encodeURIComponent(asig.id)}"
                class="btn btn--primario btn--pequeno"
                style="margin-top: var(--espacio-s); align-self: flex-start;"
              >
                Ingresar a la materia →
              </a>
            </div>
          </article>
        `;
      })
      .join("");
  } catch (err) {
    ui.aviso(err.message || "Error al cargar asignaturas", "peligro");
    gridMisAsignaturas.innerHTML = `
      <div class="tarjeta" style="grid-column: 1 / -1; text-align: center; color: var(--error);">
        No se pudieron cargar las materias. Inténtalo más tarde.
      </div>
    `;
  } finally {
    ui.cargando(false);
  }
}

const gridMisAsignaturas = document.getElementById("gridMisAsignaturas");
if (gridMisAsignaturas) {
  await montarPlantilla({ titulo: "Mis Asignaturas", roles: ["estudiante", "docente", "admin"] });
  cargarAsignaturas();
}
