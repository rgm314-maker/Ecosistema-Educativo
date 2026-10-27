// Consulta y lectura de notificaciones propias

import { Router } from 'express';
import { exigirRol } from '../auth.js';
import * as almacen from '../almacen.js';

const router = Router();

router.get('/notificaciones', exigirRol('sesion'), async (req, res, next) => {
  try {
    const lista = await almacen.leer('notificaciones');
    res.json(lista.filter((item) => item.usuarioId === req.usuario.id));
  } catch (error) { next(error); }
});

router.post('/notificaciones/:id/leida', exigirRol('sesion'), async (req, res, next) => {
  try {
    const lista = await almacen.leer('notificaciones');
    const item = lista.find((registro) => registro.id === req.params.id);
    if (!item || item.usuarioId !== req.usuario.id) {
      const error = new Error('Notificación no encontrada');
      error.estado = 404;
      throw error;
    }
    res.json(await almacen.actualizar('notificaciones', item.id, { leida: true }));
  } catch (error) { next(error); }
});

router.post('/notificaciones/leidas', exigirRol('sesion'), async (req, res, next) => {
  try {
    const lista = await almacen.leer('notificaciones');
    const propias = lista.filter((item) => item.usuarioId === req.usuario.id && !item.leida);
    for (const item of propias) {
      await almacen.actualizar('notificaciones', item.id, { leida: true });
    }
    res.json({ actualizadas: propias.length });
  } catch (error) { next(error); }
});

export default router;
