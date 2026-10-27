// publico/js/modulos/inicio.js
// Página principal del Ecosistema Educativo (vistas con y sin sesión activa)

import { montarPlantilla } from "../nucleo/plantilla.js";
import { usuarioActual } from "../nucleo/sesion.js";
import { calcularAvance } from "./asignaturas.js";
import * as api from "../nucleo/api.js";
import * as ui from "../nucleo/ui.js";
import * as util from "../nucleo/util.js";

await montarPlantilla({
  titulo: "Inicio",
  roles: ["publico"]
});

const usuario = usuarioActual();
const contenedor = document.getElementById("contenido");

async function iniciar() {
  if (!usuario) {
    renderizarSinSesion();
  } else {
    await renderizarConSesion();
  }
}

function renderizarSinSesion() {
  contenedor.innerHTML = `
    <div class="pila" style="gap: var(--espacio-xl);">
      <!-- Hero de bienvenida -->
      <section class="inicio-hero">
        <span class="chip chip--primario">Plataforma Académica Digital</span>
        <h1 class="inicio-hero__titulo">Aprende, participa y potencia tus conocimientos</h1>
        <p class="inicio-hero__desc">
          Accede a contenidos interactivos, canciones educativas, foros y actividades gamificadas diseñadas para tu formación universitaria.
        </p>
        <div class="inicio-hero__botones">
          <a href="/paginas/ingreso.html" class="btn btn--primario">
            Ingresar al ecosistema
          </a>
          <a href="/paginas/registro.html" class="btn btn--secundario">
            Crear cuenta de estudiante
          </a>
        </div>
      </section>

      <!-- Pilares del ecosistema -->
      <section class="grid-auto">
        <article class="tarjeta">
          <div class="fila" style="gap: var(--espacio-s); margin-bottom: var(--espacio-xs);">
            <span style="font-size: var(--texto-xl);">📚</span>
            <h2 style="font-size: var(--texto-l); margin: 0;">Contenidos Curriculares</h2>
          </div>
          <p style="color: var(--texto-suave); font-size: var(--texto-s);">
            Unidades didácticas estructuradas con objetivos claros, resúmenes, lecturas y recursos multimedia.
          </p>
        </article>

        <article class="tarjeta">
          <div class="fila" style="gap: var(--espacio-s); margin-bottom: var(--espacio-xs);">
            <span style="font-size: var(--texto-xl);">🎵</span>
            <h2 style="font-size: var(--texto-l); margin: 0;">Canciones y Audio</h2>
          </div>
          <p style="color: var(--texto-suave); font-size: var(--texto-s);">
            Material auditivo con letras sincronizadas para fijar conceptos clave de forma amena y efectiva.
          </p>
        </article>

        <article class="tarjeta">
          <div class="fila" style="gap: var(--espacio-s); margin-bottom: var(--espacio-xs);">
            <span style="font-size: var(--texto-xl);">🏆</span>
            <h2 style="font-size: var(--texto-l); margin: 0;">Gamificación y Logros</h2>
          </div>
          <p style="color: var(--texto-suave); font-size: var(--texto-s);">
            Gana puntos, desbloquea insignias y obtén diplomas al superar desafíos y prácticas.
          </p>
        </article>
      </section>
    </div>
  `;
}

async function renderizarConSesion() {
  ui.cargando(true);

  let misAsignaturas = [];
  let noticiasRecientes = [];
  let avancesPorAsignatura = [];

  try {
    const [asigs, noticias] = await Promise.all([
      api.listar("asignaturas"),
      api.listar("noticias")
    ]);

    misAsignaturas = asigs || [];

    // Calcular avance para cada asignatura
    avancesPorAsignatura = await Promise.all(
      misAsignaturas.map((a) => calcularAvance(a.id))
    );

    // Filtrar noticias publicadas y ordenar: destacadas primero, luego por fecha reciente
    const publicadas = (noticias || []).filter((n) => n.estado === "publicado");
    publicadas.sort((a, b) => {
      const destA = Boolean(a.destacada);
      const destB = Boolean(b.destacada);
      if (destA && !destB) return -1;
      if (!destA && destB) return 1;

      const fA = new Date(a.fechaPublicacion || a.fecha || 0).getTime();
      const fB = new Date(b.fechaPublicacion || b.fecha || 0).getTime();
      return fB - fA;
    });

    noticiasRecientes = publicadas.slice(0, 3);
  } catch (err) {
    ui.aviso(err.message || "Error al cargar datos de inicio", "error");
  } finally {
    ui.cargando(false);
  }

  // Leer último tema desde localStorage
  let ultimoTema = null;
  const rawUltimoTema = localStorage.getItem("ultimoTema");
  if (rawUltimoTema) {
    try {
      ultimoTema = JSON.parse(rawUltimoTema);
    } catch {
      ultimoTema = null;
    }
  }

  const esDocenteOAdmin = usuario.rol === "docente" || usuario.rol === "admin";

  contenedor.innerHTML = `
    <div class="pila" style="gap: var(--espacio-xl);">
      <!-- Saludo inicial -->
      <section class="fila" style="justify-content: space-between; align-items: center; flex-wrap: wrap; gap: var(--espacio-m);">
        <div>
          <h1 style="margin: 0; font-size: var(--texto-2xl);">¡Hola, ${ui.escapar(usuario.nombre)}!</h1>
          <p style="margin: 0; color: var(--texto-suave);">Bienvenido a tu panel de estudio e interacción académica</p>
        </div>
        <span class="chip chip--primario" style="text-transform: capitalize;">
          Rol: ${ui.escapar(usuario.rol)}
        </span>
      </section>

      <!-- Continuar donde te quedaste -->
      ${
        ultimoTema && ultimoTema.id
          ? `
            <section class="tarjeta-continuar">
              <div class="tarjeta-continuar__info">
                <span style="font-size: var(--texto-xs); color: var(--texto-suave); font-weight: var(--peso-negrita); text-transform: uppercase; letter-spacing: 0.05em;">
                  Continuar donde te quedaste
                </span>
                <h2 class="tarjeta-continuar__titulo">📖 ${ui.escapar(ultimoTema.titulo || "Tema en curso")}</h2>
              </div>
              <a href="/paginas/tema.html?id=${encodeURIComponent(ultimoTema.id)}" class="btn btn--primario">
                Reanudar estudio →
              </a>
            </section>
          `
          : ""
      }

      <!-- Accesos rápidos para docentes y admin -->
      ${
        esDocenteOAdmin
          ? `
            <section class="pila" style="gap: var(--espacio-s);">
              <h2 style="font-size: var(--texto-l); margin: 0;">Gestión Académica</h2>
              <div class="accesos-rapidos-grid">
                <a href="/paginas/editor-contenidos.html" class="acceso-rapido-card">
                  <div class="acceso-rapido-icono">📑</div>
                  <div>
                    <strong style="color: var(--primario); display: block;">Contenidos</strong>
                    <small style="color: var(--texto-suave);">Unidades y temas</small>
                  </div>
                </a>

                <a href="/paginas/noticias.html" class="acceso-rapido-card">
                  <div class="acceso-rapido-icono">📰</div>
                  <div>
                    <strong style="color: var(--primario); display: block;">Noticias</strong>
                    <small style="color: var(--texto-suave);">Publicar y editar</small>
                  </div>
                </a>

                <a href="/paginas/canciones.html" class="acceso-rapido-card">
                  <div class="acceso-rapido-icono">🎵</div>
                  <div>
                    <strong style="color: var(--primario); display: block;">Canciones</strong>
                    <small style="color: var(--texto-suave);">Música educativa</small>
                  </div>
                </a>
              </div>
            </section>
          `
          : ""
      }

      <!-- Mis Asignaturas con su avance -->
      <section class="pila" style="gap: var(--espacio-m);">
        <div class="fila" style="justify-content: space-between; align-items: center;">
          <h2 style="font-size: var(--texto-l); margin: 0;">Mis Asignaturas</h2>
          <a href="/paginas/asignaturas.html" class="btn btn--secundario btn--pequeno">Ver todas</a>
        </div>

        ${
          misAsignaturas.length === 0
            ? `
              <div class="vacio">
                <span class="vacio__icono">📚</span>
                <h3 class="vacio__titulo">No tienes materias asignadas</h3>
                <p class="vacio__texto">Actualmente no estás registrado en materias curriculares.</p>
              </div>
            `
            : `
              <div class="grid-asignaturas-inicio">
                ${misAsignaturas
                  .map((asig, idx) => {
                    const avance = avancesPorAsignatura[idx] || { total: 0, revisados: 0, porcentaje: 0 };
                    return `
                      <article class="tarjeta-asignatura-inicio">
                        <div>
                          <div class="fila" style="justify-content: space-between; margin-bottom: var(--espacio-xs);">
                            <span class="chip chip--primario">Nivel ${ui.escapar(asig.nivel || "1")}</span>
                            <strong style="color: var(--primario); font-size: var(--texto-s);">${avance.porcentaje}%</strong>
                          </div>
                          <h3 style="font-size: var(--texto-m); margin: 0; color: var(--primario);">${ui.escapar(asig.nombre)}</h3>
                          <p style="font-size: var(--texto-xs); color: var(--texto-suave); margin-top: var(--espacio-xs);">
                            ${ui.escapar(asig.descripcion || "")}
                          </p>
                        </div>

                        <div class="pila" style="gap: var(--espacio-xs);">
                          <div class="barra-progreso" role="progressbar" aria-valuenow="${avance.porcentaje}" aria-valuemin="0" aria-valuemax="100">
                            <div class="barra-progreso__relleno" style="width: ${avance.porcentaje}%;"></div>
                          </div>
                          <small style="color: var(--texto-suave);">${avance.revisados} de ${avance.total} temas revisados</small>
                          <a href="/paginas/asignatura.html?id=${encodeURIComponent(asig.id)}" class="btn btn--secundario btn--pequeno" style="margin-top: var(--espacio-xs); align-self: flex-start;">
                            Ir a la materia →
                          </a>
                        </div>
                      </article>
                    `;
                  })
                  .join("")}
              </div>
            `
        }
      </section>

      <!-- Noticias publicadas más recientes -->
      <section class="pila" style="gap: var(--espacio-m);">
        <div class="fila" style="justify-content: space-between; align-items: center;">
          <h2 style="font-size: var(--texto-l); margin: 0;">Noticias Recientes</h2>
          <a href="/paginas/noticias.html" class="btn btn--secundario btn--pequeno">Ver todas</a>
        </div>

        ${
          noticiasRecientes.length === 0
            ? `
              <div class="vacio">
                <span class="vacio__icono">📰</span>
                <h3 class="vacio__titulo">No hay noticias publicadas</h3>
                <p class="vacio__texto">Pronto se publicarán novedades institucionales y académicas.</p>
              </div>
            `
            : `
              <div class="grid-noticias-recientes">
                ${noticiasRecientes
                  .map((n) => {
                    const fechaTexto = n.fechaPublicacion
                      ? util.fechaRelativa(n.fechaPublicacion)
                      : (n.fecha ? util.fechaRelativa(n.fecha) : "Reciente");

                    return `
                      <article class="tarjeta-noticia-reciente${n.destacada ? " tarjeta-noticia-reciente--destacada" : ""}">
                        <div class="pila" style="gap: var(--espacio-xs);">
                          <div class="fila" style="gap: var(--espacio-xs);">
                            <span class="chip chip--primario">${ui.escapar(n.categoria || "General")}</span>
                            ${n.destacada ? `<span class="chip chip--acento">★ Destacada</span>` : ""}
                          </div>
                          <h3 class="tarjeta-noticia-reciente__titulo">
                            <a href="/paginas/noticia.html?id=${encodeURIComponent(n.id)}">${ui.escapar(n.titulo)}</a>
                          </h3>
                          <p class="tarjeta-noticia-reciente__resumen">${ui.escapar(n.resumen || "")}</p>
                        </div>
                        <div class="fila" style="justify-content: space-between; font-size: var(--texto-xs); color: var(--texto-suave); margin-top: var(--espacio-xs);">
                          <span>${ui.escapar(fechaTexto)}</span>
                          <a href="/paginas/noticia.html?id=${encodeURIComponent(n.id)}" class="btn btn--texto btn--pequeno">Leer →</a>
                        </div>
                      </article>
                    `;
                  })
                  .join("")}
              </div>
            `
        }
      </section>
    </div>
  `;
}

iniciar();
