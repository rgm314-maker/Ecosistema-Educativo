// Prepara el contexto seguro para generar el glosario de un tema.

import * as almacen from '../almacen.js';
import * as acceso from '../acceso.js';

export default async function prepararGlosario(cuerpo, usuario) {
  const temaId = String(cuerpo?.temaId || '').trim();
  const cantidad = Math.min(20, Math.max(12, Number(cuerpo?.cantidad || 12)));
  if (!temaId) {
    const error = new Error('El parámetro temaId es obligatorio');
    error.estado = 400;
    throw error;
  }

  const temas = await almacen.leer('temas');
  const tema = temas.find((item) => item.id === temaId);
  if (!tema) {
    const error = new Error('Tema no encontrado');
    error.estado = 404;
    throw error;
  }

  const asignatura = await acceso.asignaturaDeTema(temaId);
  if (!asignatura || !await acceso.puedeEditarAsignatura(usuario, asignatura.id)) {
    const error = new Error('No tienes permisos para generar material de este tema');
    error.estado = 403;
    throw error;
  }

  const glosario = await almacen.leer('glosario');
  const existentes = glosario.filter((item) => item.temaId === temaId).map((item) => item.termino);
  const contenido = [
    tema.resumen,
    ...(Array.isArray(tema.objetivos) ? tema.objetivos : []),
    ...(Array.isArray(tema.ejemplos) ? tema.ejemplos : []),
    ...(Array.isArray(tema.palabrasClave) ? tema.palabrasClave : [])
  ].filter(Boolean).join('\n');

  return {
    asignatura: asignatura.nombre,
    tema: tema.titulo,
    dificultad: tema.dificultad || 'intermedio',
    contenido,
    cantidad,
    existentes
  };
}
