// publico/js/nucleo/retroalimentacion.js
// Componentes de retroalimentación formativa y resumen de actividades lúdicas

import * as ui from './ui.js';

export function mostrarRetro({ correcto = true, explicacion = '', sugerencia = '', enlaceTema = '', contenedor = null }) {
  const panel = document.createElement('div');
  panel.className = `retro ${correcto ? 'retro--correcto' : 'retro--incorrecto'}`;
  panel.setAttribute('aria-live', 'polite');

  const icono = correcto ? '✓' : '✕';

  let enlaceHtml = '';
  if (enlaceTema) {
    enlaceHtml = `
      <a href="${ui.escapar(enlaceTema)}" class="btn btn--secundario btn--pequeno" style="align-self: flex-start; margin-top: var(--espacio-xs);">
        Repasar el tema
      </a>
    `;
  }

  let sugerenciaHtml = '';
  if (sugerencia) {
    sugerenciaHtml = `<p class="retro__sugerencia">${ui.escapar(sugerencia)}</p>`;
  }

  panel.innerHTML = `
    <div class="retro__icono" aria-hidden="true">${icono}</div>
    <div class="retro__cuerpo">
      <p class="retro__explicacion">${ui.escapar(explicacion || (correcto ? '¡Respuesta correcta!' : 'Respuesta incorrecta.'))}</p>
      ${sugerenciaHtml}
      ${enlaceHtml}
    </div>
  `;

  // Si se especifica un contenedor o existe uno estándar en el documento, se monta automáticamente
  const destino =
    (typeof contenedor === 'string' ? document.querySelector(contenedor) : contenedor) ||
    document.getElementById('retroalimentacion') ||
    document.getElementById('retro');

  if (destino) {
    destino.innerHTML = '';
    destino.appendChild(panel);
  }

  return panel;
}

export async function mostrarResumen({
  titulo = 'Resumen de la Actividad',
  aciertos = 0,
  errores = 0,
  recomendaciones = '',
  enlaceTema = ''
} = {}) {
  const total = aciertos + errores;
  const pct = total > 0 ? Math.round((aciertos / total) * 100) : 0;

  let enlaceHtml = '';
  if (enlaceTema) {
    enlaceHtml = `
      <div style="margin-top: var(--espacio-m);">
        <a href="${ui.escapar(enlaceTema)}" class="btn btn--texto btn--pequeno">
          📖 Repasar el tema de estudio
        </a>
      </div>
    `;
  }

  let recomendacionesHtml = '';
  if (recomendaciones) {
    recomendacionesHtml = `
      <div class="alerta alerta--info" style="margin-top: var(--espacio-m); font-size: var(--texto-xs);">
        <p style="margin: 0;"><strong>Recomendación:</strong> ${ui.escapar(recomendaciones)}</p>
      </div>
    `;
  }

  const contenido = `
    <div class="pila" style="gap: var(--espacio-m); text-align: center;">
      <div class="fila" style="justify-content: center; gap: var(--espacio-xl); margin-block: var(--espacio-s);">
        <div>
          <span style="display: block; font-size: var(--texto-2xl); font-weight: var(--peso-extranegrita); color: var(--exito);">
            ${aciertos}
          </span>
          <small style="color: var(--texto-suave);">Aciertos</small>
        </div>
        <div>
          <span style="display: block; font-size: var(--texto-2xl); font-weight: var(--peso-extranegrita); color: var(--error);">
            ${errores}
          </span>
          <small style="color: var(--texto-suave);">Errores</small>
        </div>
        <div>
          <span style="display: block; font-size: var(--texto-2xl); font-weight: var(--peso-extranegrita); color: var(--primario);">
            ${pct}%
          </span>
          <small style="color: var(--texto-suave);">Efectividad</small>
        </div>
      </div>

      ${recomendacionesHtml}
      ${enlaceHtml}
    </div>
  `;

  const respuesta = await ui.modal({
    titulo,
    contenido,
    acciones: [
      { texto: 'Jugar de nuevo', valor: 'repetir', clase: 'btn--primario' },
      { texto: 'Salir', valor: 'salir', clase: 'btn--secundario' }
    ]
  });

  return respuesta === 'repetir' ? 'repetir' : 'salir';
}

export default {
  mostrarRetro,
  mostrarResumen
};
