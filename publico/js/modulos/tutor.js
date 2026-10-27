import { montarPlantilla } from '../nucleo/plantilla.js';
import * as api from '../nucleo/api.js';
import * as ui from '../nucleo/ui.js';
import * as util from '../nucleo/util.js';
import { obtenerTemaActividad } from '../nucleo/selector-tema.js';
import { cambiarEstado, decir } from '../nucleo/avatar.js';

await montarPlantilla({ titulo: 'Tutor socrático', roles: ['estudiante'] });

const tituloTema = document.getElementById('temaTutor');
const preguntasGuia = document.getElementById('preguntasGuia');
const mensajesTutor = document.getElementById('mensajesTutor');
const pensando = document.getElementById('tutorPensando');
const formulario = document.getElementById('formTutor');
const pregunta = document.getElementById('preguntaTutor');
const contador = document.getElementById('contadorTutor');
const botonEnviar = document.getElementById('btnEnviarTutor');
const botonNueva = document.getElementById('btnNuevaConversacion');

let tema = null;
let historial = [];
let enviando = false;

function crearBurbuja(mensaje) {
  const burbuja = document.createElement('article');
  burbuja.className = `tutor__mensaje tutor__mensaje--${mensaje.rol}`;

  const autor = document.createElement('span');
  autor.className = 'tutor__autor';
  autor.textContent = mensaje.rol === 'estudiante' ? 'Tú' : 'Tutor';

  const contenido = document.createElement('div');
  contenido.className = 'tutor__texto';
  if (mensaje.rol === 'tutor') contenido.innerHTML = util.formatoBasico(mensaje.texto);
  else contenido.textContent = mensaje.texto;

  burbuja.append(autor, contenido);
  return burbuja;
}

function renderizarMensajes() {
  mensajesTutor.replaceChildren();
  if (!historial.length) {
    const inicio = document.createElement('div');
    inicio.className = 'tutor__inicio';
    const texto = document.createElement('p');
    texto.textContent = 'Selecciona una pregunta guía o escribe tu duda.';
    inicio.appendChild(texto);
    mensajesTutor.appendChild(inicio);
    return;
  }

  historial.forEach((mensaje) => mensajesTutor.appendChild(crearBurbuja(mensaje)));
  mensajesTutor.scrollTop = mensajesTutor.scrollHeight;
}

function mostrarMensajeTemporal(texto) {
  const mensaje = crearBurbuja({ rol: 'tutor', texto });
  mensaje.classList.add('tutor__mensaje--aviso');
  mensajesTutor.appendChild(mensaje);
  mensajesTutor.scrollTop = mensajesTutor.scrollHeight;
}

function actualizarControles() {
  const disponible = Boolean(tema) && !enviando;
  pregunta.disabled = !disponible;
  botonEnviar.disabled = !disponible || !pregunta.value.trim();
  botonNueva.disabled = enviando;
  preguntasGuia.querySelectorAll('button').forEach((boton) => {
    boton.disabled = !disponible;
  });
  pensando.hidden = !enviando;
}

async function enviarMensaje(textoExplicito = '') {
  const texto = String(textoExplicito || pregunta.value).trim().slice(0, 1000);
  if (!tema || !texto || enviando) return;

  historial.push({ rol: 'estudiante', texto });
  pregunta.value = '';
  contador.textContent = '0/1000';
  enviando = true;
  cambiarEstado('pensando');
  renderizarMensajes();
  actualizarControles();

  try {
    const resultado = await api.ia('tutor', {
      temaId: tema.id,
      historial: historial.slice(-10)
    });
    const respuesta = String(resultado?.respuesta || '').replace(/\$/g, '').trim();
    if (!respuesta) throw new Error('El tutor no devolvió una respuesta');
    historial.push({ rol: 'tutor', texto: respuesta });
    renderizarMensajes();
    cambiarEstado('hablando');
    decir(respuesta);
  } catch (error) {
    const limiteAlcanzado = error.estado === 429 || /l[ií]mite diario|429/i.test(error.message || '');
    mostrarMensajeTemporal(limiteAlcanzado
      ? 'Por hoy alcanzaste el límite de consultas. Puedes continuar nuevamente mañana.'
      : 'No pude responder en este momento. Inténtalo de nuevo en unos minutos.');
    cambiarEstado('reposo');
  } finally {
    enviando = false;
    actualizarControles();
    pregunta.focus();
  }
}

function mostrarTema() {
  tituloTema.textContent = tema.titulo;
  preguntasGuia.replaceChildren();
  const guias = (Array.isArray(tema.preguntasGuia) ? tema.preguntasGuia : [])
    .map((texto) => String(texto || '').trim())
    .filter(Boolean)
    .slice(0, 3);
  const sugerencias = [
    `¿Cuál es la idea principal de ${tema.titulo}?`,
    `¿Cómo puedo relacionar los conceptos de ${tema.titulo}?`,
    `¿Qué error frecuente debo evitar en ${tema.titulo}?`
  ];
  sugerencias.forEach((texto) => {
    if (guias.length < 3 && !guias.includes(texto)) guias.push(texto);
  });

  guias.forEach((texto) => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'chip tutor__guia';
    chip.textContent = texto;
    chip.addEventListener('click', () => enviarMensaje(texto));
    preguntasGuia.appendChild(chip);
  });
  pregunta.disabled = false;
  actualizarControles();
  pregunta.focus();
}

pregunta.addEventListener('input', () => {
  contador.textContent = `${pregunta.value.length}/1000`;
  actualizarControles();
});
pregunta.addEventListener('keydown', (evento) => {
  if (evento.key === 'Enter' && !evento.shiftKey) {
    evento.preventDefault();
    formulario.requestSubmit();
  }
});
formulario.addEventListener('submit', (evento) => {
  evento.preventDefault();
  enviarMensaje();
});
botonNueva.addEventListener('click', () => {
  historial = [];
  pregunta.value = '';
  contador.textContent = '0/1000';
  renderizarMensajes();
  actualizarControles();
  pregunta.focus();
});

tema = await obtenerTemaActividad();
if (tema) mostrarTema();
else {
  tituloTema.textContent = 'No seleccionaste un tema';
  ui.aviso('Selecciona un tema para conversar con el tutor', 'advertencia');
  actualizarControles();
}
