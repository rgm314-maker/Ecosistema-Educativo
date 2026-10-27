// publico/js/nucleo/plantilla.js
// Montaje del encabezado, menú lateral filtrado, sesión y pie de página

import { MENU } from "./menu.js";
import { usuarioActual, sincronizarSesion, exigirRol, cerrar } from "./sesion.js";
import { registrarEvento } from "./bitacora.js";
import { aviso, escapar } from "./ui.js";
import { logrosDe } from "./gamificacion.js";
import * as api from "./api.js";
import { montarCampana } from "./notificaciones.js";
import { montarAvatar, decir } from "./avatar.js";

export const NOMBRE = "Ecosistema Educativo";

export async function montarPlantilla({ titulo = "", roles = [] } = {}) {
  await sincronizarSesion();

  // Validación de rol si se especifican roles
  if (roles && roles.length > 0) {
    const permitido = exigirRol(roles);
    if (!permitido) return;
  }

  // Despliegue de avisos pendientes almacenados en sessionStorage
  const avisoGuardado = sessionStorage.getItem("aviso_pendiente");
  if (avisoGuardado) {
    sessionStorage.removeItem("aviso_pendiente");
    try {
      const { texto, tipo } = JSON.parse(avisoGuardado);
      aviso(texto, tipo);
    } catch {
      // Ignorar si el formato es inválido
    }
  }

  // Título de la pestaña
  document.title = `${titulo ? `${titulo} · ` : ""}${NOMBRE}`;

  const usuario = usuarioActual();

  // Si hay sesión activa, se registra el evento en bitácora sin esperar respuesta
  if (usuario) {
    registrarEvento("pagina", window.location.pathname).catch(() => {});
  }

  const contenedorPlantilla = document.getElementById("plantilla");
  if (!contenedorPlantilla) {
    console.warn("No se encontró el elemento #plantilla en la página.");
    return;
  }

  // Filtrado de enlaces de navegación por rol
  const enlacesVisibles = MENU.filter((item) => {
    if (!item.roles || item.roles.includes("publico")) return true;
    if (usuario) {
      if (item.roles.includes("sesion")) return true;
      if (item.roles.includes(usuario.rol)) return true;
    }
    return false;
  });

  const rutaActual = window.location.pathname;

  let noticiasSinLeer = 0;
  let puntosHtml = "";

  if (usuario) {
    try {
      const [noticias, lecturas] = await Promise.all([
        api.listar("noticias"),
        api.listar("lecturas-noticias")
      ]);
      const publicadas = (noticias || []).filter((n) => n.estado === "publicado");
      const idsLeidas = new Set((lecturas || []).map((l) => l.noticiaId));
      noticiasSinLeer = publicadas.filter((n) => !idsLeidas.has(n.id)).length;
    } catch {
      // Ignorar si falla la consulta
    }

    if (usuario.rol === "estudiante") {
      try {
        const logros = await logrosDe("yo");
        const puntos = logros?.puntos || 0;
        puntosHtml = `<span id="puntos-usuario" class="puntos-usuario" title="Puntos acumulados">⭐ ${puntos} pts</span>`;
      } catch {
        puntosHtml = `<span id="puntos-usuario" class="puntos-usuario" title="Puntos acumulados">⭐ 0 pts</span>`;
      }
    }
  }

  const itemsMenuHtml = enlacesVisibles
    .map((item) => {
      const esActual =
        rutaActual === item.href ||
        (rutaActual === "/" && item.href === "/index.html") ||
        (rutaActual.endsWith("/") && item.href.endsWith(rutaActual));

      const attrCurrent = esActual ? ' aria-current="page"' : "";
      const claseActivo = esActual ? " menu__item--activo activo" : "";

      let badgeHtml = "";
      if (item.texto === "Noticias" && noticiasSinLeer > 0) {
        badgeHtml = ` <span class="chip chip--acento" style="font-size: var(--texto-xs); padding: 1px 6px; border-radius: var(--radio-completo); margin-left: auto;">${noticiasSinLeer}</span>`;
      }
      if (item.texto === "Mensajes") {
        badgeHtml = ' <span id="mensajes-no-leidos" class="chip chip--acento oculto" aria-label="Mensajes no leídos"></span>';
      }

      return `<a href="${item.href}" class="menu__item${claseActivo}"${attrCurrent}><span>${item.texto}</span>${badgeHtml}</a>`;
    })
    .join("");

  // Bloque derecho de autenticación en el encabezado
  let bloqueSesionHtml = "";
  if (usuario) {
    bloqueSesionHtml = `
      <div class="fila" style="gap: var(--espacio-s);">
        ${puntosHtml}
        <div id="campana-notificaciones" class="campana"></div>
        <a href="/paginas/perfil.html" class="chip chip--primario" title="Ver mi perfil" style="text-decoration: none;">
          <span>${escapar(usuario.nombre)}</span>
          <small style="opacity: 0.85;">(${escapar(usuario.rol)})</small>
        </a>
        <button type="button" class="btn btn--secundario btn--pequeno" id="btnSalir">
          Salir
        </button>
      </div>
    `;
  } else {
    bloqueSesionHtml = `
      <div class="fila" style="gap: var(--espacio-s);">
        <a href="/paginas/ingreso.html" class="btn btn--secundario btn--pequeno">
          Ingresar
        </a>
        <a href="/paginas/registro.html" class="btn btn--primario btn--pequeno">
          Registrarse
        </a>
      </div>
    `;
  }

  // Renderizado en #plantilla
  contenedorPlantilla.innerHTML = `
    <header class="encabezado app-encabezado">
      <div class="encabezado__interior">
        <div class="fila" style="gap: var(--espacio-s);">
          <button type="button" class="btn btn--secundario btn--pequeno btn-menu-movil" id="btnMenuMovil" aria-label="Abrir o cerrar menú" aria-expanded="false" aria-controls="menuLateral">
            ☰ Menú
          </button>
          <a href="/index.html" style="color: var(--primario); text-decoration: none;">
            <strong class="encabezado__nombre">${NOMBRE}</strong>
          </a>
          ${titulo ? `<span class="encabezado__separador" aria-hidden="true">/</span><span class="encabezado__titulo">${escapar(titulo)}</span>` : ""}
        </div>
        ${bloqueSesionHtml}
      </div>
    </header>
  `;

  // Contenedor principal que une el menú lateral y el contenido de la página
  let layout = document.querySelector(".app-layout");
  const contenido = document.getElementById("contenido");

  if (!layout && contenido) {
    layout = document.createElement("div");
    layout.className = "app-layout";
    contenido.parentNode.insertBefore(layout, contenido);

    const aside = document.createElement("aside");
    aside.className = "menu app-menu";
    aside.id = "menuLateral";
    aside.setAttribute("aria-label", "Menú principal");
    aside.innerHTML = `
      <nav class="pila" style="gap: var(--espacio-xs);" aria-label="Navegación del sistema">
        ${itemsMenuHtml}
      </nav>
    `;

    layout.appendChild(aside);
    layout.appendChild(contenido);
  }

  // Acceso global al tutor, independiente del menú lateral.
  if (usuario?.rol === "estudiante" && rutaActual !== "/paginas/tutor.html" && !document.getElementById("tutor-flotante")) {
    const parametros = new URLSearchParams(window.location.search);
    const temaId = parametros.get("temaId") || (rutaActual === "/paginas/tema.html" ? parametros.get("id") : "");
    const tutorFlotante = document.createElement("a");
    tutorFlotante.id = "tutor-flotante";
    tutorFlotante.className = "tutor-flotante";
    tutorFlotante.href = temaId
      ? `/paginas/tutor.html?temaId=${encodeURIComponent(temaId)}`
      : "/paginas/tutor.html";
    tutorFlotante.setAttribute("aria-label", "Abrir tutor socrático");
    tutorFlotante.title = "Abrir tutor socrático";
    tutorFlotante.innerHTML = '<span class="tutor-flotante__icono" aria-hidden="true">?</span><span>Tutor IA</span>';
    document.body.appendChild(tutorFlotante);
  }

  // Asignar acción al botón Salir si está presente
  const btnSalir = document.getElementById("btnSalir");
  if (btnSalir) {
    btnSalir.addEventListener("click", () => {
      cerrar();
    });
  }

  // Pie de página al final del body
  let pieExistente = document.querySelector("footer.pie");
  if (!pieExistente) {
    const pie = document.createElement("footer");
    pie.className = "pie app-pie";
    const anio = new Date().getFullYear();
    pie.innerHTML = `
      <div class="contenedor fila" style="justify-content: space-between; flex-wrap: wrap; gap: var(--espacio-s);">
        <p style="margin: 0;">© ${anio} ${NOMBRE} · Universidad Estatal de Milagro</p>
        <p style="margin: 0;"><small>Plataforma Educativa Digital</small></p>
      </div>
    `;
    document.body.appendChild(pie);
  }

  // Control interactivo del menú móvil
  const btnMenu = document.getElementById("btnMenuMovil");
  const menuLateral = document.getElementById("menuLateral");

  if (btnMenu && menuLateral) {
    btnMenu.addEventListener("click", () => {
      const abierto = menuLateral.classList.toggle("menu--abierto");
      btnMenu.setAttribute("aria-expanded", String(abierto));
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && menuLateral.classList.contains("menu--abierto")) {
        menuLateral.classList.remove("menu--abierto");
        btnMenu.setAttribute("aria-expanded", "false");
        btnMenu.focus();
      }
    });

    menuLateral.querySelectorAll("a").forEach((enlace) => {
      enlace.addEventListener("click", () => {
        if (window.innerWidth <= 768) {
          menuLateral.classList.remove("menu--abierto");
          btnMenu.setAttribute("aria-expanded", "false");
        }
      });
    });
  }

  if (usuario) montarCampana().catch(() => {});

  const instruccionesAvatar = contenido?.dataset.avatar?.trim();
  if (instruccionesAvatar) {
    montarAvatar();
    decir(instruccionesAvatar);
  }

  return usuario;
}
