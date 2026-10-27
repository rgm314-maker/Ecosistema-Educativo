// servidor/acceso.js
// Control de relaciones académicas y permisos por grupo según distributivo

import * as almacen from './almacen.js';

export async function gruposDe(usuario) {
  if (!usuario || !usuario.id) return [];

  const distributivo = await almacen.leer('distributivo');

  if (usuario.rol === 'admin') {
    return distributivo;
  }

  if (usuario.rol === 'docente') {
    return distributivo.filter(g => g.docenteId === usuario.id);
  }

  if (usuario.rol === 'estudiante') {
    return distributivo.filter(g => Array.isArray(g.estudiantes) && g.estudiantes.includes(usuario.id));
  }

  return [];
}

export async function asignaturasDe(usuario) {
  if (!usuario || !usuario.id) return [];

  const todasAsignaturas = await almacen.leer('asignaturas');

  if (usuario.rol === 'admin') {
    return todasAsignaturas;
  }

  const grupos = await gruposDe(usuario);
  const idsAsignaturas = new Set(grupos.map(g => g.asignaturaId).filter(Boolean));

  return todasAsignaturas.filter(a => idsAsignaturas.has(a.id));
}

export async function asignaturaDeTema(temaId) {
  if (!temaId) return null;

  const temas = await almacen.leer('temas');
  const tema = temas.find(t => t.id === temaId);
  if (!tema || !tema.unidadId) return null;

  const unidades = await almacen.leer('unidades');
  const unidad = unidades.find(u => u.id === tema.unidadId);
  if (!unidad || !unidad.asignaturaId) return null;

  const asignaturas = await almacen.leer('asignaturas');
  return asignaturas.find(a => a.id === unidad.asignaturaId) || null;
}

export async function puedeEditarAsignatura(usuario, asignaturaId) {
  if (!usuario || !usuario.id || !asignaturaId) return false;

  if (usuario.rol === 'admin') {
    return true;
  }

  if (usuario.rol === 'docente') {
    const distributivo = await almacen.leer('distributivo');
    return distributivo.some(g => g.docenteId === usuario.id && g.asignaturaId === asignaturaId);
  }

  return false;
}

export async function estudiantesDe(docenteId) {
  if (!docenteId) return [];

  const distributivo = await almacen.leer('distributivo');
  const estudiantesSet = new Set();

  for (const g of distributivo) {
    if (g.docenteId === docenteId && Array.isArray(g.estudiantes)) {
      for (const id of g.estudiantes) {
        if (id) estudiantesSet.add(id);
      }
    }
  }

  return Array.from(estudiantesSet);
}

export async function docentesDe(estudianteId) {
  if (!estudianteId) return [];

  const distributivo = await almacen.leer('distributivo');
  const docentesSet = new Set();

  for (const g of distributivo) {
    if (Array.isArray(g.estudiantes) && g.estudiantes.includes(estudianteId) && g.docenteId) {
      docentesSet.add(g.docenteId);
    }
  }

  return Array.from(docentesSet);
}

export default {
  gruposDe,
  asignaturasDe,
  asignaturaDeTema,
  puedeEditarAsignatura,
  estudiantesDe,
  docentesDe
};
