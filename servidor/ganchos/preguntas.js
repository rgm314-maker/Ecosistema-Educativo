// servidor/ganchos/preguntas.js
// Gancho para control de acceso y validación del banco de preguntas

import * as almacen from '../almacen.js';
import * as acceso from '../acceso.js';

export async function filtrarLista(lista, usuario) {
  if (!Array.isArray(lista) || !usuario || !usuario.id) return [];

  if (usuario.rol === 'admin') {
    return lista;
  }

  if (usuario.rol === 'docente') {
    const grupos = await acceso.gruposDe(usuario);
    const misAsigIds = new Set(grupos.map((g) => g.asignaturaId).filter(Boolean));

    const unidades = await almacen.leer('unidades');
    const unidadAsig = new Map(unidades.map((u) => [u.id, u.asignaturaId]));

    const temas = await almacen.leer('temas');
    const temaAsig = new Map(temas.map((t) => [t.id, unidadAsig.get(t.unidadId)]));

    return lista.filter((p) => misAsigIds.has(temaAsig.get(p.temaId)));
  }

  return [];
}

export async function antesDeGuardar(datos, usuario, anterior) {
  if (!usuario || !usuario.id) {
    const err = new Error('Se requiere autenticación');
    err.estado = 401;
    throw err;
  }

  if (usuario.rol !== 'admin' && usuario.rol !== 'docente') {
    const err = new Error('No tienes permisos para gestionar preguntas');
    err.estado = 403;
    throw err;
  }

  const temaId = datos.temaId || anterior?.temaId;
  if (!temaId) {
    const err = new Error('El campo temaId es obligatorio');
    err.estado = 400;
    throw err;
  }

  const asignatura = await acceso.asignaturaDeTema(temaId);
  if (!asignatura) {
    const err = new Error('Asignatura no encontrada para el tema especificado');
    err.estado = 404;
    throw err;
  }

  const puedeEditar = await acceso.puedeEditarAsignatura(usuario, asignatura.id);
  if (!puedeEditar) {
    const err = new Error('No tienes permisos para editar preguntas de esta asignatura');
    err.estado = 403;
    throw err;
  }

  const nivelNum = Number(datos.nivel !== undefined ? datos.nivel : anterior?.nivel);
  if (isNaN(nivelNum) || nivelNum < 1 || nivelNum > 5) {
    const err = new Error('El nivel de la pregunta debe estar entre 1 y 5');
    err.estado = 400;
    throw err;
  }
  datos.nivel = nivelNum;

  const tipo = datos.tipo || anterior?.tipo;
  if (!['opcion', 'vf', 'completar'].includes(tipo)) {
    const err = new Error('El tipo de pregunta debe ser "opcion", "vf" o "completar"');
    err.estado = 400;
    throw err;
  }
  datos.tipo = tipo;

  const enunciado = (datos.enunciado !== undefined ? datos.enunciado : anterior?.enunciado || '').trim();
  if (!enunciado) {
    const err = new Error('El enunciado de la pregunta no puede estar vacío');
    err.estado = 400;
    throw err;
  }
  datos.enunciado = enunciado;

  if (tipo === 'opcion') {
    if (!Array.isArray(datos.opciones) || datos.opciones.length < 2) {
      const err = new Error('Las preguntas de opción deben tener al menos 2 opciones');
      err.estado = 400;
      throw err;
    }
  }

  if (datos.correcta === undefined && anterior?.correcta === undefined) {
    const err = new Error('Debes definir la respuesta correcta');
    err.estado = 400;
    throw err;
  }

  datos.origen = datos.origen || anterior?.origen || 'docente';
  datos.estado = datos.estado || anterior?.estado || 'aprobado';

  return datos;
}

export default {
  filtrarLista,
  antesDeGuardar
};
