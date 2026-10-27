import { montarPlantilla } from '../nucleo/plantilla.js';
import * as api from '../nucleo/api.js';
import * as ui from '../nucleo/ui.js';
import * as util from '../nucleo/util.js';

const usuario = await montarPlantilla({ titulo: 'Foro', roles: ['sesion'] });
const hiloId = util.parametro('id');
const contenedorHilo = document.getElementById('hilo');
const contenedorRespuestas = document.getElementById('respuestas');
const formRespuesta = document.getElementById('form-respuesta');
const modalReporte = document.getElementById('modal-reporte');
let hilo = null;
let respuestas = [];
let pagina = 1;
let referenciaReporte = null;
const POR_PAGINA = 20;
const modera = ['docente', 'admin'].includes(usuario?.rol);

function accionesPublicacion(tipo, item) {
  const acciones = [`<button class="btn btn--texto btn--pequeno" data-accion="reportar" data-id="${item.id}">Reportar</button>`];
  if (modera && tipo === 'hilo') {
    acciones.push(`<button class="btn btn--secundario btn--pequeno" data-accion="fijar">${item.fijado ? 'Desfijar' : 'Fijar'}</button>`);
    acciones.push(`<button class="btn btn--secundario btn--pequeno" data-accion="cerrar">${item.cerrado ? 'Reabrir' : 'Cerrar'}</button>`);
    acciones.push(`<button class="btn btn--secundario btn--pequeno" data-accion="ocultar">${item.oculto ? 'Mostrar' : 'Ocultar'}</button>`);
  }
  if (modera && tipo === 'respuesta') {
    acciones.push(`<button class="btn btn--secundario btn--pequeno" data-accion="destacar" data-id="${item.id}">${item.destacada ? 'Quitar destaque' : 'Destacar'}</button>`);
    acciones.push(`<button class="btn btn--secundario btn--pequeno" data-accion="ocultar" data-id="${item.id}">${item.oculta ? 'Mostrar' : 'Ocultar'}</button>`);
  }
  return acciones.join('');
}

function renderizar() {
  contenedorHilo.innerHTML = `<article class="tarjeta publicacion ${hilo.oculto ? 'publicacion--oculta' : ''}"><div class="publicacion__cabecera"><div><h1>${ui.escapar(hilo.titulo)}</h1><small class="texto-suave">${util.fechaLarga(hilo.fecha)}</small></div>${hilo.fijado ? '<span class="badge">Fijado</span>' : ''}</div><div>${util.formatoBasico(hilo.texto)}</div><div class="publicacion__acciones">${accionesPublicacion('hilo', hilo)}</div></article>`;
  const inicio = (pagina - 1) * POR_PAGINA;
  const bloque = respuestas.slice(inicio, inicio + POR_PAGINA);
  contenedorRespuestas.innerHTML = bloque.length ? bloque.map((item) => `<article class="tarjeta publicacion ${item.destacada ? 'publicacion--destacada' : ''} ${item.oculta ? 'publicacion--oculta' : ''}"><div class="publicacion__cabecera"><small class="texto-suave">${util.fechaLarga(item.fecha)}</small>${item.destacada ? '<span class="badge">Destacada</span>' : ''}</div><div>${util.formatoBasico(item.texto)}</div><div class="publicacion__acciones">${accionesPublicacion('respuesta', item)}</div></article>`).join('') : '<p class="texto-suave">Todavía no hay respuestas.</p>';
  const paginas = Math.ceil(respuestas.length / POR_PAGINA);
  document.getElementById('paginacion').innerHTML = Array.from({ length: paginas }, (_, indice) => `<button class="btn ${pagina === indice + 1 ? 'btn--primario' : 'btn--secundario'} btn--pequeno" data-pagina="${indice + 1}">${indice + 1}</button>`).join('');
  formRespuesta.hidden = Boolean(hilo.cerrado);
}

async function cargar() {
  if (!hiloId) return ui.aviso('Falta el identificador del hilo', 'error');
  try {
    ui.cargando(true);
    [hilo, respuestas] = await Promise.all([api.obtener('foros-hilos', hiloId), api.listar('foros-respuestas', { hiloId })]);
    respuestas.sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
    renderizar();
  } catch (error) { ui.aviso(error.message, 'error'); } finally { ui.cargando(false); }
}

document.getElementById('contenido').addEventListener('click', async (evento) => {
  const boton = evento.target.closest('[data-accion], [data-pagina]');
  if (!boton) return;
  if (boton.dataset.pagina) { pagina = Number(boton.dataset.pagina); renderizar(); return; }
  const id = boton.dataset.id;
  if (boton.dataset.accion === 'reportar') {
    referenciaReporte = id || hilo.id;
    modalReporte.showModal();
    return;
  }
  try {
    ui.cargando(true);
    if (id) {
      const item = respuestas.find((respuesta) => respuesta.id === id);
      const campo = boton.dataset.accion === 'destacar' ? 'destacada' : 'oculta';
      await api.actualizar('foros-respuestas', id, { [campo]: !item[campo] });
    } else {
      const campo = boton.dataset.accion === 'fijar' ? 'fijado' : boton.dataset.accion === 'cerrar' ? 'cerrado' : 'oculto';
      await api.actualizar('foros-hilos', hilo.id, { [campo]: !hilo[campo] });
    }
    await cargar();
  } catch (error) { ui.aviso(error.message, 'error'); } finally { ui.cargando(false); }
});

formRespuesta.addEventListener('submit', async (evento) => {
  evento.preventDefault();
  try {
    ui.cargando(true);
    await api.crear('foros-respuestas', { hiloId, texto: document.getElementById('respuesta').value });
    formRespuesta.reset();
    await cargar();
  } catch (error) { ui.aviso(error.message, 'error'); } finally { ui.cargando(false); }
});
document.getElementById('cancelar-reporte').addEventListener('click', () => modalReporte.close());
document.getElementById('form-reporte').addEventListener('submit', async (evento) => {
  evento.preventDefault();
  try {
    await api.crear('reportes', { tipo: 'foro', referenciaId: referenciaReporte, motivo: document.getElementById('motivo').value });
    modalReporte.close(); evento.target.reset(); ui.aviso('Reporte enviado', 'exito');
  } catch (error) { ui.aviso(error.message, 'error'); }
});

cargar();
