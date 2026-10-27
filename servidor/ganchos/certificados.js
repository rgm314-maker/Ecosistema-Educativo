// Gancho para la colección de certificados

export async function filtrarLista(lista, usuario) {
  if (!Array.isArray(lista) || !usuario || !usuario.id) return [];

  if (usuario.rol === 'admin') {
    return lista;
  }

  return lista.filter((c) => c.usuarioId === usuario.id);
}

export default {
  filtrarLista
};
