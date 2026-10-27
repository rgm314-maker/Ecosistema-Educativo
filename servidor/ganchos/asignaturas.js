// servidor/ganchos/asignaturas.js
// Gancho para filtrar asignaturas según el distributivo del usuario

import * as acceso from '../acceso.js';

export async function filtrarLista(lista, usuario) {
  if (!Array.isArray(lista) || !usuario || !usuario.id) return [];

  if (usuario.rol === 'admin') {
    return lista;
  }

  const permitidas = await acceso.asignaturasDe(usuario);
  const idsPermitidas = new Set(permitidas.map(a => a.id));

  return lista.filter(a => idsPermitidas.has(a.id));
}

export default {
  filtrarLista
};
