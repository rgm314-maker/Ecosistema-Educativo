// servidor/rutas/gamificacion.js
// Rutas de gamificación: registro de intentos y consulta de logros

import { Router } from 'express';
import { exigirRol } from '../auth.js';
import * as almacen from '../almacen.js';
import * as acceso from '../acceso.js';
import { procesarIntento } from '../gamificacion.js';

const router = Router();

// POST /api/intentos (con sesión)
router.post('/intentos', exigirRol('sesion'), async (req, res, next) => {
  try {
    const resultado = await procesarIntento(req.usuario, req.body);
    res.status(201).json(resultado);
  } catch (err) {
    next(err);
  }
});

// GET /api/logros/:usuarioId ("yo" permitido)
router.get('/logros/:usuarioId', exigirRol('sesion'), async (req, res, next) => {
  try {
    let objetivoId = req.params.usuarioId;
    if (objetivoId === 'yo') {
      objetivoId = req.usuario.id;
    }

    // Permisos: permitido al propio estudiante, a un docente de sus grupos o al admin
    let permitido = false;

    if (req.usuario.rol === 'admin') {
      permitido = true;
    } else if (req.usuario.id === objetivoId) {
      permitido = true;
    } else if (req.usuario.rol === 'docente') {
      const estudiantes = await acceso.estudiantesDe(req.usuario.id);
      if (estudiantes.includes(objetivoId)) {
        permitido = true;
      }
    }

    if (!permitido) {
      const err = new Error('Acceso no autorizado para consultar estos logros');
      err.estado = 403;
      throw err;
    }

    const lista = await almacen.leer('logros');
    const encontrado = lista.find((l) => l.usuarioId === objetivoId);

    const logros = encontrado || {
      usuarioId: objetivoId,
      puntos: 0,
      insignias: [],
      nivelQuiz: {}
    };

    res.json(logros);
  } catch (err) {
    next(err);
  }
});

export default router;
