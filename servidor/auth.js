// servidor/auth.js
// Middleware de autenticación, control de roles y limpieza de sesiones

import * as almacen from './almacen.js';

// Limpieza de sesiones vencidas al iniciar o cargar el módulo
export async function limpiarSesionesVencidas() {
  try {
    const sesiones = await almacen.leer('sesiones');
    const ahora = new Date();
    const activas = sesiones.filter(s => s && s.expira && new Date(s.expira) > ahora);
    if (activas.length !== sesiones.length) {
      await almacen.escribir('sesiones', activas);
    }
  } catch {
    // Si no existe aún datos/sesiones.json, se ignora
  }
}

// Carga inicial: limpia sesiones expiradas
await limpiarSesionesVencidas();

// Middleware: Carga los datos del usuario autenticado si el token es válido
export async function cargarUsuario(req, res, next) {
  req.usuario = null;
  const authHeader = req.headers.authorization || req.headers.Authorization;

  if (authHeader && typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    if (token) {
      try {
        const sesiones = await almacen.leer('sesiones');
        const ahora = new Date();
        const sesion = sesiones.find(s => s.token === token);

        if (sesion && new Date(sesion.expira) > ahora) {
          const usuarios = await almacen.leer('usuarios');
          const u = usuarios.find(user => user.id === sesion.usuarioId && user.activo);
          if (u) {
            req.usuario = {
              id: u.id,
              nombre: u.nombre,
              apellido: u.apellido,
              rol: u.rol
            };
          }
        }
      } catch (err) {
        console.error('Error cargando usuario desde sesión:', err);
      }
    }
  }

  next();
}

// Middleware: Exige que el usuario tenga sesión y pertenezca a los roles permitidos
export function exigirRol(...roles) {
  return (req, res, next) => {
    if (!req.usuario) {
      return res.status(401).json({ error: 'No autenticado' });
    }

    if (
      roles.length === 0 ||
      roles.includes('sesion') ||
      roles.includes(req.usuario.rol)
    ) {
      return next();
    }

    return res.status(403).json({ error: 'Acceso no autorizado' });
  };
}
