// Resúmenes académicos especiales para paneles

import { Router } from 'express';
import { exigirRol } from '../auth.js';
import * as almacen from '../almacen.js';

const router = Router();

function rechazar(mensaje, estado) {
  const error = new Error(mensaje);
  error.estado = estado;
  throw error;
}

router.get('/resumen/tutor/:grupoId', exigirRol('docente', 'admin'), async (req, res, next) => {
  try {
    const [grupos, usuarios, unidades, temas, consultas] = await Promise.all([
      almacen.leer('distributivo'), almacen.leer('usuarios'), almacen.leer('unidades'),
      almacen.leer('temas'), almacen.leer('consultas-tutor')
    ]);
    const grupo = grupos.find((item) => item.id === req.params.grupoId);
    if (!grupo) rechazar('Grupo no encontrado', 404);
    if (req.usuario.rol !== 'admin' && grupo.docenteId !== req.usuario.id) {
      rechazar('No eres docente de este grupo', 403);
    }

    const idsEstudiantes = new Set(grupo.estudiantes || []);
    const idsUnidades = new Set(unidades
      .filter((item) => item.asignaturaId === grupo.asignaturaId)
      .map((item) => item.id));
    const temasGrupo = temas.filter((item) => idsUnidades.has(item.unidadId));
    const idsTemas = new Set(temasGrupo.map((item) => item.id));
    const consultasGrupo = consultas.filter((item) =>
      idsEstudiantes.has(item.usuarioId) && idsTemas.has(item.temaId)
    );

    const porTema = temasGrupo.map((tema) => ({
      temaId: tema.id,
      titulo: tema.titulo,
      consultas: consultasGrupo
        .filter((item) => item.temaId === tema.id)
        .reduce((total, item) => total + Number(item.mensajes || 0), 0)
    })).sort((a, b) => a.titulo.localeCompare(b.titulo, 'es'));

    const porEstudiante = usuarios
      .filter((item) => idsEstudiantes.has(item.id) && item.rol === 'estudiante')
      .map((estudiante) => ({
        id: estudiante.id,
        nombre: [estudiante.nombre, estudiante.apellido].filter(Boolean).join(' '),
        consultas: consultasGrupo
          .filter((item) => item.usuarioId === estudiante.id)
          .reduce((total, item) => total + Number(item.mensajes || 0), 0)
      }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));

    res.json({ porTema, porEstudiante });
  } catch (error) { next(error); }
});

export default router;
