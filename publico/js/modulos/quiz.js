import { montarPlantilla } from '../nucleo/plantilla.js';
import * as api from '../nucleo/api.js';
import * as ui from '../nucleo/ui.js';
import * as util from '../nucleo/util.js';
import { mostrarRetro, mostrarResumen } from '../nucleo/retroalimentacion.js';

await montarPlantilla({ titulo: 'Quiz por niveles', roles: ['estudiante'] });

const contenido = document.getElementById('contenido');
const temaId = util.parametro('temaId');
let sesion = null;
let pregunta = null;

function renderizarInicio(estado) {
  contenido.innerHTML = `<section class="quiz pila">
    <div><h1>Quiz por niveles</h1><p class="texto-suave">Supera cada nivel con al menos 70 % de respuestas correctas.</p></div>
    <div class="quiz__niveles">${estado.niveles.map((item) => {
      const bloqueado = item.estado === 'bloqueado';
      const clase = item.estado === 'aprobado' ? 'btn--secundario' : 'btn--primario';
      return `<button class="btn ${clase} quiz__nivel" data-nivel="${item.nivel}" ${bloqueado ? 'disabled' : ''}>
        Nivel ${item.nivel} · ${ui.escapar(item.nombre)}
        <small>${item.estado === 'aprobado' ? `Aprobado · ${item.mejorPorcentaje}%` : item.estado}</small>
      </button>`;
    }).join('')}</div>
  </section>`;
  contenido.querySelectorAll('[data-nivel]').forEach((boton) => boton.addEventListener('click', () => iniciar(Number(boton.dataset.nivel))));
}

function campoRespuesta(item) {
  if (item.tipo === 'completar') return `<label class="campo"><span>Tu respuesta</span><input class="campo-texto" id="respuesta-texto" required autocomplete="off"></label>`;
  const opciones = item.tipo === 'vf' ? ['Verdadero', 'Falso'] : item.opciones;
  return `<fieldset class="quiz__opciones"><legend>Selecciona una respuesta</legend>${opciones.map((opcion, indice) => {
    const valor = item.tipo === 'vf' ? String(indice === 0) : String(indice);
    return `<label class="quiz__opcion"><input type="radio" name="respuesta" value="${valor}" required><span>${ui.escapar(opcion)}</span></label>`;
  }).join('')}</fieldset>`;
}

function renderizarPregunta() {
  contenido.innerHTML = `<section class="quiz pila"><div class="quiz__cabecera"><h1>Nivel ${sesion.nivel}</h1><span class="badge">Pregunta ${sesion.respondidas + 1} de ${sesion.total}</span></div>
    <form id="form-respuesta" class="tarjeta pila"><h2>${ui.escapar(pregunta.enunciado)}</h2>${campoRespuesta(pregunta)}<div id="retroalimentacion"></div><div class="quiz__acciones"><button class="btn btn--primario" type="submit">Responder</button></div></form></section>`;
  document.getElementById('form-respuesta').addEventListener('submit', responder);
}

async function iniciar(nivel) {
  try {
    ui.cargando(true);
    const datos = await api.llamar('POST', '/api/quiz/iniciar', { temaId, nivel });
    if (!Array.isArray(datos.preguntas) || datos.preguntas.length === 0) throw new Error('El quiz no contiene preguntas disponibles');
    sesion = { id: datos.sesionId, nivel, preguntas: datos.preguntas, total: datos.preguntas.length, respondidas: 0 };
    pregunta = sesion.preguntas[0];
    renderizarPregunta();
  } catch (err) { ui.aviso(err.message, 'error'); } finally { ui.cargando(false); }
}

async function responder(evento) {
  evento.preventDefault();
  const texto = document.getElementById('respuesta-texto');
  const marcada = contenido.querySelector('input[name="respuesta"]:checked');
  const respuesta = texto ? texto.value.trim() : marcada?.value;
  if (respuesta === undefined || respuesta === '') return ui.aviso('Selecciona o escribe una respuesta', 'advertencia');
  try {
    ui.cargando(true);
    const datos = await api.llamar('POST', '/api/quiz/responder', { sesionId: sesion.id, preguntaId: pregunta.id, respuesta });
    mostrarRetro({ correcto: datos.correcto, explicacion: datos.retroalimentacion || `Respuesta correcta: ${datos.correcta}`, enlaceTema: `/paginas/tema.html?id=${encodeURIComponent(temaId)}` });
    contenido.querySelectorAll('input, button[type="submit"]').forEach((control) => { control.disabled = true; });
    sesion.respondidas += 1;
    const siguiente = sesion.preguntas[sesion.respondidas] || null;
    const boton = document.createElement('button');
    boton.className = 'btn btn--primario';
    boton.textContent = siguiente ? 'Siguiente pregunta' : 'Ver resultado';
    boton.addEventListener('click', () => siguiente ? avanzar(siguiente) : finalizar());
    contenido.querySelector('.quiz__acciones').appendChild(boton);
  } catch (err) { ui.aviso(err.message, 'error'); } finally { ui.cargando(false); }
}

function avanzar(siguiente) { pregunta = siguiente; renderizarPregunta(); }

async function finalizar() {
  try {
    ui.cargando(true);
    const resultado = await api.llamar('POST', '/api/quiz/finalizar', { sesionId: sesion.id });
    const accion = await mostrarResumen({ titulo: resultado.aprobado ? '¡Nivel superado!' : 'Sigue practicando', aciertos: resultado.aciertos, errores: resultado.total - resultado.aciertos, recomendaciones: resultado.aprobado ? `Ganaste ${resultado.puntosGanados} puntos.` : (resultado.repasar.join(' ') || 'Repasa el tema antes de volver a intentarlo.'), enlaceTema: `/paginas/tema.html?id=${encodeURIComponent(temaId)}` });
    if (accion === 'repetir') await iniciar(sesion.nivel); else window.location.href = `/paginas/actividades.html?temaId=${encodeURIComponent(temaId)}`;
  } catch (err) { ui.aviso(err.message, 'error'); } finally { ui.cargando(false); }
}

if (!temaId) {
  contenido.innerHTML = '<div class="vacio"><h1>Selecciona un tema</h1><p>Abre el quiz desde las actividades de un tema.</p><a class="btn btn--primario" href="/paginas/asignaturas.html">Ver asignaturas</a></div>';
} else {
  try { renderizarInicio(await api.llamar('GET', `/api/quiz/estado?temaId=${encodeURIComponent(temaId)}`)); } catch (err) { ui.aviso(err.message, 'error'); }
}
