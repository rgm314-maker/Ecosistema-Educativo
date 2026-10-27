// publico/js/modulos/registro.js
// Módulo de registro de estudiantes con validación en vivo y auto-login

import { montarPlantilla } from "../nucleo/plantilla.js";
import { registrar, iniciar, usuarioActual } from "../nucleo/sesion.js";
import { aviso } from "../nucleo/ui.js";

// Si ya hay sesión activa, redirige a inicio
if (usuarioActual()) {
  window.location.href = "/index.html";
}

await montarPlantilla({ titulo: "Registro", roles: ["publico"] });

const form = document.getElementById("formRegistro");
const campoNombre = document.getElementById("nombre");
const campoApellido = document.getElementById("apellido");
const campoCorreo = document.getElementById("correo");
const campoClave = document.getElementById("clave");
const campoConsentimiento = document.getElementById("consentimiento");

const errorNombre = document.getElementById("errorNombre");
const errorApellido = document.getElementById("errorApellido");
const errorCorreo = document.getElementById("errorCorreo");
const errorClave = document.getElementById("errorClave");
const errorConsentimiento = document.getElementById("errorConsentimiento");

const btnRegistrar = document.getElementById("btnRegistrar");

const regexCorreo = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validarNombre() {
  const val = campoNombre.value.trim();
  if (!val) {
    errorNombre.textContent = "El nombre es obligatorio.";
    errorNombre.classList.remove("oculto");
    return false;
  }
  errorNombre.classList.add("oculto");
  return true;
}

function validarApellido() {
  const val = campoApellido.value.trim();
  if (!val) {
    errorApellido.textContent = "El apellido es obligatorio.";
    errorApellido.classList.remove("oculto");
    return false;
  }
  errorApellido.classList.add("oculto");
  return true;
}

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
  if (!val || val.length < 8 || !/[a-zA-Z]/.test(val) || !/\d/.test(val)) {
    errorClave.textContent = "La contraseña debe tener al menos 8 caracteres con letras y números.";
    errorClave.classList.remove("oculto");
    return false;
  }
  errorClave.classList.add("oculto");
  return true;
}

function validarConsentimiento() {
  if (!campoConsentimiento.checked) {
    errorConsentimiento.textContent = "Debes aceptar el aviso de privacidad para continuar.";
    errorConsentimiento.classList.remove("oculto");
    return false;
  }
  errorConsentimiento.classList.add("oculto");
  return true;
}

// Validación en vivo
campoNombre.addEventListener("input", validarNombre);
campoApellido.addEventListener("input", validarApellido);
campoCorreo.addEventListener("input", validarCorreo);
campoClave.addEventListener("input", validarClave);
campoConsentimiento.addEventListener("change", validarConsentimiento);

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const vNombre = validarNombre();
  const vApellido = validarApellido();
  const vCorreo = validarCorreo();
  const vClave = validarClave();
  const vConsentimiento = validarConsentimiento();

  if (!vNombre || !vApellido || !vCorreo || !vClave || !vConsentimiento) {
    return;
  }

  btnRegistrar.disabled = true;
  btnRegistrar.textContent = "Registrando e ingresando...";

  const datos = {
    nombre: campoNombre.value.trim(),
    apellido: campoApellido.value.trim(),
    correo: campoCorreo.value.trim().toLowerCase(),
    clave: campoClave.value,
    consentimiento: true
  };

  try {
    // 1. Registro en el servidor
    await registrar(datos);

    // 2. Inicio de sesión automático
    await iniciar(datos.correo, datos.clave);

    sessionStorage.setItem("aviso_pendiente", JSON.stringify({
      texto: "Cuenta creada con éxito. ¡Bienvenido/a!",
      tipo: "exito"
    }));

    window.location.href = "/index.html";
  } catch (err) {
    aviso(err.message || "Error al completar el registro", "error");
    btnRegistrar.disabled = false;
    btnRegistrar.textContent = "Crear cuenta e ingresar";
  }
});
