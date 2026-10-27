// publico/js/nucleo/sesion.js
// Manejo de sesión, credenciales y control de acceso en el navegador

import { llamar } from "./api.js";

export function token() {
  return sessionStorage.getItem("token");
}

export function usuarioActual() {
  const guardado = sessionStorage.getItem("usuario");
  if (!guardado) return null;
  try {
    return JSON.parse(guardado);
  } catch {
    return null;
  }
}

export async function sincronizarSesion() {
  if (!token()) return null;
  try {
    const usuario = await llamar("GET", "/api/auth/yo");
    sessionStorage.setItem("usuario", JSON.stringify(usuario));
    return usuario;
  } catch {
    sessionStorage.removeItem("token");
    sessionStorage.removeItem("usuario");
    return null;
  }
}

export async function iniciar(correo, clave) {
  const respuesta = await llamar("POST", "/api/auth/login", { correo, clave });
  if (respuesta && respuesta.token && respuesta.usuario) {
    sessionStorage.setItem("token", respuesta.token);
    sessionStorage.setItem("usuario", JSON.stringify(respuesta.usuario));
    return respuesta.usuario;
  }
  throw new Error("Respuesta inválida al iniciar sesión");
}

export async function registrar(datos) {
  return await llamar("POST", "/api/auth/registro", datos);
}

export async function cerrar() {
  try {
    await llamar("POST", "/api/auth/logout");
  } catch {
    // Si la conexión falla, se limpia localmente de todos modos
  } finally {
    sessionStorage.removeItem("token");
    sessionStorage.removeItem("usuario");
    window.location.href = "/paginas/ingreso.html";
  }
}

export function exigirRol(roles = []) {
  if (!roles || roles.length === 0 || roles.includes("publico")) {
    return true;
  }

  const u = usuarioActual();
  const t = token();

  if (!t || !u) {
    window.location.href = "/paginas/ingreso.html";
    return false;
  }

  if (roles.includes("sesion") || roles.includes(u.rol)) {
    return true;
  }

  sessionStorage.setItem(
    "aviso_pendiente",
    JSON.stringify({
      texto: "Acceso no autorizado para tu rol de usuario.",
      tipo: "error"
    })
  );
  window.location.href = "/index.html";
  return false;
}
