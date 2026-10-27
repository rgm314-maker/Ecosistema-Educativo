// servidor/ganchos/lecturas-noticias.js
// Gancho para lecturas de noticias: asignación de usuario y prevención de duplicados

import * as almacen from '../almacen.js';

export function filtrarLista(lista, usuario) {
  if (!Array.isArray(lista) || !usuario || !usuario.id) return [];
  return lista.filter((l) => l.usuarioId === usuario.id);
}

export async function antesDeGuardar(datos, usuario, anterior) {
  if (!usuario || !usuario.id) {
    const err = new Error('Se requiere sesión de usuario activa');
    err.estado = 401;
    throw err;
  }

  // Fija usuarioId con el usuario en sesión
  datos.usuarioId = usuario.id;

  const noticiaId = datos.noticiaId || anterior?.noticiaId;
  if (!noticiaId) {
    const err = new Error('El campo noticiaId es obligatorio');
    err.estado = 400;
    throw err;
  }

  // Evita duplicados (usuarioId + noticiaId)
  const lecturas = await almacen.leer('lecturas-noticias');
  const yaLeida = lecturas.some(
    (l) => l.usuarioId === usuario.id &&
           l.noticiaId === noticiaId &&
           (!anterior || l.id !== anterior.id)
  );

  if (yaLeida) {
    const err = new Error('La lectura de esta noticia ya fue registrada');
    err.estado = 400;
    throw err;
  }

  return datos;
}

export default {
  filtrarLista,
  antesDeGuardar
};
