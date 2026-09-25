# Convenciones del proyecto Fiesta

- Documentar el código JavaScript/JSX del frontend y backend con JSDoc (bloques `/** ... */`, `@file`, `@param`, `@returns` y tipos útiles). Es el equivalente aplicable del estilo JavaDoc solicitado por el usuario.
- Al añadir o cambiar funciones, documentar propósito, parámetros, retorno, restricciones de seguridad y efectos secundarios. Mantener comentarios por bloques lógicos; no introducir comentarios que contradigan el código.
- Mantener cada pantalla como componente independiente. Nunca renderizar registros de un módulo usando columnas de otro. Descartar respuestas de pantallas desmontadas.
- No confiar en totales, propietario, folios ni saldos enviados por el navegador; recalcular/verificar en el servidor.
- Generar PDFs como ArrayBuffer; crear Blob URLs temporales y revocarlas al cerrar el visor. No generar PDFs como base64.
- Conservar .env, datos existentes y configuración del propietario en las actualizaciones. No incluir secretos en entregas.
