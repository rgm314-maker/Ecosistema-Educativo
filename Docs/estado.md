# docs/estado.md · Estado del proyecto (máximo 30 líneas)
Sprint terminado: Sprint 1 · Fecha: 2026-10-26

## Funciona
- Base, autenticación, perfiles, permisos y administración académica (asignaturas, distributivo, usuarios).
- Contenidos por asignatura > unidad > tema, noticias, canciones y actividades lúdicas con retroalimentación.
- Gamificación integral: cálculo de puntos en servidor, insignias automáticas y diplomas PDF con código único.
- Banco de preguntas, generación con IA y quiz progresivo de 5 niveles con respuestas protegidas.
- Foros de discusión por tema, mensajería privada, difusión a cursos, bloqueos y reportes de moderación.
- Agenda personal y grupal, fechas límite con alertas por actividades vencidas y recordatorios por notificación.
- Tutor socrático con límite diario, contexto curricular y panel docente con métricas de uso y gráficos.
- Simulador interactivo: modo escenarios ramificados y modo rol con diálogo IA y evaluación por rúbrica.
- Panel administrativo con configuración de IA, ajustes de plataforma y gestión de reportes.
- Interfaz 100% responsive (>=360 px), accesible (WCAG AA), sin frameworks y compatible con PM2.

## Decisiones y cambios respecto a docs/contratos.md
- Configuración de IA gestionada dinámicamente vía GET|PUT /api/ia/config y GET /api/ia/modelos.
- Almacén añade escribirConfig(nombre, obj) para persistir ajustes de administración e IA.
- El quiz aprueba con 70 %, toma hasta 10 preguntas y gamificación protege cálculos en servidor.

## Problemas conocidos
- Ninguno crítico; la generación por IA requiere clave válida y cuota activa en Google Gemini.

## Pendiente para el siguiente sprint
- Monitoreo en producción, pruebas de carga y ampliación del banco de contenidos por especialidad.
