# Corrección 1.3.1

Comprobación de sintaxis y prueba del resolvedor de host/puerto: Render fuerza 0.0.0.0, respeta PORT y conserva el modo local. Prueba HTTP real sin MongoDB: escucha en todas las interfaces y responde a una petición local. No se ha desplegado en Render ni probado MongoDB en esta corrección.

# Verificación de la versión 1.3

## Comprobado en esta entrega

- Compilación de producción React/Vite.
- Diez pruebas automatizadas: validación monetaria y fechas, permisos de API, alta inicial, imágenes normalizadas, configuración privada, pagos mixtos, idempotencia, liquidación, anulación conservando historial y saldo, conflicto de versiones y publicación del aviso correcto.
- Canal Socket.IO real sobre HTTP local: rechazo de token inválido, aislamiento por propietario y desconexión al revocar sesión. La consulta de sesiones usa un doble de modelo.
- Regresión DOM con API simulada: registro/login, cotización, pago mixto efectivo/transferencia, historial, navegación rápida/lenta, cambios remotos disparados por el canal simulado, modo oscuro, cambio de nombre/eslogan, configuración, apertura/cierre de PDF de cotización, ticket e invitación. Se comprueba liberación de las URLs temporales.
- Ejemplos PDF producidos por los generadores de la aplicación: cotización de cuatro páginas, invitación A5 y tickets de 58/80 mm. Inspección de imágenes renderizadas y texto; pago anulado no reduce saldo. Ejemplo: total $4,527.00, recibido $500.00, pendiente $4,027.00.
- `npm audit --omit=dev`: cero vulnerabilidades conocidas en las dependencias de producción consultadas al preparar la entrega.

## Límites de esta verificación

- No se ejecutó el .bat en Windows (este entorno es Linux).
- Las pruebas de API utilizan modelos simulados; no verifican persistencia real. La integración completa requiere una instancia MongoDB accesible. `npm test` contiene las pruebas de integración para ese entorno.
- Interfaz comprobada en DOM simulado, no mediante navegador gráfico real. Revisa tus colores, logo, fotografías y firma definitivos.
- No se probó una impresora térmica física. Selecciona papel de 58/80 mm según Configuración e imprime al 100 %, sin ajuste automático de escala.
- No se ha publicado la aplicación ni conectado la base del usuario.

## Actualización

Respalda MongoDB y conserva `server/.env`. Extrae la versión nueva, copia ese archivo a `fiesta/server/.env` y ejecuta `INICIAR-FIESTA.bat`. No copies `node_modules` de versiones anteriores.

El arranque conserva los nombres antiguos completos en Nombre(s), sin adivinar cómo separarlos: puedes completar los apellidos al editar. Elimina los campos antiguos de correo de clientes/invitados, según el nuevo modelo. Los correos de acceso de administradores se conservan. Migra estados antiguos y recalcula estados con los pagos vigentes.
