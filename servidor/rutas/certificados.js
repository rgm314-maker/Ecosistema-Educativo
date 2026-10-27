// servidor/rutas/certificados.js
// Rutas para certificados y diplomas de acreditación

import { Router } from 'express';
import { exigirRol } from '../auth.js';
import * as almacen from '../almacen.js';
import * as acceso from '../acceso.js';

const router = Router();

// Función auxiliar para evaluar las condiciones de certificado del usuario
async function evaluarCondicionesCertificado(usuario) {
  const reglas = await almacen.leerConfig('reglas-gamificacion');
  const cfg = reglas?.certificado || {
    nivelQuizRequerido: 5,
    temasConNivelRequerido: 1,
    puntosMinimos: 400,
    temasRevisadosPct: 80
  };

  // Obtener logros del usuario
  const todosLogros = await almacen.leer('logros');
  const misLogros = todosLogros.find((l) => l.usuarioId === usuario.id) || {
    puntos: 0,
    insignias: [],
    nivelQuiz: {}
  };

  // Temas con nivel de quiz requerido
  const nivelQuiz = misLogros.nivelQuiz || {};
  const temasConNivel = Object.values(nivelQuiz).filter(
    (n) => Number(n) >= Number(cfg.nivelQuizRequerido)
  ).length;
  const cumpleQuiz = temasConNivel >= Number(cfg.temasConNivelRequerido);

  // Puntos mínimos acumulados
  const puntosActuales = Number(misLogros.puntos || 0);
  const cumplePuntos = puntosActuales >= Number(cfg.puntosMinimos);

  // Porcentaje de temas revisados (sobre los temas publicados de sus asignaturas)
  const misAsignaturas = await acceso.asignaturasDe(usuario);
  const idsAsig = new Set(misAsignaturas.map((a) => a.id));

  const todasUnidades = await almacen.leer('unidades');
  const unidadesUsuario = todasUnidades.filter((u) => idsAsig.has(u.asignaturaId));
  const idsUnidades = new Set(unidadesUsuario.map((u) => u.id));

  const todosTemas = await almacen.leer('temas');
  const temasPublicados = todosTemas.filter(
    (t) => idsUnidades.has(t.unidadId) && t.estado === 'publicado'
  );
  const idsTemasPublicados = new Set(temasPublicados.map((t) => t.id));

  const todoProgreso = await almacen.leer('progreso-temas');
  const revisados = todoProgreso.filter(
    (p) => p.usuarioId === usuario.id && idsTemasPublicados.has(p.temaId)
  );

  const totalPublicados = temasPublicados.length;
  const pctRevisados = totalPublicados > 0
    ? Math.round((revisados.length / totalPublicados) * 100)
    : 0;
  const cumplePct = pctRevisados >= Number(cfg.temasRevisadosPct);

  const condiciones = [
    {
      nombre: "Temas con nivel de quiz requerido",
      actual: temasConNivel,
      requerido: Number(cfg.temasConNivelRequerido),
      cumple: cumpleQuiz
    },
    {
      nombre: "Puntos mínimos acumulados",
      actual: puntosActuales,
      requerido: Number(cfg.puntosMinimos),
      cumple: cumplePuntos
    },
    {
      nombre: "Porcentaje de temas revisados",
      actual: pctRevisados,
      requerido: Number(cfg.temasRevisadosPct),
      cumple: cumplePct
    }
  ];

  const cumple = condiciones.every((c) => c.cumple);

  return { condiciones, cumple };
}

// Función auxiliar para generar código único EE-AAAA-XXXXXX
function generarCodigoUnico(existentes) {
  const anio = new Date().getFullYear();
  const caracteres = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let codigo = "";
  let intentos = 0;

  do {
    let rand = "";
    for (let i = 0; i < 6; i++) {
      rand += caracteres.charAt(Math.floor(Math.random() * caracteres.length));
    }
    codigo = `EE-${anio}-${rand}`;
    intentos++;
    if (intentos > 1000) break;
  } while (existentes.some((c) => c.codigo === codigo));

  return codigo;
}

// GET /api/certificados/estado (con sesión)
router.get('/certificados/estado', exigirRol('sesion'), async (req, res, next) => {
  try {
    const estado = await evaluarCondicionesCertificado(req.usuario);
    res.json(estado);
  } catch (err) {
    next(err);
  }
});

// POST /api/certificados (con sesión)
router.post('/certificados', exigirRol('sesion'), async (req, res, next) => {
  try {
    const { tipo, temaId, nivel } = req.body || {};

    if (tipo !== 'cumplimiento' && tipo !== 'nivel-quiz') {
      const err = new Error('Tipo de certificado no válido (debe ser "cumplimiento" o "nivel-quiz")');
      err.estado = 400;
      throw err;
    }

    const certificados = await almacen.leer('certificados');
    let detalle = "";
    let temaIdFinal = undefined;
    let nivelFinal = undefined;

    if (tipo === 'cumplimiento') {
      const { cumple } = await evaluarCondicionesCertificado(req.usuario);
      if (!cumple) {
        const err = new Error('No cumples las condiciones requeridas para el certificado de cumplimiento');
        err.estado = 400;
        throw err;
      }

      // Si ya existe uno igual, devolverlo
      const existente = certificados.find(
        (c) => c.usuarioId === req.usuario.id && c.tipo === 'cumplimiento'
      );
      if (existente) {
        return res.json(existente);
      }

      detalle = "Por haber completado satisfactoriamente los requisitos del programa formativo y alcanzado las competencias de aprendizaje.";
    } else {
      // tipo === "nivel-quiz"
      if (!temaId || nivel === undefined || isNaN(Number(nivel))) {
        const err = new Error('Se requiere temaId y nivel para el certificado de quiz');
        err.estado = 400;
        throw err;
      }

      const nivelNum = Number(nivel);
      temaIdFinal = temaId;
      nivelFinal = nivelNum;

      const todosLogros = await almacen.leer('logros');
      const misLogros = todosLogros.find((l) => l.usuarioId === req.usuario.id);
      const nivelAlcanzado = Number(misLogros?.nivelQuiz?.[temaId] || 0);

      if (nivelAlcanzado < nivelNum) {
        const err = new Error(`Nivel de quiz insuficiente en este tema (alcanzado: ${nivelAlcanzado}, requerido: ${nivelNum})`);
        err.estado = 400;
        throw err;
      }

      // Si ya existe uno igual, devolverlo
      const existente = certificados.find(
        (c) =>
          c.usuarioId === req.usuario.id &&
          c.tipo === 'nivel-quiz' &&
          c.temaId === temaId &&
          Number(c.nivel) === nivelNum
      );
      if (existente) {
        return res.json(existente);
      }

      const temas = await almacen.leer('temas');
      const tema = temas.find((t) => t.id === temaId);
      const tituloTema = tema?.titulo || temaId;
      detalle = `Por haber superado con éxito el nivel ${nivelNum} en el tema: ${tituloTema}`;
    }

    const codigo = generarCodigoUnico(certificados);
    const nombreCompleto = `${req.usuario.nombre || ''} ${req.usuario.apellido || ''}`.trim() || 'Estudiante';

    const nuevoCertificado = await almacen.agregar('certificados', {
      codigo,
      usuarioId: req.usuario.id,
      tipo,
      temaId: temaIdFinal,
      nivel: nivelFinal,
      detalle,
      nombreCompleto
    });

    res.status(201).json(nuevoCertificado);
  } catch (err) {
    next(err);
  }
});

// GET /api/certificados/verificar/:codigo (sin sesión)
router.get('/certificados/verificar/:codigo', async (req, res, next) => {
  try {
    const { codigo } = req.params;
    if (!codigo) {
      return res.json({ valido: false });
    }

    const certificados = await almacen.leer('certificados');
    const codigoNormalizado = codigo.trim().toUpperCase();
    const cert = certificados.find((c) => c.codigo && c.codigo.toUpperCase() === codigoNormalizado);

    if (!cert) {
      return res.json({ valido: false });
    }

    res.json({
      valido: true,
      nombreCompleto: cert.nombreCompleto,
      detalle: cert.detalle,
      fecha: cert.fecha
    });
  } catch (err) {
    next(err);
  }
});

export default router;
