// publico/js/nucleo/ui.js
// Utilidades de interfaz y componentes accesibles

export function escapar(texto) {
  if (texto === null || texto === undefined) return "";
  return String(texto)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function limpiar(html) {
  if (typeof window !== "undefined" && window.DOMPurify && typeof window.DOMPurify.sanitize === "function") {
    return window.DOMPurify.sanitize(html);
  }
  return escapar(html);
}

export function aviso(texto, tipo = "info") {
  let contenedor = document.getElementById("contenedor-avisos");
  if (!contenedor) {
    contenedor = document.createElement("div");
    contenedor.id = "contenedor-avisos";
    contenedor.setAttribute("aria-live", "polite");
    contenedor.setAttribute("aria-atomic", "true");
    contenedor.className = "contenedor-avisos";
    document.body.appendChild(contenedor);
  }

  const toast = document.createElement("div");
  toast.className = `aviso aviso-${tipo}`;
  toast.setAttribute("role", "status");
  toast.textContent = texto;

  contenedor.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, 4000);
}

export function modal({ titulo = "", contenido = "", acciones = [] } = {}) {
  return new Promise((resolve) => {
    const elementoPrevio = document.activeElement;

    const overlay = document.createElement("div");
    overlay.className = "modal-overlay";

    const dialog = document.createElement("div");
    dialog.className = "modal-dialog";
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    const idTitulo = `modal-titulo-${Date.now()}`;
    if (titulo) {
      dialog.setAttribute("aria-labelledby", idTitulo);
    }

    let cabeceraHtml = "";
    if (titulo) {
      cabeceraHtml = `<div class="modal-cabecera"><h2 id="${idTitulo}" class="modal-titulo">${escapar(titulo)}</h2></div>`;
    }

    dialog.innerHTML = `
      ${cabeceraHtml}
      <div class="modal-cuerpo"></div>
      <div class="modal-acciones"></div>
    `;

    const cuerpoEl = dialog.querySelector(".modal-cuerpo");
    if (typeof contenido === "string") {
      cuerpoEl.innerHTML = contenido;
    } else if (contenido instanceof Node) {
      cuerpoEl.appendChild(contenido);
    }

    const accionesEl = dialog.querySelector(".modal-acciones");
    const listaAcciones = acciones.length > 0 ? acciones : [{ texto: "Aceptar", valor: true, clase: "btn-primario" }];

    let cerrado = false;
    const cerrar = (valor) => {
      if (cerrado) return;
      cerrado = true;
      document.removeEventListener("keydown", manejarTeclado);
      overlay.remove();
      if (elementoPrevio && typeof elementoPrevio.focus === "function") {
        elementoPrevio.focus();
      }
      resolve(valor);
    };

    listaAcciones.forEach((act) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `btn ${act.clase || "btn-secundario"}`;
      btn.textContent = act.texto;
      btn.addEventListener("click", () => cerrar(act.valor !== undefined ? act.valor : null));
      accionesEl.appendChild(btn);
    });

    overlay.appendChild(dialog);
    document.body.appendChild(overlay);

    const selectorFocables = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
    const elementosFocables = () => Array.from(dialog.querySelectorAll(selectorFocables)).filter(el => !el.disabled && el.offsetParent !== null);

    const focables = elementosFocables();
    if (focables.length > 0) {
      focables[0].focus();
    } else {
      dialog.setAttribute("tabindex", "-1");
      dialog.focus();
    }

    function manejarTeclado(e) {
      if (e.key === "Escape") {
        e.preventDefault();
        cerrar(null);
        return;
      }

      if (e.key === "Tab") {
        const items = elementosFocables();
        if (items.length === 0) {
          e.preventDefault();
          return;
        }
        const primero = items[0];
        const ultimo = items[items.length - 1];

        if (e.shiftKey && document.activeElement === primero) {
          e.preventDefault();
          ultimo.focus();
        } else if (!e.shiftKey && document.activeElement === ultimo) {
          e.preventDefault();
          primero.focus();
        }
      }
    }

    document.addEventListener("keydown", manejarTeclado);
  });
}

export async function confirmar(texto) {
  const respuesta = await modal({
    titulo: "Confirmación",
    contenido: `<p>${escapar(texto)}</p>`,
    acciones: [
      { texto: "Cancelar", valor: false, clase: "btn-secundario" },
      { texto: "Aceptar", valor: true, clase: "btn-primario" }
    ]
  });
  return Boolean(respuesta);
}

export function cargando(activar) {
  let spinner = document.querySelector(".cargando");
  if (activar) {
    if (!spinner) {
      spinner = document.createElement("div");
      spinner.className = "cargando";
      spinner.setAttribute("aria-live", "polite");
      spinner.setAttribute("aria-label", "Cargando");
      document.body.appendChild(spinner);
    }
    spinner.style.display = "";
  } else if (spinner) {
    spinner.remove();
  }
}
