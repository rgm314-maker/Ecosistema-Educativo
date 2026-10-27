// servidor/ganchos/usuarios.js
// Reglas de negocio y sanitización para la colección usuarios

export function filtrarLista(lista, usuario) {
  if (!Array.isArray(lista)) return [];
  return lista.map(item => {
    if (!item) return item;
    const { claveHash, ...resto } = item;
    return resto;
  });
}

export function antesDeGuardar(datos, usuario, anterior) {
  const copia = { ...datos };

  // Ignora claveHash y correo
  delete copia.claveHash;
  delete copia.correo;

  // Evita que un administrador se quite el rol o se desactive a sí mismo
  if (anterior && usuario && anterior.id === usuario.id && usuario.rol === 'admin') {
    if (copia.rol !== undefined && copia.rol !== 'admin') {
      const err = new Error('Un administrador no puede cambiar su propio rol');
      err.estado = 403;
      throw err;
    }

    if (copia.activo !== undefined && copia.activo !== true) {
      const err = new Error('Un administrador no puede desactivar su propia cuenta');
      err.estado = 403;
      throw err;
    }
  }

  return copia;
}

export default {
  filtrarLista,
  antesDeGuardar
};
