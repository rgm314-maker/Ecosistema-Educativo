// servidor/ganchos/canciones.js
// Gancho para canciones educativas: filtro por asignaturas y validación de edición

import * as almacen from '../almacen.js';
import * as acceso from '../acceso.js';

export async function filtrarLista(lista, usuario) {
  if (!Array.isArray(lista) || !usuario || !usuario.id) return [];

  // Los administradores pueden ver todas las canciones
  if (usuario.rol === 'admin') {
    return lista;
  }

  // Docentes y estudiantes solo ven canciones de sus asignaturas (a través del tema)
  const [temas, unidades, misAsignaturas] = await Promise.all([
    almacen.leer('temas'),
    almacen.leer('unidades'),
    acceso.asignaturasDe(usuario)
  ]);

  const idsAsignaturas = new Set(misAsignaturas.map((a) => a.id));
  const idsUnidades = new Set(
    unidades.filter((u) => idsAsignaturas.has(u.asignaturaId)).map((u) => u.id)
  );
  const idsTemasPermitidos = new Set(
    temas.filter((t) => idsUnidades.has(t.unidadId)).map((t) => t.id)
  );

  return lista.filter((cancion) => idsTemasPermitidos.has(cancion.temaId));
}

export async function antesDeGuardar(datos, usuario, anterior) {
  if (!usuario || !usuario.id) {
    const err = new Error('Se requiere sesión activa');
    err.estado = 401;
    throw err;
  }

  const temaId = datos.temaId || anterior?.temaId;
  if (!temaId) {
    const err = new Error('El campo temaId es obligatorio');
    err.estado = 400;
    throw err;
  }

  const asignatura = await acceso.asignaturaDeTema(temaId);
  if (!asignatura) {
    const err = new Error('No se encontró la asignatura vinculada a este tema');
    err.estado = 400;
    throw err;
  }

  const tienePermiso = await acceso.puedeEditarAsignatura(usuario, asignatura.id);
  if (!tienePermiso) {
    const err = new Error('No tienes permiso para editar contenidos de esta asignatura');
    err.estado = 403;
    throw err;
  }

  if (!datos.titulo || !String(datos.titulo).trim()) {
    const err = new Error('El título de la canción es obligatorio');
    err.estado = 400;
    throw err;
  }

  if (!datos.audio || !String(datos.audio).trim()) {
    const err = new Error('El archivo de audio MP3 es obligatorio');
    err.estado = 400;
    throw err;
  }

  if (!datos.autoria || !String(datos.autoria).trim()) {
    const err = new Error('La autoría es obligatoria');
    err.estado = 400;
    throw err;
  }

  if (!datos.licencia || !String(datos.licencia).trim()) {
    const err = new Error('La licencia es obligatoria');
    err.estado = 400;
    throw err;
  }

  return datos;
}

export default {
  filtrarLista,
  antesDeGuardar
};
