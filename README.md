# ChatConPush

Aplicación PWA de chat con autenticación local, notificaciones push y manejo avanzado de acciones, sonidos, vibración, navegación y envío segmentado.

## Ejecución

Instalar dependencias:

```bash
npm install
```

Modo producción:

```bash
npm start
```

Modo desarrollo:

```bash
npm run dev
```

La app normalmente queda disponible en `http://localhost:3000` si no se cambió el puerto del servidor.

## Cómo probar los 9 puntos

### 1. Login y asociación usuario-superhéroe con datos en IndexedDB

Cómo probar por UI:

1. Abre la app.
2. Crea un usuario en la pantalla de registro.
3. Inicia sesión.
4. Selecciona un superhéroe.
5. Cierra sesión y vuelve a entrar.

Qué verificar:

- El login y registro funcionan.
- El usuario queda autenticado localmente.
- El héroe queda asociado al usuario.
- Al volver a entrar, la sesión y el héroe asociado se conservan.

### 2. Renovación automática cuando la suscripción caduca

Cómo probar:

1. Activa notificaciones.
2. Deja la app abierta.
3. Cambia de pestaña y vuelve a la app.

Qué verificar:

- Al volver a la pestaña, la app revalida la suscripción.
- Si la suscripción falta o expiró, intenta renovarla automáticamente.
- Si el servidor ya no conoce el endpoint, también la renueva.

Cómo verificar visualmente:

- Revisa la consola del navegador.
- Deben aparecer mensajes como `Suscripción inactiva. Renovando automáticamente...` o `Suscripción eliminada en servidor. Renovando...`.

### 3. Recepción automática del evento push en el service worker aunque la app no esté abierta

Cómo probar:

1. Activa notificaciones.
2. Cierra completamente la pestaña de la app.
3. Desde otra pestaña o desde la consola, envía:

```js
fetch('/api/push', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    titulo: 'Prueba push',
    cuerpo: 'La app esta cerrada pero el SW debe recibir esto',
    usuario: 'thor',
    tipo: 'mensaje'
  })
});
```

Qué verificar:

- La notificación aparece aunque la app no esté abierta.

### 4. Botones personalizados con acciones en la notificación push

Pruebas sugeridas:

`mensaje`

```js
fetch('/api/push', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    titulo: 'Nuevo mensaje',
    cuerpo: 'Thor te envio un mensaje',
    usuario: 'thor',
    tipo: 'mensaje'
  })
});
```

`mencion`

```js
fetch('/api/push', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    titulo: 'Te mencionaron',
    cuerpo: '@spiderman te menciono en el chat',
    usuario: 'spiderman',
    tipo: 'mencion'
  })
});
```

`alerta`

```js
fetch('/api/push', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    titulo: 'Alerta',
    cuerpo: 'Hay una alerta en el chat',
    usuario: 'hulk',
    tipo: 'alerta'
  })
});
```

`urgente`

```js
fetch('/api/push', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    titulo: 'URGENTE',
    cuerpo: 'Debes confirmar esta alerta inmediatamente',
    usuario: 'hulk',
    tipo: 'urgente'
  })
});
```

Qué verificar:

- `mensaje`: `Ver mensaje`, `Responder`, `Descartar`
- `mencion`: `Ver mención`, `Responder`, `Descartar`
- `alerta`: `Unirse`, `Ver detalles`, `Ignorar`
- `bienvenida`: `Abrir app`, `OK`
- `urgente`: `Confirmar`, `Ver detalles`

### 5. Sonidos personalizados por tipo de notificación

Cómo probar:

1. Deja la app abierta.
2. Envía notificaciones de varios tipos con los `fetch` anteriores.

Qué verificar:

- `mensaje` usa un sonido.
- `mencion` usa otro.
- `alerta` usa otro.
- `bienvenida` usa otro.
- `urgente` usa otro.

Importante:

- Con la app abierta, el sonido se reproduce desde la pestaña.
- Con la app cerrada, Windows o el navegador pueden usar el sonido predeterminado del sistema y no el MP3 personalizado.

Prueba rápida manual:

```js
NotifSounds.mensaje()
NotifSounds.mencion()
NotifSounds.alerta()
NotifSounds.bienvenida()
NotifSounds.urgente()
```

### 6. Patrones de vibración personalizados

Cómo probar:

1. Usa un dispositivo Android o un navegador/dispositivo que soporte vibración.
2. Envía notificaciones de tipo `mensaje`, `mencion`, `alerta` y `urgente`.

Qué verificar:

- Cada tipo usa un patrón distinto.
- `bienvenida` no vibra.

### 7. Manejo de `notificationclick` para abrir URL, enfocar pestaña o llevar a conversación

Cómo probar:

1. Envía una notificación de tipo `mensaje` o `mencion`.
2. Haz clic en la notificación o en uno de sus botones.
3. Repite la prueba con la app abierta.
4. Repite la prueba con la app cerrada.

Qué verificar:

- Si ya existe una pestaña de la app, se enfoca.
- Si no existe, se abre una nueva.
- Si el clic corresponde a `ver-mensaje` o `ver-mencion`, la app navega a la conversación del héroe indicado.
- Si corresponde a `responder`, abre la conversación y luego el modal de redacción.
- Si corresponde a `alerta` o `urgente`, navega a la vista o acción configurada.

### 8. Notificaciones que obligan interacción del usuario para cerrarse

Cómo probar:

1. Envía una notificación `urgente`:

```js
fetch('/api/push', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    titulo: 'URGENTE',
    cuerpo: 'Esta notificacion requiere interaccion',
    usuario: 'hulk',
    tipo: 'urgente'
  })
});
```

2. Envía una `alerta`:

```js
fetch('/api/push', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    titulo: 'Alerta persistente',
    cuerpo: 'No debe cerrarse sola inmediatamente',
    usuario: 'thor',
    tipo: 'alerta'
  })
});
```

Qué verificar:

- `urgente`, `alerta` y `mencion` usan `requireInteraction`.
- La notificación permanece visible hasta que el usuario interactúe, según el soporte del navegador o del sistema operativo.

### 9. Asociar suscripciones con usuario o dispositivo y enviar a un destino específico

Qué hace:

- Cada suscripción se guarda con `usuario`, `dispositivo` y `suscripcion`.

Cómo probar por usuario:

1. Abre la app en dos navegadores o perfiles distintos.
2. Inicia sesión en ambos con el mismo usuario, o con usuarios diferentes según lo que quieras demostrar.
3. Activa notificaciones en ambos.
4. Envía a un usuario específico:

```js
fetch('/api/push', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    titulo: 'Push privado',
    cuerpo: 'Solo debe llegar a johndoe',
    usuario: 'ironman',
    destinatario: 'johndoe',
    tipo: 'mensaje'
  })
});
```

También puedes usar la ruta semántica:

```js
fetch('/api/push/usuario/johndoe', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    titulo: 'Push privado',
    cuerpo: 'Enviado por ruta directa',
    usuario: 'ironman',
    tipo: 'mencion'
  })
});
```

Cómo probar por dispositivo:

1. En la consola del navegador destino, ejecuta:

```js
localStorage.getItem('chatpwa_deviceId')
```

2. Copia el valor.
3. Envía una notificación solo a ese dispositivo:

```js
fetch('/api/push', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    titulo: 'Push a dispositivo',
    cuerpo: 'Solo debe llegar a este navegador',
    usuario: 'thor',
    dispositivo: 'PEGA_AQUI_EL_DEVICE_ID',
    tipo: 'alerta'
  })
});
```

Qué verificar:

- Solo recibe el push el usuario o dispositivo seleccionado.
- No debe llegar al resto de suscripciones si el destino fue específico.

## Resumen rápido de `fetch` útiles

`mensaje`

```js
fetch('/api/push', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    titulo: 'Nuevo mensaje',
    cuerpo: 'Thor te envio un mensaje',
    usuario: 'thor',
    tipo: 'mensaje'
  })
});
```

`mencion`

```js
fetch('/api/push', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    titulo: 'Te mencionaron',
    cuerpo: '@spiderman te menciono en el chat',
    usuario: 'spiderman',
    tipo: 'mencion'
  })
});
```

`alerta`

```js
fetch('/api/push', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    titulo: 'Alerta',
    cuerpo: 'Hay una alerta en el chat',
    usuario: 'hulk',
    tipo: 'alerta'
  })
});
```

`urgente`

```js
fetch('/api/push', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    titulo: 'URGENTE',
    cuerpo: 'Debes confirmar esta alerta inmediatamente',
    usuario: 'hulk',
    tipo: 'urgente'
  })
});
```
