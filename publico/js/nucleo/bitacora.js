// publico/js/nucleo/bitacora.js
// Registro de eventos de actividad del usuario en el navegador

import { llamar } from "./api.js";

export async function registrarEvento(tipo, recurso) {
  try {
    return await llamar("POST", "/api/eventos", { tipo, recurso });
  } catch (err) {
    // La bitácora en cliente no bloquea la navegación en caso de error
    console.debug("Error registrando evento en bitácora:", err.message);
    return null;
  }
}
