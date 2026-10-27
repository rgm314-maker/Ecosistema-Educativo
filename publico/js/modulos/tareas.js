import { montarPlantilla } from '../nucleo/plantilla.js';
import * as api from '../nucleo/api.js';
import * as ui from '../nucleo/ui.js';
import * as util from '../nucleo/util.js';

const usuario = await montarPlantilla({ titulo: 'Tareas', roles: ['estudiante', 'docente'] });
const esDocente = usuario?.rol === 'docente';
const lista = document.getElementById('lista-tareas');
const modal = document.getElementById('modal-tarea');
const form = document.getElementById('form-tarea');
let tareas = [];
let entregas = [];

function enlaceAdjunto(adjunto, texto = 'Descargar archivo') {
  if (!adjunto?.url) return '';
  return `<a class="btn btn--secundario btn--pequeno" href="${ui.escapar(adjunto.url)}" target="_blank" rel="noopener">${ui.escapar(adjunto.nombre || texto)}</a>`;
}

function renderizar() {
  if (!tareas.length) {
    lista.innerHTML = '<div class="vacio"><h2 class="vacio__titulo">No hay tareas disponibles</h2><p class="vacio__texto">Las nuevas tareas aparecerán aquí.</p></div>';
    return;
  }
  lista.innerHTML = tareas.sort((a, b) => new Date(a.fechaLimite) - new Date(b.fechaLimite)).map((tarea) => {
    const entrega = entregas.find((item) => item.tareaId === tarea.id);
    const entregasTarea = entregas.filter((item) => item.tareaId === tarea.id);
    const vencida = new Date() > new Date(tarea.fechaLimite);
    return `<article class="tarjeta pila${vencida && !entrega ? ' tarea--vencida' : ''}">
      <div class="tarea__cabecera"><div><h2>${ui.escapar(tarea.titulo)}</h2><p class="texto-suave">Entrega: ${ui.escapar(util.fechaLarga(tarea.fechaLimite))}</p></div>
      <span class="chip ${entrega ? 'chip--exito' : vencida ? 'chip--peligro' : 'chip--primario'}">${entrega ? (entrega.tardia ? 'Entregada tarde' : 'Entregada') : vencida ? 'Vencida' : 'Pendiente'}</span></div>
      <p>${ui.escapar(tarea.descripcion)}</p><div class="tarea__acciones">${enlaceAdjunto(tarea.adjunto, 'Material adjunto')}
      ${esDocente ? `<button class="btn btn--peligro btn--pequeno eliminar-tarea" data-id="${ui.escapar(tarea.id)}" type="button">Eliminar</button>` : ''}</div>
      ${esDocente ? `<section class="tarea__entregas"><h3>Entregas (${entregasTarea.length})</h3>${entregasTarea.length ? entregasTarea.map((item) => `
        <form class="pila tarea__entrega-docente" data-entrega-id="${ui.escapar(item.id)}">
          <strong>${ui.escapar(item.estudianteNombre || item.usuarioId)}</strong>
          <p>${ui.escapar(item.texto || 'Entrega sin texto.')}</p>
          <div class="tarea__acciones">${enlaceAdjunto(item.adjunto, 'Ver archivo entregado')}<span class="chip ${item.tardia ? 'chip--peligro' : 'chip--exito'}">${item.tardia ? 'Tardía' : 'A tiempo'}</span></div>
          <label class="campo tarea__nota"><span>Calificación sobre 10</span><input name="calificacion" type="number" min="0" max="10" step="0.01" required value="${item.calificacion ?? ''}"></label>
          <label class="campo"><span>Comentario para el estudiante</span><textarea name="comentarioDocente" rows="3" maxlength="2000">${ui.escapar(item.comentarioDocente || '')}</textarea></label>
          <button class="btn btn--primario" type="submit">Guardar calificación</button>
        </form>`).join('') : '<p class="texto-suave">Todavía no existen entregas.</p>'}</section>` : ''}
      ${!esDocente ? `<form class="pila tarea__entrega" data-tarea-id="${ui.escapar(tarea.id)}">
        <label class="campo"><span>Respuesta</span><textarea name="texto" rows="4" maxlength="5000">${ui.escapar(entrega?.texto || '')}</textarea></label>
        <label class="campo"><span>Adjuntar archivo</span><input name="archivo" type="file" accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.jpg,.jpeg,.png,.webp,.mp3"></label>
        <div class="tarea__acciones">${enlaceAdjunto(entrega?.adjunto, 'Archivo entregado')}<button class="btn btn--primario" type="submit">${entrega ? 'Actualizar entrega' : 'Entregar tarea'}</button></div>
      </form>${entrega?.calificacion !== null && entrega?.calificacion !== undefined ? `<section class="tarea__calificacion"><h3>Calificación: ${ui.escapar(entrega.calificacion)} / 10</h3><p>${ui.escapar(entrega.comentarioDocente || 'Sin comentario del docente.')}</p></section>` : entrega ? '<p class="texto-suave">Tu entrega está pendiente de calificación.</p>' : ''}` : ''}</article>`;
  }).join('');
}

async function cargar() {
  try {
    ui.cargando(true);
    [tareas, entregas] = await Promise.all([
      api.listar('tareas'),
      esDocente ? api.llamar('GET', '/api/tareas/entregas') : api.listar('entregas-tareas')
    ]);
    renderizar();
  } catch (error) { ui.aviso(error.message, 'peligro'); } finally { ui.cargando(false); }
}

if (esDocente) {
  const boton = document.getElementById('nueva-tarea');
  boton.classList.remove('oculto');
  boton.addEventListener('click', async () => {
    const grupos = (await api.listar('distributivo')).filter((grupo) => grupo.docenteId === usuario.id);
    document.getElementById('grupo').innerHTML = grupos.map((grupo) => `<option value="${ui.escapar(grupo.id)}">${ui.escapar(`${grupo.paralelo} · ${grupo.periodo}`)}</option>`).join('');
    form.reset(); modal.showModal();
  });
  document.getElementById('cancelar-tarea').addEventListener('click', () => modal.close());
  form.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    try {
      ui.cargando(true);
      const archivo = document.getElementById('archivo-tarea').files[0];
      const adjunto = archivo ? await api.subir(archivo) : null;
      await api.crear('tareas', { grupoId: document.getElementById('grupo').value, titulo: document.getElementById('titulo').value, descripcion: document.getElementById('descripcion').value, fechaLimite: document.getElementById('fecha-limite').value, adjunto });
      modal.close(); await cargar(); ui.aviso('Tarea publicada para el grupo', 'exito');
    } catch (error) { ui.aviso(error.message, 'peligro'); } finally { ui.cargando(false); }
  });
}

lista.addEventListener('submit', async (evento) => {
  const formularioCalificacion = evento.target.closest('.tarea__entrega-docente');
  if (formularioCalificacion) {
    evento.preventDefault();
    try {
      ui.cargando(true);
      await api.llamar('POST', `/api/tareas/entregas/${encodeURIComponent(formularioCalificacion.dataset.entregaId)}/calificar`, {
        calificacion: formularioCalificacion.elements.calificacion.value,
        comentarioDocente: formularioCalificacion.elements.comentarioDocente.value
      });
      await cargar(); ui.aviso('Calificación guardada', 'exito');
    } catch (error) { ui.aviso(error.message, 'peligro'); } finally { ui.cargando(false); }
    return;
  }
  const formulario = evento.target.closest('.tarea__entrega');
  if (!formulario) return;
  evento.preventDefault();
  const existente = entregas.find((item) => item.tareaId === formulario.dataset.tareaId);
  try {
    ui.cargando(true);
    const archivo = formulario.elements.archivo.files[0];
    const adjunto = archivo ? await api.subir(archivo) : (existente?.adjunto || null);
    const datos = { tareaId: formulario.dataset.tareaId, texto: formulario.elements.texto.value, adjunto };
    if (existente) await api.actualizar('entregas-tareas', existente.id, datos); else await api.crear('entregas-tareas', datos);
    await cargar(); ui.aviso('Entrega guardada correctamente', 'exito');
  } catch (error) { ui.aviso(error.message, 'peligro'); } finally { ui.cargando(false); }
});

lista.addEventListener('click', async (evento) => {
  const boton = evento.target.closest('.eliminar-tarea');
  if (!boton || !await ui.confirmar('¿Eliminar esta tarea?')) return;
  try { await api.eliminar('tareas', boton.dataset.id); await cargar(); ui.aviso('Tarea eliminada', 'exito'); }
  catch (error) { ui.aviso(error.message, 'peligro'); }
});

cargar();
