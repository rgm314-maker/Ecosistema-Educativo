import { montarPlantilla } from '../nucleo/plantilla.js';
import * as api from '../nucleo/api.js';
import * as ui from '../nucleo/ui.js';
import * as util from '../nucleo/util.js';
import { mostrarRetro } from '../nucleo/retroalimentacion.js';
import { registrarIntento } from '../nucleo/gamificacion.js';
import { cambiarEstado, decir } from '../nucleo/avatar.js';

await montarPlantilla({ titulo: 'Simulador', roles: ['sesion'] });

const simulacionId = util.parametro('id');
const esPrevia = util.parametro('vista') === 'previa';
const titulo = document.getElementById('tituloSimulacion');
const escenario = document.getElementById('escenario');
const indicadorPuntaje = document.getElementById('puntajeActual');
document.getElementById('indicadorPrevia').hidden = !esPrevia;

let simulacion = null;
let mapaEscenas = new Map();
let escenaActual = null;
let puntos = 0;
let recorrido = [];
let intentoRegistrado = false;
let historialRol = [];
let turnosRol = 0;
let esperandoRol = false;
let evaluacionTerminada = false;

function actualizarPuntaje() {
  indicadorPuntaje.textContent = `${puntos} ${puntos === 1 ? 'punto' : 'puntos'}`;
}

function mejorPuntaje(id, visitando = new Set(), memoria = new Map()) {
  if (memoria.has(id)) return memoria.get(id);
  if (visitando.has(id)) return Number.NEGATIVE_INFINITY;
  const escena = mapaEscenas.get(id);
  if (!escena) return Number.NEGATIVE_INFINITY;
  const opciones = Array.isArray(escena.opciones) ? escena.opciones : [];
  if (!opciones.length) return 0;

  const camino = new Set(visitando);
  camino.add(id);
  const valores = opciones.map((opcion) => {
    const resto = mejorPuntaje(opcion.destino, camino, memoria);
    return Number.isFinite(resto) ? Number(opcion.puntos || 0) + resto : Number.NEGATIVE_INFINITY;
  });
  const mejor = Math.max(...valores);
  memoria.set(id, mejor);
  return mejor;
}

function elegirOpcion(opcion, botones) {
  botones.forEach((boton) => { boton.disabled = true; });
  const puntosOpcion = Number(opcion.puntos || 0);
  puntos += puntosOpcion;
  recorrido.push({
    escenaId: escenaActual.id,
    decision: opcion.texto,
    destino: opcion.destino,
    puntos: puntosOpcion,
    consecuencia: opcion.consecuencia || ''
  });
  actualizarPuntaje();

  mostrarRetro({
    correcto: puntosOpcion > 0,
    explicacion: opcion.consecuencia || 'La decisión modifica el desarrollo del escenario.',
    contenedor: document.getElementById('retroalimentacion')
  });
  const continuar = document.getElementById('continuarEscena');
  continuar.hidden = false;
  continuar.onclick = () => {
    const siguiente = mapaEscenas.get(opcion.destino);
    if (!siguiente) {
      ui.aviso('La opción conduce a una escena inexistente', 'error');
      continuar.disabled = true;
      return;
    }
    escenaActual = siguiente;
    mostrarEscena();
  };
}

async function mostrarInforme() {
  const maximoCalculado = mejorPuntaje(simulacion.escenaInicial);
  const maximo = Number.isFinite(maximoCalculado) ? maximoCalculado : 0;
  escenario.innerHTML = `
    <section class="tarjeta simulador__informe">
      ${escenaActual.imagen ? `<img class="simulador__imagen" src="${ui.escapar(escenaActual.imagen)}" alt="Ilustración del resultado">` : ''}
      <div class="simulador__texto">${util.formatoBasico(escenaActual.texto)}</div>
      <div><h2>Informe de la simulación</h2><p>Recorrido completado con ${puntos} ${puntos === 1 ? 'punto' : 'puntos'}.</p></div>
      <div class="pila">
        ${recorrido.length ? recorrido.map((paso, indice) => `
          <article class="simulador__decision">
            <strong>Decisión ${indice + 1}: ${ui.escapar(paso.decision)}</strong>
            <p>${ui.escapar(paso.consecuencia)}</p>
            <span class="chip">${paso.puntos >= 0 ? '+' : ''}${paso.puntos} puntos</span>
          </article>`).join('') : '<p>No se tomaron decisiones en este recorrido.</p>'}
      </div>
      <div class="simulador__acciones">
        <button class="btn btn--primario" type="button" id="reiniciarSimulacion">Intentar de nuevo</button>
        <a class="btn btn--secundario" href="/paginas/simulaciones.html">Volver</a>
      </div>
      <p id="estadoIntento" class="texto-suave" role="status"></p>
    </section>`;
  document.getElementById('reiniciarSimulacion').addEventListener('click', reiniciar);

  if (esPrevia || intentoRegistrado) {
    if (esPrevia) document.getElementById('estadoIntento').textContent = 'Vista previa: este recorrido no se registró.';
    return;
  }
  intentoRegistrado = true;
  try {
    await registrarIntento({
      actividad: 'simulacion',
      temaId: simulacion.temaId,
      puntaje: Math.max(0, puntos),
      maximo,
      detalle: { simulacionId: simulacion.id, recorrido }
    });
    document.getElementById('estadoIntento').textContent = 'Intento registrado correctamente.';
  } catch (error) {
    document.getElementById('estadoIntento').textContent = 'El recorrido terminó, pero no se pudo registrar el intento.';
    ui.aviso(error.message || 'No se pudo registrar el intento', 'error');
  }
}

function mostrarEscena() {
  const opciones = Array.isArray(escenaActual.opciones) ? escenaActual.opciones : [];
  if (!opciones.length) {
    mostrarInforme();
    return;
  }
  escenario.innerHTML = `
    <article class="tarjeta simulador__escena">
      <h2>¿Qué decisión tomarías?</h2>
      ${escenaActual.imagen ? `<img class="simulador__imagen" src="${ui.escapar(escenaActual.imagen)}" alt="Ilustración de la situación">` : ''}
      <div class="simulador__texto">${util.formatoBasico(escenaActual.texto)}</div>
      <div class="simulador__opciones" id="opcionesEscena"></div>
      <div id="retroalimentacion"></div>
      <button class="btn btn--primario" type="button" id="continuarEscena" hidden>Continuar</button>
    </article>`;

  const contenedor = document.getElementById('opcionesEscena');
  const botones = opciones.map((opcion) => {
    const boton = document.createElement('button');
    boton.type = 'button';
    boton.className = 'btn btn--secundario simulador__opcion';
    boton.textContent = opcion.texto;
    boton.addEventListener('click', () => elegirOpcion(opcion, botones));
    contenedor.appendChild(boton);
    return boton;
  });
}

function reiniciar() {
  puntos = 0;
  recorrido = [];
  intentoRegistrado = false;
  escenaActual = mapaEscenas.get(simulacion.escenaInicial);
  actualizarPuntaje();
  mostrarEscena();
}

function actualizarTurnos() {
  const maximo = Math.min(12, Math.max(4, Number(simulacion.maxTurnos) || 4));
  indicadorPuntaje.textContent = `${turnosRol}/${maximo} turnos`;
}

function crearMensajeRol(mensaje) {
  const articulo = document.createElement('article');
  articulo.className = `simulador__mensaje simulador__mensaje--${mensaje.rol}`;
  const autor = document.createElement('strong');
  autor.textContent = mensaje.rol === 'estudiante' ? 'Tú' : (simulacion.personaje?.nombre || 'Personaje');
  const contenido = document.createElement('div');
  contenido.className = 'simulador__mensaje-texto';
  if (mensaje.rol === 'personaje') contenido.innerHTML = util.formatoBasico(mensaje.texto);
  else contenido.textContent = mensaje.texto;
  articulo.append(autor, contenido);
  return articulo;
}

function renderizarHistorialRol() {
  const contenedor = document.getElementById('mensajesRol');
  if (!contenedor) return;
  contenedor.replaceChildren();
  if (!historialRol.length) {
    const ayuda = document.createElement('p');
    ayuda.className = 'texto-suave';
    ayuda.textContent = 'Escribe tu primera intervención para iniciar la conversación.';
    contenedor.appendChild(ayuda);
  } else {
    historialRol.forEach((mensaje) => contenedor.appendChild(crearMensajeRol(mensaje)));
  }
  contenedor.scrollTop = contenedor.scrollHeight;
}

function actualizarControlesRol() {
  const entrada = document.getElementById('mensajeRol');
  const enviar = document.getElementById('enviarRol');
  const terminar = document.getElementById('terminarRol');
  if (!entrada || !enviar || !terminar) return;
  const maximo = Math.min(12, Math.max(4, Number(simulacion.maxTurnos) || 4));
  entrada.disabled = esperandoRol || evaluacionTerminada || turnosRol >= maximo;
  enviar.disabled = entrada.disabled || !entrada.value.trim();
  terminar.disabled = esperandoRol || evaluacionTerminada || !historialRol.some((item) => item.rol === 'estudiante');
  document.getElementById('rolPensando').hidden = !esperandoRol;
}

function textoRespuesta(resultado) {
  return String(resultado?.respuesta || resultado?.mensaje || '').replace(/\$/g, '').trim();
}

async function enviarRol() {
  const entrada = document.getElementById('mensajeRol');
  const texto = String(entrada?.value || '').trim().slice(0, 2000);
  if (!texto || esperandoRol || evaluacionTerminada) return;

  historialRol.push({ rol: 'estudiante', texto });
  turnosRol++;
  entrada.value = '';
  document.getElementById('contadorRol').textContent = '0/2000';
  esperandoRol = true;
  actualizarTurnos();
  renderizarHistorialRol();
  actualizarControlesRol();
  cambiarEstado('pensando');

  try {
    const resultado = await api.ia('rol-simulacion', { simulacionId: simulacion.id, historial: historialRol });
    const respuesta = textoRespuesta(resultado);
    if (!respuesta) throw new Error('El personaje no devolvió una respuesta');
    historialRol.push({ rol: 'personaje', texto: respuesta });
    renderizarHistorialRol();
    cambiarEstado('hablando');
    decir(respuesta);
  } catch (error) {
    historialRol.pop();
    turnosRol--;
    actualizarTurnos();
    renderizarHistorialRol();
    cambiarEstado('reposo');
    ui.aviso(error.message || 'No se pudo continuar la conversación', 'error');
  } finally {
    esperandoRol = false;
    actualizarControlesRol();
  }

  const maximo = Math.min(12, Math.max(4, Number(simulacion.maxTurnos) || 4));
  if (turnosRol >= maximo && historialRol.at(-1)?.rol === 'personaje') await finalizarRol();
  else entrada?.focus();
}

function normalizarEvaluacion(resultado) {
  const recibidos = Array.isArray(resultado?.criterios) ? resultado.criterios : [];
  const rubrica = Array.isArray(simulacion.rubrica) ? simulacion.rubrica : [];
  const criterios = rubrica.map((item, indice) => {
    const encontrado = recibidos.find((valor) => String(valor.criterio || '').toLowerCase() === String(item.criterio || '').toLowerCase()) || recibidos[indice] || {};
    const maximo = Math.max(0, Number(item.puntos) || 0);
    const puntos = Math.min(maximo, Math.max(0, Number(encontrado.puntos) || 0));
    return { criterio: item.criterio, descripcion: item.descripcion, puntos, maximo, comentario: String(encontrado.comentario || 'Sin comentario específico.') };
  });
  return {
    criterios,
    puntaje: criterios.reduce((total, item) => total + item.puntos, 0),
    maximo: criterios.reduce((total, item) => total + item.maximo, 0),
    comentarioGeneral: String(resultado?.comentarioGeneral || 'Revisa cada criterio para identificar cómo mejorar.')
  };
}

async function finalizarRol() {
  if (esperandoRol || evaluacionTerminada || !historialRol.some((item) => item.rol === 'estudiante')) return;
  esperandoRol = true;
  actualizarControlesRol();
  cambiarEstado('pensando');
  try {
    const resultado = await api.ia('evaluar-rol', { simulacionId: simulacion.id, historial: historialRol });
    const informe = normalizarEvaluacion(resultado);
    evaluacionTerminada = true;
    indicadorPuntaje.textContent = `${informe.puntaje}/${informe.maximo} puntos`;
    escenario.innerHTML = `
      <section class="tarjeta simulador__informe">
        <div><h2>Informe de la práctica</h2><p>${util.formatoBasico(informe.comentarioGeneral)}</p></div>
        <div class="simulador__evaluacion">
          ${informe.criterios.map((item) => `
            <article class="simulador__decision">
              <div class="simulador__criterio-titulo"><strong>${ui.escapar(item.criterio)}</strong><span class="chip">${item.puntos}/${item.maximo}</span></div>
              <p>${ui.escapar(item.comentario)}</p>
            </article>`).join('')}
        </div>
        <div class="simulador__acciones"><a class="btn btn--secundario" href="/paginas/simulaciones.html">Volver a simulaciones</a></div>
        <p id="estadoIntento" class="texto-suave" role="status">${esPrevia ? 'Vista previa: esta práctica no se registró.' : 'Registrando intento…'}</p>
      </section>`;
    cambiarEstado('hablando');
    decir(informe.comentarioGeneral);

    if (!esPrevia && !intentoRegistrado) {
      intentoRegistrado = true;
      try {
        await registrarIntento({
          actividad: 'simulacion',
          temaId: simulacion.temaId,
          puntaje: informe.puntaje,
          maximo: informe.maximo,
          detalle: { simulacionId: simulacion.id, modo: 'rol' }
        });
        document.getElementById('estadoIntento').textContent = 'Intento registrado correctamente.';
      } catch (error) {
        document.getElementById('estadoIntento').textContent = 'La práctica terminó, pero no se pudo registrar el intento.';
        ui.aviso(error.message || 'No se pudo registrar el intento', 'error');
      }
    }
  } catch (error) {
    cambiarEstado('reposo');
    ui.aviso(error.message || 'No se pudo evaluar la práctica', 'error');
  } finally {
    esperandoRol = false;
    actualizarControlesRol();
  }
}

function mostrarRol() {
  const personaje = simulacion.personaje || {};
  historialRol = [];
  turnosRol = 0;
  intentoRegistrado = false;
  evaluacionTerminada = false;
  actualizarTurnos();
  escenario.innerHTML = `
    <section class="simulador__rol">
      <article class="tarjeta simulador__caso">
        <div><p class="simulador__etiqueta">Tu personaje interlocutor</p><h2>${ui.escapar(personaje.nombre || 'Personaje')}</h2></div>
        <p><strong>Quién es:</strong> ${ui.escapar(personaje.descripcion || '')}</p>
        <div><strong>Contexto:</strong><div class="simulador__texto">${util.formatoBasico(personaje.contexto || '')}</div></div>
        <div class="alerta alerta--info"><strong>Tu objetivo:</strong> ${ui.escapar(personaje.objetivo || '')}</div>
      </article>
      <article class="tarjeta simulador__chat">
        <div id="mensajesRol" class="simulador__mensajes" aria-live="polite"></div>
        <p id="rolPensando" class="texto-suave" role="status" hidden>El personaje está pensando…</p>
        <form id="formRol" class="simulador__formulario">
          <label class="campo" for="mensajeRol"><span>Tu respuesta</span><textarea id="mensajeRol" maxlength="2000" rows="3"></textarea></label>
          <div class="simulador__acciones">
            <span id="contadorRol" class="texto-suave">0/2000</span>
            <button class="btn btn--secundario" type="button" id="terminarRol" disabled>Terminar</button>
            <button class="btn btn--primario" type="submit" id="enviarRol" disabled>Enviar</button>
          </div>
        </form>
      </article>
    </section>`;
  renderizarHistorialRol();
  const entrada = document.getElementById('mensajeRol');
  entrada.addEventListener('input', () => {
    document.getElementById('contadorRol').textContent = `${entrada.value.length}/2000`;
    actualizarControlesRol();
  });
  entrada.addEventListener('keydown', (evento) => {
    if (evento.key === 'Enter' && !evento.shiftKey) {
      evento.preventDefault();
      document.getElementById('formRol').requestSubmit();
    }
  });
  document.getElementById('formRol').addEventListener('submit', (evento) => {
    evento.preventDefault();
    enviarRol();
  });
  document.getElementById('terminarRol').addEventListener('click', finalizarRol);
  actualizarControlesRol();
  entrada.focus();
}

async function iniciar() {
  if (!simulacionId) {
    titulo.textContent = 'Simulación no encontrada';
    escenario.innerHTML = '<div class="vacio"><p class="vacio__texto">Falta el identificador de la simulación.</p></div>';
    return;
  }
  try {
    ui.cargando(true);
    simulacion = await api.obtener('simulaciones', simulacionId);
    titulo.textContent = simulacion.titulo;
    if (simulacion.modo === 'rol') {
      mostrarRol();
      return;
    }
    mapaEscenas = new Map((simulacion.escenas || []).map((item) => [item.id, item]));
    escenaActual = mapaEscenas.get(simulacion.escenaInicial);
    if (!escenaActual) throw new Error('La escena inicial no existe');
    mostrarEscena();
  } catch (error) {
    titulo.textContent = 'No se pudo abrir la simulación';
    escenario.innerHTML = '<div class="vacio"><p class="vacio__texto">La simulación solicitada no está disponible.</p></div>';
    ui.aviso(error.message || 'Error al cargar la simulación', 'error');
  } finally {
    ui.cargando(false);
  }
}

iniciar();
