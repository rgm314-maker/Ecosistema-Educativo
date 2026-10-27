// publico/js/modulos/ingreso.js
// Módulo de inicio de sesión con validación en vivo

import { montarPlantilla } from "../nucleo/plantilla.js";
import { iniciar, usuarioActual } from "../nucleo/sesion.js";
import { aviso } from "../nucleo/ui.js";

// Si ya hay sesión activa, redirige a inicio
if (usuarioActual()) {
  window.location.href = "/index.html";
}

await montarPlantilla({ titulo: "Ingreso", roles: ["publico"] });

const form = document.getElementById("formIngreso");
const campoCorreo = document.getElementById("correo");
const campoClave = document.getElementById("clave");
const errorCorreo = document.getElementById("errorCorreo");
const errorClave = document.getElementById("errorClave");
const btnIngresar = document.getElementById("btnIngresar");

const regexCorreo = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validarCorreo() {
  const val = campoCorreo.value.trim();
  if (!val) {
    errorCorreo.textContent = "El correo electrónico es obligatorio.";
    errorCorreo.classList.remove("oculto");
    return false;
  }
  if (!regexCorreo.test(val)) {
    errorCorreo.textContent = "Ingresa un formato de correo válido.";
    errorCorreo.classList.remove("oculto");
    return false;
  }
  errorCorreo.classList.add("oculto");
  return true;
}

function validarClave() {
  const val = campoClave.value;
  if (!val) {
    errorClave.textContent = "La contraseña es obligatoria.";
    errorClave.classList.remove("oculto");
    return false;
  }
  errorClave.classList.add("oculto");
  return true;
}

// Validación en vivo
campoCorreo.addEventListener("input", validarCorreo);
campoClave.addEventListener("input", validarClave);

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const correoValido = validarCorreo();
  const claveValida = validarClave();

  if (!correoValido || !claveValida) {
    return;
  }

  btnIngresar.disabled = true;
  btnIngresar.textContent = "Ingresando...";

  try {
    await iniciar(campoCorreo.value.trim(), campoClave.value);
    sessionStorage.setItem("aviso_pendiente", JSON.stringify({
      texto: "Has iniciado sesión con éxito.",
      tipo: "exito"
    }));
    window.location.href = "/index.html";
  } catch (err) {
    aviso(err.message || "Error al iniciar sesión", "error");
    btnIngresar.disabled = false;
    btnIngresar.textContent = "Ingresar";
  }
});
