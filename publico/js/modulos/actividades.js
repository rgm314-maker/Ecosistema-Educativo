// publico/js/modulos/actividades.js
// Catálogo de actividades lúdicas y formativas

import { montarPlantilla } from "../nucleo/plantilla.js";
import { ACTIVIDADES } from "../nucleo/catalogo-actividades.js";
import * as ui from "../nucleo/ui.js";
import * as util from "../nucleo/util.js";

const usuario = await montarPlantilla({
  titulo: "Actividades",
  roles: ["estudiante", "docente"]
});

const contenedor = document.getElementById("contenido");
const temaIdUrl = util.parametro("temaId");

function obtenerIconoActividad(id) {
  switch (id) {
    case "ahorcado": return "🎈";
    case "canciones": return "🎵";
    case "pareja": return "🃏";
    case "sopa-letras": return "🔍";
    case "crucigrama": return "✏️";
    case "quiz": return "❓";
    case "simulacion": return "🎭";
    default: return "🎯";
  }
}

function renderizar() {
  const queryTema = temaIdUrl ? `?temaId=${encodeURIComponent(temaIdUrl)}` : "";

  contenedor.innerHTML = `
    <div class="fila" style="justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: var(--espacio-m);">
      <div>
        <h1 style="margin: 0;">Actividades de Aprendizaje</h1>
        <p style="color: var(--texto-suave); margin: 0;">Practica, gana puntos y refuerza tus conocimientos mediante juegos interactivos</p>
      </div>
    </div>

    ${usuario?.rol === "docente" ? `
      <section class="tarjeta pila">
        <h2>Preparar actividades para estudiantes</h2>
        <p>Los juegos se construyen con el glosario de cada tema. Crea el tema y usa <strong>Generar material para juegos</strong>; el quiz se alimenta desde el banco de preguntas.</p>
        <div class="fila">
          <a class="btn btn--primario" href="/paginas/editor-contenidos.html">Gestionar contenidos y juegos</a>
          <a class="btn btn--secundario" href="/paginas/banco-preguntas.html">Gestionar quiz</a>
        </div>
      </section>
    ` : ""}

    <div class="grid-actividades">
      ${ACTIVIDADES.filter((act) => !act.roles || act.roles.includes(usuario?.rol)).map((act) => {
        const urlFinal = `${act.href}${queryTema}`;
        const icono = obtenerIconoActividad(act.id);

        return `
          <article class="tarjeta-actividad">
            <div class="tarjeta-actividad__cabecera">
              <div class="tarjeta-actividad__icono" aria-hidden="true">${icono}</div>
              <h2 class="tarjeta-actividad__titulo">${ui.escapar(act.texto)}</h2>
            </div>

            <p class="tarjeta-actividad__desc">${ui.escapar(act.descripcion)}</p>

            <a href="${urlFinal}" class="btn btn--primario" style="align-self: flex-start;">
              Jugar ahora →
            </a>
          </article>
        `;
      }).join("")}
    </div>
  `;
}

renderizar();
