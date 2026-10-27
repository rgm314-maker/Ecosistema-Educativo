// Permisos y validación de tareas asignadas a grupos.

import * as acceso from '../acceso.js';

function rechazar(mensaje, estado = 400) {
  const error = new Error(mensaje);
  error.estado = estado;
  throw error;
}

export async function filtrarLista(lista, usuario) {
  if (!Array.isArray(lista) || !usuario?.id) return [];
  if (usuario.rol === 'admin') return lista;
  const grupos = await acceso.gruposDe(usuario);
  const ids = new Set(grupos.map((grupo) => grupo.id));
  return lista.filter((tarea) => ids.has(tarea.grupoId));
}

async function validarGrupo(usuario, grupoId) {
  const grupos = await acceso.gruposDe(usuario);
  if (!grupos.some((grupo) => grupo.id === grupoId)) rechazar('No tienes acceso a este grupo', 403);
}

export async function antesDeGuardar(datos, usuario, anterior) {
  const grupoId = String(datos.grupoId ?? anterior?.grupoId ?? '').trim();
  const titulo = String(datos.titulo ?? anterior?.titulo ?? '').trim();
  const descripcion = String(datos.descripcion ?? anterior?.descripcion ?? '').trim();
  const fechaLimite = datos.fechaLimite ?? anterior?.fechaLimite;
  if (!grupoId) rechazar('Selecciona el grupo de la tarea');
  await validarGrupo(usuario, grupoId);
  if (anterior?.docenteId && anterior.docenteId !== usuario.id && usuario.rol !== 'admin') rechazar('Solo el docente creador puede editar esta tarea', 403);
  if (!titulo || titulo.length > 160) rechazar('El título es obligatorio y admite hasta 160 caracteres');
  if (!descripcion || descripcion.length > 5000) rechazar('La descripción es obligatoria y admite hasta 5000 caracteres');
  if (!fechaLimite || !Number.isFinite(new Date(fechaLimite).getTime())) rechazar('La fecha límite es inválida');
  const adjunto = datos.adjunto !== undefined ? datos.adjunto : (anterior?.adjunto || null);
  if (adjunto && (!adjunto.url || !String(adjunto.url).startsWith('/recursos/subidas/'))) rechazar('El archivo adjunto no es válido');
  return { grupoId, titulo, descripcion, fechaLimite: new Date(fechaLimite).toISOString(), adjunto, docenteId: anterior?.docenteId || usuario.id };
}

export async function antesDeEliminar(tarea, usuario) {
  if (usuario?.rol === 'admin' || tarea.docenteId === usuario?.id) return;
  if (!tarea.docenteId) {
    const grupos = await acceso.gruposDe(usuario);
    if (grupos.some((grupo) => grupo.id === tarea.grupoId && grupo.docenteId === usuario.id)) return;
  }
  rechazar('Solo el docente creador puede eliminar esta tarea', 403);
}

export default { filtrarLista, antesDeGuardar, antesDeEliminar };
