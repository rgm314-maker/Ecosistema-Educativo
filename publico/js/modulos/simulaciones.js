import { montarPlantilla } from '../nucleo/plantilla.js';
import * as api from '../nucleo/api.js';
import * as ui from '../nucleo/ui.js';

const usuario = await montarPlantilla({ titulo: 'Simulaciones', roles: ['sesion'] });

const lista = document.getElementById('listaSimulaciones');
const botonNueva = document.getElementById('nuevaSimulacion');
const puedeEditar = ['docente', 'admin'].includes(usuario?.rol);
botonNueva.hidden = !puedeEditar;

function renderizar(simulaciones, temas) {
  if (!simulaciones.length) {
    lista.innerHTML = '<div class="vacio"><span class="vacio__icono">🎭</span><h2 class="vacio__titulo">No hay simulaciones disponibles</h2><p class="vacio__texto">Vuelve pronto para practicar nuevas situaciones.</p></div>';
    return;
  }

  const mapaTemas = new Map(temas.map((tema) => [tema.id, tema.titulo]));
  const grupos = new Map();
  simulaciones.forEach((simulacion) => {
    const clave = simulacion.temaId || 'sin-tema';
    if (!grupos.has(clave)) grupos.set(clave, []);
    grupos.get(clave).push(simulacion);
  });

  lista.innerHTML = Array.from(grupos.entries()).map(([temaId, elementos]) => `
    <section class="simulaciones__tema">
      <h2>${ui.escapar(mapaTemas.get(temaId) || 'Tema no disponible')}</h2>
      <div class="simulaciones__rejilla">
        ${elementos.map((simulacion) => `
          <article class="tarjeta simulaciones__tarjeta">
            <div class="pila">
              <span class="chip">${ui.escapar(simulacion.modo === 'rol' ? 'Juego de rol' : 'Escenarios')}</span>
              <h3>${ui.escapar(simulacion.titulo)}</h3>
              ${puedeEditar ? `<p class="texto-suave">Estado: ${ui.escapar(simulacion.estado || 'borrador')}</p>` : ''}
            </div>
            <div class="simulaciones__acciones">
              <a class="btn btn--primario" href="/paginas/simulador.html?id=${encodeURIComponent(simulacion.id)}">Iniciar</a>
              ${puedeEditar ? `<a class="btn btn--secundario" href="/paginas/editor-simulacion.html?id=${encodeURIComponent(simulacion.id)}">Editar</a>` : ''}
            </div>
          </article>`).join('')}
      </div>
    </section>`).join('');
}

async function cargar() {
  try {
    ui.cargando(true);
    const [simulaciones, temas] = await Promise.all([
      api.listar('simulaciones'),
      api.listar('temas')
    ]);
    renderizar(simulaciones, temas);
  } catch (error) {
    lista.innerHTML = '<div class="vacio"><p class="vacio__texto">No se pudieron cargar las simulaciones.</p></div>';
    ui.aviso(error.message || 'Error al cargar las simulaciones', 'error');
  } finally {
    ui.cargando(false);
  }
}

cargar();
