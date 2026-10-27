// Consulta docente de entregas y calificación de tareas.

import { Router } from 'express';
import { exigirRol } from '../auth.js';
import * as almacen from '../almacen.js';
import * as acceso from '../acceso.js';

const router = Router();

function rechazar(mensaje, estado = 400) {
  const error = new Error(mensaje);
  error.estado = estado;
  throw error;
}

async function tareaEditable(usuario, tareaId) {
  const tareas = await almacen.leer('tareas');
  const tarea = tareas.find((item) => item.id === tareaId);
  if (!tarea) rechazar('La tarea no existe', 404);
  if (usuario.rol !== 'admin') {
    const grupos = await acceso.gruposDe(usuario);
    if (!grupos.some((grupo) => grupo.id === tarea.grupoId && grupo.docenteId === usuario.id)) {
      rechazar('No tienes permiso para calificar esta tarea', 403);
    }
  }
  return tarea;
}

router.get('/tareas/entregas', exigirRol('docente', 'admin'), async (req, res, next) => {
  try {
    const [entregas, tareas, usuarios] = await Promise.all([
      almacen.leer('entregas-tareas'), almacen.leer('tareas'), almacen.leer('usuarios')
    ]);
    const grupos = await acceso.gruposDe(req.usuario);
    const idsGrupos = new Set(grupos.map((grupo) => grupo.id));
    const idsTareas = new Set(tareas.filter((tarea) => idsGrupos.has(tarea.grupoId)).map((tarea) => tarea.id));
    const nombres = new Map(usuarios.map((usuario) => [usuario.id, `${usuario.nombre} ${usuario.apellido}`.trim()]));
    res.json(entregas.filter((entrega) => idsTareas.has(entrega.tareaId)).map((entrega) => ({
      ...entrega,
      estudianteNombre: nombres.get(entrega.usuarioId) || 'Estudiante'
    })));
  } catch (error) { next(error); }
});

router.post('/tareas/entregas/:id/calificar', exigirRol('docente', 'admin'), async (req, res, next) => {
  try {
    const entregas = await almacen.leer('entregas-tareas');
    const entrega = entregas.find((item) => item.id === req.params.id);
    if (!entrega) rechazar('La entrega no existe', 404);
    await tareaEditable(req.usuario, entrega.tareaId);
    const calificacion = Number(req.body?.calificacion);
    const comentarioDocente = String(req.body?.comentarioDocente || '').trim();
    if (!Number.isFinite(calificacion) || calificacion < 0 || calificacion > 10) {
      rechazar('La calificación debe estar entre 0 y 10');
    }
    if (comentarioDocente.length > 2000) rechazar('El comentario admite hasta 2000 caracteres');
    const actualizada = await almacen.actualizar('entregas-tareas', entrega.id, {
      calificacion: Math.round(calificacion * 100) / 100,
      comentarioDocente,
      calificadoEn: new Date().toISOString(),
      calificadoPor: req.usuario.id
    });
    res.json(actualizada);
  } catch (error) { next(error); }
});

export default router;
