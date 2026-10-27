// servidor/ganchos/temas.js
// Gancho para temas académicos: filtrado por asignatura, unidad visible y estado publicado

import * as almacen from '../almacen.js';
import * as acceso from '../acceso.js';

export async function filtrarLista(lista, usuario) {
  if (!Array.isArray(lista) || !usuario || !usuario.id) return [];

  if (usuario.rol === 'admin') {
    return lista;
  }

  const permitidas = await acceso.asignaturasDe(usuario);
  const idsAsignaturas = new Set(permitidas.map(a => a.id));

  const unidades = await almacen.leer('unidades');
  const mapaUnidades = new Map(unidades.map(u => [u.id, u]));

  return lista.filter(tema => {
    const unidad = mapaUnidades.get(tema.unidadId);
    if (!unidad || !idsAsignaturas.has(unidad.asignaturaId)) {
      return false;
    }

    if (usuario.rol === 'estudiante') {
      if (unidad.visible === false) return false;
      if (tema.estado !== 'publicado') return false;
    }

    return true;
  });
}

export async function antesDeGuardar(datos, usuario, anterior) {
  const unidadId = datos.unidadId || anterior?.unidadId;

  if (!unidadId) {
    const err = new Error('El tema debe pertenecer a una unidad');
    err.estado = 400;
    throw err;
  }

  const unidades = await almacen.leer('unidades');
  const unidad = unidades.find(u => u.id === unidadId);
  if (!unidad) {
    const err = new Error('La unidad especificada no existe');
    err.estado = 404;
    throw err;
  }

  const permitido = await acceso.puedeEditarAsignatura(usuario, unidad.asignaturaId);
  if (!permitido) {
    const err = new Error('No tienes permiso para editar temas en esta asignatura');
    err.estado = 403;
    throw err;
  }

  return datos;
}

export default {
  filtrarLista,
  antesDeGuardar
};
