# Sorteo Navideño · Congreso del Estado de México

Sistema del sorteo de fin de año: **pantalla pública** para proyectar y **panel de administración** para manejar el sorteo, los premios, los participantes (con foto) y la base de datos.

- Frontend: Angular 19 (`src/`)
- Backend: Express + Sequelize + MySQL (`backend/`)
- Todo corre en Docker.

## Arrancar en local con Docker

1. Copia `.env.example` como `.env` y cambia las contraseñas (el `.env` no se sube a git).
2. Levanta todo:

   ```bash
   docker compose up -d --build
   ```

3. Abre:
   - **Panel de administración:** http://localhost:8080/admin (usuario y contraseña del `.env`)
   - **Pantalla pública:** http://localhost:8080/pantalla (tecla **F** = pantalla completa)

La pantalla pública se actualiza en vivo desde el servidor, así que puede abrirse en otra computadora o proyector de la misma red (`http://IP-de-esta-PC:8080/pantalla`).

| Comando | Qué hace |
|---|---|
| `docker compose up -d --build` | Levantar o reconstruir después de cambios |
| `docker compose down` | Apagar (los datos se conservan) |
| `docker compose logs -f backend` | Ver los logs del backend |

## Cómo funciona el sorteo

1. **Sortear premio** (Admin → Sorteo): el sistema elige un premio al azar (cada unidad tiene la misma probabilidad), lo aparta como *pendiente* y la pantalla pública gira la ruleta hasta mostrarlo con "¿Quién se lo lleva?".
2. Se saca el **boleto de la tómbola** y en el select se **busca a la persona por nombre**. Cada opción muestra su dependencia y dirección para distinguir homónimos; también se puede buscar por dependencia o RFC.
3. **Mostrar ganador en pantalla**: aparece su foto de credencial con confeti.
4. Después eliges una opción:
   - ✅ **Confirmar entrega**: queda como *entregado*.
   - 🙋 **No se presentó · otro boleto**: se quita a la persona y el mismo premio sigue en juego para el siguiente boleto.
   - ↩️ **Cancelar premio**: el premio regresa al stock.

No se puede sortear otro premio mientras haya uno pendiente. El descuento de stock se hace en una transacción con bloqueo, así que nunca se entrega más de lo que hay. Si una persona ya ganó, el sistema avisa y pide autorización.

## Base de usuarios SAF y fotos (dentro de Docker)

La base de usuarios (`adminplem_saf`) vive **dentro del MariaDB de Docker**, junto con la del sorteo. No depende de tu PC ni de la red interna.

En **Admin → Participantes → Base de usuarios SAF**:

1. **Subir respaldo .sql de SAF**: exporta `adminplem_saf` desde DBeaver o phpMyAdmin (o al menos `s_usuario`, `t_dependencia` y `t_direccion`). Se acepta `.sql`, `.sql.gz` o `.zip`.
   - El archivo se carga primero en una base temporal y solo si trae `s_usuario` con usuarios activos reemplaza la anterior. Un archivo malo nunca deja la base a medias.
   - Después se actualiza solo la lista del sorteo con los servidores públicos activos (`Estado = 1`), su dependencia y dirección.
   - El día del evento puedes subir un .sql nuevo para actualizar todo. El historial de ganadores no se toca.
2. **Descargar fotos faltantes**: baja las fotos de credencial de `documentacionsaf.gob.mx/credenciales/storage/credenciales/{RFC}.jpg` a `data/fotos/`. Necesita internet, así que hazlo antes del evento. Si alguna foto falta y hay internet, la pantalla la intenta cargar en línea.

Como alternativa también se puede importar un Excel o CSV con las columnas RFC, Nombre, Dependencia y Dirección.

La pantalla pública se recarga sola cuando se publica una versión nueva del sistema (solo mientras está en espera). El admin muestra un aviso para recargar.

## Carpetas físicas (no se suben a git)

| Carpeta | Contenido |
|---|---|
| `data/fotos/` | Fotos de participantes, nombradas por RFC: `GOMA800101AB1.jpg` (jpg, png o webp) |
| `data/premios/` | Imágenes de premios subidas desde el admin |
| `backups/` | Respaldos `.json` de la base de datos |

Las fotos se pueden copiar directo a `data/fotos/` o subir desde **Admin → Participantes** (varias a la vez o en un `.zip`).

## Respaldos y reinicios

En **Admin → Base de datos** puedes:

- Crear, descargar, subir y **restaurar** respaldos.
- Ver los respaldos automáticos: se crea uno después de cada entrega confirmada (se guardan los últimos 30) y antes de cualquier reinicio o restauración.
- Reiniciar:
  - **Recalcular stock**: corrige cantidades; no borra nada.
  - **Reiniciar sorteo**: borra ganadores y regresa el stock al total.
  - **Vaciar participantes**.
  - **Reinicio de fábrica**.

## Producción

- El backend crea las tablas y columnas nuevas al arrancar (sin borrar datos). Si prefieres aplicarlo a mano, usa `backend/sql/migracion_2026.sql` (haz un respaldo antes).
- Variables de entorno del backend: `ADMIN_USER`, `ADMIN_PASSWORD`, `JWT_SECRET`, `RIFAS_DB_HOST`, `RIFAS_DB_NAME`, `RIFAS_DB_USER`, `RIFAS_DB_PASSWORD`, `CORS_ORIGIN`, `FOTOS_DIR`, `BACKUPS_DIR`. Si no se definen, se usan los valores anteriores del código.
- La configuración `docker` de Angular apunta al backend en `/backend/` (proxy de nginx). La de producción sigue apuntando a `https://rifas.congresoedomex.gob.mx/backend/`.
