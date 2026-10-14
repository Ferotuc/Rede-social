# Opciones de despliegue

El enunciado exige URLs públicas funcionales. Tener el código en GitHub no sustituye publicar la aplicación. Este archivo documenta la configuración; no certifica que ya exista un despliegue.

## VPS con dominio (configuración incluida)

Usar `compose.yaml` y `.env` siguiendo el README. La URL del frontend y la base de la API pueden compartir dominio; frontend/backend siguen siendo contenedores separados. El proxy publica `/api/health`, `/api/docs` y `/api/events`. El volumen `campus-data` conserva la base relacional.

## Backend en un servicio de alojamiento

Si la plataforma acepta contenedores, seleccionar `backend` como directorio raíz y construir su Dockerfile. Configurar:

- `FRONTEND_ORIGIN`: origen HTTPS exacto del frontend.
- `DATABASE_PATH`: ruta dentro de un disco persistente, por ejemplo `/data/campus.db`.
- `NODE_ENV=production`.
- `PORT`: usar el valor proporcionado por la plataforma.
- `COOKIE_CROSS_SITE=true` solo si frontend/backend pertenecen a sitios distintos.
- `TRUST_PROXY_HOPS`: número de proxies confiables de la plataforma; no habilitarlo sin comprobar su topología.

Confirmar soporte de SSE y del disco, permisos de escritura para el usuario `node`, un único proceso backend y HTTPS. Evitar dominios de sitios distintos si el navegador bloquea cookies de terceros; preferir subdominios propios del mismo dominio o el proxy de compose.

## Frontend estático

Directorio raíz: `frontend`. Instalación: `npm ci`. Compilación: `npm run build`. Publicar directorio `dist`. Definir `VITE_API_URL=https://DOMINIO-DEL-BACKEND` antes de compilar. Con Nginx en compose no hace falta esta variable: el proxy atiende `/api`.

## Validación final

1. Registrar una cuenta; cerrar sesión y entrar otra vez.
2. Abrir dos navegadores con cuentas distintas.
3. Crear una publicación; dar like desde la otra cuenta y comprobar actualización sin recargar.
4. Comentar, seguir y verificar el feed Siguiendo.
5. Comprobar que borrar una publicación ajena devuelve 403.
6. Reiniciar el backend y verificar que usuarios/publicaciones siguen presentes.
7. Abrir Swagger desde una ventana sin sesión.
8. Probar frontend en móvil y registrar capturas de producción.

Actualizar README e informe con los enlaces definitivos. No subir `.env`, bases de datos, contraseñas ni tokens a GitHub.
