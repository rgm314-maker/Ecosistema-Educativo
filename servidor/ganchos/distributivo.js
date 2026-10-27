// servidor/ganchos/distributivo.js
// Gancho para filtrar grupos del distributivo según el rol y asignación del usuario

export function filtrarLista(lista, usuario) {
  if (!Array.isArray(lista) || !usuario || !usuario.id) return [];

  if (usuario.rol === 'admin') {
    return lista;
  }

  if (usuario.rol === 'docente') {
    return lista.filter(g => g.docenteId === usuario.id);
  }

  if (usuario.rol === 'estudiante') {
    return lista.filter(g => Array.isArray(g.estudiantes) && g.estudiantes.includes(usuario.id));
  }

  return [];
}

export default {
  filtrarLista
};
