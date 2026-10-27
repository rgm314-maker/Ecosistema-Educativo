// publico/js/modulos/admin-ajustes.js
// Panel de control para configuración de la API y modelos de Inteligencia Artificial

import { montarPlantilla } from '../nucleo/plantilla.js';
import * as api from '../nucleo/api.js';
import * as ui from '../nucleo/ui.js';

await montarPlantilla({ titulo: "Configuración IA", roles: ["admin"] });

const formIA = document.getElementById("form-ia");
const campoProveedor = document.getElementById("campo-proveedor");
const selectModelo = document.getElementById("select-modelo");
const campoModeloPersonalizado = document.getElementById("campo-modelo-personalizado");
const campoClave = document.getElementById("campo-clave");
const estadoClaveActual = document.getElementById("estado-clave-actual");
const btnProbarIA = document.getElementById("btn-probar-ia");
const btnSincronizarModelos = document.getElementById("btn-sincronizar-modelos");
const resultadoPrueba = document.getElementById("resultado-prueba");

// Modelos base recomendados
const MODELOS_BASE = [
  { id: "gemini-3.5-flash", nombre: "Gemini 3.5 Flash (Recomendado · Rápido y alta disponibilidad)" },
  { id: "gemini-3.5-flash-lite", nombre: "Gemini 3.5 Flash-Lite (Ultrarrápido y ligero)" },
  { id: "gemini-flash-lite-latest", nombre: "Gemini Flash-Lite Latest (Estable)" },
  { id: "gemini-3.8-flash", nombre: "Gemini 3.8 Flash (Última generación)" },
  { id: "gemini-4-argon", nombre: "Gemini 4 Argon (Modelo avanzado)" }
];

function obtenerModeloElegido() {
  const val = selectModelo.value;
  if (val === "personalizado") {
    return campoModeloPersonalizado.value.trim();
  }
  return val;
}

function fijarModeloEnDesplegable(modeloId) {
  if (!modeloId) return;

  const existeOpcion = Array.from(selectModelo.options).some((opt) => opt.value === modeloId);

  if (existeOpcion) {
    selectModelo.value = modeloId;
    campoModeloPersonalizado.classList.add("oculto");
  } else {
    selectModelo.value = "personalizado";
    campoModeloPersonalizado.value = modeloId;
    campoModeloPersonalizado.classList.remove("oculto");
  }
}

// Cargar configuración actual
async function cargarConfiguracion() {
  try {
    ui.cargando(true);
    const config = await api.llamar("GET", "/api/ia/config");

    if (config) {
      campoProveedor.value = config.proveedor || "gemini";
      fijarModeloEnDesplegable(config.modelo || "gemini-3.5-flash");

      if (config.claveConfigurada) {
        estadoClaveActual.innerHTML = `
          <span style="color: var(--exito); font-weight: var(--peso-seminegrita);">
            ✓ Clave activa: <code>${ui.escapar(config.claveEnmascarada)}</code>
          </span>
          <span class="texto-suave"> (deja el campo vacío para conservarla, o escribe una nueva para cambiarla).</span>
        `;
      } else {
        estadoClaveActual.innerHTML = `
          <span style="color: var(--advertencia);">
            ⚠️ No hay ninguna clave configurada. El sistema utilizará el generador didáctico de respaldo.
          </span>
        `;
      }
    }
  } catch (err) {
    ui.aviso(err.message || "Error al cargar la configuración de IA", "error");
  } finally {
    ui.cargando(false);
  }
}

// Sincronizar modelos disponibles con Google
async function sincronizarModelos() {
  try {
    ui.cargando(true);
    btnSincronizarModelos.disabled = true;
    const claveEscrita = campoClave.value.trim();
    const query = claveEscrita ? `?clave=${encodeURIComponent(claveEscrita)}` : '';
    const modelos = await api.llamar("GET", `/api/ia/modelos${query}`);

    if (Array.isArray(modelos) && modelos.length > 0) {
      const modeloActual = obtenerModeloElegido();
      selectModelo.innerHTML = "";

      for (const m of modelos) {
        const opt = document.createElement("option");
        opt.value = m.id;
        opt.textContent = m.nombre;
        selectModelo.appendChild(opt);
      }

      const optPersonalizado = document.createElement("option");
      optPersonalizado.value = "personalizado";
      optPersonalizado.textContent = "Otro modelo (especificar manualmente)...";
      selectModelo.appendChild(optPersonalizado);

      fijarModeloEnDesplegable(modeloActual);
      ui.aviso(`Se cargaron ${modelos.length} modelos de Google Gemini`, "exito");
    }
  } catch (err) {
    ui.aviso(err.message || "No se pudo sincronizar la lista de modelos", "error");
  } finally {
    btnSincronizarModelos.disabled = false;
    ui.cargando(false);
  }
}

// Probar conexión en vivo con Google Gemini
btnProbarIA.addEventListener("click", async () => {
  const clave = campoClave.value.trim();
  const modelo = obtenerModeloElegido();

  if (!modelo) {
    ui.aviso("Selecciona o escribe el modelo a probar", "advertencia");
    selectModelo.focus();
    return;
  }

  resultadoPrueba.className = "resultado-prueba-caja";
  resultadoPrueba.innerHTML = "⏳ Conectando con Google Gemini...";
  resultadoPrueba.classList.remove("oculto");

  try {
    btnProbarIA.disabled = true;
    const res = await api.llamar("POST", "/api/ia/prueba", { clave, modelo });

    resultadoPrueba.className = "resultado-prueba-caja resultado-prueba-caja--exito";
    resultadoPrueba.innerHTML = `
      <strong>✓ Conexión exitosa:</strong>
      <p style="margin: var(--espacio-xs) 0 0 0;">
        El modelo <code>${ui.escapar(res.modelo || modelo)}</code> respondió correctamente a la prueba. Las credenciales son válidas y operativas.
      </p>
    `;
    ui.aviso("Conexión con Google Gemini verificada exitosamente", "exito");
  } catch (err) {
    resultadoPrueba.className = "resultado-prueba-caja resultado-prueba-caja--error";
    resultadoPrueba.innerHTML = `
      <strong>✕ Error al conectar:</strong>
      <p style="margin: var(--espacio-xs) 0 0 0;">${ui.escapar(err.message || "Fallo en la prueba de conexión.")}</p>
    `;
    ui.aviso(err.message || "Fallo en la prueba de conexión", "error");
  } finally {
    btnProbarIA.disabled = false;
  }
});

// Guardar configuración
formIA.addEventListener("submit", async (e) => {
  e.preventDefault();

  const proveedor = campoProveedor.value.trim();
  const modelo = obtenerModeloElegido();
  const clave = campoClave.value.trim();

  if (!modelo) {
    ui.aviso("Debes seleccionar o escribir un modelo de IA", "advertencia");
    selectModelo.focus();
    return;
  }

  try {
    ui.cargando(true);
    const res = await api.llamar("PUT", "/api/ia/config", { proveedor, modelo, clave });

    ui.aviso(`Configuración guardada. Modelo activo: ${modelo}`, "exito");
    campoClave.value = "";
    await cargarConfiguracion();
  } catch (err) {
    ui.aviso(err.message || "Error al guardar la configuración", "error");
  } finally {
    ui.cargando(false);
  }
});

// Alternar campo de texto si se elige "personalizado"
selectModelo.addEventListener("change", () => {
  if (selectModelo.value === "personalizado") {
    campoModeloPersonalizado.classList.remove("oculto");
    campoModeloPersonalizado.focus();
  } else {
    campoModeloPersonalizado.classList.add("oculto");
  }
});

btnSincronizarModelos.addEventListener("click", sincronizarModelos);

// Inicializar
cargarConfiguracion();
