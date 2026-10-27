import { montarPlantilla } from '../nucleo/plantilla.js';
import * as api from '../nucleo/api.js';
import * as ui from '../nucleo/ui.js';

await montarPlantilla({ titulo: 'Panel docente', roles: ['docente'] });

const selectorGrupo = document.getElementById('grupoPanel');
const tabla = document.getElementById('tablaUsoTutor');
const lienzo = document.getElementById('graficoTutor');
const sinDatos = document.getElementById('sinDatosGrafico');
const estado = document.getElementById('estadoUsoTutor');

let grafico = null;

function destruirGrafico() {
  if (grafico) grafico.destroy();
  grafico = null;
}

function renderizarTabla(estudiantes) {
  if (!estudiantes.length) {
    tabla.innerHTML = '<tr><td colspan="2">Este grupo no tiene estudiantes registrados.</td></tr>';
    return;
  }
  tabla.innerHTML = estudiantes
    .slice()
    .sort((a, b) => b.consultas - a.consultas || a.nombre.localeCompare(b.nombre, 'es'))
    .map((item) => `<tr><td>${ui.escapar(item.nombre)}</td><td>${Number(item.consultas || 0)}</td></tr>`)
    .join('');
}

function renderizarGrafico(temas) {
  destruirGrafico();
  const principales = temas
    .filter((item) => Number(item.consultas || 0) > 0)
    .sort((a, b) => b.consultas - a.consultas || a.titulo.localeCompare(b.titulo, 'es'))
    .slice(0, 5);

  const hayDatos = principales.length > 0;
  lienzo.hidden = !hayDatos;
  sinDatos.hidden = hayDatos;
  if (!hayDatos) return;
  if (typeof window.Chart !== 'function') {
    lienzo.hidden = true;
    sinDatos.hidden = false;
    sinDatos.textContent = 'No se pudo cargar el gráfico. La tabla continúa disponible.';
    return;
  }

  const estilos = getComputedStyle(document.documentElement);
  grafico = new window.Chart(lienzo, {
    type: 'bar',
    data: {
      labels: principales.map((item) => item.titulo),
      datasets: [{
        label: 'Consultas',
        data: principales.map((item) => Number(item.consultas || 0)),
        backgroundColor: estilos.getPropertyValue('--primario').trim(),
        borderColor: estilos.getPropertyValue('--acento').trim(),
        borderWidth: 1
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: {
          beginAtZero: true,
          ticks: { precision: 0, color: estilos.getPropertyValue('--texto').trim() },
          grid: { color: estilos.getPropertyValue('--borde').trim() }
        },
        y: { ticks: { color: estilos.getPropertyValue('--texto').trim() } }
      }
    }
  });
}

async function cargarUsoTutor() {
  const grupoId = selectorGrupo.value;
  destruirGrafico();
  if (!grupoId) return;
  estado.textContent = 'Cargando estadísticas del tutor…';
  selectorGrupo.disabled = true;
  try {
    const resumen = await api.llamar('GET', `/api/resumen/tutor/${encodeURIComponent(grupoId)}`);
    renderizarGrafico(Array.isArray(resumen.porTema) ? resumen.porTema : []);
    renderizarTabla(Array.isArray(resumen.porEstudiante) ? resumen.porEstudiante : []);
    estado.textContent = '';
  } catch (error) {
    tabla.innerHTML = '<tr><td colspan="2">No se pudieron cargar las estadísticas.</td></tr>';
    lienzo.hidden = true;
    sinDatos.hidden = false;
    sinDatos.textContent = 'No se pudieron cargar los temas consultados.';
    estado.textContent = error.message || 'Error al cargar el uso del tutor';
    ui.aviso(estado.textContent, 'error');
  } finally {
    selectorGrupo.disabled = false;
  }
}

async function cargarGrupos() {
  try {
    const [grupos, asignaturas] = await Promise.all([
      api.listar('distributivo'),
      api.listar('asignaturas')
    ]);
    const nombres = new Map(asignaturas.map((item) => [item.id, item.nombre]));
    selectorGrupo.replaceChildren(new Option('Selecciona un grupo', ''));
    grupos.forEach((grupo) => {
      const asignatura = nombres.get(grupo.asignaturaId) || 'Asignatura';
      selectorGrupo.add(new Option(`${asignatura} · ${grupo.paralelo || ''} · ${grupo.periodo || ''}`, grupo.id));
    });
    selectorGrupo.disabled = false;
    if (grupos.length) {
      selectorGrupo.value = grupos[0].id;
      await cargarUsoTutor();
    } else {
      estado.textContent = 'No tienes grupos asignados.';
      tabla.innerHTML = '<tr><td colspan="2">No hay grupos disponibles.</td></tr>';
    }
  } catch (error) {
    selectorGrupo.replaceChildren(new Option('No se pudieron cargar los grupos', ''));
    estado.textContent = error.message || 'Error al cargar los grupos';
    ui.aviso(estado.textContent, 'error');
  }
}

selectorGrupo.addEventListener('change', cargarUsoTutor);
cargarGrupos();
