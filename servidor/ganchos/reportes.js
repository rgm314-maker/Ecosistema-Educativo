// Registro y administración de reportes de contenido

import * as almacen from '../almacen.js';

function rechazar(mensaje, estado) {
  const error = new Error(mensaje);
  error.estado = estado;
  throw error;
}

export function filtrarLista(lista, usuario) {
  return usuario?.rol === 'admin' && Array.isArray(lista) ? lista : [];
}

export async function antesDeGuardar(datos, usuario, anterior) {
  if (!usuario?.id) rechazar('Se requiere sesión activa', 401);
  if (anterior) {
    if (usuario.rol !== 'admin') rechazar('Solo un administrador puede resolver reportes', 403);
    const estado = datos.estado ?? anterior.estado;
    if (!['pendiente', 'resuelto'].includes(estado)) {
      rechazar('Estado de reporte inválido', 400);
    }
    return { estado };
  }

  if (!['foro', 'mensaje'].includes(datos.tipo)) rechazar('Tipo de reporte inválido', 400);
  const referenciaId = String(datos.referenciaId || '').trim();
  const motivo = String(datos.motivo || '').trim();
  if (!referenciaId || !motivo) rechazar('La referencia y el motivo son obligatorios', 400);
  if (motivo.length > 5000) rechazar('El motivo no puede superar 5.000 caracteres', 400);

  if (datos.tipo === 'foro') {
    const [hilos, respuestas] = await Promise.all([
      almacen.leer('foros-hilos'),
      almacen.leer('foros-respuestas')
    ]);
    if (![...hilos, ...respuestas].some((item) => item.id === referenciaId)) {
      rechazar('El contenido reportado no existe', 404);
    }
  } else {
    const [convId, mensajeId, extra] = referenciaId.split('/');
    if (!convId || !mensajeId || extra) rechazar('Referencia de mensaje inválida', 400);
    const conversaciones = await almacen.leer('conversaciones');
    const conversacion = conversaciones.find((item) => item.id === convId);
    if (!conversacion || (!conversacion.participantes?.includes(usuario.id) && usuario.rol !== 'admin')) {
      rechazar('No puedes reportar este mensaje', 403);
    }
    const mensajes = await almacen.leer(`mensajes/${convId}`);
    if (!mensajes.some((item) => item.id === mensajeId)) {
      rechazar('El mensaje reportado no existe', 404);
    }
  }

  const reportes = await almacen.leer('reportes');
  if (reportes.some((item) => item.referenciaId === referenciaId && item.reportadoPor === usuario.id && item.estado === 'pendiente')) {
    rechazar('Ya enviaste un reporte pendiente sobre este contenido', 409);
  }

  return {
    tipo: datos.tipo,
    referenciaId,
    motivo,
    reportadoPor: usuario.id,
    estado: 'pendiente'
  };
}

export function antesDeEliminar(reporte, usuario) {
  if (usuario?.rol !== 'admin') rechazar('Solo un administrador puede eliminar reportes', 403);
}

export default { filtrarLista, antesDeGuardar, antesDeEliminar };
