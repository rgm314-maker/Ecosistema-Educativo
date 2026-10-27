// servidor/gamificacion.js
// Motor central de gamificación: procesamiento de intentos, cálculo de puntos e insignias

import * as almacen from './almacen.js';
import * as acceso from './acceso.js';
import * as alertas from './alertas.js';

// Registro en memoria de intentos por hora por usuario { usuarioId: [timestamps] }
const intentosPorHora = new Map();

function obtenerValor(obj, ruta) {
  if (!obj || !ruta) return undefined;
  const partes = ruta.split('.');
  let actual = obj;
  for (const p of partes) {
    if (actual === null || actual === undefined) return undefined;
    actual = actual[p];
  }
  return actual;
}

function calcularRachaHastaHoy(intentos) {
  const fechasSet = new Set(
    intentos
      .map((i) => (i.fecha ? String(i.fecha).slice(0, 10) : ''))
      .filter(Boolean)
  );

  const hoy = new Date();
  let cursor = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  let racha = 0;

  while (true) {
    const claveDia = cursor.toISOString().slice(0, 10);
    if (fechasSet.has(claveDia)) {
      racha++;
      cursor.setDate(cursor.getDate() - 1);
    } else {
      break;
    }
  }

  return racha;
}

export async function procesarIntento(usuario, datos) {
  if (!usuario || !usuario.id) {
    const err = new Error('Se requiere sesión activa');
    err.estado = 401;
    throw err;
  }

  const reglas = await almacen.leerConfig('reglas-gamificacion');
  const actividad = datos?.actividad;

  // 1. Validar actividad existente en reglas.puntos
  if (!actividad || !reglas.puntos || reglas.puntos[actividad] === undefined) {
    const err = new Error(`Actividad "${actividad}" no soportada en reglas de gamificación`);
    err.estado = 400;
    throw err;
  }

  // 2. Validar 0 <= puntaje <= maximo y maximo > 0
  const puntaje = Number(datos.puntaje);
  const maximo = Number(datos.maximo);
  const errores = Number(datos.errores) || 0;

  if (isNaN(puntaje) || isNaN(maximo) || puntaje < 0 || puntaje > maximo || maximo <= 0) {
    const err = new Error('Puntaje o valor máximo inválido');
    err.estado = 400;
    throw err;
  }

  // 3. Si viene temaId, validar acceso del usuario al tema
  if (datos.temaId) {
    const asignatura = await acceso.asignaturaDeTema(datos.temaId);
    if (!asignatura) {
      const err = new Error('Tema o asignatura no encontrados');
      err.estado = 400;
      throw err;
    }

    if (usuario.rol !== 'admin') {
      const misAsignaturas = await acceso.asignaturasDe(usuario);
      const tieneAcceso = misAsignaturas.some((a) => a.id === asignatura.id);
      if (!tieneAcceso) {
        const err = new Error('No tienes acceso a los contenidos de este tema');
        err.estado = 403;
        throw err;
      }
    }
  }

  // 4. Rate limiting: máximo reglas.limiteIntentosHora intentos por hora (en memoria) -> 429
  const limiteHora = reglas.limiteIntentosHora || 60;
  const ahoraMs = Date.now();
  const unaHoraAtras = ahoraMs - 3600000;

  const timestampsPrevios = (intentosPorHora.get(usuario.id) || []).filter(
    (t) => t >= unaHoraAtras
  );

  if (timestampsPrevios.length >= limiteHora) {
    const err = new Error('Límite de intentos por hora superado. Intenta más tarde.');
    err.estado = 429;
    throw err;
  }

  timestampsPrevios.push(ahoraMs);
  intentosPorHora.set(usuario.id, timestampsPrevios);

  // 5. Cálculo base de puntos y bono sin errores
  const puntosBase = Math.round((reglas.puntos[actividad] * puntaje) / maximo);
  const tieneBono = errores === 0 && puntaje === maximo;
  const bono = tieneBono ? (reglas.bonoSinErrores || 0) : 0;
  let puntosGanados = puntosBase + bono;

  // 6. Condiciones para guardar sin puntos
  const todosIntentos = await almacen.leer('intentos');
  const misIntentos = todosIntentos.filter((i) => i.usuarioId === usuario.id);

  // A. Actividades únicas: si ya hay un intento con puntos con la misma clave
  if (reglas.unicas && Array.isArray(reglas.unicas[actividad])) {
    const camposClave = reglas.unicas[actividad];
    const claveActual = camposClave
      .map((c) => String(obtenerValor(datos, c) ?? ''))
      .join('|');

    const yaRealizado = misIntentos.some((i) => {
      if (i.actividad !== actividad || (i.puntos || 0) <= 0) return false;
      const clavePrevia = camposClave
        .map((c) => String(obtenerValor(i, c) ?? ''))
        .join('|');
      return clavePrevia === claveActual;
    });

    if (yaRealizado) {
      puntosGanados = 0;
    }
  }

  // B. Requiere aprobado: si está en la lista y detalle.aprobado !== true
  if (Array.isArray(reglas.requiereAprobado) && reglas.requiereAprobado.includes(actividad)) {
    if (datos.detalle?.aprobado !== true) {
      puntosGanados = 0;
    }
  }

  // C. Máximo diario de intentos con puntos
  if (reglas.maxDiario && reglas.maxDiario[actividad] !== undefined) {
    const maxDiario = Number(reglas.maxDiario[actividad]);
    const hoyIso = new Date().toISOString().slice(0, 10);
    const intentosHoyConPuntos = misIntentos.filter((i) => {
      if (i.actividad !== actividad || (i.puntos || 0) <= 0) return false;
      const fechaDia = String(i.fecha || '').slice(0, 10);
      return fechaDia === hoyIso;
    }).length;

    if (intentosHoyConPuntos >= maxDiario) {
      puntosGanados = 0;
    }
  }

  // 7. Guardar el nuevo intento
  const registroIntento = {
    usuarioId: usuario.id,
    actividad,
    temaId: datos.temaId || null,
    nivel: datos.nivel !== undefined ? Number(datos.nivel) : null,
    puntaje,
    maximo,
    errores,
    duracionSeg: Number(datos.duracionSeg) || 0,
    detalle: datos.detalle || {},
    puntos: puntosGanados
  };

  const intentoGuardado = await almacen.agregar('intentos', registroIntento);
  const historialCompleto = [...misIntentos, intentoGuardado];

  // 8. Cargar y actualizar logros del usuario
  const listaLogros = await almacen.leer('logros');
  let logrosUsuario = listaLogros.find((l) => l.usuarioId === usuario.id);
  const esNuevoLogro = !logrosUsuario;

  if (esNuevoLogro) {
    logrosUsuario = {
      usuarioId: usuario.id,
      puntos: 0,
      insignias: [],
      nivelQuiz: {}
    };
  }

  logrosUsuario.puntos = (logrosUsuario.puntos || 0) + puntosGanados;
  if (!Array.isArray(logrosUsuario.insignias)) logrosUsuario.insignias = [];
  if (!logrosUsuario.nivelQuiz || typeof logrosUsuario.nivelQuiz !== 'object') {
    logrosUsuario.nivelQuiz = {};
  }

  // Si fue un quiz aprobado con nivel y temaId, registrar progreso en nivelQuiz
  if (actividad === 'quiz' && datos.temaId && datos.nivel && datos.detalle?.aprobado === true) {
    const n = Number(datos.nivel);
    logrosUsuario.nivelQuiz[datos.temaId] = Math.max(
      logrosUsuario.nivelQuiz[datos.temaId] || 0,
      n
    );
  }

  // 9. Evaluar insignias no obtenidas
  const catalogoInsignias = await almacen.leer('insignias');
  const idsObtenidas = new Set(logrosUsuario.insignias.map((i) => i.id));
  const insigniasNuevas = [];

  for (const ins of catalogoInsignias) {
    if (idsObtenidas.has(ins.id)) continue;
    const cond = ins.condicion;
    if (!cond || !cond.tipo) continue;

    let cumple = false;

    if (cond.tipo === 'conteo') {
      const intentosAct = historialCompleto.filter((i) => i.actividad === cond.actividad);
      if (reglas.unicas && Array.isArray(reglas.unicas[cond.actividad])) {
        const campos = reglas.unicas[cond.actividad];
        const clavesUnicas = new Set(
          intentosAct.map((i) => campos.map((c) => String(obtenerValor(i, c) ?? '')).join('|'))
        );
        cumple = clavesUnicas.size >= Number(cond.minimo || 1);
      } else {
        cumple = intentosAct.length >= Number(cond.minimo || 1);
      }
    } else if (cond.tipo === 'sinErrores') {
      cumple = historialCompleto.some(
        (i) => i.actividad === cond.actividad && Number(i.errores) === 0 && Number(i.puntaje) === Number(i.maximo)
      );
    } else if (cond.tipo === 'puntos') {
      cumple = logrosUsuario.puntos >= Number(cond.minimo || 0);
    } else if (cond.tipo === 'nivelQuiz') {
      const nivelReq = Number(cond.nivel || 1);
      cumple = Object.values(logrosUsuario.nivelQuiz).some((n) => Number(n) >= nivelReq);
    } else if (cond.tipo === 'racha') {
      const rachaDias = calcularRachaHastaHoy(historialCompleto);
      cumple = rachaDias >= Number(cond.dias || 1);
    }

    if (cumple) {
      const fechaOtorgada = new Date().toISOString();
      logrosUsuario.insignias.push({ id: ins.id, fecha: fechaOtorgada });
      idsObtenidas.add(ins.id);
      insigniasNuevas.push({
        id: ins.id,
        nombre: ins.nombre,
        icono: ins.icono
      });
    }
  }

  // 10. Persistir logros actualizados
  if (esNuevoLogro) {
    await almacen.agregar('logros', logrosUsuario);
  } else {
    await almacen.actualizar('logros', logrosUsuario.id, logrosUsuario);
  }

  // 11. Evaluar alertas tempranas en try/catch
  try {
    await alertas.evaluarAlertas(intentoGuardado, usuario);
  } catch (err) {
    console.error('Error al evaluar alertas:', err);
  }

  return {
    puntosGanados,
    puntosTotales: logrosUsuario.puntos,
    insigniasNuevas
  };
}

export default {
  procesarIntento
};
