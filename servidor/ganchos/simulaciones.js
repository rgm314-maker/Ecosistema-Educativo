// Control de acceso a simulaciones por asignatura y estado de publicación

import * as acceso from '../acceso.js';

function rechazar(mensaje, estado) {
  const error = new Error(mensaje);
  error.estado = estado;
  throw error;
}

export async function filtrarLista(lista, usuario) {
  if (!Array.isArray(lista) || !usuario?.id) return [];
  if (usuario.rol !== 'estudiante') return lista;

  const asignaturas = await acceso.asignaturasDe(usuario);
  const idsAsignaturas = new Set(asignaturas.map((item) => item.id));
  const permitidas = [];
  for (const simulacion of lista) {
    if (simulacion.estado !== 'publicado') continue;
    const asignatura = await acceso.asignaturaDeTema(simulacion.temaId);
    if (asignatura && idsAsignaturas.has(asignatura.id)) permitidas.push(simulacion);
  }
  return permitidas;
}

async function exigirEdicion(usuario, temaId) {
  if (!temaId) rechazar('La simulación debe pertenecer a un tema', 400);
  const asignatura = await acceso.asignaturaDeTema(temaId);
  if (!asignatura) rechazar('El tema de la simulación no existe', 404);
  if (!await acceso.puedeEditarAsignatura(usuario, asignatura.id)) {
    rechazar('No tienes permiso para editar simulaciones de esta asignatura', 403);
  }
}

export async function antesDeGuardar(datos, usuario, anterior) {
  await exigirEdicion(usuario, datos.temaId || anterior?.temaId);
  return datos;
}

export async function antesDeEliminar(registro, usuario) {
  await exigirEdicion(usuario, registro.temaId);
}

export default { filtrarLista, antesDeGuardar, antesDeEliminar };
