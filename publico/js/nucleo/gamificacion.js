// publico/js/nucleo/gamificacion.js
// Cliente de gamificación: registro de intentos, celebración de logros y consulta de insignias

import * as api from './api.js';
import * as ui from './ui.js';
import { cambiarEstado } from './avatar.js';

export async function registrarIntento(datos) {
  const resultado = await api.llamar('POST', '/api/intentos', datos);
  await mostrarLogros(resultado);
  return resultado;
}

export async function mostrarLogros(resultado) {
  if (!resultado) return;

  // Notificación de puntos ganados
  if (resultado.puntosGanados && resultado.puntosGanados > 0) {
    ui.aviso(`+${resultado.puntosGanados} puntos ganados`, 'exito');
  }

  // Actualizar indicador en vivo de puntos en el encabezado
  const badgePuntos = document.getElementById('puntos-usuario');
  if (badgePuntos && resultado.puntosTotales !== undefined) {
    badgePuntos.textContent = `⭐ ${resultado.puntosTotales} pts`;
  }

  // Celebración por cada insignia nueva obtenida
  if (Array.isArray(resultado.insigniasNuevas) && resultado.insigniasNuevas.length > 0) {
    if (document.getElementById('avatar-guia')) {
      cambiarEstado('celebrando');
      setTimeout(() => cambiarEstado('reposo'), 3000);
    }
    for (const ins of resultado.insigniasNuevas) {
      await ui.modal({
        titulo: '¡Insignia Desbloqueada!',
        contenido: `
          <div class="celebracion">
            <div class="celebracion__icono" aria-hidden="true">${ui.escapar(ins.icono || '🏅')}</div>
            <h3 class="celebracion__nombre">${ui.escapar(ins.nombre)}</h3>
            <p class="celebracion__desc">¡Felicitaciones! Has alcanzado un nuevo logro en tu aprendizaje.</p>
          </div>
        `,
        acciones: [
          { texto: '¡Continuar!', valor: 'ok', clase: 'btn--primario' }
        ]
      });
    }
  }
}

export async function logrosDe(usuarioId = 'yo') {
  return await api.llamar('GET', `/api/logros/${encodeURIComponent(usuarioId)}`);
}

export default {
  registrarIntento,
  mostrarLogros,
  logrosDe
};
