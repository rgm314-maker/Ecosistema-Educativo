// servidor/preparadores/generar-preguntas.js
// Preparador de contexto para la generación de preguntas de evaluación con IA

import * as almacen from '../almacen.js';
import * as acceso from '../acceso.js';

/**
 * @param {Object} cuerpo { temaId, nivel, cantidad }
 * @param {Object} usuario Usuario en sesión
 * @returns {Promise<Object>} Datos estructurados para la plantilla de prompt
 */
export default async function (cuerpo, usuario) {
  const { temaId, nivel, cantidad } = cuerpo || {};

  if (!temaId) {
    const err = new Error('El parámetro temaId es obligatorio');
    err.estado = 400;
    throw err;
  }

  const nivelNum = Number(nivel);
  if (isNaN(nivelNum) || nivelNum < 1 || nivelNum > 5) {
    const err = new Error('El nivel debe ser un número entero entre 1 y 5');
    err.estado = 400;
    throw err;
  }

  const cantidadNum = Math.min(15, Math.max(5, Number(cantidad || 10)));

  // Buscar tema
  const temas = await almacen.leer('temas');
  const tema = temas.find((t) => t.id === temaId);
  if (!tema) {
    const err = new Error('Tema no encontrado');
    err.estado = 404;
    throw err;
  }

  // Buscar asignatura del tema
  const asignatura = await acceso.asignaturaDeTema(temaId);
  if (!asignatura) {
    const err = new Error('No se encontró la asignatura vinculada a este tema');
    err.estado = 404;
    throw err;
  }

  // Verificar permisos de edición
  const puedeEditar = await acceso.puedeEditarAsignatura(usuario, asignatura.id);
  if (!puedeEditar) {
    const err = new Error('No tienes permisos para editar contenidos de esta asignatura');
    err.estado = 403;
    throw err;
  }

  // Glosario del tema en formato "término: definición"
  const todoGlosario = await almacen.leer('glosario');
  const glosarioTema = todoGlosario.filter((g) => g.temaId === temaId && g.estado !== 'rechazado');
  const glosario = glosarioTema.map((g) => `${g.termino}: ${g.definicion}`);

  // Nivel según taxonomía de Bloom
  const nivelesBloom = {
    1: '1 Recordar',
    2: '2 Comprender',
    3: '3 Aplicar',
    4: '4 Analizar',
    5: '5 Evaluar'
  };
  const nivelBloom = nivelesBloom[nivelNum] || `${nivelNum}`;

  // Preguntas ya existentes en ese nivel
  const todasPreguntas = await almacen.leer('preguntas');
  const existentes = todasPreguntas
    .filter((p) => p.temaId === temaId && Number(p.nivel) === nivelNum)
    .map((p) => p.enunciado);

  // Contenido pedagógico del tema
  const contenido = [
    tema.resumen || '',
    Array.isArray(tema.objetivos) && tema.objetivos.length > 0
      ? `Objetivos:\n- ${tema.objetivos.join('\n- ')}`
      : '',
    Array.isArray(tema.ejemplos) && tema.ejemplos.length > 0
      ? `Ejemplos:\n- ${tema.ejemplos.join('\n- ')}`
      : ''
  ].filter(Boolean).join('\n\n');

  return {
    asignatura: asignatura.nombre,
    nivel: asignatura.nivel || 'Nivel General',
    tema: tema.titulo,
    contenido,
    glosario,
    nivelBloom,
    cantidad: cantidadNum,
    existentes
  };
}
