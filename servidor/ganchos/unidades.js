// servidor/ganchos/unidades.js
// Gancho para unidades académicas: visibilidad y validación de permisos de edición

import * as acceso from '../acceso.js';

export async function filtrarLista(lista, usuario) {
  if (!Array.isArray(lista) || !usuario || !usuario.id) return [];

  if (usuario.rol === 'admin') {
    return lista;
  }

  const permitidas = await acceso.asignaturasDe(usuario);
  const idsAsignaturas = new Set(permitidas.map(a => a.id));

  return lista.filter(u => {
    if (!idsAsignaturas.has(u.asignaturaId)) return false;
    if (usuario.rol === 'estudiante' && u.visible === false) return false;
    return true;
  });
}

export async function antesDeGuardar(datos, usuario, anterior) {
  const asignaturaId = datos.asignaturaId || anterior?.asignaturaId;

  if (!asignaturaId) {
    const err = new Error('La unidad debe estar asociada a una asignatura');
    err.estado = 400;
    throw err;
  }

  const permitido = await acceso.puedeEditarAsignatura(usuario, asignaturaId);
  if (!permitido) {
    const err = new Error('No tienes permiso para editar unidades en esta asignatura');
    err.estado = 403;
    throw err;
  }

  return datos;
}

export default {
  filtrarLista,
  antesDeGuardar
};
