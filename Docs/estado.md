# docs/estado.md · Estado del proyecto (máximo 30 líneas)
Sprint terminado: P00.1 · Fecha: 2026-10-17 · Velocidad real: 100%

## Funciona
- Servidor base Express con ESM y carga dinámica de rutas y ganchos.
- Almacenamiento JSON asíncrono con encolamiento por archivo, respaldo diario automático y rotación a 14 copias.
- Sistema de permisos declarativo basado en datos/config/permisos.json.
- API genérica /api/:col y /api/:col/:id con soporte CRUD y filtros por query.

## Decisiones y cambios respecto a docs/contratos.md
- Se implementó cargarUsuario provisionalmente (req.usuario = null) hasta la integración del módulo auth.

## Problemas conocidos
- Ninguno en P00.1.

## Pendiente para el siguiente sprint
- P00.2 / Autenticación y sesiones (auth.js).
