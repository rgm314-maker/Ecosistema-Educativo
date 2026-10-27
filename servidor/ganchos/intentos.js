// servidor/ganchos/intentos.js
// Gancho para la colección de intentos de actividades gamificadas

import * as acceso from '../acceso.js';

export async function filtrarLista(lista, usuario) {
  if (!Array.isArray(lista) || !usuario || !usuario.id) return [];

  if (usuario.rol === 'admin') {
    return lista;
  }

  if (usuario.rol === 'estudiante') {
    return lista.filter((i) => i.usuarioId === usuario.id);
  }

  if (usuario.rol === 'docente') {
    const misEstudiantes = await acceso.estudiantesDe(usuario.id);
    const idsSet = new Set(misEstudiantes);
    return lista.filter((i) => idsSet.has(i.usuarioId));
  }

  return [];
}

export default {
  filtrarLista
};
