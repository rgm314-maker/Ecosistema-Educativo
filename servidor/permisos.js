import { leerConfig } from './almacen.js';

export async function puede(usuario, accion, col, registro = null) {
  const permisos = await leerConfig('permisos');
  const colBase = col.includes('/') ? col.split('/')[0] : col;
  const configCol = permisos[col] || permisos[colBase];

  if (!configCol || !Array.isArray(configCol[accion])) {
    return false;
  }

  const reglas = configCol[accion];

  for (const regla of reglas) {
    if (regla === 'servidor') {
      // 'servidor' nunca se permite desde la API
      continue;
    }

    if (regla === 'publico') {
      return true;
    }

    if (usuario && usuario.id) {
      if (regla === 'sesion') {
        return true;
      }
      if (regla === usuario.rol) {
        return true;
      }
      if (regla === 'propio') {
        if (!registro) {
          return true;
        }
        if (registro.usuarioId === usuario.id || registro.id === usuario.id) {
          return true;
        }
      }
    }
  }

  return false;
}
