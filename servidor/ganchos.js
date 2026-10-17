import fs from 'fs/promises';
import path from 'path';
import { pathToFileURL } from 'url';

const ganchosPorColeccion = new Map();
const DIR_GANCHOS = path.resolve('servidor', 'ganchos');

export async function cargarGanchos() {
  ganchosPorColeccion.clear();
  try {
    const entradas = await fs.readdir(DIR_GANCHOS, { withFileTypes: true });
    for (const entrada of entradas) {
      if (entrada.isFile() && entrada.name.endsWith('.js')) {
        const col = entrada.name.replace(/\.js$/, '');
        const rutaCompleta = path.join(DIR_GANCHOS, entrada.name);
        const modulo = await import(pathToFileURL(rutaCompleta).href);
        ganchosPorColeccion.set(col, modulo.default || modulo);
      }
    }
  } catch (err) {
    if (err.code !== 'ENOENT') {
      console.error('Error cargando ganchos:', err);
    }
  }
}

// Carga inicial de ganchos al importar el módulo
await cargarGanchos();

export async function aplicar(col, nombre, ...args) {
  const colBase = col.includes('/') ? col.split('/')[0] : col;
  const definicion = ganchosPorColeccion.get(col) || ganchosPorColeccion.get(colBase);

  if (definicion && typeof definicion[nombre] === 'function') {
    return await definicion[nombre](...args);
  }

  return args[0];
}
