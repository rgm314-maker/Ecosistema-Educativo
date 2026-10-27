// Acceso, autoría, moderación y recompensas de respuestas del foro

import * as almacen from '../almacen.js';
import * as acceso from '../acceso.js';
import { notificar } from '../notificar.js';
import { procesarIntento } from '../gamificacion.js';

function rechazar(mensaje, estado) {
  const error = new Error(mensaje);
  error.estado = estado;
  throw error;
}

function dentroDeQuinceMinutos(fecha) {
  const momento = new Date(fecha).getTime();
  return Number.isFinite(momento) && Date.now() - momento <= 15 * 60 * 1000;
}

async function obtenerHilo(hiloId) {
  const hilos = await almacen.leer('foros-hilos');
  return hilos.find((hilo) => hilo.id === hiloId) || null;
}

async function puedeModerar(usuario, asignaturaId) {
  return usuario?.rol === 'admin' || (
    usuario?.rol === 'docente' &&
    await acceso.puedeEditarAsignatura(usuario, asignaturaId)
  );
}

export async function filtrarLista(lista, usuario) {
  if (!Array.isArray(lista) || !usuario?.id) return [];
  const [hilos, asignaturas] = await Promise.all([
    almacen.leer('foros-hilos'),
    acceso.asignaturasDe(usuario)
  ]);
  const permitidas = new Set(asignaturas.map((item) => item.id));
  const hilosPermitidos = new Set(hilos
    .filter((hilo) =>
      permitidas.has(hilo.asignaturaId) &&
      (!hilo.oculto || usuario.rol === 'docente' || usuario.rol === 'admin')
    )
    .map((hilo) => hilo.id));
  return lista.filter((respuesta) =>
    hilosPermitidos.has(respuesta.hiloId) &&
    (!respuesta.oculta || usuario.rol === 'docente' || usuario.rol === 'admin')
  );
}

export async function antesDeGuardar(datos, usuario, anterior) {
  if (!usuario?.id) rechazar('Se requiere sesión activa', 401);
  const hiloId = datos.hiloId || anterior?.hiloId;
  const hilo = await obtenerHilo(hiloId);
  if (!hilo) rechazar('Hilo no encontrado', 404);

  const asignaturas = await acceso.asignaturasDe(usuario);
  if (!asignaturas.some((item) => item.id === hilo.asignaturaId)) {
    rechazar('No tienes acceso a este hilo', 403);
  }

  const moderador = await puedeModerar(usuario, hilo.asignaturaId);
  if (anterior) {
    if (Object.hasOwn(datos, 'hiloId') && datos.hiloId !== anterior.hiloId) {
      rechazar('No se puede mover una respuesta a otro hilo', 400);
    }
    const autorVigente = anterior.autorId === usuario.id && dentroDeQuinceMinutos(anterior.fecha);
    if (!autorVigente && !moderador) rechazar('El plazo para editar esta respuesta terminó', 403);
  } else {
    if (hilo.cerrado) rechazar('No se puede responder en un hilo cerrado', 409);
    datos.autorId = usuario.id;
    datos.destacada = moderador ? Boolean(datos.destacada) : false;
    datos.oculta = moderador ? Boolean(datos.oculta) : false;
  }

  for (const campo of ['destacada', 'oculta']) {
    if (Object.hasOwn(datos, campo) && anterior && datos[campo] !== anterior[campo] && !moderador) {
      rechazar('Solo docentes y administradores pueden moderar respuestas', 403);
    }
  }

  if (Object.hasOwn(datos, 'autorId')) datos.autorId = anterior?.autorId || usuario.id;
  const texto = String(datos.texto ?? anterior?.texto ?? '').trim();
  if (!texto) rechazar('El texto es obligatorio', 400);
  if (texto.length > 5000) rechazar('El texto no puede superar 5.000 caracteres', 400);
  datos.texto = texto;
  return datos;
}

export async function despuesDeGuardar(respuesta, usuario, anterior) {
  if (anterior) return;
  const hilo = await obtenerHilo(respuesta.hiloId);
  if (!hilo) return;

  await almacen.actualizar('foros-hilos', hilo.id, {
    ultimoMovimiento: respuesta.fecha || new Date().toISOString()
  });
  if (hilo.autorId !== usuario.id) {
    await notificar(hilo.autorId, {
      tipo: 'foro-respuesta',
      mensaje: `Respondieron en tu hilo: ${hilo.titulo}`,
      enlace: `/paginas/hilo.html?id=${encodeURIComponent(hilo.id)}`
    });
  }
  await procesarIntento(usuario, {
    actividad: 'foro',
    puntaje: 1,
    maximo: 1
  });
}

export async function antesDeEliminar(respuesta, usuario) {
  const hilo = await obtenerHilo(respuesta.hiloId);
  if (!hilo) rechazar('Hilo no encontrado', 404);
  const moderador = await puedeModerar(usuario, hilo.asignaturaId);
  const autorVigente = respuesta.autorId === usuario?.id && dentroDeQuinceMinutos(respuesta.fecha);
  if (!autorVigente && !moderador) rechazar('No puedes eliminar esta respuesta', 403);
}

export default { filtrarLista, antesDeGuardar, despuesDeGuardar, antesDeEliminar };
