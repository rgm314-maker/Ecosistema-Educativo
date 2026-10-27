// servidor/ganchos/progreso-temas.js
// Gancho para progreso en temas: asignación automática de usuario y prevención de duplicados

import * as almacen from '../almacen.js';
import * as acceso from '../acceso.js';

export async function filtrarLista(lista, usuario) {
  if (!Array.isArray(lista) || !usuario || !usuario.id) return [];

  if (usuario.rol === 'admin') {
    return lista;
  }

  if (usuario.rol === 'docente') {
    const estudiantes = await acceso.estudiantesDe(usuario.id);
    const idsEstudiantes = new Set(estudiantes);
    return lista.filter(item => idsEstudiantes.has(item.usuarioId));
  }

  if (usuario.rol === 'estudiante') {
    return lista.filter(item => item.usuarioId === usuario.id);
  }

  return [];
}

export async function antesDeGuardar(datos, usuario, anterior) {
  if (!usuario || !usuario.id) {
    const err = new Error('Se requiere sesión de usuario');
    err.estado = 401;
    throw err;
  }

  // Fija usuarioId con el usuario en sesión
  datos.usuarioId = usuario.id;

  const temaId = datos.temaId || anterior?.temaId;
  if (!temaId) {
    const err = new Error('El campo temaId es obligatorio');
    err.estado = 400;
    throw err;
  }

  // Rechaza duplicados (usuarioId + temaId)
  const existentes = await almacen.leer('progreso-temas');
  const existeDuplicado = existentes.some(
    item => item.usuarioId === usuario.id &&
            item.temaId === temaId &&
            (!anterior || item.id !== anterior.id)
  );

  if (existeDuplicado) {
    const err = new Error('Ya existe un registro de progreso para este tema');
    err.estado = 400;
    throw err;
  }

  return datos;
}

export default {
  filtrarLista,
  antesDeGuardar
};
