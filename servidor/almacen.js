import fs from 'fs/promises';
import path from 'path';

const DIR_DATOS = path.resolve('datos');
const DIR_RESPALDOS = path.join(DIR_DATOS, 'respaldos');

// Expresión regular para nombres válidos: solo minúsculas, números y guiones, con subcarpeta opcional
const REGEX_COL = /^[a-z0-9-]+(?:\/[a-z0-9_-]+)?$/;

// Colas de escritura en memoria por ruta de archivo
const colasEscritura = new Map();
let ultimoRespaldoDia = null;

function validarColeccion(col) {
  if (typeof col !== 'string' || !REGEX_COL.test(col)) {
    const error = new Error(`Nombre de colección inválido: ${col}`);
    error.estado = 400;
    throw error;
  }
}

function resolverRuta(col) {
  validarColeccion(col);
  return path.join(DIR_DATOS, `${col}.json`);
}

function encolarEscritura(ruta, operacion) {
  const colaActual = colasEscritura.get(ruta) || Promise.resolve();
  const siguiente = colaActual
    .catch(() => {})
    .then(() => operacion());
  colasEscritura.set(ruta, siguiente);
  return siguiente;
}

async function asegurarRespaldoDiario() {
  const hoy = new Date().toISOString().slice(0, 10);
  if (ultimoRespaldoDia === hoy) return;

  const destinoHoy = path.join(DIR_RESPALDOS, hoy);
  try {
    await fs.access(destinoHoy);
    ultimoRespaldoDia = hoy;
    return;
  } catch {
    // Continúa con la creación del respaldo
  }

  await fs.mkdir(destinoHoy, { recursive: true });

  try {
    await fs.cp(DIR_DATOS, destinoHoy, {
      recursive: true,
      filter: (origen) => {
        const relativo = path.relative(DIR_DATOS, origen);
        if (!relativo) return true;
        const primeraCarpeta = relativo.split(path.sep)[0];
        return primeraCarpeta !== 'respaldos';
      }
    });
  } catch {
    // Si no hay datos aún, no se interrumpe
  }

  try {
    const entradas = await fs.readdir(DIR_RESPALDOS, { withFileTypes: true });
    const respaldos = entradas
      .filter(e => e.isDirectory() && /^\d{4}-\d{2}-\d{2}$/.test(e.name))
      .map(e => e.name)
      .sort();

    if (respaldos.length > 14) {
      const aEliminar = respaldos.slice(0, respaldos.length - 14);
      for (const dir of aEliminar) {
        await fs.rm(path.join(DIR_RESPALDOS, dir), { recursive: true, force: true });
      }
    }
  } catch {
    // Ignorar errores al podar respaldos
  }

  ultimoRespaldoDia = hoy;
}

function generarId(col, lista) {
  const parteColeccion = col.split('/')[0];
  const prefijo = parteColeccion.replace(/[^a-z]/g, '').slice(0, 3).padEnd(3, 'x');

  let maxNum = 0;
  for (const item of lista) {
    if (item && typeof item.id === 'string') {
      const match = item.id.match(/_(\d+)$/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxNum) maxNum = num;
      }
    }
  }

  const siguiente = String(maxNum + 1).padStart(6, '0');
  return `${prefijo}_${siguiente}`;
}

export async function leer(col) {
  const ruta = resolverRuta(col);
  try {
    const contenido = await fs.readFile(ruta, 'utf-8');
    return JSON.parse(contenido);
  } catch (err) {
    if (err.code === 'ENOENT') {
      return [];
    }
    throw err;
  }
}

export async function escribir(col, lista) {
  const ruta = resolverRuta(col);
  await asegurarRespaldoDiario();

  return encolarEscritura(ruta, async () => {
    await fs.mkdir(path.dirname(ruta), { recursive: true });
    const tmp = `${ruta}.${Date.now()}_${Math.random().toString(36).slice(2)}.tmp`;
    const contenido = JSON.stringify(lista, null, 2);
    await fs.writeFile(tmp, contenido, 'utf-8');
    await fs.rename(tmp, ruta);
    return lista;
  });
}

export async function agregar(col, reg) {
  const lista = await leer(col);
  const nuevoReg = {
    ...reg,
    id: reg.id || generarId(col, lista),
    fecha: reg.fecha || new Date().toISOString()
  };
  lista.push(nuevoReg);
  await escribir(col, lista);
  return nuevoReg;
}

export async function actualizar(col, id, cambios) {
  const lista = await leer(col);
  const indice = lista.findIndex(item => item.id === id);
  if (indice === -1) {
    const error = new Error('Registro no encontrado');
    error.estado = 404;
    throw error;
  }

  const actualizado = {
    ...lista[indice],
    ...cambios,
    id // El id permanece inmutable
  };

  lista[indice] = actualizado;
  await escribir(col, lista);
  return actualizado;
}

export async function eliminar(col, id) {
  const lista = await leer(col);
  const indice = lista.findIndex(item => item.id === id);
  if (indice === -1) {
    const error = new Error('Registro no encontrado');
    error.estado = 404;
    throw error;
  }

  const [eliminado] = lista.splice(indice, 1);
  await escribir(col, lista);
  return eliminado;
}

export async function buscar(col, filtro = {}) {
  const lista = await leer(col);
  const claves = Object.keys(filtro);
  if (claves.length === 0) return lista;

  return lista.filter(item => {
    return claves.every(clave => {
      const valorItem = item[clave];
      const valorFiltro = filtro[clave];
      return valorItem === valorFiltro || String(valorItem) === String(valorFiltro);
    });
  });
}

export async function anexarLinea(archivo, obj) {
  await asegurarRespaldoDiario();
  const nombreLimpio = archivo.endsWith('.jsonl') ? archivo : `${archivo}.jsonl`;
  if (!/^[a-z0-9_-]+(?:\/[a-z0-9_-]+)?\.jsonl$/.test(nombreLimpio)) {
    const error = new Error(`Nombre de archivo inválido: ${archivo}`);
    error.estado = 400;
    throw error;
  }

  const ruta = path.join(DIR_DATOS, nombreLimpio);
  const linea = JSON.stringify(obj) + '\n';

  return encolarEscritura(ruta, async () => {
    await fs.mkdir(path.dirname(ruta), { recursive: true });
    await fs.appendFile(ruta, linea, 'utf-8');
    return obj;
  });
}

export async function leerLineas(archivo) {
  const nombreLimpio = archivo.endsWith('.jsonl') ? archivo : `${archivo}.jsonl`;
  const ruta = path.join(DIR_DATOS, nombreLimpio);
  try {
    const contenido = await fs.readFile(ruta, 'utf-8');
    return contenido
      .split('\n')
      .map(linea => linea.trim())
      .filter(Boolean)
      .map(linea => JSON.parse(linea));
  } catch (err) {
    if (err.code === 'ENOENT') {
      return [];
    }
    throw err;
  }
}

export async function leerConfig(nombre) {
  const ruta = path.join(DIR_DATOS, 'config', `${nombre}.json`);
  try {
    const contenido = await fs.readFile(ruta, 'utf-8');
    return JSON.parse(contenido);
  } catch (err) {
    if (err.code === 'ENOENT') {
      return {};
    }
    throw err;
  }
}
