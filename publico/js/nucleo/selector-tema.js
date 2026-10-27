// publico/js/nucleo/selector-tema.js
// Obtención del tema para actividades interactivas (por query string o selector modal)

import * as api from './api.js';
import * as ui from './ui.js';
import * as util from './util.js';

export async function obtenerTemaActividad() {
  const temaIdParam = util.parametro('temaId');

  // Si viene ?temaId= en la URL, intentar obtenerlo directamente
  if (temaIdParam) {
    try {
      const temaDirecto = await api.obtener('temas', temaIdParam);
      if (temaDirecto && temaDirecto.id) {
        return temaDirecto;
      }
    } catch {
      // Si falla, continuar al modal selector
    }
  }

  // Cargar colecciones para el selector en cascada
  ui.cargando(true);
  let asignaturas = [];
  let unidades = [];
  let temas = [];

  try {
    const [asigsRes, unisRes, temasRes] = await Promise.all([
      api.listar('asignaturas'),
      api.listar('unidades'),
      api.listar('temas')
    ]);

    asignaturas = asigsRes || [];
    unidades = (unisRes || []).filter((u) => u.visible !== false);
    // Solo temas publicados
    temas = (temasRes || []).filter((t) => t.estado === 'publicado');
  } catch (err) {
    ui.aviso(err.message || 'Error al cargar temas disponibles', 'peligro');
    return null;
  } finally {
    ui.cargando(false);
  }

  if (temas.length === 0) {
    ui.aviso('No hay temas publicados disponibles para realizar actividades', 'advertencia');
    return null;
  }

  // Construir el formulario del modal
  const divContenido = document.createElement('div');
  divContenido.className = 'pila';
  divContenido.style.gap = 'var(--espacio-m)';
  divContenido.innerHTML = `
    <p style="color: var(--texto-suave); font-size: var(--texto-s); margin: 0;">
      Elige la asignatura, unidad y tema sobre el cual deseas practicar:
    </p>

    <div class="campo">
      <label for="selModalAsignatura"><strong>Asignatura</strong></label>
      <select id="selModalAsignatura" class="input">
        ${asignaturas.map((a) => `<option value="${ui.escapar(a.id)}">${ui.escapar(a.nombre)}</option>`).join('')}
      </select>
    </div>

    <div class="campo">
      <label for="selModalUnidad"><strong>Unidad</strong></label>
      <select id="selModalUnidad" class="input"></select>
    </div>

    <div class="campo">
      <label for="selModalTema"><strong>Tema de estudio</strong></label>
      <select id="selModalTema" class="input"></select>
    </div>
  `;

  const selAsig = divContenido.querySelector('#selModalAsignatura');
  const selUni = divContenido.querySelector('#selModalUnidad');
  const selTem = divContenido.querySelector('#selModalTema');

  function actualizarUnidades() {
    const asigId = selAsig.value;
    const unidadesDeAsig = unidades.filter((u) => u.asignaturaId === asigId);

    selUni.innerHTML = unidadesDeAsig.length > 0
      ? unidadesDeAsig.map((u) => `<option value="${ui.escapar(u.id)}">${ui.escapar(u.titulo)}</option>`).join('')
      : '<option value="">(Sin unidades disponibles)</option>';

    actualizarTemas();
  }

  function actualizarTemas() {
    const uniId = selUni.value;
    const temasDeUni = temas.filter((t) => t.unidadId === uniId);

    selTem.innerHTML = temasDeUni.length > 0
      ? temasDeUni.map((t) => `<option value="${ui.escapar(t.id)}">${ui.escapar(t.titulo)}</option>`).join('')
      : '<option value="">(Sin temas publicados)</option>';
  }

  selAsig.addEventListener('change', actualizarUnidades);
  selUni.addEventListener('change', actualizarTemas);

  actualizarUnidades();

  return new Promise(async (resolve) => {
    let temaElegido = null;

    const resModal = await ui.modal({
      titulo: 'Seleccionar Tema de Práctica',
      contenido: divContenido,
      acciones: [
        {
          texto: 'Comenzar actividad',
          valor: 'aceptar',
          clase: 'btn--primario'
        },
        {
          texto: 'Cancelar',
          valor: 'cancelar',
          clase: 'btn--secundario'
        }
      ]
    });

    if (resModal === 'aceptar') {
      const temaIdSeleccionado = selTem.value;
      temaElegido = temas.find((t) => t.id === temaIdSeleccionado) || null;
    }

    resolve(temaElegido);
  });
}

export default {
  obtenerTemaActividad
};
