// publico/js/modulos/admin-usuarios.js
// Panel de administración de usuarios, roles, estado y contraseñas temporales

import { montarPlantilla } from '../nucleo/plantilla.js';
import * as api from '../nucleo/api.js';
import * as ui from '../nucleo/ui.js';

await montarPlantilla({ titulo: "Usuarios", roles: ["admin"] });

const filtroTexto = document.getElementById("filtroTexto");
const filtroRol = document.getElementById("filtroRol");
const conteoUsuarios = document.getElementById("conteoUsuarios");
const cuerpoTablaUsuarios = document.getElementById("cuerpoTablaUsuarios");

let usuarios = [];

// Cargar lista completa de usuarios
async function cargarUsuarios() {
  try {
    ui.cargando(true);
    usuarios = await api.listar("usuarios");
    renderizarUsuarios();
  } catch (err) {
    ui.aviso(err.message || "Error al cargar la lista de usuarios", "peligro");
    cuerpoTablaUsuarios.innerHTML = `
      <tr>
        <td colspan="4" style="text-align: center; color: var(--color-peligro); padding: var(--espacio-l);">
          No se pudieron cargar los usuarios. Verifica tus permisos.
        </td>
      </tr>
    `;
  } finally {
    ui.cargando(false);
  }
}

// Filtrar y renderizar la tabla
function renderizarUsuarios() {
  const query = (filtroTexto.value || "").trim().toLowerCase();
  const rolSeleccionado = filtroRol.value;

  const filtrados = usuarios.filter((u) => {
    const textoCompleto = `${u.nombre || ""} ${u.apellido || ""} ${u.correo || ""}`.toLowerCase();
    const coincideTexto = !query || textoCompleto.includes(query);
    const coincideRol = !rolSeleccionado || u.rol === rolSeleccionado;
    return coincideTexto && coincideRol;
  });

  conteoUsuarios.textContent = `Mostrando ${filtrados.length} de ${usuarios.length} usuarios`;

  if (filtrados.length === 0) {
    cuerpoTablaUsuarios.innerHTML = `
      <tr>
        <td colspan="4" style="text-align: center; color: var(--color-texto-suave); padding: var(--espacio-xl);">
          No se encontraron usuarios con los criterios de búsqueda.
        </td>
      </tr>
    `;
    return;
  }

  cuerpoTablaUsuarios.innerHTML = filtrados.map((u) => {
    const iniciales = `${(u.nombre || "U")[0]}${(u.apellido || "")[0] || ""}`.toUpperCase();
    const avatarHtml = u.foto
      ? `<img src="${ui.escapar(u.foto)}" alt="Avatar de ${ui.escapar(u.nombre)}">`
      : `<span>${ui.escapar(iniciales)}</span>`;

    return `
      <tr data-id="${ui.escapar(u.id)}">
        <td>
          <div class="usuario-celda">
            <div class="usuario-celda__avatar">
              ${avatarHtml}
            </div>
            <div class="usuario-celda__info">
              <span class="usuario-celda__nombre">${ui.escapar(u.nombre || "")} ${ui.escapar(u.apellido || "")}</span>
              <span class="usuario-celda__correo">${ui.escapar(u.correo || "")}</span>
            </div>
          </div>
        </td>
        <td>
          <select class="selector-rol" data-id="${ui.escapar(u.id)}" aria-label="Rol de ${ui.escapar(u.nombre)}">
            <option value="estudiante" ${u.rol === "estudiante" ? "selected" : ""}>Estudiante</option>
            <option value="docente" ${u.rol === "docente" ? "selected" : ""}>Docente</option>
            <option value="admin" ${u.rol === "admin" ? "selected" : ""}>Administrador</option>
          </select>
        </td>
        <td>
          <label class="admin-control-inline">
            <input
              type="checkbox"
              class="casilla-activo"
              data-id="${ui.escapar(u.id)}"
              ${u.activo ? "checked" : ""}
            >
            <span>${u.activo ? "Activo" : "Inactivo"}</span>
          </label>
        </td>
        <td>
          <button
            type="button"
            class="btn btn--secundario btn--pequeno btn-restablecer"
            data-id="${ui.escapar(u.id)}"
            data-nombre="${ui.escapar((u.nombre || "") + " " + (u.apellido || ""))}"
          >
            Restablecer clave
          </button>
        </td>
      </tr>
    `;
  }).join("");
}

// Delegación de eventos en la tabla
cuerpoTablaUsuarios.addEventListener("change", async (e) => {
  const target = e.target;
  const id = target.dataset.id;
  if (!id) return;

  // Cambio de rol
  if (target.classList.contains("selector-rol")) {
    const nuevoRol = target.value;
    const usuario = usuarios.find((u) => u.id === id);
    const rolAnterior = usuario ? usuario.rol : "estudiante";

    try {
      target.disabled = true;
      await api.actualizar("usuarios", id, { rol: nuevoRol });
      if (usuario) usuario.rol = nuevoRol;
      ui.aviso(`Rol actualizado a "${nuevoRol}" correctamente`, "exito");
    } catch (err) {
      target.value = rolAnterior;
      ui.aviso(err.message || "No se pudo actualizar el rol", "peligro");
    } finally {
      target.disabled = false;
    }
    return;
  }

  // Cambio de estado activo
  if (target.classList.contains("casilla-activo")) {
    const nuevoEstado = target.checked;
    const labelTexto = target.closest("label")?.querySelector("span");
    const usuario = usuarios.find((u) => u.id === id);

    try {
      target.disabled = true;
      await api.actualizar("usuarios", id, { activo: nuevoEstado });
      if (usuario) usuario.activo = nuevoEstado;
      if (labelTexto) labelTexto.textContent = nuevoEstado ? "Activo" : "Inactivo";
      ui.aviso(nuevoEstado ? "Usuario activado" : "Usuario desactivado", "info");
    } catch (err) {
      target.checked = !nuevoEstado;
      if (labelTexto) labelTexto.textContent = !nuevoEstado ? "Activo" : "Inactivo";
      ui.aviso(err.message || "No se pudo actualizar el estado", "peligro");
    } finally {
      target.disabled = false;
    }
  }
});

cuerpoTablaUsuarios.addEventListener("click", async (e) => {
  const btnRestablecer = e.target.closest(".btn-restablecer");
  if (!btnRestablecer) return;

  const id = btnRestablecer.dataset.id;
  const nombre = btnRestablecer.dataset.nombre || "el usuario";

  const confirmado = await ui.confirmar(`¿Deseas restablecer la contraseña para ${nombre}? Se generará una clave temporal.`);
  if (!confirmado) return;

  try {
    ui.cargando(true);
    const resultado = await api.llamar("POST", `/api/admin/usuarios/${encodeURIComponent(id)}/restablecer`);
    const claveTemporal = resultado.claveTemporal;

    // Crear contenido del modal con botón de copia interactivo
    const contenedorModal = document.createElement("div");
    contenedorModal.className = "pila";
    contenedorModal.innerHTML = `
      <p>Se ha generado una nueva contraseña temporal para <strong>${ui.escapar(nombre)}</strong>.</p>
      <div class="clave-temporal-box">
        <span class="clave-temporal-codigo" id="claveCodigo">${ui.escapar(claveTemporal)}</span>
        <button type="button" class="btn btn--primario btn--pequeno" id="btnCopiarClave">
          Copiar
        </button>
      </div>
      <p style="font-size: var(--tamano-texto-sm); color: var(--color-texto-suave);">
        Proporciona esta clave al usuario de manera segura. Podrá actualizarla desde su perfil tras ingresar.
      </p>
    `;

    const btnCopiar = contenedorModal.querySelector("#btnCopiarClave");
    btnCopiar.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(claveTemporal);
        btnCopiar.textContent = "¡Copiado!";
        setTimeout(() => {
          btnCopiar.textContent = "Copiar";
        }, 2000);
      } catch (_) {
        ui.aviso("No se pudo copiar automáticamente. Por favor selecciónala manualmente.", "aviso");
      }
    });

    await ui.modal({
      titulo: "Contraseña Restablecida",
      contenido: contenedorModal,
      acciones: [
        { texto: "Cerrar", valor: true, clase: "btn-primario" }
      ]
    });
  } catch (err) {
    ui.aviso(err.message || "Error al restablecer la contraseña", "peligro");
  } finally {
    ui.cargando(false);
  }
});

// Eventos de filtrado en vivo
filtroTexto.addEventListener("input", renderizarUsuarios);
filtroRol.addEventListener("change", renderizarUsuarios);

// Carga inicial
cargarUsuarios();
