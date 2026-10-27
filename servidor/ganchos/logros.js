// servidor/ganchos/logros.js
// Gancho para la colección de logros de usuarios

import * as acceso from '../acceso.js';

export async function filtrarLista(lista, usuario) {
  if (!Array.isArray(lista) || !usuario || !usuario.id) return [];

  if (usuario.rol === 'admin') {
    return lista;
  }

  if (usuario.rol === 'estudiante') {
    return lista.filter((l) => l.usuarioId === usuario.id);
  }

  if (usuario.rol === 'docente') {
    const misEstudiantes = await acceso.estudiantesDe(usuario.id);
    const idsSet = new Set(misEstudiantes);
    return lista.filter((l) => idsSet.has(l.usuarioId));
  }

  return [];
}

export default {
  filtrarLista
};
