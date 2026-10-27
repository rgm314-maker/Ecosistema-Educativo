// servidor/crear-estudiante.js
// Script interactivo de consola para crear un usuario estudiante

import readline from 'readline/promises';
import { stdin as input, stdout as output } from 'process';
import bcrypt from 'bcryptjs';
import * as almacen from './almacen.js';

async function main() {
  const rl = readline.createInterface({ input, output });

  try {
    console.log('=== Crear Usuario Estudiante ===\n');

    const nombre = (await rl.question('Nombre: ')).trim();
    if (!nombre) {
      console.error('Error: El nombre es obligatorio.');
      process.exit(1);
    }

    const apellido = (await rl.question('Apellido: ')).trim();
    if (!apellido) {
      console.error('Error: El apellido es obligatorio.');
      process.exit(1);
    }

    const correo = (await rl.question('Correo: ')).trim().toLowerCase();
    const regexCorreo = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!correo || !regexCorreo.test(correo)) {
      console.error('Error: Ingrese un correo electrónico válido.');
      process.exit(1);
    }

    const clave = (await rl.question('Contraseña (mínimo 8 caracteres, con letras y números): ')).trim();
    if (!clave || clave.length < 8 || !/[a-zA-Z]/.test(clave) || !/\d/.test(clave)) {
      console.error('Error: La contraseña debe tener al menos 8 caracteres e incluir letras y números.');
      process.exit(1);
    }

    const usuarios = await almacen.leer('usuarios');
    const existe = usuarios.some(u => u.correo && u.correo.toLowerCase() === correo);
    if (existe) {
      console.error('Error: Ya existe un usuario registrado con ese correo.');
      process.exit(1);
    }

    const claveHash = await bcrypt.hash(clave, 10);
    const fecha = new Date().toISOString();

    const nuevoEstudiante = await almacen.agregar('usuarios', {
      nombre,
      apellido,
      correo,
      claveHash,
      rol: 'estudiante',
      activo: true,
      foto: '',
      consentimiento: {
        aceptado: true,
        fecha
      }
    });

    console.log(`\n¡Estudiante creado con éxito!`);
    console.log(`ID: ${nuevoEstudiante.id}`);
    console.log(`Nombre: ${nuevoEstudiante.nombre} ${nuevoEstudiante.apellido}`);
    console.log(`Correo: ${nuevoEstudiante.correo}`);
    console.log(`Rol: ${nuevoEstudiante.rol}`);
  } catch (err) {
    console.error('Error al crear usuario estudiante:', err.message);
    process.exit(1);
  } finally {
    rl.close();
  }
}

main();
