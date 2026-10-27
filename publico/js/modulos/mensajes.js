import { montarPlantilla } from '../nucleo/plantilla.js';
import * as api from '../nucleo/api.js';
import * as ui from '../nucleo/ui.js';
import * as util from '../nucleo/util.js';

const usuario = await montarPlantilla({ titulo: 'Mensajes', roles: ['sesion'] });
const pagina = document.getElementById('contenido');
const listaConversaciones = document.getElementById('conversaciones');
const contenedorMensajes = document.getElementById('mensajes');
const form = document.getElementById('form-mensaje');
const texto = document.getElementById('texto-mensaje');
const modal = document.getElementById('modal-contactos');
const modalDifusion = document.getElementById('modal-difusion');
let conversaciones = [];
let contactos = [];
let grupos = [];
let conversacionActiva = null;
let mensajes = [];
let hayAnteriores = false;
let versionConversacion = 0;
const cargasMensajes = new Set();

function obtenerLista(respuesta, clave) {
  if (Array.isArray(respuesta)) return respuesta;
  return Array.isArray(respuesta?.[clave]) ? respuesta[clave] : [];
}

function nombrePersona(persona) {
  return persona?.nombreCompleto || [persona?.nombre, persona?.apellido].filter(Boolean).join(' ') || persona?.correo || 'Usuario';
}

function contactoDe(conversacion) {
  if (conversacion.contacto) return conversacion.contacto;
  const ids = conversacion.participantes || [];
  const id = ids.find((valor) => valor !== usuario.id);
  return contactos.find((item) => item.id === id) || { id, nombre: conversacion.nombre || 'Conversación' };
}

function otroParticipante(conversacion) {
  return conversacion?.participantes?.find((id) => id !== usuario.id);
}

function totalNoLeidos(conversacion) {
  return Number(conversacion.noLeidos?.[usuario.id] ?? conversacion.noLeidos ?? 0);
}

function horaCorta(fecha) {
  if (!fecha) return '';
  return new Intl.DateTimeFormat('es-EC', { hour: '2-digit', minute: '2-digit' }).format(new Date(fecha));
}

function fechaDia(fecha) {
  return new Intl.DateTimeFormat('es-EC', { dateStyle: 'long' }).format(new Date(fecha));
}

function textoConEnlaces(valor) {
  const entrada = String(valor || '');
  const patron = /https?:\/\/[^\s<>]+/gi;
  let salida = '';
  let posicion = 0;
  for (const coincidencia of entrada.matchAll(patron)) {
    salida += ui.escapar(entrada.slice(posicion, coincidencia.index)).replace(/\n/g, '<br>');
    let enlace = coincidencia[0];
    const sufijo = enlace.match(/[.,;:!?\)\]]+$/)?.[0] || '';
    enlace = enlace.slice(0, enlace.length - sufijo.length);
    salida += `<a href="${ui.escapar(enlace)}" rel="noopener" target="_blank">${ui.escapar(enlace)}</a>${ui.escapar(sufijo)}`;
    posicion = coincidencia.index + coincidencia[0].length;
  }
  return salida + ui.escapar(entrada.slice(posicion)).replace(/\n/g, '<br>');
}

function renderizarConversaciones() {
  const busqueda = util.normalizar(document.getElementById('buscar').value);
  const visibles = conversaciones.filter((item) => {
    const contacto = contactoDe(item);
    return util.normalizar(`${nombrePersona(contacto)} ${item.ultimo?.texto || ''}`).includes(busqueda);
  });
  if (!visibles.length) {
    listaConversaciones.innerHTML = '<div class="vacio"><p>No hay conversaciones.</p></div>';
    return;
  }
  listaConversaciones.innerHTML = visibles.map((item) => {
    const contacto = contactoDe(item);
    const pendientes = totalNoLeidos(item);
    return `<button class="conversacion${item.id === conversacionActiva?.id ? ' conversacion--activa' : ''}" type="button" data-id="${ui.escapar(item.id)}"><strong class="conversacion__nombre">${ui.escapar(nombrePersona(contacto))}</strong><span class="conversacion__hora">${horaCorta(item.ultimo?.fecha)}</span><span class="conversacion__ultimo">${ui.escapar(item.ultimo?.texto || 'Sin mensajes')}</span>${pendientes ? `<span class="conversacion__conteo">${pendientes}</span>` : '<span></span>'}</button>`;
  }).join('');
}

function renderizarMensajes(conservarPosicion = false) {
  const alturaAnterior = contenedorMensajes.scrollHeight;
  const desplazamientoAnterior = contenedorMensajes.scrollTop;
  let diaAnterior = '';
  contenedorMensajes.innerHTML = mensajes.map((item) => {
    const dia = new Date(item.fecha).toDateString();
    const separador = dia !== diaAnterior ? `<div class="chat__dia">${ui.escapar(fechaDia(item.fecha))}</div>` : '';
    diaAnterior = dia;
    const mia = item.autorId === usuario.id;
    const reportar = mia ? '' : `<div class="burbuja__acciones"><button class="btn btn--texto btn--pequeno burbuja__reportar" type="button" data-reportar="${ui.escapar(item.id)}">Reportar</button></div>`;
    return `${separador}<article class="burbuja${mia ? ' burbuja--mia' : ''}"><div>${item.oculto ? '<em>Mensaje oculto</em>' : textoConEnlaces(item.texto)}</div><small class="burbuja__hora">${horaCorta(item.fecha)}</small>${reportar}</article>`;
  }).join('');
  if (conservarPosicion) contenedorMensajes.scrollTop = contenedorMensajes.scrollHeight - alturaAnterior + desplazamientoAnterior;
  else contenedorMensajes.scrollTop = contenedorMensajes.scrollHeight;
  document.getElementById('anteriores').classList.toggle('oculto', !hayAnteriores);
}

async function marcarLeido(conversacionId = conversacionActiva?.id) {
  if (!conversacionId) return;
  await api.llamar('POST', `/api/mensajes/${encodeURIComponent(conversacionId)}/leido`);
  const conversacion = conversaciones.find((item) => item.id === conversacionId);
  if (conversacion) conversacion.noLeidos = 0;
  renderizarConversaciones();
}

async function cargarConversaciones() {
  const respuesta = await api.llamar('GET', '/api/mensajes/conversaciones');
  conversaciones = obtenerLista(respuesta, 'conversaciones');
  if (conversacionActiva) conversacionActiva = conversaciones.find((item) => item.id === conversacionActiva.id) || conversacionActiva;
  renderizarConversaciones();
  actualizarControlesConversacion();
}

function actualizarControlesConversacion() {
  const boton = document.getElementById('alternar-bloqueo');
  const enviar = form.querySelector('[type="submit"]');
  const activa = Boolean(conversacionActiva);
  const bloqueada = Boolean(conversacionActiva?.bloqueadoPorMi || conversacionActiva?.bloqueadoPorOtro);
  boton.classList.toggle('oculto', !activa);
  boton.textContent = conversacionActiva?.bloqueadoPorMi ? 'Desbloquear' : 'Bloquear';
  texto.disabled = !activa || bloqueada;
  enviar.disabled = !activa || bloqueada;
  if (activa) {
    const contacto = contactoDe(conversacionActiva);
    const estado = bloqueada ? ' · Mensajería bloqueada' : '';
    document.getElementById('detalle-contacto').textContent = `${contacto.rol || ''}${estado}`;
  }
}

async function cargarMensajes({ anteriores = false, nuevos = false } = {}) {
  if (!conversacionActiva) return;
  const conversacionId = conversacionActiva.id;
  const version = versionConversacion;
  const modo = anteriores ? 'anteriores' : nuevos ? 'nuevos' : 'inicio';
  const claveCarga = `${version}:${modo}`;
  if (cargasMensajes.has(claveCarga)) return;
  cargasMensajes.add(claveCarga);
  try {
    const params = new URLSearchParams();
    if (anteriores && mensajes[0]?.fecha) params.set('antes', mensajes[0].fecha);
    if (nuevos && mensajes.at(-1)?.fecha) params.set('desde', mensajes.at(-1).fecha);
    const respuesta = await api.llamar('GET', `/api/mensajes/${encodeURIComponent(conversacionId)}${params.size ? `?${params}` : ''}`);
    if (version !== versionConversacion || conversacionActiva?.id !== conversacionId) return;
    const recibidos = obtenerLista(respuesta, 'mensajes');
    if (!nuevos) hayAnteriores = respuesta?.hayMas ?? recibidos.length > 0;
    const porId = new Map((anteriores ? [...recibidos, ...mensajes] : [...mensajes, ...recibidos]).map((item) => [item.id, item]));
    mensajes = [...porId.values()].sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
    renderizarMensajes(anteriores);
    if (!document.hidden) await marcarLeido(conversacionId);
  } catch (error) { ui.aviso(error.message, 'error'); } finally { cargasMensajes.delete(claveCarga); }
}

async function abrirConversacion(id) {
  conversacionActiva = conversaciones.find((item) => item.id === id);
  if (!conversacionActiva) return;
  versionConversacion++;
  mensajes = [];
  const contacto = contactoDe(conversacionActiva);
  document.getElementById('nombre-contacto').textContent = nombrePersona(contacto);
  document.getElementById('detalle-contacto').textContent = contacto.rol || '';
  form.classList.remove('oculto');
  pagina.classList.add('mensajes--chat-activo');
  renderizarConversaciones();
  actualizarControlesConversacion();
  await cargarMensajes();
  if (!texto.disabled) texto.focus();
}

async function cargarContactos() {
  contactos = obtenerLista(await api.llamar('GET', '/api/mensajes/contactos'), 'contactos');
}

function renderizarContactos() {
  const busqueda = util.normalizar(document.getElementById('buscar-contacto').value);
  const visibles = contactos.filter((item) => util.normalizar(`${nombrePersona(item)} ${item.rol || ''}`).includes(busqueda));
  document.getElementById('contactos').innerHTML = visibles.length ? visibles.map((item) => `<button class="contacto" type="button" data-id="${ui.escapar(item.id)}"><strong>${ui.escapar(nombrePersona(item))}</strong><span class="texto-suave">${ui.escapar(item.rol || '')}</span></button>`).join('') : '<p class="texto-suave">No se encontraron contactos.</p>';
}

async function reportarMensaje(mensajeId) {
  if (!conversacionActiva) return;
  const contenido = document.createElement('label');
  contenido.className = 'campo';
  contenido.innerHTML = '<span>Motivo del reporte</span><textarea rows="4" maxlength="5000" required></textarea>';
  const motivo = contenido.querySelector('textarea');
  const accion = await ui.modal({
    titulo: 'Reportar mensaje',
    contenido,
    acciones: [
      { texto: 'Cancelar', valor: null, clase: 'btn--secundario' },
      { texto: 'Enviar reporte', valor: 'reportar', clase: 'btn--primario' }
    ]
  });
  if (accion !== 'reportar') return;
  const valor = motivo.value.trim();
  if (!valor) { ui.aviso('Escribe el motivo del reporte', 'error'); return; }
  await api.crear('reportes', {
    tipo: 'mensaje',
    referenciaId: `${conversacionActiva.id}/${mensajeId}`,
    motivo: valor
  });
  ui.aviso('Mensaje reportado', 'exito');
}

listaConversaciones.addEventListener('click', (evento) => {
  const boton = evento.target.closest('[data-id]');
  if (boton) abrirConversacion(boton.dataset.id);
});
document.getElementById('buscar').addEventListener('input', renderizarConversaciones);
document.getElementById('volver').addEventListener('click', () => pagina.classList.remove('mensajes--chat-activo'));
document.getElementById('anteriores').addEventListener('click', () => cargarMensajes({ anteriores: true }));
contenedorMensajes.addEventListener('click', async (evento) => {
  const boton = evento.target.closest('[data-reportar]');
  if (!boton) return;
  try { await reportarMensaje(boton.dataset.reportar); }
  catch (error) { ui.aviso(error.message, 'error'); }
});
document.getElementById('alternar-bloqueo').addEventListener('click', async () => {
  if (!conversacionActiva) return;
  const contactoId = otroParticipante(conversacionActiva);
  const desbloquear = conversacionActiva.bloqueadoPorMi;
  const confirmado = await ui.confirmar(`${desbloquear ? '¿Desbloquear' : '¿Bloquear'} a ${nombrePersona(contactoDe(conversacionActiva))}?`);
  if (!confirmado) return;
  try {
    if (desbloquear) await api.llamar('DELETE', `/api/mensajes/bloquear/${encodeURIComponent(contactoId)}`);
    else await api.llamar('POST', '/api/mensajes/bloquear', { usuarioId: contactoId });
    await cargarConversaciones();
    ui.aviso(desbloquear ? 'Usuario desbloqueado' : 'Usuario bloqueado', 'exito');
  } catch (error) { ui.aviso(error.message, 'error'); }
});
document.getElementById('nueva-conversacion').addEventListener('click', async () => {
  try { if (!contactos.length) await cargarContactos(); renderizarContactos(); modal.showModal(); }
  catch (error) { ui.aviso(error.message, 'error'); }
});
document.getElementById('cerrar-contactos').addEventListener('click', () => modal.close());
document.getElementById('buscar-contacto').addEventListener('input', renderizarContactos);
document.getElementById('contactos').addEventListener('click', async (evento) => {
  const boton = evento.target.closest('[data-id]');
  if (!boton) return;
  try {
    const respuesta = await api.llamar('POST', '/api/mensajes/conversaciones', { con: boton.dataset.id });
    const creada = respuesta.conversacion || respuesta;
    modal.close(); await cargarConversaciones(); await abrirConversacion(creada.id);
  } catch (error) { ui.aviso(error.message, 'error'); }
});
if (usuario.rol === 'docente') document.getElementById('difusion').classList.remove('oculto');
document.getElementById('difusion').addEventListener('click', async () => {
  try {
    grupos = grupos.length ? grupos : await api.listar('distributivo');
    if (!grupos.length) { ui.aviso('No tienes grupos asignados', 'info'); return; }
    document.getElementById('grupo-difusion').innerHTML = grupos.map((grupo) =>
      `<option value="${ui.escapar(grupo.id)}">${ui.escapar(`${grupo.paralelo || 'Grupo'} · ${grupo.periodo || ''}`)}</option>`
    ).join('');
    modalDifusion.showModal();
  } catch (error) { ui.aviso(error.message, 'error'); }
});
document.getElementById('cerrar-difusion').addEventListener('click', () => modalDifusion.close());
document.getElementById('form-difusion').addEventListener('submit', async (evento) => {
  evento.preventDefault();
  const campoTexto = document.getElementById('texto-difusion');
  try {
    const resultado = await api.llamar('POST', '/api/mensajes/difusion', {
      grupoId: document.getElementById('grupo-difusion').value,
      texto: campoTexto.value.trim()
    });
    modalDifusion.close();
    campoTexto.value = '';
    ui.aviso(`Mensaje enviado a ${resultado.enviados} estudiante(s)`, 'exito');
    await cargarConversaciones();
  } catch (error) { ui.aviso(error.message, 'error'); }
});
texto.addEventListener('input', () => { document.getElementById('contador').textContent = `${texto.value.length.toLocaleString('es-EC')} / 2.000`; });
texto.addEventListener('keydown', (evento) => {
  if (evento.key === 'Enter' && !evento.shiftKey) { evento.preventDefault(); form.requestSubmit(); }
});
form.addEventListener('submit', async (evento) => {
  evento.preventDefault();
  const contenido = texto.value.trim();
  if (!contenido || !conversacionActiva) return;
  try {
    const respuesta = await api.llamar('POST', `/api/mensajes/${encodeURIComponent(conversacionActiva.id)}`, { texto: contenido });
    const enviado = respuesta.mensaje || respuesta;
    mensajes = [...new Map([...mensajes, enviado].map((item) => [item.id, item])).values()]
      .sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
    texto.value = ''; texto.dispatchEvent(new Event('input')); renderizarMensajes(); await cargarConversaciones();
  } catch (error) { ui.aviso(error.message, 'error'); }
});

document.addEventListener('visibilitychange', () => { if (!document.hidden) { cargarConversaciones().catch(() => {}); cargarMensajes({ nuevos: true }); } });
window.setInterval(() => { if (!document.hidden) cargarMensajes({ nuevos: true }); }, 4000);
window.setInterval(() => { if (!document.hidden) cargarConversaciones().catch(() => {}); }, 15000);

try { await cargarContactos(); await cargarConversaciones(); }
catch (error) { ui.aviso(error.message, 'error'); }
