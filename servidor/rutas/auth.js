// servidor/rutas/auth.js
// Rutas de autenticación, perfil, administración de credenciales y bitácora

import { Router } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import * as almacen from '../almacen.js';
import { exigirRol } from '../auth.js';

const router = Router();

// Registro de intentos fallidos de login en memoria: email -> array de timestamps
const intentosFallidos = new Map();
const LIMITE_INTENTOS = 5;
const VENTANA_INTENTOS_MS = 15 * 60 * 1000; // 15 minutos

// POST /api/auth/registro
router.post('/auth/registro', async (req, res, next) => {
  try {
    const { nombre, apellido, correo, clave, consentimiento } = req.body;

    if (!nombre || typeof nombre !== 'string' || !nombre.trim()) {
      return res.status(400).json({ error: 'El nombre es obligatorio' });
    }
    if (!apellido || typeof apellido !== 'string' || !apellido.trim()) {
      return res.status(400).json({ error: 'El apellido es obligatorio' });
    }
    if (!correo || typeof correo !== 'string') {
      return res.status(400).json({ error: 'El correo es obligatorio' });
    }

    const correoNorm = correo.trim().toLowerCase();
    const regexCorreo = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!regexCorreo.test(correoNorm)) {
      return res.status(400).json({ error: 'El formato de correo no es válido' });
    }

    if (
      !clave ||
      typeof clave !== 'string' ||
      clave.length < 8 ||
      !/[a-zA-Z]/.test(clave) ||
      !/\d/.test(clave)
    ) {
      return res.status(400).json({
        error: 'La contraseña debe tener al menos 8 caracteres e incluir letras y números'
      });
    }

    if (consentimiento !== true) {
      return res.status(400).json({ error: 'Debe aceptar los términos de consentimiento' });
    }

    const usuarios = await almacen.leer('usuarios');
    const existe = usuarios.some(u => u.correo && u.correo.toLowerCase() === correoNorm);
    if (existe) {
      return res.status(400).json({ error: 'El correo ya está registrado' });
    }

    const claveHash = await bcrypt.hash(clave, 10);
    const fecha = new Date().toISOString();

    const nuevoUsuario = await almacen.agregar('usuarios', {
      nombre: nombre.trim(),
      apellido: apellido.trim(),
      correo: correoNorm,
      claveHash,
      rol: 'estudiante',
      activo: true,
      foto: '',
      consentimiento: {
        aceptado: true,
        fecha
      }
    });

    res.status(201).json({
      id: nuevoUsuario.id,
      nombre: nuevoUsuario.nombre,
      apellido: nuevoUsuario.apellido,
      correo: nuevoUsuario.correo,
      rol: nuevoUsuario.rol
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/login
router.post('/auth/login', async (req, res, next) => {
  try {
    const { correo, clave } = req.body;
    const correoNorm = (typeof correo === 'string' ? correo : '').trim().toLowerCase();
    const ahora = Date.now();

    // Verificación de tasa de fallos en memoria (máximo 5 en 15 min por correo)
    const timestamps = (intentosFallidos.get(correoNorm) || []).filter(
      t => ahora - t < VENTANA_INTENTOS_MS
    );
    intentosFallidos.set(correoNorm, timestamps);

    if (timestamps.length >= LIMITE_INTENTOS) {
      return res.status(429).json({
        error: 'Demasiados intentos fallidos. Intente nuevamente en 15 minutos.'
      });
    }

    const usuarios = await almacen.leer('usuarios');
    const usuario = usuarios.find(u => u.correo && u.correo.toLowerCase() === correoNorm);

    let credencialesValidas = false;
    if (usuario && usuario.activo && usuario.claveHash) {
      credencialesValidas = await bcrypt.compare(clave || '', usuario.claveHash);
    }

    if (!credencialesValidas) {
      timestamps.push(ahora);
      intentosFallidos.set(correoNorm, timestamps);
      return res.status(401).json({ error: 'Correo o contraseña incorrectos' });
    }

    // Limpia intentos fallidos tras login exitoso
    intentosFallidos.delete(correoNorm);

    // Creación de token (32 bytes aleatorios en hex) y sesión (8 horas de validez)
    const token = crypto.randomBytes(32).toString('hex');
    const expira = new Date(ahora + 8 * 60 * 60 * 1000).toISOString();

    await almacen.agregar('sesiones', {
      token,
      usuarioId: usuario.id,
      expira
    });

    // Registro automático en bitácora
    await almacen.anexarLinea('bitacora.jsonl', {
      usuarioId: usuario.id,
      tipo: 'login',
      recurso: 'auth',
      fecha: new Date().toISOString()
    });

    res.json({
      token,
      usuario: {
        id: usuario.id,
        nombre: usuario.nombre,
        apellido: usuario.apellido,
        rol: usuario.rol
      }
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/logout
router.post('/auth/logout', async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization || req.headers.Authorization;
    const token =
      authHeader && typeof authHeader === 'string' && authHeader.startsWith('Bearer ')
        ? authHeader.slice(7).trim()
        : null;

    let usuarioId = req.usuario?.id || null;

    if (token) {
      const sesiones = await almacen.leer('sesiones');
      const sesion = sesiones.find(s => s.token === token);
      if (sesion) {
        usuarioId = usuarioId || sesion.usuarioId;
        await almacen.eliminar('sesiones', sesion.id);
      }
    }

    if (usuarioId) {
      await almacen.anexarLinea('bitacora.jsonl', {
        usuarioId,
        tipo: 'logout',
        recurso: 'auth',
        fecha: new Date().toISOString()
      });
    }

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// GET /api/auth/yo
router.get('/auth/yo', exigirRol('sesion'), async (req, res, next) => {
  try {
    const usuarios = await almacen.leer('usuarios');
    const u = usuarios.find(user => user.id === req.usuario.id);

    if (!u || !u.activo) {
      return res.status(401).json({ error: 'Usuario inactivo o no encontrado' });
    }

    res.json({
      id: u.id,
      nombre: u.nombre,
      apellido: u.apellido,
      correo: u.correo,
      rol: u.rol,
      foto: u.foto || '',
      activo: u.activo
    });
  } catch (err) {
    next(err);
  }
});

// PUT /api/auth/perfil
router.put('/auth/perfil', exigirRol('sesion'), async (req, res, next) => {
  try {
    const { nombre, apellido, foto } = req.body;
    const cambios = {};

    if (nombre !== undefined) {
      if (typeof nombre !== 'string' || !nombre.trim()) {
        return res.status(400).json({ error: 'El nombre no puede estar vacío' });
      }
      cambios.nombre = nombre.trim();
    }

    if (apellido !== undefined) {
      if (typeof apellido !== 'string' || !apellido.trim()) {
        return res.status(400).json({ error: 'El apellido no puede estar vacío' });
      }
      cambios.apellido = apellido.trim();
    }

    if (foto !== undefined) {
      cambios.foto = typeof foto === 'string' ? foto : '';
    }

    const actualizado = await almacen.actualizar('usuarios', req.usuario.id, cambios);
    const { claveHash, ...resto } = actualizado;

    res.json(resto);
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/clave
router.post('/auth/clave', exigirRol('sesion'), async (req, res, next) => {
  try {
    const { actual, nueva } = req.body;

    if (
      !nueva ||
      typeof nueva !== 'string' ||
      nueva.length < 8 ||
      !/[a-zA-Z]/.test(nueva) ||
      !/\d/.test(nueva)
    ) {
      return res.status(400).json({
        error: 'La nueva contraseña debe tener al menos 8 caracteres e incluir letras y números'
      });
    }

    const usuarios = await almacen.leer('usuarios');
    const u = usuarios.find(user => user.id === req.usuario.id);

    if (!u || !u.claveHash) {
      return res.status(400).json({ error: 'Usuario sin credenciales' });
    }

    const coincide = await bcrypt.compare(actual || '', u.claveHash);
    if (!coincide) {
      return res.status(400).json({ error: 'La contraseña actual es incorrecta' });
    }

    const nuevoHash = await bcrypt.hash(nueva, 10);
    await almacen.actualizar('usuarios', u.id, { claveHash: nuevoHash });

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// POST /api/admin/usuarios/:id/restablecer (admin)
router.post(
  '/admin/usuarios/:id/restablecer',
  exigirRol('admin'),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const usuarios = await almacen.leer('usuarios');
      const u = usuarios.find(user => user.id === id);

      if (!u) {
        return res.status(404).json({ error: 'Usuario no encontrado' });
      }

      // Generación de clave temporal de 10 caracteres con letras y números
      const caracteres = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
      const bytes = crypto.randomBytes(10);
      let claveTemporal = '';
      for (let i = 0; i < 10; i++) {
        claveTemporal += caracteres[bytes[i] % caracteres.length];
      }
      if (!/[a-zA-Z]/.test(claveTemporal)) claveTemporal = 'A' + claveTemporal.slice(1);
      if (!/\d/.test(claveTemporal)) claveTemporal = claveTemporal.slice(0, 9) + '7';

      const claveHash = await bcrypt.hash(claveTemporal, 10);
      await almacen.actualizar('usuarios', id, { claveHash });

      res.json({ claveTemporal });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/eventos
router.post('/eventos', exigirRol('sesion'), async (req, res, next) => {
  try {
    const { tipo, recurso } = req.body;

    if (!tipo || !recurso) {
      return res.status(400).json({ error: 'tipo y recurso son requeridos' });
    }

    const fecha = new Date().toISOString();
    await almacen.anexarLinea('bitacora.jsonl', {
      usuarioId: req.usuario.id,
      tipo,
      recurso,
      fecha
    });

    res.status(201).json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
