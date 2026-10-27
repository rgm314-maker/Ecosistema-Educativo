// Emisión idempotente de recordatorios de agenda

import { Router } from 'express';
import { exigirRol } from '../auth.js';
import * as almacen from '../almacen.js';
import { filtrarLista } from '../ganchos/agenda.js';
import { notificar } from '../notificar.js';

const router = Router();
let colaRecordatorios = Promise.resolve();

async function generarRecordatorios(usuario) {
  const todos = await almacen.leer('agenda');
  const eventos = await filtrarLista(todos, usuario);
  const ahora = Date.now();
  const creadas = [];

  for (const evento of eventos) {
    const inicio = new Date(evento.inicio).getTime();
    if (!Number.isFinite(inicio)) continue;
    const avisados = { ...(evento.avisados || {}) };
    const enviados = new Set((avisados[usuario.id] || []).map(Number));
    let cambio = false;

    for (const valor of evento.recordatorios || []) {
      const minutos = Number(valor);
      if (!Number.isFinite(minutos) || enviados.has(minutos)) continue;
      if (ahora < inicio - minutos * 60 * 1000) continue;

      const notificacion = await notificar(usuario.id, {
        tipo: 'agenda-recordatorio',
        mensaje: `Recordatorio: ${evento.titulo}`,
        enlace: '/paginas/agenda.html'
      });
      creadas.push(notificacion);
      enviados.add(minutos);
      cambio = true;
    }

    if (cambio) {
      avisados[usuario.id] = [...enviados];
      await almacen.actualizar('agenda', evento.id, { avisados });
    }
  }

  return creadas;
}

router.get('/agenda/recordatorios', exigirRol('sesion'), async (req, res, next) => {
  try {
    const turno = colaRecordatorios.catch(() => {}).then(() => generarRecordatorios(req.usuario));
    colaRecordatorios = turno;
    res.json(await turno);
  } catch (error) {
    next(error);
  }
});

export default router;
