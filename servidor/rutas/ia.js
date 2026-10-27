// servidor/rutas/ia.js
// Rutas de asistencia con Inteligencia Artificial pedagógica y configuración de modelos

import { Router } from 'express';
import path from 'path';
import { pathToFileURL } from 'url';
import { exigirRol } from '../auth.js';
import * as almacen from '../almacen.js';
import { ejecutarTarea, obtenerConfiguracionIA, probarConexionIA, listarModelosDisponibles } from '../ia.js';

const router = Router();
let colaTutor = Promise.resolve();

function rechazar(mensaje, estado) {
  const error = new Error(mensaje);
  error.estado = estado;
  throw error;
}

function diaEcuador() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Guayaquil' }).format(new Date());
}

function encolarTutor(tarea) {
  const siguiente = colaTutor.catch(() => {}).then(tarea);
  colaTutor = siguiente;
  return siguiente;
}

async function registrarConsultaTutor(usuarioId, temaId) {
  return encolarTutor(async () => {
    const ajustes = await almacen.leerConfig('ajustes');
    const configurado = Number(ajustes.limiteTutorDiario);
    const limite = Number.isFinite(configurado) ? Math.max(0, Math.trunc(configurado)) : 40;
    const dia = diaEcuador();
    const consultas = await almacen.leer('consultas-tutor');
    const usados = consultas
      .filter((item) => item.usuarioId === usuarioId && item.dia === dia)
      .reduce((total, item) => total + Number(item.mensajes || 0), 0);
    if (usados >= limite) rechazar('Alcanzaste el límite diario de consultas al tutor', 429);

    const existente = consultas.find((item) =>
      item.usuarioId === usuarioId && item.temaId === temaId && item.dia === dia
    );
    if (existente) {
      return almacen.actualizar('consultas-tutor', existente.id, { mensajes: Number(existente.mensajes || 0) + 1 });
    }
    return almacen.agregar('consultas-tutor', { usuarioId, temaId, dia, mensajes: 1 });
  });
}

// GET /api/ia/modelos (docente y admin) - Lista modelos disponibles en Google Gemini
router.get('/ia/modelos', exigirRol('docente', 'admin'), async (req, res, next) => {
  try {
    const claveQuery = req.query?.clave ? String(req.query.clave).trim() : null;
    const modelos = await listarModelosDisponibles(claveQuery);
    res.json(modelos);
  } catch (err) {
    next(err);
  }
});

// GET /api/ia/config (solo admin) - Consulta configuración de IA activa
router.get('/ia/config', exigirRol('admin'), async (req, res, next) => {
  try {
    const config = await obtenerConfiguracionIA();
    // Enmascarar la clave para seguridad
    let claveEnmascarada = '';
    if (config.clave) {
      claveEnmascarada = config.clave.length > 8
        ? `${config.clave.slice(0, 4)}...${config.clave.slice(-4)}`
        : '********';
    }

    res.json({
      proveedor: config.proveedor,
      modelo: config.modelo,
      claveConfigurada: Boolean(config.clave),
      claveEnmascarada
    });
  } catch (err) {
    next(err);
  }
});

// PUT /api/ia/config (solo admin) - Guarda configuración de IA en datos/config/ajustes.json
router.put('/ia/config', exigirRol('admin'), async (req, res, next) => {
  try {
    const { proveedor, clave, modelo } = req.body || {};

    const ajustesActuales = await almacen.leerConfig('ajustes');

    const nuevosAjustes = {
      ...ajustesActuales,
      iaProveedor: proveedor ? String(proveedor).trim().toLowerCase() : (ajustesActuales.iaProveedor || 'gemini'),
      iaModelo: modelo ? String(modelo).trim() : (ajustesActuales.iaModelo || 'gemini-1.5-flash')
    };

    if (clave && String(clave).trim()) {
      nuevosAjustes.iaClave = String(clave).trim();
    }

    await almacen.escribirConfig('ajustes', nuevosAjustes);

    res.json({
      ok: true,
      mensaje: 'Configuración de IA guardada exitosamente',
      proveedor: nuevosAjustes.iaProveedor,
      modelo: nuevosAjustes.iaModelo
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/ia/prueba (solo admin) - Prueba de conexión con la IA
router.get('/ia/prueba', exigirRol('admin'), async (req, res, next) => {
  try {
    const resultado = await probarConexionIA();
    res.json(resultado);
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

// POST /api/ia/prueba (solo admin) - Prueba de conexión con credenciales enviadas
router.post('/ia/prueba', exigirRol('admin'), async (req, res, next) => {
  try {
    const { clave, modelo } = req.body || {};
    const config = await obtenerConfiguracionIA();
    const resultado = await probarConexionIA({
      proveedor: 'gemini',
      clave: clave ? String(clave).trim() : config.clave,
      modelo: modelo ? String(modelo).trim() : config.modelo
    });
    res.json(resultado);
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

// POST /api/ia/:tarea (con sesión docente/admin)
router.post('/ia/:tarea', exigirRol('sesion'), async (req, res, next) => {
  const { tarea } = req.params;
  const usuario = req.usuario;

  try {
    let datos = req.body || {};

    // Si existe preparador específico para la tarea, ejecutarlo
    const rutaPreparador = path.resolve('servidor', 'preparadores', `${tarea}.js`);
    try {
      const modulo = await import(pathToFileURL(rutaPreparador).href);
      const preparador = modulo.default || modulo;
      if (typeof preparador === 'function') {
        datos = await preparador(datos, usuario);
      }
    } catch (err) {
      if (err.code !== 'ENOENT' && !err.message?.includes('Cannot find module')) {
        throw err;
      }
    }

    if (tarea === 'tutor') await registrarConsultaTutor(usuario.id, String(req.body?.temaId || '').trim());
    const resultado = await ejecutarTarea(tarea, datos, usuario, { formato: tarea === 'tutor' ? 'texto' : 'json' });
    const respuesta = tarea === 'tutor'
      ? String(typeof resultado === 'string' ? resultado : (resultado?.respuesta || resultado?.mensaje || '')).trim().slice(0, 700)
      : resultado;
    if (tarea === 'tutor' && !respuesta) rechazar('El tutor no devolvió una respuesta', 502);

    // Registro en consumo-ia.jsonl
    await almacen.anexarLinea('consumo-ia.jsonl', {
      usuarioId: usuario.id,
      tarea,
      entrada: tarea === 'tutor' ? { temaId: req.body?.temaId } : req.body,
      ok: true,
      fecha: new Date().toISOString()
    }).catch(() => {});

    res.json(tarea === 'tutor' ? { respuesta } : resultado);
  } catch (err) {
    await almacen.anexarLinea('consumo-ia.jsonl', {
      usuarioId: usuario?.id || null,
      tarea,
      entrada: tarea === 'tutor' ? { temaId: req.body?.temaId } : req.body,
      ok: false,
      error: err.message,
      fecha: new Date().toISOString()
    }).catch(() => {});

    next(err);
  }
});

export default router;
