// Prepara el contexto académico seguro para el tutor socrático

import * as almacen from '../almacen.js';
import * as acceso from '../acceso.js';

function rechazar(mensaje, estado) {
  const error = new Error(mensaje);
  error.estado = estado;
  throw error;
}

function seccion(titulo, valor) {
  const elementos = Array.isArray(valor) ? valor.filter(Boolean) : [];
  if (!elementos.length) return `${titulo}: Sin información registrada.`;
  return `${titulo}:\n- ${elementos.join('\n- ')}`;
}

export default async function prepararTutor(cuerpo, usuario) {
  const temaId = String(cuerpo?.temaId || '').trim();
  if (!temaId) rechazar('El parámetro temaId es obligatorio', 400);
  if (!Array.isArray(cuerpo?.historial)) rechazar('El historial debe ser una lista', 400);

  const historialReciente = cuerpo.historial.slice(-10).map((mensaje) => {
    if (!mensaje || !['estudiante', 'tutor'].includes(mensaje.rol)) {
      rechazar('El historial contiene un rol inválido', 400);
    }
    const texto = String(mensaje.texto || '').trim();
    if (!texto) rechazar('Los mensajes del historial no pueden estar vacíos', 400);
    if (texto.length > 1000) rechazar('Cada mensaje puede tener hasta 1.000 caracteres', 400);
    return { rol: mensaje.rol, texto: texto.replace(/\s+/g, ' ') };
  });
  const pregunta = [...historialReciente].reverse().find((item) => item.rol === 'estudiante')?.texto;
  if (!pregunta) rechazar('El historial debe incluir una pregunta del estudiante', 400);

  const [temas, unidades, glosario] = await Promise.all([
    almacen.leer('temas'), almacen.leer('unidades'), almacen.leer('glosario')
  ]);
  const tema = temas.find((item) => item.id === temaId);
  if (!tema) rechazar('Tema no encontrado', 404);
  const unidad = unidades.find((item) => item.id === tema.unidadId);
  if (!unidad) rechazar('Unidad del tema no encontrada', 404);
  const asignatura = await acceso.asignaturaDeTema(temaId);
  if (!asignatura) rechazar('Asignatura del tema no encontrada', 404);

  const asignaturasPermitidas = await acceso.asignaturasDe(usuario);
  if (usuario.rol !== 'admin' && !asignaturasPermitidas.some((item) => item.id === asignatura.id)) {
    rechazar('No tienes acceso a este tema', 403);
  }
  if (usuario.rol === 'estudiante' && (unidad.visible === false || tema.estado !== 'publicado')) {
    rechazar('No tienes acceso a este tema', 403);
  }

  const terminos = glosario
    .filter((item) => item.temaId === temaId && item.estado === 'aprobado')
    .slice(0, 30)
    .map((item) => `${item.termino}: ${item.definicion || 'Sin definición registrada'}`);
  const contenido = [
    seccion('Objetivos', tema.objetivos),
    `Resumen: ${tema.resumen || 'Sin información registrada.'}`,
    seccion('Ejemplos', tema.ejemplos),
    seccion('Errores frecuentes', tema.erroresFrecuentes),
    seccion('Preguntas guía', tema.preguntasGuia),
    seccion('Glosario', terminos)
  ].join('\n\n');

  return {
    asignatura: asignatura.nombre,
    nivel: asignatura.nivel || 'Nivel general',
    tema: tema.titulo,
    contenido,
    historial: historialReciente.map((item) => `${item.rol === 'estudiante' ? 'Estudiante' : 'Tutor'}: ${item.texto}`).join('\n'),
    pregunta
  };
}
