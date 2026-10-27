// servidor/semilla.js
// Carga de datos de prueba (semilla) en el ecosistema educativo

import fs from 'fs/promises';
import path from 'path';
import readline from 'readline';
import bcrypt from 'bcryptjs';

const DIR_SEMILLA = path.resolve('datos', 'semilla');
const DIR_DATOS = path.resolve('datos');
const CLAVE_POR_DEFECTO = 'Demo12345';

function pedirConfirmacion(pregunta) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    rl.question(pregunta, (respuesta) => {
      rl.close();
      const limpia = (respuesta || '').trim().toLowerCase();
      resolve(limpia === 's' || limpia === 'si' || limpia === 'y' || limpia === 'yes');
    });
  });
}

async function existeArchivo(ruta) {
  try {
    await fs.access(ruta);
    return true;
  } catch {
    return false;
  }
}

async function sembrar() {
  const esForzado = process.argv.includes('--forzar') || process.argv.includes('-f');

  if (esForzado) {
    const confirmado = await pedirConfirmacion(
      'ADVERTENCIA: --forzar sobrescribirá las colecciones de datos con la semilla. ¿Deseas continuar? (s/N): '
    );
    if (!confirmado) {
      console.log('Operación cancelada. No se modificaron los datos.');
      process.exit(0);
    }
  }

  // Verificar que la carpeta semilla exista
  if (!await existeArchivo(DIR_SEMILLA)) {
    console.error(`Error: el directorio de semillas no existe en ${DIR_SEMILLA}`);
    process.exit(1);
  }

  const entradas = await fs.readdir(DIR_SEMILLA);
  const archivos = entradas.filter((f) => f.endsWith('.json')).sort();

  if (archivos.length === 0) {
    console.log('No se encontraron archivos de semilla para procesar.');
    process.exit(0);
  }

  console.log(`Iniciando proceso de semilla (Modo: ${esForzado ? 'SOBRESCRITURA FORZADA' : 'SOLO FALTANTES'})...\n`);

  let hashCompartido = null;

  for (const archivo of archivos) {
    const rutaOrigen = path.join(DIR_SEMILLA, archivo);
    const rutaDestino = path.join(DIR_DATOS, archivo);
    const yaExiste = await existeArchivo(rutaDestino);

    if (yaExiste && !esForzado) {
      console.log(`[omitido] ${archivo} ya existe en datos/`);
      continue;
    }

    const contenidoRaw = await fs.readFile(rutaOrigen, 'utf-8');
    let datos = JSON.parse(contenidoRaw);

    // Si es usuarios.json, generar claveHash con Demo12345
    if (archivo === 'usuarios.json' && Array.isArray(datos)) {
      if (!hashCompartido) {
        hashCompartido = await bcrypt.hash(CLAVE_POR_DEFECTO, 10);
      }
      datos = datos.map((u) => ({
        ...u,
        claveHash: hashCompartido
      }));
    }

    await fs.writeFile(rutaDestino, JSON.stringify(datos, null, 2), 'utf-8');
    console.log(`[${yaExiste ? 'reemplazado' : 'creado'}] ${archivo}`);
  }

  console.log('\n✅ Proceso de semilla completado con éxito.');
}

sembrar().catch((err) => {
  console.error('Error durante la ejecución de semilla:', err);
  process.exit(1);
});
