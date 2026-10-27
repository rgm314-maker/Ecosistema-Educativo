import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs/promises';
import { pathToFileURL } from 'url';
import * as almacen from './almacen.js';
import { puede } from './permisos.js';
import { aplicar } from './ganchos.js';

import { cargarUsuario } from './auth.js';

dotenv.config();

const app = express();
const PUERTO = process.env.PUERTO || 3000;

// Servir archivos estáticos de publico/
app.use(express.static(path.resolve('publico')));

// Soporte CORS para clientes y peticiones API
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Límite de 1 MB para payloads JSON
app.use(express.json({ limit: '1mb' }));

// Middleware de autenticación y sesión
app.use(cargarUsuario);

// Envoltura para capturar errores asíncronos
const asyncManejar = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// Cargar y montar rutas automáticas en /api antes de la API genérica
async function montarRutas() {
  const dirRutas = path.resolve('servidor', 'rutas');
  try {
    const entradas = await fs.readdir(dirRutas, { withFileTypes: true });
    const archivos = entradas
      .filter(e => e.isFile() && e.name.endsWith('.js'))
      .map(e => e.name)
      .sort();

    for (const archivo of archivos) {
      const rutaModulo = path.join(dirRutas, archivo);
      const modulo = await import(pathToFileURL(rutaModulo).href);
      const router = modulo.default || modulo;
      app.use('/api', router);
    }
  } catch (err) {
    if (err.code !== 'ENOENT') {
      console.error('Error cargando rutas en servidor/rutas:', err);
    }
  }
}

await montarRutas();

// --- API Genérica ---

// GET /api/:col (con filtros exactos por query)
app.get('/api/:col', asyncManejar(async (req, res) => {
  const { col } = req.params;
  const permitido = await puede(req.usuario, 'leer', col);
  if (!permitido) {
    const err = new Error('Acceso no autorizado');
    err.estado = 403;
    throw err;
  }

  const tieneFiltros = Object.keys(req.query).length > 0;
  const lista = tieneFiltros
    ? await almacen.buscar(col, req.query)
    : await almacen.leer(col);

  const listaFiltrada = await aplicar(col, 'filtrarLista', lista, req.usuario);
  res.json(listaFiltrada);
}));

// GET /api/:col/:id
app.get('/api/:col/:id', asyncManejar(async (req, res) => {
  const { col, id } = req.params;
  const lista = await almacen.leer(col);
  const registro = lista.find(item => item.id === id);

  if (!registro) {
    const err = new Error('Registro no encontrado');
    err.estado = 404;
    throw err;
  }

  const permitido = await puede(req.usuario, 'leer', col, registro);
  if (!permitido) {
    const err = new Error('Acceso no autorizado');
    err.estado = 403;
    throw err;
  }

  const filtrados = await aplicar(col, 'filtrarLista', [registro], req.usuario);
  if (!filtrados || filtrados.length === 0) {
    const err = new Error('Registro no encontrado');
    err.estado = 404;
    throw err;
  }

  res.json(filtrados[0]);
}));

// POST /api/:col
app.post('/api/:col', asyncManejar(async (req, res) => {
  const { col } = req.params;
  const permitido = await puede(req.usuario, 'escribir', col, req.body);
  if (!permitido) {
    const err = new Error('Acceso no autorizado');
    err.estado = 403;
    throw err;
  }

  const datosAceptados = await aplicar(col, 'antesDeGuardar', req.body, req.usuario, null);
  const creado = await almacen.agregar(col, datosAceptados);
  await aplicar(col, 'despuesDeGuardar', creado, req.usuario, null);

  res.status(201).json(creado);
}));

// PUT /api/:col/:id (fusiona campos)
app.put('/api/:col/:id', asyncManejar(async (req, res) => {
  const { col, id } = req.params;
  const lista = await almacen.leer(col);
  const anterior = lista.find(item => item.id === id);

  if (!anterior) {
    const err = new Error('Registro no encontrado');
    err.estado = 404;
    throw err;
  }

  const permitido = await puede(req.usuario, 'escribir', col, anterior);
  if (!permitido) {
    const err = new Error('Acceso no autorizado');
    err.estado = 403;
    throw err;
  }

  const cambios = await aplicar(col, 'antesDeGuardar', req.body, req.usuario, anterior);
  const actualizado = await almacen.actualizar(col, id, cambios);
  await aplicar(col, 'despuesDeGuardar', actualizado, req.usuario, anterior);

  res.json(actualizado);
}));

// DELETE /api/:col/:id
app.delete('/api/:col/:id', asyncManejar(async (req, res) => {
  const { col, id } = req.params;
  const lista = await almacen.leer(col);
  const anterior = lista.find(item => item.id === id);

  if (!anterior) {
    const err = new Error('Registro no encontrado');
    err.estado = 404;
    throw err;
  }

  const permitido = await puede(req.usuario, 'escribir', col, anterior);
  if (!permitido) {
    const err = new Error('Acceso no autorizado');
    err.estado = 403;
    throw err;
  }

  await aplicar(col, 'antesDeEliminar', anterior, req.usuario);
  const eliminado = await almacen.eliminar(col, id);
  await aplicar(col, 'despuesDeEliminar', eliminado, req.usuario);
  res.json(eliminado);
}));

// Manejador centralizado de errores
app.use((err, req, res, next) => {
  const estado = typeof err.estado === 'number' ? err.estado : (err.statusCode || 500);
  const mensaje = err.message || 'Error interno del servidor';
  res.status(estado).json({ error: mensaje });
});

app.listen(PUERTO, () => {
  console.log(`Servidor iniciado en http://localhost:${PUERTO}`);
});

export default app;
