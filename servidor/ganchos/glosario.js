// servidor/ganchos/glosario.js
// Gancho para términos de glosario: filtrado por asignaturas, estado aprobado y permisos

import * as almacen from '../almacen.js';
import * as acceso from '../acceso.js';

export async function filtrarLista(lista, usuario) {
  if (!Array.isArray(lista) || !usuario || !usuario.id) return [];

  if (usuario.rol === 'admin') {
    return lista;
  }

  const permitidas = await acceso.asignaturasDe(usuario);
  const idsAsignaturas = new Set(permitidas.map(a => a.id));

  const [temas, unidades] = await Promise.all([
    almacen.leer('temas'),
    almacen.leer('unidades')
  ]);

  const mapaTemas = new Map(temas.map(t => [t.id, t]));
  const mapaUnidades = new Map(unidades.map(u => [u.id, u]));

  return lista.filter(item => {
    const tema = mapaTemas.get(item.temaId);
    if (!tema) return false;

    const unidad = mapaUnidades.get(tema.unidadId);
    if (!unidad || !idsAsignaturas.has(unidad.asignaturaId)) {
      return false;
    }

    if (usuario.rol === 'estudiante') {
      if (unidad.visible === false) return false;
      if (tema.estado !== 'publicado') return false;
      if (item.estado !== 'aprobado') return false;
    }

    return true;
  });
}

export async function antesDeGuardar(datos, usuario, anterior) {
  const temaId = datos.temaId || anterior?.temaId;

  if (!temaId) {
    const err = new Error('El término debe pertenecer a un tema');
    err.estado = 400;
    throw err;
  }

  const asignatura = await acceso.asignaturaDeTema(temaId);
  if (!asignatura) {
    const err = new Error('No se pudo resolver la asignatura del tema');
    err.estado = 404;
    throw err;
  }

  const permitido = await acceso.puedeEditarAsignatura(usuario, asignatura.id);
  if (!permitido) {
    const err = new Error('No tienes permiso para editar términos de glosario en esta asignatura');
    err.estado = 403;
    throw err;
  }

  return datos;
}

export default {
  filtrarLista,
  antesDeGuardar
};
