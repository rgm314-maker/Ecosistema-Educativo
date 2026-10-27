// Motor de alertas tempranas e inactividad estudiantil

import * as almacen from './almacen.js';

export async function evaluarAlertas(intento, usuario) {
  return null;
}

export async function evaluarInactividad(grupoId) {
  const [reglas, grupos, eventos, intentos, existentes, usuarios] = await Promise.all([
    almacen.leerConfig('reglas-alertas'),
    almacen.leer('distributivo'),
    almacen.leer('agenda'),
    almacen.leer('intentos'),
    almacen.leer('alertas'),
    almacen.leer('usuarios')
  ]);
  const grupo = grupos.find((item) => item.id === grupoId);
  if (!grupo) {
    const error = new Error('Grupo no encontrado');
    error.estado = 404;
    throw error;
  }

  const diasGracia = Number(reglas.vencidas?.diasGracia ?? reglas.vencidas);
  if (!Number.isFinite(diasGracia) || diasGracia < 0) return [];
  const limite = Date.now() - diasGracia * 24 * 60 * 60 * 1000;
  const vencidos = eventos.filter((evento) =>
    evento.grupoId === grupoId && evento.tipo === 'fecha-limite' &&
    evento.actividad && evento.temaId && new Date(evento.inicio).getTime() < limite
  );
  const creadas = [];
  const idsEstudiantes = new Set(usuarios
    .filter((usuario) => usuario.rol === 'estudiante')
    .map((usuario) => usuario.id));

  for (const estudianteId of grupo.estudiantes || []) {
    if (!idsEstudiantes.has(estudianteId)) continue;
    for (const evento of vencidos) {
      const completada = intentos.some((intento) =>
        intento.usuarioId === estudianteId && intento.actividad === evento.actividad &&
        intento.temaId === evento.temaId && new Date(intento.fecha) >= new Date(evento.fecha)
      );
      const yaExiste = existentes.some((alerta) =>
        alerta.estudianteId === estudianteId && alerta.regla === 'vencidas' &&
        alerta.detalle?.eventoId === evento.id
      );
      if (completada || yaExiste) continue;

      const alerta = await almacen.agregar('alertas', {
        estudianteId,
        docenteId: grupo.docenteId,
        grupoId,
        regla: 'vencidas',
        temaId: evento.temaId,
        detalle: { eventoId: evento.id, actividad: evento.actividad, titulo: evento.titulo },
        estado: 'activa'
      });
      existentes.push(alerta);
      creadas.push(alerta);
    }
  }

  return creadas;
}

export default { evaluarAlertas, evaluarInactividad };
