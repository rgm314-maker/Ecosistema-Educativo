// publico/js/modulos/prueba-datos.js
// Módulo de prueba de operaciones CRUD sobre la colección "prueba"

import { montarPlantilla } from "../nucleo/plantilla.js";
import { crear, listar } from "../nucleo/api.js";
import { aviso, escapar } from "../nucleo/ui.js";
import { fechaLarga } from "../nucleo/util.js";

await montarPlantilla({ titulo: "Prueba de datos", roles: ["publico"] });

const form = document.getElementById("formPrueba");
const campoTexto = document.getElementById("campoTexto");
const errorTexto = document.getElementById("errorTexto");
const btnGuardar = document.getElementById("btnGuardar");
const btnRecargar = document.getElementById("btnRecargar");
const contenedorLista = document.getElementById("contenedorLista");

// Carga y renderizado de la lista de registros
async function cargarRegistros() {
  contenedorLista.innerHTML = `<div class="cargando" aria-label="Cargando registros"></div>`;
  try {
    const lista = await listar("prueba");

    if (!Array.isArray(lista) || lista.length === 0) {
      contenedorLista.innerHTML = `
        <div class="vacio">
          <div class="vacio__icono" aria-hidden="true">📭</div>
          <h3 class="vacio__titulo">No hay registros aún</h3>
          <p class="vacio__texto">Usa el formulario a la izquierda para agregar el primer registro a la colección.</p>
        </div>
      `;
      return;
    }

    const filasHtml = lista
      .map((item) => {
        const id = escapar(item.id || "-");
        const texto = escapar(item.texto || "");
        const fecha = item.fecha ? escapar(fechaLarga(item.fecha)) : "-";

        return `
          <tr>
            <td><code>${id}</code></td>
            <td>${texto}</td>
            <td><small>${fecha}</small></td>
          </tr>
        `;
      })
      .join("");

    contenedorLista.innerHTML = `
      <div class="tabla-contenedor">
        <table class="tabla">
          <thead>
            <tr>
              <th scope="col">ID</th>
              <th scope="col">Texto</th>
              <th scope="col">Fecha</th>
            </tr>
          </thead>
          <tbody>
            ${filasHtml}
          </tbody>
        </table>
      </div>
    `;
  } catch (err) {
    contenedorLista.innerHTML = `
      <div class="alerta alerta--error" role="alert">
        <div><strong>Error al cargar:</strong> ${escapar(err.message)}</div>
      </div>
    `;
    aviso(`Error al cargar datos: ${err.message}`, "error");
  }
}

// Envío del formulario
form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const texto = campoTexto.value.trim();
  if (!texto) {
    errorTexto.classList.remove("oculto");
    campoTexto.focus();
    return;
  }
  errorTexto.classList.add("oculto");

  btnGuardar.disabled = true;
  try {
    await crear("prueba", { texto });
    aviso("Registro guardado con éxito", "exito");
    campoTexto.value = "";
    await cargarRegistros();
  } catch (err) {
    aviso(err.message || "Error al guardar el registro", "error");
  } finally {
    btnGuardar.disabled = false;
  }
});

btnRecargar.addEventListener("click", () => {
  cargarRegistros();
});

// Carga inicial
cargarRegistros();
