// Visibilidad, propiedad y validación de eventos de agenda

import * as acceso from '../acceso.js';

const TIPOS = new Set(['tarea', 'reunion', 'fecha-limite', 'recordatorio']);
const RECORDATORIOS = new Set([60, 1440]);

function rechazar(mensaje, estado) {
  const error = new Error(mensaje);
  error.estado = estado;
  throw error;
}

async function idsGruposDe(usuario) {
  const grupos = await acceso.gruposDe(usuario);
  return new Set(grupos.map((grupo) => grupo.id));
}

export async function filtrarLista(lista, usuario) {
  if (!Array.isArray(lista) || !usuario?.id) return [];
  const grupos = await idsGruposDe(usuario);
  return lista.filter((evento) =>
    evento.propietarioId === usuario.id || (evento.grupoId && grupos.has(evento.grupoId))
  );
}

export async function antesDeGuardar(datos, usuario, anterior) {
  if (!usuario?.id) rechazar('Se requiere sesión activa', 401);
  if (anterior && anterior.propietarioId !== usuario.id) {
    rechazar('Solo el propietario puede editar este evento', 403);
  }

  const titulo = String(datos.titulo ?? anterior?.titulo ?? '').trim();
  const tipo = datos.tipo ?? anterior?.tipo;
  const inicio = datos.inicio ?? anterior?.inicio;
  const fin = datos.fin ?? anterior?.fin ?? null;
  const grupoId = datos.grupoId !== undefined ? (datos.grupoId || null) : (anterior?.grupoId || null);
  const actividad = datos.actividad !== undefined ? (datos.actividad || null) : (anterior?.actividad || null);
  const temaId = datos.temaId !== undefined ? (datos.temaId || null) : (anterior?.temaId || null);

  if (!titulo) rechazar('El título es obligatorio', 400);
  if (titulo.length > 160) rechazar('El título no puede superar 160 caracteres', 400);
  if (!TIPOS.has(tipo)) rechazar('Tipo de evento inválido', 400);
  if (!inicio || !Number.isFinite(new Date(inicio).getTime())) rechazar('La fecha de inicio es inválida', 400);
  if (fin && !Number.isFinite(new Date(fin).getTime())) rechazar('La fecha de fin es inválida', 400);
  if (fin && new Date(fin) < new Date(inicio)) rechazar('La fecha de fin no puede ser anterior al inicio', 400);

  if (grupoId) {
    if (!['docente', 'admin'].includes(usuario.rol)) {
      rechazar('Solo docentes y administradores pueden asignar eventos a grupos', 403);
    }
    const grupos = await idsGruposDe(usuario);
    if (!grupos.has(grupoId)) rechazar('No tienes acceso a este grupo', 403);
  }

  if (temaId) {
    const asignatura = await acceso.asignaturaDeTema(temaId);
    if (!asignatura) rechazar('El tema seleccionado no existe', 400);
    if (grupoId) {
      const grupos = await acceso.gruposDe(usuario);
      const grupo = grupos.find((item) => item.id === grupoId);
      if (!grupo || grupo.asignaturaId !== asignatura.id) {
        rechazar('El tema no pertenece a la asignatura del grupo', 400);
      }
    }
  }
  if ((actividad || temaId) && !['docente', 'admin'].includes(usuario.rol)) {
    rechazar('Solo docentes y administradores pueden vincular actividades', 403);
  }
  if (actividad && !temaId) rechazar('Selecciona un tema para vincular la actividad', 400);

  const recordatoriosEntrada = datos.recordatorios ?? anterior?.recordatorios ?? [];
  if (!Array.isArray(recordatoriosEntrada)) rechazar('Los recordatorios son inválidos', 400);
  const recordatorios = [...new Set(recordatoriosEntrada.map(Number))];
  if (recordatorios.some((minutos) => !RECORDATORIOS.has(minutos))) {
    rechazar('Recordatorio no permitido', 400);
  }

  return {
    titulo,
    tipo,
    inicio: new Date(inicio).toISOString(),
    fin: fin ? new Date(fin).toISOString() : null,
    todoElDia: Boolean(datos.todoElDia ?? anterior?.todoElDia),
    propietarioId: anterior?.propietarioId || usuario.id,
    grupoId,
    actividad,
    temaId,
    recordatorios,
    avisados: anterior?.avisados || {}
  };
}

export function antesDeEliminar(evento, usuario) {
  if (evento.propietarioId !== usuario?.id) {
    rechazar('Solo el propietario puede eliminar este evento', 403);
  }
}

export default { filtrarLista, antesDeGuardar, antesDeEliminar };
