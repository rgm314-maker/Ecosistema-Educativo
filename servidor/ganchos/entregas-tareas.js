// Controla las entregas realizadas por estudiantes.

import * as almacen from '../almacen.js';
import * as acceso from '../acceso.js';

function rechazar(mensaje, estado = 400) {
  const error = new Error(mensaje);
  error.estado = estado;
  throw error;
}

export async function filtrarLista(lista, usuario) {
  if (!Array.isArray(lista) || !usuario?.id) return [];
  if (usuario.rol === 'admin') return lista;
  if (usuario.rol === 'estudiante') return lista.filter((item) => item.usuarioId === usuario.id);
  const estudiantes = new Set(await acceso.estudiantesDe(usuario.id));
  return lista.filter((item) => estudiantes.has(item.usuarioId));
}

export async function antesDeGuardar(datos, usuario, anterior) {
  if (usuario?.rol !== 'estudiante') rechazar('Solo los estudiantes pueden realizar entregas', 403);
  if (anterior && anterior.usuarioId !== usuario.id) rechazar('No puedes modificar esta entrega', 403);
  const tareaId = String(datos.tareaId ?? anterior?.tareaId ?? '').trim();
  const tareas = await almacen.leer('tareas');
  const tarea = tareas.find((item) => item.id === tareaId);
  if (!tarea) rechazar('La tarea no existe', 404);
  const grupos = await acceso.gruposDe(usuario);
  if (!grupos.some((grupo) => grupo.id === tarea.grupoId)) rechazar('Esta tarea no pertenece a tu grupo', 403);
  if (!anterior) {
    const entregas = await almacen.leer('entregas-tareas');
    if (entregas.some((item) => item.tareaId === tareaId && item.usuarioId === usuario.id)) {
      rechazar('Ya existe una entrega para esta tarea; actualiza la entrega existente', 409);
    }
  }
  const texto = String(datos.texto ?? anterior?.texto ?? '').trim();
  const adjunto = datos.adjunto !== undefined ? datos.adjunto : (anterior?.adjunto || null);
  if (!texto && !adjunto) rechazar('Escribe una respuesta o adjunta un archivo');
  if (texto.length > 5000) rechazar('La respuesta admite hasta 5000 caracteres');
  if (adjunto && (!adjunto.url || !String(adjunto.url).startsWith('/recursos/subidas/'))) rechazar('El archivo adjunto no es válido');
  return {
    tareaId,
    usuarioId: usuario.id,
    texto,
    adjunto,
    entregadoEn: new Date().toISOString(),
    tardia: new Date() > new Date(tarea.fechaLimite),
    calificacion: null,
    comentarioDocente: '',
    calificadoEn: null
  };
}

export default { filtrarLista, antesDeGuardar };
