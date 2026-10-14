# Revisión del enunciado

| Requisito | Implementación | Estado |
|---|---|---|
| Registro/login y contraseñas con hash | NestJS, scrypt y sesiones HttpOnly | Probado por API |
| Crear, visualizar y eliminar publicaciones | Texto, feed y borrado por autor | Probado por API; interfaz escrita |
| Likes y comentarios | Rutas REST y componentes React | Probado por API; interfaz escrita |
| Seguimiento de usuarios | Tabla follows, perfil y feed Siguiendo | Probado por API; interfaz escrita |
| Feed general o personalizado | Ambos, con paginación | Probado por API |
| Tiempo real | SSE con invalidación y recarga del feed | Evento SSE probado; falta prueba visual con dos navegadores |
| Mensajes privados (ampliación) | Texto, emojis, imagen/audio/video y SSE privado | Probados acceso, persistencia, límites y aislamiento de eventos |
| Notas de voz (ampliación) | MediaRecorder, revisión y envío del audio | Implementado; prueba de micrófono en navegador pendiente |
| Publicaciones multimedia (ampliación) | Emojis, imagen/audio/video y notas de voz en el feed | Adjuntos, permisos de borrado y persistencia probados por API |
| Login/registro, feed y perfil | Componentes React responsive | Compilan; revisión visual pendiente |
| Frontend/backend separados | Carpetas, procesos y contenedores independientes | Implementado |
| API REST | /api con controladores y servicio | Probado |
| Base de datos relacional | SQLite, integridad referencial y claves compuestas | Probada persistencia tras reinicio |
| Migraciones reproducibles | SQL versionado y tabla schema_migrations | Probadas al iniciar/reiniciar |
| Validación y errores | DTO, ValidationPipe y filtro de errores | Probado |
| CORS y variables de entorno | Orígenes exactos y .env.example | Probado CORS y rechazo CSRF |
| Swagger/OpenAPI | /api/docs y /api/openapi.json | Documento JSON probado |
| Frontend y backend públicos | Compose + HTTPS preparados | Pendiente de alojamiento y validación |
| GitHub | Ferotuc/Rede-social | Repositorio público |
| PDF con datos, arquitectura y tecnologías | Informe borrador externo al repositorio | Preparado; faltan URLs y capturas de producción |
| SSR/prerender | El enunciado lo recomienda | No incluido; usa renderizado cliente |

Fecha de entrega del archivo exportado: 31/10/2026, 23:59 (Guatemala). Docker está instalado en el equipo, pero su motor no estaba activo durante la preparación; los contenedores aún no fueron ejecutados ni validados. No declarar cumplimiento total hasta resolver los estados pendientes.

