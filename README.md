# Fiesta — versión 1.3

## Cambios de esta versión

- Identidad desde Configuración: nombre del programa, logo, eslogan del login y del menú. Nombre reflejado en documentos y título de la pestaña.
- Clientes: Nombre(s), apellido paterno, apellido materno y teléfono. Clientes e invitados sin correo; el administrador conserva su correo de acceso.
- Cotización nueva en **Esperando autorización**. El estado se gestiona desde la tabla; el formulario no permite enviarlo. Anticipo/abono cambia a **Aceptada**; al cubrir el total cambia a **Pagado**.
- Pago mixto: captura efectivo y transferencia en el mismo movimiento. Los importes se validan en centavos en el servidor. Puedes anular pagos con motivo obligatorio: el historial permanece y el saldo aumenta por el importe anulado. No se genera dinero ni se elimina deuda al anular.
- Ticket PDF de 58/80 mm, desglose del pago y RFC configurado. Largo adaptado al contenido; historiales largos continúan en otra hoja. RFC opcional en cotización/invitación.
- Invitaciones PDF A5: nombre del invitado, evento, lugar, fecha, lugares reservados, texto e imagen configurables.
- Configuración separada en Programa, Cotizaciones y tickets, e Invitaciones. Se mantienen el editor de fotos y el reporte de cuatro secciones.
- Colores de títulos/tablas/indicadores/programa; modo oscuro animado con opción de seguir el dispositivo y respeto a movimiento reducido.
- Iconos Facebook, Instagram y ubicación incluidos. Avisos de operaciones durante diez segundos, descartables.
- Socket.IO con sesión autenticada y salas por propietario: refresca registros después de cambios y al reconectar. Los formularios abiertos conservan sus cambios sin guardar; las cotizaciones/pagos rechazan conflictos de versión.
- PDFs como ArrayBuffer y URLs temporales revocadas al cerrar. Un ArrayBuffer por sí solo no garantiza menor memoria: también se liberan recursos del visor.

## Actualizar e iniciar

Respalda la base y conserva `server/.env`. Extrae esta versión y copia tu `.env` a `fiesta/server/.env`. Ejecuta `INICIAR-FIESTA.bat`: conserva la instalación existente y solo pide crear administrador cuando aún no hay uno.

Para otro servidor, usa `VITE_API_URL=https://tu-api.com/api` y recompila. Socket.IO toma automáticamente ese origen; opcionalmente configura `VITE_SOCKET_URL=https://tu-api.com`. El proxy debe reenviar `/socket.io/` y permitir WebSocket/Upgrade hacia Node, además de `/api/`. Configura `CLIENT_ORIGIN` con la URL exacta del frontend. Para hosting único usa `VITE_API_URL=/api`.

Para imprimir un ticket, descarga/abre el PDF y elige tu impresora con el ancho seleccionado y escala 100 %. El sistema genera el documento; no instala controladores de impresora.

Consulta `VERIFICACION.md` para las pruebas ejecutadas y los pasos pendientes en Windows/MongoDB.


React + Node.js/Express + MongoDB. Menú clásico superior, sin dashboard.

## Inicio en Windows: un solo archivo

1. Extrae el ZIP completo. No ejecutes archivos directamente dentro del ZIP.
2. Si vienes de la versión anterior, **copia tu `server/.env` anterior** a la carpeta `server` de esta versión antes de iniciar. Conserva la misma URI para seguir usando tu base. No borres tu base ni tus clientes.
3. Abre **`INICIAR-FIESTA.bat`**.
4. Si Node.js 22 o superior no está disponible, el iniciador descarga Node 22 portable desde el sitio oficial, verifica SHA-256 y lo guarda únicamente en `.runtime/node`. No instala programas globales ni cambia permisos del sistema. Fuente del paquete y sus sumas: https://nodejs.org/download/release/latest-v22.x/.
5. Comprueba los `.env`; conserva los existentes y crea los faltantes a partir de sus ejemplos. Instala las dependencias cuando sea necesario, compila y abre la aplicación.
6. Si no existe ningún administrador, se abre la pantalla **Crear administrador**. Escribe correo, contraseña de al menos 12 caracteres y confirmación. La clave de instalación se completa desde el iniciador; si abres la página manualmente, está en `server/.setup-key`.
7. Después de crear la cuenta, inicia sesión. El alta inicial queda cerrada. Si ya había una cuenta, se conserva y se muestra directamente el acceso.

Requiere Windows de 64 bits con PowerShell, Internet para descargas iniciales y **MongoDB local funcionando o MongoDB Atlas configurado**. El iniciador descarga Node; no instala MongoDB. Si usas Atlas, edita `MONGODB_URI` en `server/.env` con tu conexión antes de iniciar. Nunca compartas ese archivo.

El `.bat` permanece abierto ante errores y guarda registros en `.logs`. Mantén la consola abierta durante el uso; Ctrl+C detiene el programa. Un error de MongoDB indica que debe revisarse la conexión, las credenciales o el acceso de red. No se registra tu contraseña ni el contenido del `.env` en los logs del iniciador.

Si Windows bloquea la ejecución por una política corporativa, solicita a tu administrador un método permitido. El iniciador no modifica políticas de ejecución.

## Cotizaciones — CRUD

| Campo | Comportamiento |
| --- | --- |
| No. cotización | Folio automático `COT-000001`, único por administrador; no editable. Puede haber saltos si se cancela una escritura. |
| Fecha actual | Fecha/hora real de creación asignada por el servidor; no editable. Se conserva al editar y se presenta en fecha local. |
| Fecha del evento | Fecha elegida por el usuario. |
| Nombre del cliente | Cliente seleccionado; se guarda su referencia y nombre en la cotización. No existe un campo “fecha del cliente”. |
| Materiales | Arreglo con descripción, cantidad, precio unitario y total por renglón. Se retiró el ID material del formulario y de los nuevos datos. |
| Subtotal | Suma de materiales, calculada en el servidor. |
| Descuento | Porcentaje de 0 a 100 con hasta dos decimales; motivo obligatorio si es mayor que cero. |
| Total | Subtotal menos descuento. Los importes calculados se guardan en centavos de MXN. |
| Imagen de referencia | Una imagen. |
| Elementos de la decoración | Texto descriptivo editable. |
| Imágenes de materiales | Tres fotos para el reporte, cada una con título y encuadre. Las cotizaciones antiguas pueden conservar fotos adicionales, pero se imprimen las tres primeras. |

Los precios admiten dos decimales; las cantidades son enteras positivas. El subtotal máximo es 100 millones de MXN para acotar cálculos y entradas fuera de escala. El descuento se redondea al centavo más cercano.

Las cotizaciones v1 conservan fecha y total; al arrancar se asigna un folio `COT-LEG-…` a las que no tenían número. Los IDs antiguos ya no se piden ni se imprimen. Haz un respaldo de MongoDB antes de actualizar: esta versión conserva datos y añade configuración y diseño del reporte.

## Clientes, anticipos, abonos e historial

Se conserva el CRUD de clientes. En **Clientes → Pagos / historial**, o desde una cotización:

- Consulta todas las cotizaciones del cliente, total cotizado, pagos recibidos y saldo pendiente.
- Elige la cotización concreta a la que aplicar el pago.
- Registra el anticipo como primer movimiento, o un abono posterior.
- Captura importe, forma de pago (efectivo, transferencia o tarjeta) y nota/referencia.
- Consulta el historial con fecha real, cotización, tipo de movimiento e importe.

Los pagos se guardan dentro de la cotización; el saldo se deriva del total menos los pagos. El servidor rechaza montos negativos, cero, sobrepagos y nuevos anticipos después del primer movimiento. El ID de solicitud evita duplicar una misma solicitud reenviada. El control de versión de MongoDB evita que dos pagos concurrentes sobrescriban el historial o excedan el saldo; ante conflicto se debe actualizar y reintentar.

No se puede eliminar ni cancelar una cotización con pagos ni bajar su total por debajo de lo cobrado. Los pagos no se editan ni borran en esta versión; no se incluyen devoluciones ni anulaciones. Una cotización con pagos tampoco puede cambiar de cliente.

## Imágenes privadas

- JPEG, PNG o WebP; máximo 5 MB y 20 megapíxeles por imagen.
- El servidor comprueba contenido y decodifica la imagen; rechaza SVG y archivos disfrazados.
- Se normaliza a WebP, hasta 1600 px, sin metadatos originales.
- Archivos guardados en MongoDB, por lo que no dependen del disco temporal del hosting.
- Lectura autenticada y limitada al propietario. No se publican carpetas de fotos.
- Quitar una foto de la cotización desvincula la referencia. Las imágenes ya subidas permanecen en la base; no hay limpieza de imágenes huérfanas en esta versión.

## Invitados e invitaciones

Se conservan sus CRUD. Un invitado pertenece a un cliente; la invitación vincula una cotización con un invitado del mismo cliente. No hay envío automático, diseño de invitaciones ni enlaces públicos en esta versión.

## Seguridad y registro inicial

- Contraseñas bcrypt, mínimo 12 caracteres al crear administrador y máximo 72 bytes UTF-8 (acentos/emojis pueden ocupar varios bytes).
- Sin usuario predeterminado, sin registro público permanente y sin alta de administradores por consola.
- El alta inicial requiere clave aleatoria y usa un identificador único fijo para evitar dobles altas simultáneas.
- La instalación existente se detecta consultando MongoDB, no por una bandera del navegador.
- Sesiones aleatorias de ocho horas, guardadas como hash en MongoDB; token solo en memoria del navegador. Recargar requiere iniciar sesión otra vez.
- Validación estricta, protección por propietario, límites de intentos y de carga, Helmet y CORS explícito.
- Operaciones de cotización/pagos con control de versión. Las validaciones entre colecciones (clientes/invitados/invitaciones) no son transacciones multdocumento; no se ofrece garantía de serialización de esas relaciones ante edición simultánea entre procesos.

HTTPS, acceso restringido a MongoDB y respaldos son responsabilidad del despliegue. No se incluye MFA, recuperación de contraseña ni roles adicionales. Si una instalación anterior tiene varias cuentas, se conservan aisladas; la pantalla inicial no crea cuentas nuevas.

## Despliegue en otros servidores

| Variable | Ubicación | Ejemplo de producción |
| --- | --- | --- |
| `VITE_API_URL` | Frontend, antes del build | `https://api.tudominio.com/api` |
| `CLIENT_ORIGIN` | Backend | `https://tudominio.com` sin barra final |
| `MONGODB_URI` | Solo backend | URI privada MongoDB Atlas |
| `NODE_ENV` | Backend | `production` |
| `HOST` | Backend | `0.0.0.0` |
| `PORT` | Backend | El puerto asignado por el proveedor |
| `SETUP_TOKEN` | Backend, solo primer alta | Al menos 32 caracteres aleatorios |

En hosting único, usa `VITE_API_URL=/api`; Node sirve `client/dist` y la API. En hosting separado, sustituye `localhost` por la URL real de la API. Las variables Vite requieren recompilación y nunca deben incluir secretos. El iniciador Windows sobrescribe solo variables del proceso para ejecución local; no reemplaza los `.env` existentes.

Desde la raíz: `npm ci`, `npm run build`, `npm start`. En backend separado basta instalar e iniciar; publica `client/dist` en el frontend. Usa HTTPS. Prueba `/api/health` para verificar que la API responde. Configura `TRUST_PROXY=1` solo si existe exactamente un proxy confiable delante.

Para generar una clave de instalación: `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`. En producción configúrala como `SETUP_TOKEN`; introdúcela en la pantalla inicial y elimínala del entorno tras crear el administrador. En local el archivo `server/.setup-key` se genera automáticamente y no debe publicarse.

## Desarrollo y pruebas

1. `npm ci`
2. `node scripts/setup.mjs`
3. Configurar `server/.env`: MongoDB, `CLIENT_ORIGIN=http://localhost:5173` y `HOST=127.0.0.1`.
4. Configurar `client/.env`: `VITE_API_URL=http://localhost:4000/api`.
5. `npm run dev`

Pruebas sin MongoDB: `node --test server/validation.test.js server/security.test.js`.
Pruebas completas con MongoDB temporal: `npm test`. El primer uso descarga un binario MongoDB; no utiliza tu base configurada.

Consulta `VERIFICACION.md` para distinguir lo probado de lo pendiente. No se ha publicado esta aplicación ni se ha conectado la base del usuario.


## Novedades 1.2: componentes y navegación

El menú incluye iconos y Configuración. Las acciones de clientes incluyen iconos de historial, edición y eliminación. Cada pantalla es un componente independiente (`ClientsPage`, `QuotesPage`, `GuestsPage`, `InvitationsPage`, `SettingsPage`). El estado de tablas/formularios se desmonta al cambiar de módulo y las respuestas tardías se descartan. Se corrige la pantalla en blanco causada por interpretar un registro de cliente como cotización antes de limpiar el estado.

## PDF de cotización

En una cotización guardada, pulsa **PDF**. Se consultan de nuevo sus datos/pagos actuales, se genera el documento como **ArrayBuffer** y se muestra en un visor. Puedes abrirlo en otra pestaña o descargarlo. Se usa un Blob binario y se revoca su URL al cerrar el visor; no se conserva el PDF como cadena base64. Esto evita esa conversión, pero no significa que el PDF consuma cero memoria.

El reporte tiene cuatro secciones:

1. **COTIZACION:** folio, fecha de creación real, cliente, logo, fecha del evento, tabla de materiales, subtotal, descuento con porcentaje y razón, total, primer pago como AGENDADO, pagos siguientes como ABONADO (todos con fecha), pendiente de liquidar, notas y firma.
2. **Propuesta de decoración:** imagen de referencia y descripción a su lado; debajo, tres fotos con sus títulos.
3. **Resultado final:** imagen final con posición, tamaño y encuadre configurables.
4. **Dinámica de contratación:** texto editable en Configuración.

En una cotización normal ocupa cuatro páginas. Si hay muchos materiales, pagos o texto, se agregan páginas de continuación para no recortar información. La fecha de la cotización es su fecha de creación, no se cambia cada vez que se imprime.

`docs/Ejemplo-cotizacion.pdf` muestra un ejemplo real del generador. Los bloques de color son únicamente muestras de posición; no son tu logo, firma ni fotografías. No se recibió en el chat el archivo de referencia mencionado; puedes subir tus imágenes desde el sistema.

## Configuración del reporte

- **Fuente:** Helvetica, Times o Courier; tamaño del texto de 8 a 14 puntos y color principal. Encabezados y pie tienen tamaños específicos para conservar jerarquía y legibilidad.
- **Identidad:** logo, firma y marcos superior/inferior guardados como imágenes privadas en MongoDB.
- **Posiciones:** logo a izquierda/derecha, firma a izquierda/centro/derecha, imagen de referencia a un lado del texto; ancho, alto y posición vertical. Imagen final con coordenadas y tamaño en milímetros dentro del área imprimible.
- **Redes y ubicación:** iconos cargados por el usuario y textos de Facebook, Instagram y ubicación en todas las páginas.
- **Textos:** notas de la cotización y dinámica de contratación editables.
- **Vista previa:** muestra el PDF real con datos de ejemplo antes de guardar; permite revisar fuente, posiciones y marcos.

La configuración se aplica al volver a generar reportes, incluidos los de cotizaciones previas. Los PDFs ya descargados no cambian. Las configuraciones pertenecen a cada administrador. No es un editor libre de arrastrar y soltar: utiliza selectores, medidas y controles de encuadre.

## Editor dentro de Cotizaciones

Carga imagen de referencia, tres fotos tituladas y resultado final. Ajusta **foto completa o recorte**, acercamiento y anclaje horizontal/vertical con vista inmediata; el mismo cálculo geométrico se usa en el PDF. Activa **marcos personalizados** para reemplazar los marcos predeterminados solo en esa cotización. Un marco personalizado vacío deja esa franja sin imagen.

Pulsa **Vista previa de las cuatro páginas** para revisar el diseño con los cambios actuales. Guarda el formulario para persistirlos. El botón PDF del listado siempre utiliza el registro guardado y sus pagos actuales.

Los marcos ocupan franjas de 210 × 20 mm y se ajustan al formato; las fotos pueden recortarse según sus controles. Las imágenes no se exponen por URLs públicas.

## Documentación del código

Se aplica **JSDoc**, equivalente a JavaDoc en JavaScript/React. Los archivos incluyen propósito, contratos de funciones y comentarios por bloques de negocio y seguridad. Consulta `AGENTS.md` y `docs/ESTANDAR-JSDOC.md`; esta convención debe mantenerse en frontend y backend en futuras modificaciones.

## Verificación adicional

- `npm run test:unit`: validaciones, seguridad, configuración y geometría de encuadre sin MongoDB real.
- `npm run test:ui`: prueba reproducible de navegación rápida/lenta, alta, login, cotización, pagos y configuración con DOM/API simulados.
- `npm test`: integración contra MongoDB temporal; requiere poder ejecutar su binario.
- `npm run build`: compila los componentes; el generador PDF se carga bajo demanda.
