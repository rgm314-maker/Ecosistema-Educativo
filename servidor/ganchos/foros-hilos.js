// Acceso, autoría y moderación de hilos del foro

import * as acceso from '../acceso.js';

function rechazar(mensaje, estado) {
  const error = new Error(mensaje);
  error.estado = estado;
  throw error;
}

function dentroDeQuinceMinutos(fecha) {
  const momento = new Date(fecha).getTime();
  return Number.isFinite(momento) && Date.now() - momento <= 15 * 60 * 1000;
}

async function puedeModerar(usuario, asignaturaId) {
  return usuario?.rol === 'admin' || (
    usuario?.rol === 'docente' &&
    await acceso.puedeEditarAsignatura(usuario, asignaturaId)
  );
}

export async function filtrarLista(lista, usuario) {
  if (!Array.isArray(lista) || !usuario?.id) return [];
  const asignaturas = await acceso.asignaturasDe(usuario);
  const permitidas = new Set(asignaturas.map((item) => item.id));
  return lista.filter((hilo) =>
    permitidas.has(hilo.asignaturaId) &&
    (!hilo.oculto || usuario.rol === 'docente' || usuario.rol === 'admin')
  );
}

export async function antesDeGuardar(datos, usuario, anterior) {
  if (!usuario?.id) rechazar('Se requiere sesión activa', 401);
  const asignaturaId = datos.asignaturaId || anterior?.asignaturaId;
  if (!asignaturaId) rechazar('La asignatura es obligatoria', 400);

  const asignaturas = await acceso.asignaturasDe(usuario);
  if (!asignaturas.some((item) => item.id === asignaturaId)) {
    rechazar('No tienes acceso a esta asignatura', 403);
  }
  const temaId = datos.temaId ?? anterior?.temaId;
  if (temaId) {
    const asignaturaTema = await acceso.asignaturaDeTema(temaId);
    if (!asignaturaTema || asignaturaTema.id !== asignaturaId) {
      rechazar('El tema no pertenece a la asignatura seleccionada', 400);
    }
  }

  const moderador = await puedeModerar(usuario, asignaturaId);
  if (anterior) {
    if (Object.hasOwn(datos, 'asignaturaId') && datos.asignaturaId !== anterior.asignaturaId) {
      rechazar('No se puede cambiar la asignatura del hilo', 400);
    }
    const autorVigente = anterior.autorId === usuario.id && dentroDeQuinceMinutos(anterior.fecha);
    if (!autorVigente && !moderador) rechazar('El plazo para editar este hilo terminó', 403);
  } else {
    datos.autorId = usuario.id;
    datos.fijado = moderador ? Boolean(datos.fijado) : false;
    datos.cerrado = moderador ? Boolean(datos.cerrado) : false;
    datos.oculto = moderador ? Boolean(datos.oculto) : false;
    datos.ultimoMovimiento = new Date().toISOString();
  }

  for (const campo of ['fijado', 'cerrado', 'oculto']) {
    if (Object.hasOwn(datos, campo) && anterior && datos[campo] !== anterior[campo] && !moderador) {
      rechazar('Solo docentes y administradores pueden moderar hilos', 403);
    }
  }

  if (Object.hasOwn(datos, 'autorId')) datos.autorId = anterior?.autorId || usuario.id;
  const titulo = String(datos.titulo ?? anterior?.titulo ?? '').trim();
  const texto = String(datos.texto ?? anterior?.texto ?? '').trim();
  if (!titulo) rechazar('El título es obligatorio', 400);
  if (titulo.length > 160) rechazar('El título no puede superar 160 caracteres', 400);
  if (!texto) rechazar('El texto es obligatorio', 400);
  if (texto.length > 5000) rechazar('El texto no puede superar 5.000 caracteres', 400);
  datos.titulo = titulo;
  datos.texto = texto;
  return datos;
}

export async function antesDeEliminar(hilo, usuario) {
  const moderador = await puedeModerar(usuario, hilo.asignaturaId);
  const autorVigente = hilo.autorId === usuario?.id && dentroDeQuinceMinutos(hilo.fecha);
  if (!autorVigente && !moderador) rechazar('No puedes eliminar este hilo', 403);
}

export default { filtrarLista, antesDeGuardar, antesDeEliminar };
