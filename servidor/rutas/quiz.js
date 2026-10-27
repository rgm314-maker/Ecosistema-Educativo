// Motor del quiz progresivo por niveles

import { Router } from 'express';
import { exigirRol } from '../auth.js';
import * as almacen from '../almacen.js';
import * as acceso from '../acceso.js';
import { procesarIntento } from '../gamificacion.js';
import { notificar } from '../notificar.js';

const router = Router();
const NOMBRES_NIVEL = ['Recordar', 'Comprender', 'Aplicar', 'Analizar', 'Evaluar'];

function rechazar(mensaje, estado) {
  const error = new Error(mensaje);
  error.estado = estado;
  throw error;
}

function mezclar(lista) {
  const copia = [...lista];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}

function normalizar(valor) {
  return String(valor ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLocaleLowerCase('es');
}

function esCorrecta(pregunta, respuesta) {
  if (pregunta.tipo === 'opcion') return Number(respuesta) === Number(pregunta.correcta);
  if (pregunta.tipo === 'vf') return String(respuesta) === String(pregunta.correcta);
  return normalizar(respuesta) === normalizar(pregunta.correcta);
}

function respuestaCorrectaTexto(pregunta) {
  if (pregunta.tipo === 'opcion') return String(pregunta.opciones?.[Number(pregunta.correcta)] ?? '');
  if (pregunta.tipo === 'vf') return String(pregunta.correcta) === 'true' ? 'Verdadero' : 'Falso';
  return String(pregunta.correcta ?? '');
}

function preguntaPublica(pregunta) {
  return {
    id: pregunta.id,
    tipo: pregunta.tipo,
    enunciado: pregunta.enunciado,
    opciones: Array.isArray(pregunta.opciones) ? pregunta.opciones : []
  };
}

async function contextoTema(usuario, temaId) {
  const asignatura = await acceso.asignaturaDeTema(temaId);
  if (!asignatura) rechazar('Tema no encontrado', 404);

  const grupos = await acceso.gruposDe(usuario);
  const gruposTema = grupos.filter((grupo) => grupo.asignaturaId === asignatura.id);
  if (!gruposTema.length) rechazar('No tienes acceso a este tema', 403);
  return { asignatura, grupos: gruposTema };
}

async function obtenerLogro(usuarioId) {
  const logros = await almacen.leer('logros');
  return logros.find((logro) => logro.usuarioId === usuarioId) || null;
}

async function nivelAprobado(usuarioId, temaId) {
  const logro = await obtenerLogro(usuarioId);
  return Number(logro?.nivelQuiz?.[temaId] || 0);
}

async function avisarBancoInsuficiente(grupos, temaId, nivel) {
  const hoy = new Date().toISOString().slice(0, 10);
  const enlace = `/paginas/banco-preguntas.html?temaId=${encodeURIComponent(temaId)}&nivel=${nivel}`;
  const existentes = await almacen.leer('notificaciones');
  const docentes = new Set(grupos.map((grupo) => grupo.docenteId).filter(Boolean));

  for (const docenteId of docentes) {
    const yaAvisado = existentes.some((item) =>
      item.usuarioId === docenteId &&
      item.tipo === 'banco-preguntas-insuficiente' &&
      item.enlace === enlace &&
      String(item.fecha || '').slice(0, 10) === hoy
    );
    if (!yaAvisado) {
      await notificar(docenteId, {
        tipo: 'banco-preguntas-insuficiente',
        mensaje: `Se reutilizaron preguntas del nivel ${nivel} porque no hay suficientes preguntas nuevas aprobadas.`,
        enlace
      });
    }
  }
}

router.get('/quiz/estado', exigirRol('estudiante'), async (req, res, next) => {
  try {
    const temaId = String(req.query.temaId || '').trim();
    if (!temaId) rechazar('temaId es obligatorio', 400);
    await contextoTema(req.usuario, temaId);

    const aprobadoHasta = await nivelAprobado(req.usuario.id, temaId);
    const sesiones = await almacen.buscar('quiz-sesiones', {
      usuarioId: req.usuario.id,
      temaId
    });

    const niveles = NOMBRES_NIVEL.map((nombre, indice) => {
      const nivel = indice + 1;
      const porcentajes = sesiones
        .filter((sesion) => Number(sesion.nivel) === nivel && sesion.finalizada)
        .map((sesion) => Number(sesion.resultado?.porcentaje ?? 0));
      const estado = nivel <= aprobadoHasta
        ? 'aprobado'
        : (nivel === 1 || nivel === aprobadoHasta + 1 ? 'disponible' : 'bloqueado');
      return {
        nivel,
        nombre,
        estado,
        mejorPorcentaje: porcentajes.length ? Math.max(...porcentajes) : 0
      };
    });

    res.json({ niveles });
  } catch (error) {
    next(error);
  }
});

router.post('/quiz/iniciar', exigirRol('estudiante'), async (req, res, next) => {
  try {
    const temaId = String(req.body.temaId || '').trim();
    const nivel = Number(req.body.nivel);
    if (!temaId || !Number.isInteger(nivel) || nivel < 1 || nivel > 5) {
      rechazar('Tema o nivel inválido', 400);
    }

    const { grupos } = await contextoTema(req.usuario, temaId);
    const aprobadoHasta = await nivelAprobado(req.usuario.id, temaId);
    if (nivel !== 1 && nivel > aprobadoHasta + 1) rechazar('Debes aprobar el nivel anterior', 403);

    const reglas = await almacen.leerConfig('reglas-gamificacion');
    const cantidad = Number(reglas.quiz?.preguntasPorNivel);
    if (!Number.isInteger(cantidad) || cantidad < 1) rechazar('Configuración del quiz inválida', 500);

    const banco = await almacen.buscar('preguntas', { temaId, nivel, estado: 'aprobado' });
    if (!banco.length) rechazar('No hay preguntas aprobadas para este nivel', 409);

    const sesiones = await almacen.buscar('quiz-sesiones', {
      usuarioId: req.usuario.id,
      temaId,
      nivel
    });
    const ultimaVista = new Map();
    for (const sesion of sesiones) {
      const momento = new Date(sesion.inicio || sesion.fecha || 0).getTime();
      for (const preguntaId of sesion.preguntasIds || []) {
        ultimaVista.set(preguntaId, Math.max(ultimaVista.get(preguntaId) || 0, momento));
      }
    }

    const nuevas = mezclar(banco.filter((pregunta) => !ultimaVista.has(pregunta.id)));
    const vistas = banco
      .filter((pregunta) => ultimaVista.has(pregunta.id))
      .sort((a, b) => ultimaVista.get(a.id) - ultimaVista.get(b.id));
    const seleccionadas = [...nuevas, ...vistas].slice(0, cantidad);

    if (nuevas.length < cantidad) {
      await avisarBancoInsuficiente(grupos, temaId, nivel);
    }

    const sesion = await almacen.agregar('quiz-sesiones', {
      usuarioId: req.usuario.id,
      temaId,
      nivel,
      preguntasIds: seleccionadas.map((pregunta) => pregunta.id),
      respuestas: {},
      inicio: new Date().toISOString(),
      finalizada: false
    });

    res.status(201).json({
      sesionId: sesion.id,
      preguntas: seleccionadas.map(preguntaPublica)
    });
  } catch (error) {
    next(error);
  }
});

router.post('/quiz/responder', exigirRol('estudiante'), async (req, res, next) => {
  try {
    const { sesionId, preguntaId, respuesta } = req.body;
    const sesiones = await almacen.leer('quiz-sesiones');
    const sesion = sesiones.find((item) => item.id === sesionId);
    if (!sesion || sesion.usuarioId !== req.usuario.id) rechazar('Sesión de quiz no encontrada', 404);
    if (sesion.finalizada) rechazar('Este quiz ya finalizó', 409);
    if (!sesion.preguntasIds.includes(preguntaId)) rechazar('La pregunta no pertenece a esta sesión', 400);
    if (Object.hasOwn(sesion.respuestas || {}, preguntaId)) rechazar('Esta pregunta ya fue respondida', 409);

    const preguntas = await almacen.leer('preguntas');
    const pregunta = preguntas.find((item) => item.id === preguntaId);
    if (!pregunta) rechazar('Pregunta no encontrada', 404);

    const correcto = esCorrecta(pregunta, respuesta);
    const respuestas = { ...sesion.respuestas, [preguntaId]: { respuesta, correcto } };
    await almacen.actualizar('quiz-sesiones', sesion.id, { respuestas });

    res.json({
      correcto,
      retroalimentacion: pregunta.retroalimentacion || '',
      correcta: respuestaCorrectaTexto(pregunta)
    });
  } catch (error) {
    next(error);
  }
});

router.post('/quiz/finalizar', exigirRol('estudiante'), async (req, res, next) => {
  try {
    const sesiones = await almacen.leer('quiz-sesiones');
    const sesion = sesiones.find((item) => item.id === req.body.sesionId);
    if (!sesion || sesion.usuarioId !== req.usuario.id) rechazar('Sesión de quiz no encontrada', 404);
    if (sesion.finalizada) return res.json(sesion.resultado);

    const respuestas = sesion.respuestas || {};
    if (Object.keys(respuestas).length !== sesion.preguntasIds.length) {
      rechazar('Debes responder todas las preguntas', 409);
    }

    const reglas = await almacen.leerConfig('reglas-gamificacion');
    const porcentajeAprobacion = Number(reglas.quiz?.porcentajeAprobacion);
    if (!Number.isFinite(porcentajeAprobacion)) rechazar('Configuración del quiz inválida', 500);

    const preguntas = await almacen.leer('preguntas');
    const preguntasSesion = sesion.preguntasIds
      .map((id) => preguntas.find((pregunta) => pregunta.id === id))
      .filter(Boolean);
    const aciertos = Object.values(respuestas).filter((item) => item.correcto).length;
    const total = sesion.preguntasIds.length;
    const porcentaje = Math.round((aciertos / total) * 100);
    const aprobado = porcentaje >= porcentajeAprobacion;
    const repasar = preguntasSesion
      .filter((pregunta) => !respuestas[pregunta.id]?.correcto)
      .map((pregunta) => pregunta.retroalimentacion || 'Repasa el contenido relacionado con esta pregunta.');

    if (aprobado) {
      const logro = await obtenerLogro(req.usuario.id);
      const nivelQuiz = { ...(logro?.nivelQuiz || {}) };
      nivelQuiz[sesion.temaId] = Math.max(Number(nivelQuiz[sesion.temaId] || 0), Number(sesion.nivel));
      if (logro) {
        await almacen.actualizar('logros', logro.id, { nivelQuiz });
      } else {
        await almacen.agregar('logros', {
          usuarioId: req.usuario.id,
          puntos: 0,
          insignias: [],
          nivelQuiz
        });
      }
    }

    const duracionSeg = Math.max(0, Math.round((Date.now() - new Date(sesion.inicio).getTime()) / 1000));
    const gamificacion = await procesarIntento(req.usuario, {
      actividad: 'quiz',
      temaId: sesion.temaId,
      nivel: sesion.nivel,
      puntaje: aciertos,
      maximo: total,
      errores: total - aciertos,
      duracionSeg,
      detalle: { aprobado }
    });
    const resultado = {
      porcentaje,
      aprobado,
      aciertos,
      total,
      repasar,
      puntosGanados: gamificacion.puntosGanados,
      insigniasNuevas: gamificacion.insigniasNuevas
    };
    await almacen.actualizar('quiz-sesiones', sesion.id, {
      finalizada: true,
      fin: new Date().toISOString(),
      resultado
    });
    res.json(resultado);
  } catch (error) {
    next(error);
  }
});

export default router;
