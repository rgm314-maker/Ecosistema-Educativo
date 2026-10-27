import { montarPlantilla } from '../nucleo/plantilla.js';
import * as api from '../nucleo/api.js';
import * as ui from '../nucleo/ui.js';
import * as util from '../nucleo/util.js';

await montarPlantilla({ titulo: 'Reportes', roles: ['admin'] });
const contenedor = document.getElementById('reportes');
let reportes = [];
let referencias = new Map();
let contextos = new Map();

async function cargar() {
  try {
    ui.cargando(true);
    const [todos, hilos, respuestas] = await Promise.all([
      api.listar('reportes'), api.listar('foros-hilos'), api.listar('foros-respuestas')
    ]);
    reportes = todos.filter((item) => item.estado === 'pendiente');
    referencias = new Map([...hilos, ...respuestas].map((item) => [item.id, item]));
    const resultados = await Promise.all(reportes.filter((item) => item.tipo === 'mensaje').map(async (reporte) => {
      try {
        return [reporte.id, await api.llamar('GET', `/api/mensajes/reporte/${encodeURIComponent(reporte.id)}`)];
      } catch (error) {
        return [reporte.id, { error: error.message }];
      }
    }));
    contextos = new Map(resultados);
    renderizar();
  } catch (error) { ui.aviso(error.message, 'error'); } finally { ui.cargando(false); }
}

function contextoMensaje(reporte) {
  const contexto = contextos.get(reporte.id);
  if (!contexto || contexto.error) return `<p>${ui.escapar(contexto?.error || 'El mensaje ya no está disponible.')}</p>`;
  const mensajes = [...(contexto.anteriores || []), contexto.mensaje];
  return `<ol class="reporte__contexto">${mensajes.map((mensaje) => {
    const reportado = mensaje.id === contexto.mensaje.id;
    return `<li class="reporte__mensaje${reportado ? ' reporte__mensaje--reportado' : ''}"><div class="reporte__mensaje-meta"><strong>${reportado ? 'Mensaje reportado' : ui.escapar(mensaje.autorId)}</strong><small>${util.fechaLarga(mensaje.fecha)}</small></div><div>${util.formatoBasico(mensaje.texto)}</div></li>`;
  }).join('')}</ol>`;
}

function renderizar() {
  if (!reportes.length) {
    contenedor.innerHTML = '<div class="vacio"><h2>No hay reportes pendientes</h2></div>';
    return;
  }
  contenedor.innerHTML = reportes.map((reporte) => {
    const esMensaje = reporte.tipo === 'mensaje';
    const contenido = referencias.get(reporte.referenciaId);
    const contexto = contextos.get(reporte.id);
    const cuerpo = esMensaje ? contextoMensaje(reporte) : (contenido ? util.formatoBasico(contenido.texto) : '<p>El contenido ya no está disponible.</p>');
    const acciones = esMensaje
      ? `<button class="btn btn--secundario" data-accion="descartar" data-id="${ui.escapar(reporte.id)}">Descartar</button><button class="btn btn--secundario" data-accion="desactivar" data-id="${ui.escapar(reporte.id)}" ${contexto?.mensaje ? '' : 'disabled'}>Desactivar usuario</button><button class="btn btn--primario" data-accion="ocultar-mensaje" data-id="${ui.escapar(reporte.id)}" ${contexto?.mensaje ? '' : 'disabled'}>Ocultar mensaje</button>`
      : `<button class="btn btn--secundario" data-accion="descartar" data-id="${ui.escapar(reporte.id)}">Descartar</button><button class="btn btn--primario" data-accion="ocultar-foro" data-id="${ui.escapar(reporte.id)}" ${contenido ? '' : 'disabled'}>Ocultar contenido</button>`;
    return `<article class="tarjeta reporte"><div class="reporte__meta"><span class="badge">${ui.escapar(reporte.tipo)}</span><small>${util.fechaLarga(reporte.fecha)}</small></div><div><strong>Motivo:</strong>${util.formatoBasico(reporte.motivo)}</div><div class="reporte__contenido">${cuerpo}</div><div class="reporte__acciones">${acciones}</div></article>`;
  }).join('');
}

contenedor.addEventListener('click', async (evento) => {
  const boton = evento.target.closest('[data-accion]');
  if (!boton) return;
  const reporte = reportes.find((item) => item.id === boton.dataset.id);
  if (!reporte) return;
  if (boton.dataset.accion === 'desactivar' && !await ui.confirmar('¿Desactivar al autor de este mensaje?')) return;
  try {
    ui.cargando(true);
    if (boton.dataset.accion === 'ocultar-mensaje') {
      await api.llamar('POST', '/api/mensajes/ocultar', { referenciaId: reporte.referenciaId });
    } else if (boton.dataset.accion === 'desactivar') {
      const autorId = contextos.get(reporte.id)?.mensaje?.autorId;
      if (!autorId) throw new Error('No se encontró al autor del mensaje');
      await api.actualizar('usuarios', autorId, { activo: false });
    } else if (boton.dataset.accion === 'ocultar-foro') {
      const coleccion = reporte.referenciaId.startsWith('fre_') ? 'foros-respuestas' : 'foros-hilos';
      await api.actualizar(coleccion, reporte.referenciaId, { [coleccion === 'foros-hilos' ? 'oculto' : 'oculta']: true });
    }
    await api.actualizar('reportes', reporte.id, { estado: 'resuelto' });
    const mensajes = {
      descartar: 'Reporte descartado', desactivar: 'Usuario desactivado',
      'ocultar-mensaje': 'Mensaje ocultado', 'ocultar-foro': 'Contenido ocultado'
    };
    ui.aviso(mensajes[boton.dataset.accion], 'exito');
    await cargar();
  } catch (error) { ui.aviso(error.message, 'error'); } finally { ui.cargando(false); }
});

cargar();
