import { montarPlantilla } from '../nucleo/plantilla.js';
import * as api from '../nucleo/api.js';
import * as ui from '../nucleo/ui.js';
import * as util from '../nucleo/util.js';
import { ACTIVIDADES } from '../nucleo/catalogo-actividades.js';

const usuario = await montarPlantilla({ titulo: 'Agenda', roles: ['sesion'] });
const esDocente = ['docente', 'admin'].includes(usuario?.rol);
const modal = document.getElementById('modal-evento');
const form = document.getElementById('form-evento');
let eventos = [];
let grupos = [];
let unidades = [];
let temas = [];
let intentos = [];
let calendario;

function valorFechaLocal(iso) {
  if (!iso) return '';
  const fecha = new Date(iso);
  const local = new Date(fecha.getTime() - fecha.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function colores() {
  const estilos = getComputedStyle(document.documentElement);
  return {
    tarea: estilos.getPropertyValue('--info').trim(),
    reunion: estilos.getPropertyValue('--primario').trim(),
    'fecha-limite': estilos.getPropertyValue('--error').trim(),
    recordatorio: estilos.getPropertyValue('--advertencia').trim()
  };
}

function estaCompleto(evento) {
  if (usuario?.rol !== 'estudiante' || evento.tipo !== 'fecha-limite' || !evento.actividad || !evento.temaId) return false;
  const creado = new Date(evento.fecha).getTime();
  return intentos.some((intento) => intento.actividad === evento.actividad && intento.temaId === evento.temaId && new Date(intento.fecha).getTime() >= creado);
}

function eventosCalendario() {
  const paleta = colores();
  return eventos.map((evento) => ({
    id: evento.id,
    title: `${estaCompleto(evento) ? '✓ ' : ''}${evento.titulo}`,
    start: evento.inicio,
    end: evento.fin || undefined,
    allDay: Boolean(evento.todoElDia),
    color: paleta[evento.tipo],
    contrastColor: getComputedStyle(document.documentElement).getPropertyValue('--texto-inverso').trim(),
    extendedProps: { registro: evento }
  }));
}

function renderizarSemana() {
  const ahora = new Date();
  const limite = new Date(ahora.getTime() + 7 * 24 * 60 * 60 * 1000);
  const visibles = eventos.filter((evento) => {
    const inicio = new Date(evento.inicio);
    return inicio <= limite && (inicio >= ahora || (evento.tipo === 'fecha-limite' && !estaCompleto(evento)));
  }).sort((a, b) => new Date(a.inicio) - new Date(b.inicio));
  const contenedor = document.getElementById('mi-semana');
  if (!visibles.length) {
    contenedor.innerHTML = '<p class="texto-suave">No tienes eventos próximos.</p>';
    return;
  }
  contenedor.innerHTML = visibles.map((evento) => {
    const completo = estaCompleto(evento);
    const vencido = evento.tipo === 'fecha-limite' && new Date(evento.inicio) < ahora && !completo;
    const clase = completo ? ' semana-evento--completo' : vencido ? ' semana-evento--vencido' : '';
    return `<article class="semana-evento${clase}"><strong>${completo ? '✓ ' : ''}${ui.escapar(evento.titulo)}</strong><div class="texto-suave">${util.fechaLarga(evento.inicio)}</div></article>`;
  }).join('');
}

function llenarTemas() {
  const grupoId = document.getElementById('grupo').value;
  const grupo = grupos.find((item) => item.id === grupoId);
  const idsUnidades = new Set(unidades.filter((item) => !grupo || item.asignaturaId === grupo.asignaturaId).map((item) => item.id));
  const seleccionado = document.getElementById('tema').value;
  document.getElementById('tema').innerHTML = '<option value="">Selecciona un tema</option>' + temas.filter((item) => idsUnidades.has(item.unidadId)).map((item) => `<option value="${ui.escapar(item.id)}">${ui.escapar(item.titulo)}</option>`).join('');
  document.getElementById('tema').value = seleccionado;
}

function abrir(evento = null, fecha = null) {
  form.reset();
  document.getElementById('evento-id').value = evento?.id || '';
  document.getElementById('titulo-modal').textContent = evento ? 'Editar evento' : 'Nuevo evento';
  document.getElementById('titulo').value = evento?.titulo || '';
  document.getElementById('tipo').value = evento?.tipo || 'tarea';
  document.getElementById('inicio').value = valorFechaLocal(evento?.inicio || fecha || new Date());
  document.getElementById('fin').value = valorFechaLocal(evento?.fin);
  document.getElementById('todo-el-dia').checked = Boolean(evento?.todoElDia);
  document.getElementById('recordatorio-dia').checked = evento?.recordatorios?.includes(1440) || false;
  document.getElementById('recordatorio-hora').checked = evento?.recordatorios?.includes(60) || false;
  document.getElementById('grupo').value = evento?.grupoId || '';
  llenarTemas();
  document.getElementById('actividad').value = evento?.actividad || '';
  document.getElementById('tema').value = evento?.temaId || '';
  document.getElementById('eliminar-evento').classList.toggle('oculto', !evento);
  modal.showModal();
}

async function cargar() {
  try {
    ui.cargando(true);
    const consultas = [api.listar('agenda')];
    if (esDocente) consultas.push(api.listar('distributivo'), api.listar('unidades'), api.listar('temas'));
    if (usuario?.rol === 'estudiante') consultas.push(api.listar('intentos'));
    const resultados = await Promise.all(consultas);
    eventos = resultados[0];
    let indice = 1;
    if (esDocente) {
      grupos = resultados[indice++]; unidades = resultados[indice++]; temas = resultados[indice++];
      if (usuario.rol === 'docente') grupos = grupos.filter((grupo) => grupo.docenteId === usuario.id);
      document.getElementById('campos-docente').classList.remove('oculto');
      document.getElementById('grupo').innerHTML = '<option value="">Evento personal</option>' + grupos.map((grupo) => `<option value="${ui.escapar(grupo.id)}">${ui.escapar(`${grupo.paralelo} · ${grupo.periodo}`)}</option>`).join('');
      document.getElementById('actividad').innerHTML = '<option value="">Sin actividad</option>' + ACTIVIDADES.map((actividad) => `<option value="${ui.escapar(actividad.id)}">${ui.escapar(actividad.texto)}</option>`).join('');
      llenarTemas();
    }
    if (usuario?.rol === 'estudiante') intentos = resultados[indice] || [];
    calendario.removeAllEvents();
    calendario.addEventSource(eventosCalendario());
    renderizarSemana();
  } catch (error) { ui.aviso(error.message, 'error'); } finally { ui.cargando(false); }
}

calendario = new FullCalendar.Calendar(document.getElementById('calendario'), {
  locale: 'es', firstDay: 1, initialView: 'dayGridMonth', height: 'auto',
  headerToolbar: { left: 'prev,next today', center: '', right: '' },
  footerToolbar: { left: 'dayGridMonth,timeGridWeek,listWeek', center: '', right: '' },
  buttons: {
    today: { text: 'Hoy' }, dayGridMonth: { text: 'Mes' },
    timeGridWeek: { text: 'Semana' }, listWeek: { text: 'Lista' }
  },
  datesSet(info) { document.getElementById('calendario-titulo').textContent = info.view.title; },
  dateClick(info) { abrir(null, info.date); },
  eventClick(info) {
    const evento = info.event.extendedProps.registro;
    if (evento.propietarioId !== usuario?.id) return ui.aviso('Este evento pertenece a tu grupo y solo su propietario puede editarlo', 'info');
    abrir(evento);
  }
});
calendario.render();

document.getElementById('nuevo-evento').addEventListener('click', () => abrir());
document.getElementById('cancelar-evento').addEventListener('click', () => modal.close());
document.getElementById('grupo').addEventListener('change', llenarTemas);
form.addEventListener('submit', async (eventoSubmit) => {
  eventoSubmit.preventDefault();
  const id = document.getElementById('evento-id').value;
  const recordatorios = [document.getElementById('recordatorio-dia').checked ? 1440 : null, document.getElementById('recordatorio-hora').checked ? 60 : null].filter(Boolean);
  const datos = {
    titulo: document.getElementById('titulo').value, tipo: document.getElementById('tipo').value,
    inicio: document.getElementById('inicio').value, fin: document.getElementById('fin').value || null,
    todoElDia: document.getElementById('todo-el-dia').checked, recordatorios,
    grupoId: esDocente ? document.getElementById('grupo').value || null : null,
    actividad: esDocente ? document.getElementById('actividad').value || null : null,
    temaId: esDocente ? document.getElementById('tema').value || null : null
  };
  try {
    ui.cargando(true);
    if (id) await api.actualizar('agenda', id, datos); else await api.crear('agenda', datos);
    modal.close(); await cargar(); ui.aviso('Evento guardado', 'exito');
  } catch (error) { ui.aviso(error.message, 'error'); } finally { ui.cargando(false); }
});
document.getElementById('eliminar-evento').addEventListener('click', async () => {
  const id = document.getElementById('evento-id').value;
  if (!id || !await ui.confirmar('¿Eliminar este evento?')) return;
  try { await api.eliminar('agenda', id); modal.close(); await cargar(); ui.aviso('Evento eliminado', 'exito'); }
  catch (error) { ui.aviso(error.message, 'error'); }
});

cargar();
