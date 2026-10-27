import { montarPlantilla } from '../nucleo/plantilla.js';
import * as api from '../nucleo/api.js';
import * as ui from '../nucleo/ui.js';
import { parametro } from '../nucleo/util.js';

await montarPlantilla({ titulo: 'Editor de simulación', roles: ['docente', 'admin'] });

const tituloPagina = document.getElementById('tituloPagina');
const campoTitulo = document.getElementById('titulo');
const campoTema = document.getElementById('tema');
const campoModo = document.getElementById('modo');
const campoEstado = document.getElementById('estado');
const campoInicial = document.getElementById('escenaInicial');
const editorEscenarios = document.getElementById('editorEscenarios');
const editorRol = document.getElementById('editorRol');
const listaEscenas = document.getElementById('listaEscenas');
const mapaEscenario = document.getElementById('mapaEscenario');
const erroresValidacion = document.getElementById('erroresValidacion');
const personajeNombre = document.getElementById('personajeNombre');
const personajeDescripcion = document.getElementById('personajeDescripcion');
const personajeContexto = document.getElementById('personajeContexto');
const personajeObjetivo = document.getElementById('personajeObjetivo');
const campoMaxTurnos = document.getElementById('maxTurnos');
const listaRubrica = document.getElementById('listaRubrica');

let simulacionId = parametro('id');
let escenas = [];
let rubrica = [];
let escenaInicial = 'E1';
let guardando = false;

function leerRubricaDelDom() {
  rubrica = Array.from(listaRubrica.querySelectorAll('[data-criterio-indice]')).map((fila) => ({
    criterio: fila.querySelector('[data-campo="criterio"]').value.trim(),
    descripcion: fila.querySelector('[data-campo="descripcion"]').value.trim(),
    puntos: Number(fila.querySelector('[data-campo="puntos"]').value)
  }));
}

function renderizarRubrica() {
  listaRubrica.innerHTML = rubrica.map((item, indice) => `
    <div class="editor-simulacion__criterio" data-criterio-indice="${indice}">
      <label class="campo"><span>Criterio</span><input data-campo="criterio" maxlength="120" value="${ui.escapar(item.criterio || '')}"></label>
      <label class="campo"><span>Descripción</span><textarea data-campo="descripcion" maxlength="600" rows="3">${ui.escapar(item.descripcion || '')}</textarea></label>
      <label class="campo"><span>Puntos máximos</span><input data-campo="puntos" type="number" min="1" max="100" value="${Number.isFinite(Number(item.puntos)) ? Number(item.puntos) : 10}"></label>
      <button class="btn btn--texto btn--pequeno" type="button" data-accion="eliminar-criterio">Eliminar</button>
    </div>`).join('');
}

function siguienteIdEscena() {
  const usados = new Set(escenas.map((escena) => escena.id));
  let numero = 1;
  while (usados.has(`E${numero}`)) numero++;
  return `E${numero}`;
}

function leerEscenasDelDom() {
  escenas = Array.from(listaEscenas.querySelectorAll('[data-escena-id]')).map((tarjeta) => ({
    id: tarjeta.dataset.escenaId,
    texto: tarjeta.querySelector('[data-campo="texto"]').value.trim(),
    imagen: tarjeta.querySelector('[data-campo="imagen"]').value.trim(),
    opciones: Array.from(tarjeta.querySelectorAll('[data-opcion-indice]')).map((fila) => ({
      texto: fila.querySelector('[data-campo="opcion-texto"]').value.trim(),
      destino: fila.querySelector('[data-campo="destino"]').value,
      puntos: Number(fila.querySelector('[data-campo="puntos"]').value),
      consecuencia: fila.querySelector('[data-campo="consecuencia"]').value.trim()
    }))
  }));
  escenaInicial = campoInicial.value || escenas[0]?.id || '';
}

function opcionesDestino(destinoActual) {
  const ids = escenas.map((escena) => escena.id);
  const inexistente = destinoActual && !ids.includes(destinoActual)
    ? `<option value="${ui.escapar(destinoActual)}" selected>${ui.escapar(destinoActual)} (no existe)</option>`
    : '';
  return `<option value="">Selecciona un destino</option>${inexistente}${ids.map((id) =>
    `<option value="${ui.escapar(id)}" ${id === destinoActual ? 'selected' : ''}>${ui.escapar(id)}</option>`
  ).join('')}`;
}

function renderizarEscenas() {
  campoInicial.innerHTML = escenas.length
    ? escenas.map((escena) => `<option value="${ui.escapar(escena.id)}" ${escena.id === escenaInicial ? 'selected' : ''}>${ui.escapar(escena.id)}</option>`).join('')
    : '<option value="">Sin escenas</option>';
  if (!escenas.some((escena) => escena.id === escenaInicial)) {
    escenaInicial = escenas[0]?.id || '';
    campoInicial.value = escenaInicial;
  }

  listaEscenas.innerHTML = escenas.map((escena) => `
    <article class="tarjeta editor-simulacion__escena" id="escena-${ui.escapar(escena.id)}" data-escena-id="${ui.escapar(escena.id)}" tabindex="-1">
      <header class="editor-simulacion__escena-cabecera">
        <div><span class="chip chip--primario">${ui.escapar(escena.id)}</span><h2>Escena ${ui.escapar(escena.id)}</h2></div>
        <button class="btn btn--peligro btn--pequeno" type="button" data-accion="eliminar-escena">Eliminar escena</button>
      </header>
      <label class="campo"><span>Texto de la situación</span><textarea data-campo="texto" maxlength="2000" rows="5">${ui.escapar(escena.texto || '')}</textarea></label>
      <input type="hidden" data-campo="imagen" value="${ui.escapar(escena.imagen || '')}">
      <div class="editor-simulacion__imagen-acciones">
        <label class="campo"><span>Imagen opcional</span><input type="file" data-accion="subir-imagen" accept="image/jpeg,image/png,image/webp"></label>
        ${escena.imagen ? `<img class="editor-simulacion__imagen-actual" src="${ui.escapar(escena.imagen)}" alt="Imagen de la escena ${ui.escapar(escena.id)}"><button class="btn btn--texto" type="button" data-accion="quitar-imagen">Quitar imagen</button>` : ''}
      </div>
      <section class="editor-simulacion__opciones" aria-label="Opciones de ${ui.escapar(escena.id)}">
        <div class="editor-simulacion__opcion-cabecera"><div><h3>Opciones</h3><p class="texto-suave">Sin opciones, esta escena será un final.</p></div><button class="btn btn--secundario btn--pequeno" type="button" data-accion="agregar-opcion">Agregar opción</button></div>
        ${escena.opciones.map((opcion, indice) => `
          <div class="editor-simulacion__opcion" data-opcion-indice="${indice}">
            <label class="campo"><span>Texto de la opción</span><input data-campo="opcion-texto" maxlength="300" value="${ui.escapar(opcion.texto || '')}"></label>
            <label class="campo"><span>Destino</span><select data-campo="destino">${opcionesDestino(opcion.destino)}</select></label>
            <label class="campo"><span>Puntos (−10 a 10)</span><input data-campo="puntos" type="number" min="-10" max="10" value="${Number.isFinite(Number(opcion.puntos)) ? Number(opcion.puntos) : 0}"></label>
            <label class="campo editor-simulacion__consecuencia"><span>Consecuencia</span><textarea data-campo="consecuencia" maxlength="600" rows="3">${ui.escapar(opcion.consecuencia || '')}</textarea></label>
            <button class="btn btn--texto btn--pequeno" type="button" data-accion="eliminar-opcion">Eliminar opción</button>
          </div>`).join('')}
      </section>
    </article>`).join('');
  renderizarMapa();
}

function renderizarMapa() {
  if (!escenas.length) {
    mapaEscenario.innerHTML = '<li>No hay escenas.</li>';
    return;
  }
  const mapa = new Map(escenas.map((escena) => [escena.id, escena]));
  const expandidas = new Set();
  const lineas = [];

  function recorrer(id, nivel, camino) {
    const escena = mapa.get(id);
    if (!escena) return;
    expandidas.add(id);
    if (!escena.opciones.length) {
      lineas.push({ nivel, texto: `${id} → Final`, clase: 'editor-simulacion__mapa-item--final' });
      return;
    }
    escena.opciones.forEach((opcion) => {
      lineas.push({ nivel, texto: `${id} → ${opcion.destino || '?'} (${opcion.texto || 'opción sin texto'})`, clase: opcion.destino && mapa.has(opcion.destino) ? '' : 'editor-simulacion__mapa-item--advertencia' });
      if (opcion.destino && mapa.has(opcion.destino) && !camino.has(opcion.destino) && !expandidas.has(opcion.destino)) {
        const siguienteCamino = new Set(camino);
        siguienteCamino.add(opcion.destino);
        recorrer(opcion.destino, nivel + 1, siguienteCamino);
      }
    });
  }

  recorrer(escenaInicial, 0, new Set([escenaInicial]));
  escenas.filter((escena) => !expandidas.has(escena.id)).forEach((escena) => {
    lineas.push({ nivel: 0, texto: `${escena.id} (no alcanzable desde ${escenaInicial || '?'})`, clase: 'editor-simulacion__mapa-item--advertencia' });
  });
  mapaEscenario.innerHTML = lineas.map((linea) =>
    `<li class="editor-simulacion__mapa-item editor-simulacion__mapa-item--nivel-${Math.min(linea.nivel, 10)} ${linea.clase}">${ui.escapar(linea.texto)}</li>`
  ).join('');
}

function validarPublicacion(datos) {
  const errores = [];
  const agregar = (mensaje, escenaId = '') => errores.push({ mensaje, escenaId });
  if (!datos.titulo) agregar('El título es obligatorio.');
  if (!datos.temaId) agregar('Selecciona un tema.');
  if (datos.estado !== 'publicado') return errores;
  if (datos.modo === 'rol') {
    if (!datos.personaje.nombre) agregar('Escribe el nombre del personaje.');
    if (!datos.personaje.descripcion) agregar('Escribe la descripción del personaje.');
    if (!datos.personaje.contexto) agregar('Escribe el contexto del caso.');
    if (!datos.personaje.objetivo) agregar('Escribe el objetivo del estudiante.');
    if (!Number.isInteger(datos.maxTurnos) || datos.maxTurnos < 4 || datos.maxTurnos > 12) agregar('El máximo de turnos debe estar entre 4 y 12.');
    if (datos.rubrica.length < 3 || datos.rubrica.length > 5) agregar('La rúbrica debe tener de 3 a 5 criterios.');
    datos.rubrica.forEach((item, indice) => {
      if (!item.criterio) agregar(`Escribe el nombre del criterio ${indice + 1}.`);
      if (!item.descripcion) agregar(`Escribe la descripción del criterio ${indice + 1}.`);
      if (!Number.isFinite(item.puntos) || item.puntos < 1 || item.puntos > 100) agregar(`Los puntos del criterio ${indice + 1} deben estar entre 1 y 100.`);
    });
    return errores;
  }
  if (!datos.escenas.length) agregar('Agrega al menos una escena.');

  const mapa = new Map(datos.escenas.map((escena) => [escena.id, escena]));
  if (!datos.escenaInicial || !mapa.has(datos.escenaInicial)) agregar('Selecciona una escena inicial existente.');
  if (!datos.escenas.some((escena) => escena.opciones.length === 0)) agregar('La simulación debe tener al menos una escena final.');

  datos.escenas.forEach((escena) => {
    if (!escena.texto) agregar('Escribe el texto de la escena.', escena.id);
    if (escena.opciones.length === 1 || escena.opciones.length > 4) agregar('Una escena no final debe tener de 2 a 4 opciones.', escena.id);
    escena.opciones.forEach((opcion, indice) => {
      const numero = indice + 1;
      if (!opcion.texto) agregar(`Completa el texto de la opción ${numero}.`, escena.id);
      if (!opcion.destino || !mapa.has(opcion.destino)) agregar(`La opción ${numero} tiene un destino inexistente.`, escena.id);
      if (!Number.isFinite(opcion.puntos) || opcion.puntos < -10 || opcion.puntos > 10) agregar(`Los puntos de la opción ${numero} deben estar entre −10 y 10.`, escena.id);
      if (!opcion.consecuencia) agregar(`Escribe la consecuencia de la opción ${numero}.`, escena.id);
    });
  });

  if (mapa.has(datos.escenaInicial)) {
    const alcanzables = new Set();
    const pendientes = [datos.escenaInicial];
    while (pendientes.length) {
      const id = pendientes.pop();
      if (alcanzables.has(id) || !mapa.has(id)) continue;
      alcanzables.add(id);
      mapa.get(id).opciones.forEach((opcion) => pendientes.push(opcion.destino));
    }
    datos.escenas.filter((escena) => !alcanzables.has(escena.id)).forEach((escena) => agregar('La escena no es alcanzable desde la escena inicial.', escena.id));
  }

  const estadoVisita = new Map();
  const ciclos = new Set();
  function visitar(id) {
    if (!mapa.has(id)) return;
    if (estadoVisita.get(id) === 1) { ciclos.add(id); return; }
    if (estadoVisita.get(id) === 2) return;
    estadoVisita.set(id, 1);
    mapa.get(id).opciones.forEach((opcion) => {
      if (estadoVisita.get(opcion.destino) === 1) ciclos.add(id);
      else visitar(opcion.destino);
    });
    estadoVisita.set(id, 2);
  }
  datos.escenas.forEach((escena) => visitar(escena.id));
  ciclos.forEach((id) => agregar('La escena forma parte de un ciclo.', id));
  return errores;
}

function mostrarErrores(errores) {
  if (!errores.length) {
    erroresValidacion.hidden = true;
    erroresValidacion.replaceChildren();
    return;
  }
  erroresValidacion.hidden = false;
  erroresValidacion.innerHTML = `<div><strong>Corrige estos problemas antes de guardar:</strong><ul class="editor-simulacion__errores">${errores.map((error) =>
    `<li>${error.escenaId ? `<a href="#escena-${ui.escapar(error.escenaId)}">${ui.escapar(error.escenaId)}</a>: ` : ''}${ui.escapar(error.mensaje)}</li>`
  ).join('')}</ul></div>`;
  erroresValidacion.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function datosFormulario() {
  leerEscenasDelDom();
  leerRubricaDelDom();
  const datos = {
    titulo: campoTitulo.value.trim(),
    temaId: campoTema.value,
    modo: campoModo.value,
    estado: campoEstado.value
  };
  if (datos.modo === 'escenarios') {
    datos.escenaInicial = escenaInicial;
    datos.escenas = escenas;
  } else {
    datos.personaje = {
      nombre: personajeNombre.value.trim(),
      descripcion: personajeDescripcion.value.trim(),
      contexto: personajeContexto.value.trim(),
      objetivo: personajeObjetivo.value.trim()
    };
    datos.rubrica = rubrica;
    datos.maxTurnos = Number(campoMaxTurnos.value);
  }
  return datos;
}

async function guardar(previsualizar = false) {
  if (guardando) return;
  const ventanaPrevia = previsualizar ? window.open('', '_blank') : null;
  const datos = datosFormulario();
  const errores = validarPublicacion(datos);
  if (errores.length) {
    if (ventanaPrevia) ventanaPrevia.close();
    mostrarErrores(errores);
    return;
  }
  mostrarErrores([]);
  guardando = true;
  try {
    ui.cargando(true);
    const guardada = simulacionId
      ? await api.actualizar('simulaciones', simulacionId, datos)
      : await api.crear('simulaciones', datos);
    simulacionId = guardada.id;
    tituloPagina.textContent = 'Editar simulación';
    history.replaceState(null, '', `/paginas/editor-simulacion.html?id=${encodeURIComponent(simulacionId)}`);
    ui.aviso('Simulación guardada correctamente', 'exito');
    if (previsualizar) {
      const ruta = `/paginas/simulador.html?id=${encodeURIComponent(simulacionId)}&vista=previa`;
      if (ventanaPrevia) ventanaPrevia.location.href = ruta;
      else window.open(ruta, '_blank', 'noopener');
    }
  } catch (error) {
    if (ventanaPrevia) ventanaPrevia.close();
    ui.aviso(error.message || 'No se pudo guardar la simulación', 'error');
  } finally {
    guardando = false;
    ui.cargando(false);
  }
}

function actualizarModo() {
  const esRol = campoModo.value === 'rol';
  if (!esRol && !escenas.length) {
    escenas = [{ id: 'E1', texto: '', imagen: '', opciones: [] }];
    escenaInicial = 'E1';
    renderizarEscenas();
  }
  editorRol.hidden = !esRol;
  editorEscenarios.hidden = esRol;
}

document.getElementById('agregarEscena').addEventListener('click', () => {
  leerEscenasDelDom();
  const id = siguienteIdEscena();
  escenas.push({ id, texto: '', imagen: '', opciones: [] });
  if (!escenaInicial) escenaInicial = id;
  renderizarEscenas();
  document.getElementById(`escena-${id}`)?.scrollIntoView({ behavior: 'smooth' });
});

campoInicial.addEventListener('change', () => {
  escenaInicial = campoInicial.value;
  leerEscenasDelDom();
  renderizarMapa();
});
campoModo.addEventListener('change', actualizarModo);
document.getElementById('agregarCriterio').addEventListener('click', () => {
  leerRubricaDelDom();
  if (rubrica.length >= 5) return ui.aviso('La rúbrica admite hasta 5 criterios', 'advertencia');
  rubrica.push({ criterio: '', descripcion: '', puntos: 10 });
  renderizarRubrica();
});
listaRubrica.addEventListener('click', (evento) => {
  const boton = evento.target.closest('[data-accion="eliminar-criterio"]');
  if (!boton) return;
  leerRubricaDelDom();
  if (rubrica.length <= 3) return ui.aviso('La rúbrica debe conservar al menos 3 criterios', 'advertencia');
  const indice = Number(boton.closest('[data-criterio-indice]').dataset.criterioIndice);
  rubrica.splice(indice, 1);
  renderizarRubrica();
});
listaEscenas.addEventListener('input', () => {
  leerEscenasDelDom();
  renderizarMapa();
});
listaEscenas.addEventListener('change', (evento) => {
  if (evento.target.matches('[data-accion="subir-imagen"]')) return;
  leerEscenasDelDom();
  renderizarMapa();
});

listaEscenas.addEventListener('click', async (evento) => {
  const boton = evento.target.closest('[data-accion]');
  if (!boton) return;
  const tarjeta = boton.closest('[data-escena-id]');
  if (!tarjeta) return;
  leerEscenasDelDom();
  const escena = escenas.find((item) => item.id === tarjeta.dataset.escenaId);
  if (!escena) return;

  if (boton.dataset.accion === 'agregar-opcion') {
    if (escena.opciones.length >= 4) return ui.aviso('Cada escena admite hasta 4 opciones', 'advertencia');
    escena.opciones.push({ texto: '', destino: '', puntos: 0, consecuencia: '' });
    renderizarEscenas();
  } else if (boton.dataset.accion === 'eliminar-opcion') {
    escena.opciones.splice(Number(boton.closest('[data-opcion-indice]').dataset.opcionIndice), 1);
    renderizarEscenas();
  } else if (boton.dataset.accion === 'quitar-imagen') {
    escena.imagen = '';
    renderizarEscenas();
  } else if (boton.dataset.accion === 'eliminar-escena') {
    if (escenas.length === 1) return ui.aviso('La simulación debe conservar al menos una escena', 'advertencia');
    if (!await ui.confirmar(`¿Eliminar la escena ${escena.id}?`)) return;
    escenas = escenas.filter((item) => item.id !== escena.id);
    if (escenaInicial === escena.id) escenaInicial = escenas[0]?.id || '';
    renderizarEscenas();
  }
});

listaEscenas.addEventListener('change', async (evento) => {
  const entrada = evento.target.closest('[data-accion="subir-imagen"]');
  if (!entrada?.files?.[0]) return;
  leerEscenasDelDom();
  const tarjeta = entrada.closest('[data-escena-id]');
  const escena = escenas.find((item) => item.id === tarjeta?.dataset.escenaId);
  if (!escena) return;
  try {
    entrada.disabled = true;
    ui.cargando(true);
    const resultado = await api.subir(entrada.files[0]);
    escena.imagen = resultado.url;
    renderizarEscenas();
    ui.aviso('Imagen cargada correctamente', 'exito');
  } catch (error) {
    entrada.disabled = false;
    ui.aviso(error.message || 'No se pudo subir la imagen', 'error');
  } finally {
    ui.cargando(false);
  }
});

document.getElementById('guardarSimulacion').addEventListener('click', () => guardar(false));
document.getElementById('vistaPrevia').addEventListener('click', () => guardar(true));

async function iniciar() {
  try {
    ui.cargando(true);
    const temas = await api.listar('temas');
    campoTema.replaceChildren(new Option('Selecciona un tema', ''));
    temas.forEach((tema) => campoTema.add(new Option(tema.titulo, tema.id)));

    if (simulacionId) {
      const simulacion = await api.obtener('simulaciones', simulacionId);
      tituloPagina.textContent = 'Editar simulación';
      campoTitulo.value = simulacion.titulo || '';
      campoTema.value = simulacion.temaId || '';
      campoModo.value = simulacion.modo || 'escenarios';
      campoEstado.value = simulacion.estado || 'borrador';
      escenas = Array.isArray(simulacion.escenas) ? structuredClone(simulacion.escenas) : [];
      escenaInicial = simulacion.escenaInicial || escenas[0]?.id || '';
      personajeNombre.value = simulacion.personaje?.nombre || '';
      personajeDescripcion.value = simulacion.personaje?.descripcion || '';
      personajeContexto.value = simulacion.personaje?.contexto || '';
      personajeObjetivo.value = simulacion.personaje?.objetivo || '';
      campoMaxTurnos.value = Math.min(12, Math.max(4, Number(simulacion.maxTurnos) || 6));
      rubrica = Array.isArray(simulacion.rubrica) ? structuredClone(simulacion.rubrica) : [];
    } else {
      campoTema.value = parametro('temaId') || '';
      escenas = [{ id: 'E1', texto: '', imagen: '', opciones: [] }];
      escenaInicial = 'E1';
    }
    if (!rubrica.length) {
      rubrica = [
        { criterio: '', descripcion: '', puntos: 10 },
        { criterio: '', descripcion: '', puntos: 10 },
        { criterio: '', descripcion: '', puntos: 10 }
      ];
    }
    renderizarEscenas();
    renderizarRubrica();
    actualizarModo();
  } catch (error) {
    ui.aviso(error.message || 'No se pudo cargar el editor', 'error');
  } finally {
    ui.cargando(false);
  }
}

iniciar();
