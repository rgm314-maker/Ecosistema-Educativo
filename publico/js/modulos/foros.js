import { montarPlantilla } from '../nucleo/plantilla.js';
import * as api from '../nucleo/api.js';
import * as ui from '../nucleo/ui.js';
import * as util from '../nucleo/util.js';

await montarPlantilla({ titulo: 'Foros', roles: ['sesion'] });

const asignatura = document.getElementById('asignatura');
const tema = document.getElementById('tema');
const lista = document.getElementById('lista-hilos');
const modal = document.getElementById('modal-hilo');
let asignaturas = [];
let temas = [];
let unidades = [];
let hilos = [];
let respuestas = [];

async function cargar() {
  try {
    ui.cargando(true);
    [asignaturas, temas, unidades, hilos, respuestas] = await Promise.all([
      api.listar('asignaturas'), api.listar('temas'), api.listar('unidades'),
      api.listar('foros-hilos'), api.listar('foros-respuestas')
    ]);
    asignatura.innerHTML = asignaturas.map((item) => `<option value="${ui.escapar(item.id)}">${ui.escapar(item.nombre)}</option>`).join('');
    actualizarTemas();
    renderizar();
  } catch (error) {
    ui.aviso(error.message, 'error');
  } finally {
    ui.cargando(false);
  }
}

function actualizarTemas() {
  const idsUnidades = new Set(unidades.filter((item) => item.asignaturaId === asignatura.value).map((item) => item.id));
  tema.innerHTML = '<option value="">Todos los temas</option>' + temas
    .filter((item) => idsUnidades.has(item.unidadId))
    .map((item) => `<option value="${ui.escapar(item.id)}">${ui.escapar(item.titulo)}</option>`).join('');
}

function renderizar() {
  const visibles = hilos
    .filter((item) => item.asignaturaId === asignatura.value && (!tema.value || item.temaId === tema.value))
    .sort((a, b) => Number(Boolean(b.fijado)) - Number(Boolean(a.fijado)) || new Date(b.ultimoMovimiento || b.fecha) - new Date(a.ultimoMovimiento || a.fecha));
  if (!visibles.length) {
    lista.innerHTML = '<div class="vacio"><h2>No hay hilos todavía</h2><p>Inicia una conversación para esta asignatura.</p></div>';
    return;
  }
  lista.innerHTML = visibles.map((hilo) => {
    const total = respuestas.filter((item) => item.hiloId === hilo.id && !item.oculta).length;
    return `<a class="tarjeta foro-hilo" href="/paginas/hilo.html?id=${encodeURIComponent(hilo.id)}">
      <div class="foro-hilo__cabecera"><h2 class="foro-hilo__titulo">${ui.escapar(hilo.titulo)}</h2><div class="foro-hilo__etiquetas">${hilo.fijado ? '<span class="badge">Fijado</span>' : ''}${hilo.cerrado ? '<span class="badge">Cerrado</span>' : ''}</div></div>
      <div>${util.formatoBasico(hilo.texto)}</div><div class="foro-hilo__meta texto-suave"><span>${total} respuestas</span><span>${util.fechaRelativa(hilo.ultimoMovimiento || hilo.fecha)}</span></div>
    </a>`;
  }).join('');
}

asignatura.addEventListener('change', () => { actualizarTemas(); renderizar(); });
tema.addEventListener('change', renderizar);
document.getElementById('nuevo-hilo').addEventListener('click', () => {
  if (!asignatura.value) return ui.aviso('No tienes asignaturas disponibles', 'advertencia');
  modal.showModal();
});
document.getElementById('cancelar-hilo').addEventListener('click', () => modal.close());
document.getElementById('form-hilo').addEventListener('submit', async (evento) => {
  evento.preventDefault();
  try {
    ui.cargando(true);
    const creado = await api.crear('foros-hilos', {
      asignaturaId: asignatura.value,
      temaId: tema.value || null,
      titulo: document.getElementById('titulo').value,
      texto: document.getElementById('texto').value
    });
    window.location.href = `/paginas/hilo.html?id=${encodeURIComponent(creado.id)}`;
  } catch (error) {
    ui.aviso(error.message, 'error');
  } finally {
    ui.cargando(false);
  }
});

cargar();
