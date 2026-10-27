// Prepara la evaluación final de una simulación de rol

import * as almacen from '../almacen.js';
import { filtrarLista } from '../ganchos/simulaciones.js';

function rechazar(mensaje, estado) {
  const error = new Error(mensaje);
  error.estado = estado;
  throw error;
}

function limpiarHistorial(historial, maxTurnos) {
  if (!Array.isArray(historial)) rechazar('El historial debe ser una lista', 400);
  return historial.slice(-maxTurnos).map((mensaje) => {
    if (!mensaje || !['estudiante', 'personaje'].includes(mensaje.rol)) {
      rechazar('El historial contiene un rol inválido', 400);
    }
    const texto = String(mensaje.texto || '').trim();
    if (!texto || texto.length > 2000) rechazar('Cada mensaje debe tener entre 1 y 2.000 caracteres', 400);
    return { rol: mensaje.rol, texto: texto.replace(/\s+/g, ' ') };
  });
}

export default async function prepararEvaluacionRol(cuerpo, usuario) {
  const simulacionId = String(cuerpo?.simulacionId || '').trim();
  if (!simulacionId) rechazar('El parámetro simulacionId es obligatorio', 400);

  const simulaciones = await almacen.leer('simulaciones');
  const simulacion = simulaciones.find((item) => item.id === simulacionId);
  if (!simulacion) rechazar('Simulación no encontrada', 404);
  if (simulacion.modo !== 'rol') rechazar('La simulación no corresponde al modo rol', 400);
  if (!(await filtrarLista([simulacion], usuario)).length) rechazar('No tienes acceso a esta simulación', 403);

  const maxTurnos = Math.min(12, Math.max(4, Math.trunc(Number(simulacion.maxTurnos)) || 4));
  const historial = limpiarHistorial(cuerpo?.historial, maxTurnos);
  if (!historial.some((item) => item.rol === 'estudiante')) rechazar('No hay intervenciones para evaluar', 400);

  return {
    personaje: `${simulacion.personaje?.nombre || 'Personaje'}: ${simulacion.personaje?.descripcion || 'Sin descripción'}`,
    objetivo: simulacion.personaje?.objetivo || '',
    rubrica: (simulacion.rubrica || []).map((item) => ({
      criterio: item.criterio,
      descripcion: item.descripcion,
      puntosMaximos: Number(item.puntos || 0)
    })),
    transcripcion: historial.map((item) => `${item.rol === 'estudiante' ? 'Estudiante' : 'Personaje'}: ${item.texto}`).join('\n')
  };
}
