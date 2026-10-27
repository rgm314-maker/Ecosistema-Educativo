// Campana, consulta periódica y avisos del navegador

import * as api from './api.js';
import * as ui from './ui.js';
import * as util from './util.js';

const INTERVALO_MS = 60 * 1000;
let montada = false;
let notificaciones = [];

function actualizarMensajesNoLeidos(valor) {
  const badge = document.getElementById('mensajes-no-leidos');
  if (!badge) return;
  const total = Number(valor?.noLeidos ?? valor?.total ?? valor ?? 0);
  badge.textContent = String(total);
  badge.classList.toggle('oculto', total <= 0);
}

function avisarEnNavegador(nuevas) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  for (const item of nuevas) {
    const aviso = new Notification('Ecosistema Educativo', {
      body: item.mensaje,
      tag: item.id
    });
    aviso.onclick = () => {
      window.focus();
      if (item.enlace) window.location.href = item.enlace;
      aviso.close();
    };
  }
}

function renderizar() {
  const raiz = document.getElementById('campana-notificaciones');
  if (!raiz) return;
  const pendientes = notificaciones.filter((item) => !item.leida).length;
  const recientes = [...notificaciones].sort((a, b) => new Date(b.fecha) - new Date(a.fecha)).slice(0, 10);
  const permiso = !('Notification' in window) ? 'no-disponible' : Notification.permission;
  raiz.innerHTML = `<button id="abrir-campana" class="btn btn--secundario btn--pequeno campana__boton" type="button" aria-expanded="false" aria-controls="panel-campana" aria-label="Notificaciones">🔔${pendientes ? `<span class="campana__conteo">${pendientes}</span>` : ''}</button>
    <section id="panel-campana" class="campana__panel" hidden><div class="campana__cabecera"><strong>Notificaciones</strong>${pendientes ? '<button class="btn btn--texto btn--pequeno" data-accion="leer-todas" type="button">Marcar leídas</button>' : ''}</div>
    ${permiso !== 'granted' && permiso !== 'no-disponible' ? '<button class="btn btn--secundario" data-accion="activar-avisos" type="button">Activar avisos del navegador</button>' : ''}
    <div class="campana__lista">${recientes.length ? recientes.map((item) => `<a class="campana__item${item.leida ? '' : ' campana__item--nueva'}" href="${ui.escapar(item.enlace || '#')}" data-id="${ui.escapar(item.id)}"><span>${ui.escapar(item.mensaje)}</span><small class="texto-suave">${util.fechaRelativa(item.fecha)}</small></a>`).join('') : '<p class="texto-suave">No tienes notificaciones.</p>'}</div></section>`;
}

async function consultar() {
  const [nuevas, lista, mensajes] = await Promise.all([
    api.llamar('GET', '/api/agenda/recordatorios').catch(() => []),
    api.llamar('GET', '/api/notificaciones').catch(() => null),
    api.llamar('GET', '/api/mensajes/no-leidos').catch(() => null)
  ]);
  avisarEnNavegador(nuevas || []);
  if (Array.isArray(lista)) notificaciones = lista;
  if (mensajes !== null) actualizarMensajesNoLeidos(mensajes);
  renderizar();
}

export async function noLeidas() {
  const lista = await api.llamar('GET', '/api/notificaciones');
  return lista.filter((item) => !item.leida).length;
}

export async function montarCampana() {
  if (montada || !document.getElementById('campana-notificaciones')) return;
  montada = true;
  await consultar();
  const raiz = document.getElementById('campana-notificaciones');
  raiz.addEventListener('click', async (evento) => {
    const abrir = evento.target.closest('#abrir-campana');
    if (abrir) {
      const panel = document.getElementById('panel-campana');
      panel.hidden = !panel.hidden;
      abrir.setAttribute('aria-expanded', String(!panel.hidden));
      return;
    }
    const accion = evento.target.closest('[data-accion]')?.dataset.accion;
    if (accion === 'activar-avisos') {
      const permiso = await Notification.requestPermission();
      ui.aviso(permiso === 'granted' ? 'Avisos del navegador activados' : 'No se activaron los avisos', permiso === 'granted' ? 'exito' : 'info');
      renderizar();
    } else if (accion === 'leer-todas') {
      await api.llamar('POST', '/api/notificaciones/leidas');
      await consultar();
    }
  });
  raiz.addEventListener('click', async (evento) => {
    const enlace = evento.target.closest('.campana__item[data-id]');
    if (enlace) {
      evento.preventDefault();
      await api.llamar('POST', `/api/notificaciones/${encodeURIComponent(enlace.dataset.id)}/leida`);
      if (enlace.getAttribute('href') !== '#') window.location.href = enlace.href;
      else await consultar();
    }
  });
  window.setInterval(consultar, INTERVALO_MS);
}

export default { montarCampana, noLeidas };
