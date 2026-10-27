// Mensajería privada, bloqueos, difusión y moderación

import { Router } from 'express';
import { exigirRol } from '../auth.js';
import * as almacen from '../almacen.js';
import * as acceso from '../acceso.js';

const router = Router();
const enviosPorUsuario = new Map();
const colas = new Map();

function rechazar(mensaje, estado) {
  const error = new Error(mensaje);
  error.estado = estado;
  throw error;
}

function encolar(clave, tarea) {
  const anterior = colas.get(clave) || Promise.resolve();
  const siguiente = anterior.catch(() => {}).then(tarea);
  colas.set(clave, siguiente);
  return siguiente.finally(() => {
    if (colas.get(clave) === siguiente) colas.delete(clave);
  });
}

function usuarioPublico(usuario) {
  return {
    id: usuario.id,
    nombre: usuario.nombre,
    apellido: usuario.apellido,
    correo: usuario.correo,
    rol: usuario.rol,
    foto: usuario.foto || ''
  };
}

function hayBloqueo(usuarioId, otroId, bloqueos) {
  return bloqueos.some((item) =>
    (item.usuarioId === usuarioId && item.bloqueadoId === otroId) ||
    (item.usuarioId === otroId && item.bloqueadoId === usuarioId)
  );
}

async function contactosPermitidos(usuario) {
  const [usuarios, grupos, bloqueos, ajustes] = await Promise.all([
    almacen.leer('usuarios'), acceso.gruposDe(usuario), almacen.leer('bloqueos'),
    almacen.leerConfig('ajustes')
  ]);
  const activos = usuarios.filter((item) => item.activo && item.id !== usuario.id);
  let ids = new Set();

  if (usuario.rol === 'admin') {
    ids = new Set(activos.map((item) => item.id));
  } else if (usuario.rol === 'docente') {
    for (const grupo of grupos) {
      for (const estudianteId of grupo.estudiantes || []) {
        const estudiante = activos.find((item) => item.id === estudianteId);
        if (estudiante?.rol === 'estudiante') ids.add(estudianteId);
      }
    }
    for (const item of activos) if (item.rol === 'docente') ids.add(item.id);
  } else if (usuario.rol === 'estudiante') {
    for (const grupo of grupos) {
      const docente = activos.find((item) => item.id === grupo.docenteId);
      if (docente?.rol === 'docente') ids.add(grupo.docenteId);
      if (ajustes.chatEntreEstudiantes) {
        for (const estudianteId of grupo.estudiantes || []) {
          const estudiante = activos.find((item) => item.id === estudianteId);
          if (estudiante?.rol === 'estudiante') ids.add(estudianteId);
        }
      }
    }
  }

  return activos
    .filter((item) => ids.has(item.id) && !hayBloqueo(usuario.id, item.id, bloqueos))
    .sort((a, b) => `${a.apellido} ${a.nombre}`.localeCompare(`${b.apellido} ${b.nombre}`, 'es'))
    .map(usuarioPublico);
}

async function conversacionPorId(convId, usuarioId = null) {
  const conversaciones = await almacen.leer('conversaciones');
  const conversacion = conversaciones.find((item) => item.id === convId);
  if (!conversacion) rechazar('Conversación no encontrada', 404);
  if (usuarioId && !conversacion.participantes?.includes(usuarioId)) {
    rechazar('No participas en esta conversación', 403);
  }
  return conversacion;
}

async function buscarOCrearConversacion(usuarioId, otroId) {
  return encolar('conversaciones', async () => {
    const conversaciones = await almacen.leer('conversaciones');
    const existente = conversaciones.find((item) =>
      item.participantes?.length === 2 && item.participantes.includes(usuarioId) && item.participantes.includes(otroId)
    );
    if (existente) return existente;
    const ahora = new Date().toISOString();
    return almacen.agregar('conversaciones', {
      participantes: [usuarioId, otroId],
      ultimo: null,
      leidoHasta: { [usuarioId]: ahora, [otroId]: ahora }
    });
  });
}

function validarTexto(valor) {
  const texto = String(valor || '').trim();
  if (!texto) rechazar('El mensaje no puede estar vacío', 400);
  if (texto.length > 2000) rechazar('El mensaje no puede superar 2.000 caracteres', 400);
  return texto;
}

function registrarLimite(usuarioId) {
  const ahora = Date.now();
  const desde = ahora - 60 * 1000;
  const recientes = (enviosPorUsuario.get(usuarioId) || []).filter((momento) => momento >= desde);
  if (recientes.length >= 30) rechazar('Superaste el límite de 30 mensajes por minuto', 429);
  recientes.push(ahora);
  enviosPorUsuario.set(usuarioId, recientes);
}

async function enviarMensaje(conversacion, autorId, texto, limitar = true) {
  return encolar(`mensajes/${conversacion.id}`, async () => {
    const actual = await conversacionPorId(conversacion.id, autorId);
    const otroId = actual.participantes.find((id) => id !== autorId);
    const bloqueos = await almacen.leer('bloqueos');
    if (hayBloqueo(autorId, otroId, bloqueos)) rechazar('No puedes enviar mensajes a este usuario', 403);
    if (limitar) registrarLimite(autorId);
    const mensaje = await almacen.agregar(`mensajes/${actual.id}`, { autorId, texto, oculto: false });
    await encolar('conversaciones', () => almacen.actualizar('conversaciones', actual.id, {
      ultimo: { texto, fecha: mensaje.fecha, autorId }
    }));
    return mensaje;
  });
}

async function conversacionesDelUsuario(usuario) {
  const [todas, usuarios, bloqueos] = await Promise.all([
    almacen.leer('conversaciones'), almacen.leer('usuarios'), almacen.leer('bloqueos')
  ]);
  const mapaUsuarios = new Map(usuarios.map((item) => [item.id, item]));
  const propias = todas.filter((item) => item.participantes?.includes(usuario.id));
  const salida = [];

  for (const conversacion of propias) {
    const mensajes = await almacen.leer(`mensajes/${conversacion.id}`);
    const visibles = mensajes
      .filter((item) => !item.oculto)
      .sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
    const ultimoVisible = visibles.at(-1);
    const leidoHasta = new Date(conversacion.leidoHasta?.[usuario.id] || 0).getTime();
    const noLeidos = visibles.filter((item) =>
      item.autorId !== usuario.id && new Date(item.fecha).getTime() > leidoHasta
    ).length;
    const otroId = conversacion.participantes.find((id) => id !== usuario.id);
    salida.push({
      ...conversacion,
      ultimo: ultimoVisible ? {
        texto: ultimoVisible.texto,
        fecha: ultimoVisible.fecha,
        autorId: ultimoVisible.autorId
      } : null,
      contacto: usuarioPublico(mapaUsuarios.get(otroId) || { id: otroId, nombre: 'Usuario', activo: false }),
      bloqueadoPorMi: bloqueos.some((item) => item.usuarioId === usuario.id && item.bloqueadoId === otroId),
      bloqueadoPorOtro: bloqueos.some((item) => item.usuarioId === otroId && item.bloqueadoId === usuario.id),
      noLeidos
    });
  }

  return salida.sort((a, b) => new Date(b.ultimo?.fecha || b.fecha) - new Date(a.ultimo?.fecha || a.fecha));
}

// Las rutas fijas deben declararse antes de /mensajes/:convId.
router.get('/mensajes/contactos', exigirRol('sesion'), async (req, res, next) => {
  try { res.json(await contactosPermitidos(req.usuario)); } catch (error) { next(error); }
});

router.get('/mensajes/conversaciones', exigirRol('sesion'), async (req, res, next) => {
  try { res.json(await conversacionesDelUsuario(req.usuario)); } catch (error) { next(error); }
});

router.post('/mensajes/conversaciones', exigirRol('sesion'), async (req, res, next) => {
  try {
    const otroId = String(req.body?.con || '').trim();
    const contactos = await contactosPermitidos(req.usuario);
    if (!contactos.some((item) => item.id === otroId)) rechazar('Contacto no permitido', 403);
    res.status(201).json(await buscarOCrearConversacion(req.usuario.id, otroId));
  } catch (error) { next(error); }
});

router.get('/mensajes/no-leidos', exigirRol('sesion'), async (req, res, next) => {
  try {
    const conversaciones = await conversacionesDelUsuario(req.usuario);
    res.json({ total: conversaciones.reduce((suma, item) => suma + item.noLeidos, 0) });
  } catch (error) { next(error); }
});

router.post('/mensajes/difusion', exigirRol('docente'), async (req, res, next) => {
  try {
    const grupoId = String(req.body?.grupoId || '').trim();
    const texto = validarTexto(req.body?.texto);
    const grupos = await acceso.gruposDe(req.usuario);
    const grupo = grupos.find((item) => item.id === grupoId && item.docenteId === req.usuario.id);
    if (!grupo) rechazar('No eres docente de este grupo', 403);
    const [bloqueos, usuarios] = await Promise.all([almacen.leer('bloqueos'), almacen.leer('usuarios')]);
    const estudiantesActivos = new Set(usuarios
      .filter((item) => item.activo && item.rol === 'estudiante')
      .map((item) => item.id));
    let enviados = 0;
    let omitidos = 0;
    for (const estudianteId of grupo.estudiantes || []) {
      if (!estudiantesActivos.has(estudianteId)) { omitidos++; continue; }
      if (hayBloqueo(req.usuario.id, estudianteId, bloqueos)) { omitidos++; continue; }
      const conversacion = await buscarOCrearConversacion(req.usuario.id, estudianteId);
      await enviarMensaje(conversacion, req.usuario.id, texto, false);
      enviados++;
    }
    res.status(201).json({ enviados, omitidos });
  } catch (error) { next(error); }
});

router.post('/mensajes/bloquear', exigirRol('sesion'), async (req, res, next) => {
  try {
    const bloqueadoId = String(req.body?.usuarioId || '').trim();
    if (!bloqueadoId || bloqueadoId === req.usuario.id) rechazar('Usuario para bloqueo inválido', 400);
    const usuarios = await almacen.leer('usuarios');
    if (!usuarios.some((item) => item.id === bloqueadoId && item.activo)) rechazar('Usuario no encontrado', 404);
    const resultado = await encolar('bloqueos', async () => {
      const bloqueos = await almacen.leer('bloqueos');
      const existente = bloqueos.find((item) => item.usuarioId === req.usuario.id && item.bloqueadoId === bloqueadoId);
      return { existente: Boolean(existente), registro: existente || await almacen.agregar('bloqueos', {
        usuarioId: req.usuario.id,
        bloqueadoId
      }) };
    });
    res.status(resultado.existente ? 200 : 201).json(resultado.registro);
  } catch (error) { next(error); }
});

router.delete('/mensajes/bloquear/:usuarioId', exigirRol('sesion'), async (req, res, next) => {
  try {
    const eliminado = await encolar('bloqueos', async () => {
      const bloqueos = await almacen.leer('bloqueos');
      const existente = bloqueos.find((item) => item.usuarioId === req.usuario.id && item.bloqueadoId === req.params.usuarioId);
      if (!existente) rechazar('Bloqueo no encontrado', 404);
      return almacen.eliminar('bloqueos', existente.id);
    });
    res.json(eliminado);
  } catch (error) { next(error); }
});

router.get('/mensajes/reporte/:reporteId', exigirRol('admin'), async (req, res, next) => {
  try {
    const reportes = await almacen.leer('reportes');
    const reporte = reportes.find((item) => item.id === req.params.reporteId && item.tipo === 'mensaje');
    if (!reporte) rechazar('Reporte de mensaje no encontrado', 404);
    const [convId, mensajeId] = String(reporte.referenciaId).split('/');
    await conversacionPorId(convId);
    const mensajes = await almacen.leer(`mensajes/${convId}`);
    const indice = mensajes.findIndex((item) => item.id === mensajeId);
    if (indice < 0) rechazar('Mensaje reportado no encontrado', 404);
    res.json({ reporte, convId, mensaje: mensajes[indice], anteriores: mensajes.slice(Math.max(0, indice - 5), indice) });
  } catch (error) { next(error); }
});

router.post('/mensajes/ocultar', exigirRol('admin'), async (req, res, next) => {
  try {
    const [convId, mensajeId, extra] = String(req.body?.referenciaId || '').split('/');
    if (!convId || !mensajeId || extra) rechazar('Referencia de mensaje inválida', 400);
    await conversacionPorId(convId);
    res.json(await encolar(`mensajes/${convId}`, async () => {
      const mensaje = await almacen.actualizar(`mensajes/${convId}`, mensajeId, { oculto: true });
      const visibles = (await almacen.leer(`mensajes/${convId}`))
        .filter((item) => !item.oculto)
        .sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
      const ultimo = visibles.at(-1);
      await encolar('conversaciones', () => almacen.actualizar('conversaciones', convId, {
        ultimo: ultimo ? { texto: ultimo.texto, fecha: ultimo.fecha, autorId: ultimo.autorId } : null
      }));
      return mensaje;
    }));
  } catch (error) { next(error); }
});

router.get('/mensajes/:convId', exigirRol('sesion'), async (req, res, next) => {
  try {
    const conversacion = await conversacionPorId(req.params.convId, req.usuario.id);
    const todos = (await almacen.leer(`mensajes/${conversacion.id}`))
      .filter((item) => !item.oculto)
      .sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
    let filtrados = todos;
    if (req.query.desde) {
      const desde = new Date(req.query.desde).getTime();
      if (!Number.isFinite(desde)) rechazar('Fecha desde inválida', 400);
      filtrados = todos.filter((item) => new Date(item.fecha).getTime() > desde).slice(0, 50);
    } else if (req.query.antes) {
      const antes = new Date(req.query.antes).getTime();
      if (!Number.isFinite(antes)) rechazar('Fecha antes inválida', 400);
      filtrados = todos.filter((item) => new Date(item.fecha).getTime() < antes).slice(-50);
    } else {
      filtrados = todos.slice(-50);
    }
    const hayMas = filtrados.length > 0 && todos.some((item) => new Date(item.fecha) < new Date(filtrados[0].fecha));
    res.json({ mensajes: filtrados, hayMas });
  } catch (error) { next(error); }
});

router.post('/mensajes/:convId/leido', exigirRol('sesion'), async (req, res, next) => {
  try {
    const conversacion = await conversacionPorId(req.params.convId, req.usuario.id);
    res.json(await encolar('conversaciones', async () => {
      const lista = await almacen.leer('conversaciones');
      const actual = lista.find((item) => item.id === conversacion.id);
      const leidoHasta = { ...(actual?.leidoHasta || {}), [req.usuario.id]: new Date().toISOString() };
      return almacen.actualizar('conversaciones', conversacion.id, { leidoHasta });
    }));
  } catch (error) { next(error); }
});

router.post('/mensajes/:convId', exigirRol('sesion'), async (req, res, next) => {
  try {
    const conversacion = await conversacionPorId(req.params.convId, req.usuario.id);
    const texto = validarTexto(req.body?.texto);
    res.status(201).json(await enviarMensaje(conversacion, req.usuario.id, texto));
  } catch (error) { next(error); }
});

export default router;
