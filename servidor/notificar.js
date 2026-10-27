// Creación centralizada de notificaciones internas

import * as almacen from './almacen.js';

export async function notificar(usuarioId, { tipo, mensaje, enlace = '' }) {
  if (!usuarioId || !tipo || !mensaje) {
    const error = new Error('La notificación requiere usuarioId, tipo y mensaje');
    error.estado = 400;
    throw error;
  }

  return almacen.agregar('notificaciones', {
    usuarioId,
    tipo,
    mensaje,
    enlace,
    leida: false
  });
}

export default { notificar };
