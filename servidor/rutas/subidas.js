// servidor/rutas/subidas.js
// Subida controlada de archivos con multer diferenciada por roles

import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import crypto from 'crypto';
import fs from 'fs';
import { exigirRol } from '../auth.js';
import * as almacen from '../almacen.js';

const router = Router();
const DIR_SUBIDAS = path.resolve('publico', 'recursos', 'subidas');

// Asegurar que la carpeta de destino exista
if (!fs.existsSync(DIR_SUBIDAS)) {
  fs.mkdirSync(DIR_SUBIDAS, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, DIR_SUBIDAS);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const aleatorio = crypto.randomBytes(16).toString('hex');
    cb(null, `${aleatorio}${ext}`);
  }
});

// POST /api/subidas (con sesión)
router.post('/subidas', exigirRol('sesion'), async (req, res, next) => {
  const rol = req.usuario?.rol;
  const esDocenteOAdmin = rol === 'admin' || rol === 'docente';

  const ajustes = await almacen.leerConfig('ajustes');
  const maxDocenteMB = (ajustes && typeof ajustes.maxSubidaMB === 'number') ? ajustes.maxSubidaMB : 10;
  const maxMB = esDocenteOAdmin ? maxDocenteMB : 2;
  const maxBytes = maxMB * 1024 * 1024;

  const filtroArchivos = (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const tiposImg = ['image/jpeg', 'image/png', 'image/webp'];
    const extImg = ['.jpg', '.jpeg', '.png', '.webp'];

    if (esDocenteOAdmin) {
      const tiposPermitidos = [...tiposImg, 'application/pdf', 'application/x-pdf', 'application/octet-stream', 'audio/mpeg', 'audio/mp3',
        'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];
      const extPermitidas = [...extImg, '.pdf', '.mp3', '.doc', '.docx', '.ppt', '.pptx', '.xls', '.xlsx'];
      const esAudio = file.mimetype.startsWith('audio/') && ext === '.mp3';
      const esPdf = ext === '.pdf';

      if ((tiposPermitidos.includes(file.mimetype) || esAudio || esPdf) && extPermitidas.includes(ext)) {
        cb(null, true);
      } else {
        const err = new Error('Solo se permiten imágenes, PDF, documentos de Office o audios MP3');
        err.estado = 400;
        cb(err, false);
      }
    } else {
      const tiposEstudiante = [...tiposImg, 'application/pdf', 'application/x-pdf', 'application/octet-stream',
        'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];
      const extEstudiante = [...extImg, '.pdf', '.doc', '.docx', '.ppt', '.pptx', '.xls', '.xlsx'];
      if (tiposEstudiante.includes(file.mimetype) && extEstudiante.includes(ext)) {
        cb(null, true);
      } else {
        const err = new Error('Solo se permiten imágenes, PDF o documentos de Office');
        err.estado = 400;
        cb(err, false);
      }
    }
  };

  const upload = multer({
    storage,
    limits: { fileSize: maxBytes },
    fileFilter: filtroArchivos
  });

  upload.single('archivo')(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        const mensaje = esDocenteOAdmin
          ? `El archivo excede el límite máximo de ${maxMB} MB`
          : 'El archivo excede el límite máximo de 2 MB';
        return res.status(400).json({ error: mensaje });
      }
      return res.status(400).json({ error: err.message });
    } else if (err) {
      const estado = err.estado || 400;
      return res.status(estado).json({ error: err.message });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No se envió ningún archivo en el campo "archivo"' });
    }

    const url = `/recursos/subidas/${req.file.filename}`;
    res.json({ url, nombre: path.basename(req.file.originalname) });
  });
});

export default router;
