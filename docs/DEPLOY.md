# Guía de despliegue y operación

## Variables de entorno

Obligatorias:

| Variable | Para qué | Cómo generarla |
|----------|----------|----------------|
| `DATABASE_URL` | Conexión a Postgres | Panel de Supabase → Connection string |
| `SESSION_SECRET` | Firma los JWT de sesión | `openssl rand -base64 48` |

`SESSION_SECRET` **debe tener 32 caracteres o más**. La aplicación se niega a
arrancar si falta o es corto: con un valor débil, cualquiera que lo conozca
podría forjar una sesión con el `userId` que quiera y leer los datos de otro
profesor. El valor por defecto que hubo en el código debe considerarse
comprometido; genera uno nuevo.

Recomendadas:

| Variable | Para qué |
|----------|----------|
| `APP_URL` | URL pública (ej. `https://tu-dominio.com`). Se usa en los enlaces de restablecimiento de contraseña y en los enlaces familiares. Si falta en producción, el restablecimiento de contraseña falla en lugar de enviar un enlace roto. |
| `CONTACT_EMAIL` | Destino de los mensajes del formulario de contacto |
| `EMAIL_FROM` | Remitente (con Resend: `ProfesorApp <tudominio@tu-dominio.com>`) |
| `RESEND_API_KEY` | Clave de Resend para enviar correo |
| `NODE_ENV` | `production` |

## Protección de la base de datos

`prestart` ejecuta `scripts/db-guard.js`, que **impide perder datos**:

1. Calcula el diff entre el schema del repo y la base de datos real.
2. Si el diff contiene operaciones destructivas (borrar tabla, borrar columna,
   cambiar un tipo con conversión), **aborta y no aplica nada**.
3. Si solo hay cambios aditivos, los aplica sin `--accept-data-loss`.

Comprobar el estado sin aplicar nada:

```bash
npm run db:status
```

El diff exacto queda en `.next/db-diff.sql` para revisión manual.

Esto sustituye a `prisma db push --accept-data-loss`, que se ejecutaba en cada
arranque y borraba columnas sin avisar.

## Backups

Los backups de Supabase cubren el lado del proveedor, pero no los errores
operativos: un `DROP` accidental, una migración que revienta o credenciales
filtradas también los destruye. Para eso está el backup local:

```bash
DATABASE_URL="postgresql://..." npm run db:backup
```

Genera `backups/profesorapp-AAAAMMDD-HHMMSS.sql.gz`, lo verifica y conserva los
14 más recientes.

**Súbelo fuera del servidor.** Un backup en el mismo disco no protege de perder
el servidor. Opciones gratuitas: un cron que lo suba por `rclone`/`restic` a un
bucket, o una copia manual a tu equipo.

Configura un cron diario:

```cron
0 3 * * * cd /ruta/app && DATABASE_URL="..." /usr/bin/npm run db:backup >> /var/log/db-backup.log 2>&1
```

## Verificar los backups de Supabase

En el panel de Supabase → *Backups*:

- Que la recuperación en el tiempo (PITR) esté activa.
- Retención: 7 días en plan gratuito, 14 en Pro.
- Prueba a restaurar en un proyecto de prueba una vez, antes de necesitarlo.

## Enlace familiar

Se genera desde el informe del alumno. El enlace contiene un token de 32 bytes
aleatorios, no el `id` del alumno:

- No se puede adivinar ni enumerar.
- Se puede revocar, y el acceso se corta en el acto.
- La página es pública solo para quien tenga el token; el resto de la aplicación
  exige sesión.

Es un enlace con datos personales de menores: trátalo como tal. No lo publiques
en redes sociales ni lo pegues en chats de grupo. Si una familia pierde el
enlace, revócalo y genera uno nuevo.

## Migración a `prisma migrate` (pendiente)

El schema se aplica con `db push`, así que no hay historial de migraciones y no
se puede hacer rollback. Cuando el producto esté estable:

```bash
npx prisma migrate diff \
  --from-url "$DATABASE_URL" \
  --to-schema-datamodel prisma/schema.prisma \
  --script > prisma/migrations/<timestamp>_baseline/migration.sql
```

Y cambiar `prestart` a `prisma migrate deploy`, que solo aplica migraciones
pendientes y nunca borra.

## Analítica

Sin dependencias externas. Los eventos van a `AnalyticsEvent`; los errores de
cliente a `ClientError`.

- Solo se aceptan nombres de evento de una lista blanca.
- Nunca se envían notas, nombres de alumnos ni identificadores.
- Métricas agregadas del propio usuario: `GET /api/analytics/metrics?days=30`.

Durante el desarrollo, `track("nombre_evento")` está disponible en la consola
del navegador.
## Licencia y pago (paso final)

Modelo ya preparado: `License` + `/api/license` (consulta) +
`/api/license/webhook` (activación).

Variables:

| Variable | Para qué |
|----------|----------|
| `LICENSES_DISABLED` | `true` deja la app abierta. **En producción debe ser `false`**: es lo que convierte esto en un producto de pago. |
| `PAYMENT_WEBHOOK_SECRET` | Secreto que valida el webhook. Si falta, el webhook devuelve 401 y no se concede ninguna licencia. |

Proveedor recomendado: **Lemon Squeezy** o **Paddle**, que resuelven IVA
europeo, facturación y reembolsos. En Lemon Squeezy el secreto se configura en
*Webhooks* y se envía en la cabecera `X-Webhook-Secret`.

### Qué significa "de por vida", y dilo explícitamente

La licencia guarda `versionAtPurchase`: el comprador tiene acceso perpetuo a
la versión que existía cuando compró. Las mejoras futuras no están incluidas,
y eso debe estar escrito en la página de venta. Si no se dice, genera
reclamaciones el día que dejes de mantener el producto.

### Requisitos legales antes de cobrar

- Política de privacidad y aviso de protección de datos (RGPO/LOPD): la
  aplicación almacena datos de menores.
- Checkbox de consentimiento en el registro.
- Derecho de exportación y borrado de datos.
- Forma de contacto (ya implementada).
- Texto del licencia con las condiciones del pago único.

### Comprobaciones tras el primer despliegue

1. `SESSION_SECRET` definido y de 32+ caracteres.
2. `APP_URL` con el dominio real.
3. `npm run db:status` para confirmar que el schema está alineado.
4. Backups automáticos activos en Supabase **y** backup local configurado.
5. Enlace familiar abre sin sesión en incógnito.
