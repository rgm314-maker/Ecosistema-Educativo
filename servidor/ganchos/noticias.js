// servidor/ganchos/noticias.js
// Gancho para noticias: visibilidad según rol, autoría y fecha de publicación

export function filtrarLista(lista, usuario) {
  if (!Array.isArray(lista) || !usuario || !usuario.id) return [];

  // Los estudiantes solo ven las noticias publicadas
  if (usuario.rol === 'estudiante') {
    return lista.filter((n) => n.estado === 'publicado');
  }

  // Docentes y administradores ven todas (borradores y publicadas)
  return lista;
}

export function antesDeGuardar(datos, usuario, anterior) {
  if (!anterior && usuario && usuario.id) {
    // Al crear, se fija el autorId de la sesión
    datos.autorId = usuario.id;
  }

  // Fija fechaPublicacion cuando el estado pasa a "publicado"
  if (datos.estado === 'publicado') {
    if (!anterior || anterior.estado !== 'publicado' || !anterior.fechaPublicacion) {
      datos.fechaPublicacion = datos.fechaPublicacion || new Date().toISOString();
    }
  }

  return datos;
}

export default {
  filtrarLista,
  antesDeGuardar
};
