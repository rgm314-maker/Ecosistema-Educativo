// servidor/ia.js
// Integración con modelos de lenguaje y ejecución de tareas de IA pedagógica

import fs from 'fs/promises';
import path from 'path';
import * as almacen from './almacen.js';

export const MODELOS_RECOMENDADOS = [
  { id: 'gemini-3.5-flash', nombre: 'Gemini 3.5 Flash (Recomendado · Rápido y alta disponibilidad)' },
  { id: 'gemini-3.5-flash-lite', nombre: 'Gemini 3.5 Flash-Lite (Ultrarrápido y ligero)' },
  { id: 'gemini-flash-lite-latest', nombre: 'Gemini Flash-Lite Latest (Estable)' },
  { id: 'gemini-3.8-flash', nombre: 'Gemini 3.8 Flash (Última generación)' },
  { id: 'gemini-4-argon', nombre: 'Gemini 4 Argon (Modelo avanzado)' },
  { id: 'gemini-flash-latest', nombre: 'Gemini Flash Latest' }
];

/**
 * Obtiene la configuración actual de IA combinando datos/config/ajustes.json y .env
 */
export async function obtenerConfiguracionIA() {
  const ajustes = await almacen.leerConfig('ajustes').catch(() => ({}));
  const proveedor = (ajustes.iaProveedor || process.env.IA_PROVEEDOR || 'gemini').trim().toLowerCase();
  const clave = (ajustes.iaClave || process.env.IA_CLAVE || '').trim();
  const modelo = (ajustes.iaModelo || process.env.IA_MODELO || 'gemini-3.5-flash').trim();

  return { proveedor, clave, modelo };
}

/**
 * Consulta a la API de Google Gemini los modelos disponibles para la clave suministrada
 */
export async function listarModelosDisponibles(claveExplicita = null) {
  const { clave } = await obtenerConfiguracionIA();
  const apiKey = claveExplicita || clave;

  if (!apiKey) {
    return MODELOS_RECOMENDADOS;
  }

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`;
    const res = await fetch(url);
    if (!res.ok) {
      return MODELOS_RECOMENDADOS;
    }
    const datos = await res.json();
    if (!Array.isArray(datos.models)) {
      return MODELOS_RECOMENDADOS;
    }

    const modelosGeneracion = datos.models
      .filter((m) => Array.isArray(m.supportedGenerationMethods) && m.supportedGenerationMethods.includes('generateContent'))
      .map((m) => {
        const idLimpio = m.name.replace(/^models\//, '');
        return {
          id: idLimpio,
          nombre: `${m.displayName || idLimpio} (${idLimpio})`
        };
      });

    return modelosGeneracion.length > 0 ? modelosGeneracion : MODELOS_RECOMENDADOS;
  } catch (err) {
    console.warn('No se pudo listar modelos desde Google AI Studio:', err.message);
    return MODELOS_RECOMENDADOS;
  }
}

/**
 * Reemplaza las variables {{clave}} en la plantilla con los valores de datos
 */
function interpolarPlantilla(plantilla, datos = {}) {
  return plantilla.replace(/\{\{([a-zA-Z0-9_]+)\}\}/g, (_, clave) => {
    const valor = datos[clave];
    if (valor === undefined || valor === null) return '';
    if (Array.isArray(valor)) {
      return valor.map((v) => (typeof v === 'string' ? `- ${v}` : JSON.stringify(v))).join('\n');
    }
    return String(valor);
  });
}

/**
 * Generador didáctico de respaldo cuando no hay clave o ante saturación temporal de la API
 */
function generarPreguntasRespaldo(datos) {
  const cantidad = Math.min(15, Math.max(5, Number(datos.cantidad || 5)));
  const tema = datos.tema || 'el tema de estudio';
  const glosario = Array.isArray(datos.glosario) ? datos.glosario : [];

  const preguntas = [];

  for (let i = 0; i < cantidad; i++) {
    const glosarioItem = glosario[i % Math.max(1, glosario.length)] || '';
    let termino = 'concepto clave';
    let definicion = 'definición fundamental del tema';

    if (glosarioItem.includes(':')) {
      const partes = glosarioItem.split(':');
      termino = partes[0].replace(/^- /, '').trim();
      definicion = partes.slice(1).join(':').trim();
    }

    const mod = i % 3;

    if (mod === 0) {
      preguntas.push({
        tipo: 'opcion',
        enunciado: `¿Cuál de las siguientes opciones describe con mayor precisión el concepto de "${termino}" en ${tema}?`,
        opciones: [
          definicion,
          `Una variación secundaria que no incide directamente en los fundamentos de ${tema}.`,
          `Un procedimiento de cálculo aplicado únicamente en casos de error metodológico.`,
          `Un indicador estadístico reservado exclusivamente para auditorías externas.`
        ],
        correcta: 0,
        retroalimentacion: `Correcto. ${termino} se define exactamente como: ${definicion}.`
      });
    } else if (mod === 1) {
      preguntas.push({
        tipo: 'vf',
        enunciado: `En el estudio de ${tema}, "${termino}" se refiere a: ${definicion}.`,
        opciones: ['Verdadero', 'Falso'],
        correcta: true,
        retroalimentacion: `Verdadero. La afirmación corresponde exactamente con la definición académica de ${termino}.`
      });
    } else {
      preguntas.push({
        tipo: 'completar',
        enunciado: `El principio que establece que "${definicion}" se denomina _____.`,
        opciones: [],
        correcta: termino,
        retroalimentacion: `El término correcto para completar la oración es "${termino}".`
      });
    }
  }

  return preguntas;
}

function generarGlosarioRespaldo(datos) {
  const tema = datos.tema || 'tema de estudio';
  const candidatos = String(`${datos.tema || ''} ${datos.contenido || ''}`)
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .match(/[A-Za-zÀ-ÿ]{4,14}/g) || [];
  const base = ['modelo', 'metodo', 'teoria', 'proceso', 'sistema', 'factor', 'analisis', 'concepto', 'contexto', 'evidencia', 'variable', 'resultado'];
  const existentes = new Set((datos.existentes || []).map((item) => String(item).toLowerCase()));
  const unicos = [...new Set([...base, ...candidatos].map((item) => item.toLowerCase()))]
    .filter((item) => !existentes.has(item))
    .slice(0, Math.min(20, Math.max(12, Number(datos.cantidad || 12))));

  return unicos.map((termino) => ({
    termino: termino.charAt(0).toUpperCase() + termino.slice(1),
    definicion: `Concepto relacionado con ${tema}, que debe comprenderse y aplicarse dentro de su contexto de estudio.`,
    pista: `Idea clave vinculada con ${tema}`.split(/\s+/).slice(0, 10).join(' '),
    retroalimentacion: `${termino} forma parte del vocabulario esencial para comprender ${tema}.`
  }));
}

function normalizarGlosarioGenerado(resultado) {
  if (Array.isArray(resultado)) return resultado;
  if (Array.isArray(resultado?.terminos)) return resultado.terminos;
  if (Array.isArray(resultado?.propuestas)) return resultado.propuestas;
  if (Array.isArray(resultado?.datos)) return resultado.datos;
  return [];
}

/**
 * Prueba la conexión con el modelo y clave configurados
 */
export async function probarConexionIA(configExplicita = null) {
  const config = configExplicita || await obtenerConfiguracionIA();
  const { clave, modelo } = config;

  if (!clave) {
    throw new Error('No se ha configurado ninguna clave de API para la IA');
  }

  const modeloPrincipal = modelo || 'gemini-3.5-flash';
  const candidatos = Array.from(new Set([
    modeloPrincipal,
    'gemini-3.5-flash',
    'gemini-3.5-flash-lite',
    'gemini-flash-lite-latest',
    'gemini-3.8-flash'
  ]));

  let ultimoError = null;

  for (const mod of candidatos) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(mod)}:generateContent?key=${encodeURIComponent(clave)}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': clave
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: 'Responde únicamente con la palabra: CONECTADO' }] }]
        })
      });

      const datos = await res.json().catch(() => null);

      if (res.ok) {
        const respuesta = datos?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || 'CONECTADO';
        const avisoConmutacion = mod !== modeloPrincipal ? ` (conmutado automáticamente a ${mod})` : '';
        return {
          ok: true,
          mensaje: `Conexión exitosa con Google Gemini${avisoConmutacion}`,
          modelo: mod,
          respuesta
        };
      }

      const errorMsg = datos?.error?.message || `Error HTTP ${res.status}: ${res.statusText}`;
      ultimoError = errorMsg;

      // Si el modelo actual está saturado o no disponible, probar el siguiente de la lista
      if (res.status === 503 || errorMsg.includes('high demand') || errorMsg.includes('overloaded') || errorMsg.includes('no longer available') || errorMsg.includes('not found')) {
        continue;
      } else {
        // Error de credenciales u otro error definitivo
        break;
      }
    } catch (err) {
      ultimoError = err.message;
    }
  }

  throw new Error(`Fallo en la API de Gemini: ${ultimoError || 'No se pudo conectar'}`);
}

/**
 * Ejecuta una petición a Gemini con reintentos y fallback si el modelo está saturado
 */
async function invocarGeminiConRespaldo(promptCompleto, modeloPrincipal, clave, formato) {
  // Lista de modelos a intentar en orden de preferencia si el principal está en "high demand"
  const modelosCandidatos = [
    modeloPrincipal,
    'gemini-3.8-flash',
    'gemini-3.5-flash',
    'gemini-3.5-flash-lite',
    'gemini-flash-latest',
    'gemini-4-argon'
  ];
  const modelosUnicos = Array.from(new Set(modelosCandidatos.filter(Boolean)));

  let ultimoError = null;

  for (const mod of modelosUnicos) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(mod)}:generateContent?key=${encodeURIComponent(clave)}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': clave
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: promptCompleto }] }],
          generationConfig: {
            responseMimeType: formato === 'json' ? 'application/json' : 'text/plain'
          }
        })
      });

      const resJson = await res.json().catch(() => null);

      if (res.ok) {
        const textoSalida = resJson?.candidates?.[0]?.content?.parts?.[0]?.text || '';
        return { textoSalida, modeloUsado: mod };
      }

      const mensajeError = resJson?.error?.message || `${res.status} ${res.statusText}`;
      ultimoError = mensajeError;

      // Si es error de alta demanda (503 / high demand), intentar con el siguiente modelo de la lista
      if (res.status === 503 || mensajeError.includes('high demand') || mensajeError.includes('overloaded')) {
        console.warn(`Modelo ${mod} saturado en Google (${mensajeError}). Probando alternativa...`);
        continue;
      } else {
        // Otro tipo de error (ej. clave inválida), romper ciclo
        break;
      }
    } catch (err) {
      ultimoError = err.message;
    }
  }

  throw new Error(ultimoError || 'No se pudo conectar con los modelos de Google Gemini');
}

/**
 * Ejecuta una tarea de IA procesando la plantilla correspondiente
 * @param {string} tarea
 * @param {Object} datos
 * @param {Object} usuario
 * @param {Object} [opciones={ formato: "json" }]
 */
export async function ejecutarTarea(tarea, datos, usuario, { formato = 'json' } = {}) {
  const rutaPrompt = path.resolve('servidor', 'prompts', `${tarea}.txt`);

  let contenidoPrompt = '';
  try {
    contenidoPrompt = await fs.readFile(rutaPrompt, 'utf-8');
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
  }

  const promptCompleto = interpolarPlantilla(contenidoPrompt, datos);

  // Obtener configuración activa (ajustes.json o .env)
  const { proveedor, clave, modelo } = await obtenerConfiguracionIA();

  // Si no hay clave de IA configurada, usar generador didáctico de respaldo
  if (!clave) {
    if (tarea === 'generar-preguntas') {
      return generarPreguntasRespaldo(datos);
    }
    if (tarea === 'generar-glosario') return generarGlosarioRespaldo(datos);
    return { ok: true, mensaje: 'Generación simulada (sin clave de API)', datos };
  }

  // Llamada HTTP al proveedor (Google Gemini) con tolerancia a saturación
  if (proveedor.includes('gemini')) {
    try {
      const { textoSalida } = await invocarGeminiConRespaldo(promptCompleto, modelo, clave, formato);

      if (formato === 'json') {
        const limpio = textoSalida.replace(/```json\n?|```/g, '').trim();
        const resultado = JSON.parse(limpio);
        return tarea === 'generar-glosario' ? normalizarGlosarioGenerado(resultado) : resultado;
      }
      return textoSalida;
    } catch (err) {
      console.warn(`Error llamando a Gemini (${err.message}). Usando generador pedagógico de respaldo.`);
      if (tarea === 'generar-preguntas') {
        return generarPreguntasRespaldo(datos);
      }
      if (tarea === 'generar-glosario') return generarGlosarioRespaldo(datos);
      throw err;
    }
  }

  return tarea === 'generar-glosario'
    ? generarGlosarioRespaldo(datos)
    : generarPreguntasRespaldo(datos);
}

export default {
  MODELOS_RECOMENDADOS,
  obtenerConfiguracionIA,
  listarModelosDisponibles,
  probarConexionIA,
  ejecutarTarea
};
