const express = require('express');
const router  = express.Router();
const push    = require('./push');

const mensajes = [
  { _id: 'XXX', user: 'spiderman', mensaje: 'Hola Mundo' }
];


// ── Mensajes ─────────────────────────────────────────────────────────────────

router.get('/', (req, res) => {
  res.json(mensajes);
});

router.post('/', (req, res) => {
  const mensaje = {
    mensaje: req.body.mensaje,
    user:    req.body.user
  };
  mensajes.push(mensaje);
  console.log(mensajes);

  push.sendPush({
    titulo:  `Nuevo mensaje de @${mensaje.user}`,
    cuerpo:  mensaje.mensaje,
    usuario: mensaje.user,
    tipo:    'mensaje'
  });

  res.json({ ok: true, mensaje });
});


// ── Suscripciones ─────────────────────────────────────────────────────────────

// Registrar suscripción y enviar notificación de bienvenida.
// Body esperado: { suscripcion: <PushSubscription>, usuario: string, dispositivo: string }
// También acepta el formato legado (PushSubscription directo) por compatibilidad.
router.post('/subscribe', (req, res) => {
  const body = req.body;

  // Detectar formato: enriquecido o legado
  const entrada = body.suscripcion
    ? { suscripcion: body.suscripcion, usuario: body.usuario || 'anonimo', dispositivo: body.dispositivo || 'desconocido' }
    : { suscripcion: body,             usuario: 'anonimo',                 dispositivo: 'legado' };

  push.addSubscription(entrada);

  // Bienvenida solo para este suscriptor
  push.sendPushToOne(entrada, {
    titulo:  '¡Notificaciones activadas!',
    cuerpo:  `Hola ${entrada.usuario}. Recibirás alertas aunque la app esté cerrada.`,
    usuario: 'spiderman',
    tipo:    'bienvenida'
  });

  res.json({ ok: true, usuario: entrada.usuario, dispositivo: entrada.dispositivo });
});

router.get('/key', (req, res) => {
  res.send(push.getKey());
});

// Verificar si un endpoint sigue registrado en el servidor
router.post('/validar-suscripcion', (req, res) => {
  const { endpoint } = req.body;
  if (!endpoint) return res.json({ valida: false });

  const suscripciones = push.getSuscripciones();
  // Soporta formato enriquecido y legado
  const valida = suscripciones.some(s => {
    const raw = s.suscripcion || s;
    return raw.endpoint === endpoint;
  });
  res.json({ valida });
});


// ── Envío de notificaciones push ──────────────────────────────────────────────

// Enviar push con destino configurable.
// Tipos admitidos: 'mensaje' | 'mencion' | 'alerta' | 'bienvenida' | 'urgente'
//
// Destino (opcional, por orden de prioridad):
//   dispositivo  → solo ese dispositivo (deviceId)
//   usuario      → todos los dispositivos de ese usuario
//   (ninguno)    → broadcast a todos los suscritos
//
// Ejemplo usuario específico:
//   POST /api/push  { "titulo":"...", "cuerpo":"...", "usuario":"ironman", "destinatario":"johndoe" }
//
// Ejemplo dispositivo específico:
//   POST /api/push  { "titulo":"...", "cuerpo":"...", "dispositivo":"dev_abc123" }
router.post('/push', (req, res) => {
  const tiposValidos = ['mensaje', 'mencion', 'alerta', 'bienvenida', 'urgente'];
  const tipo = tiposValidos.includes(req.body.tipo) ? req.body.tipo : 'mensaje';

  const post = {
    titulo:              req.body.titulo,
    cuerpo:              req.body.cuerpo,
    usuario:             req.body.usuario,
    tipo:                tipo,
    requiereInteraccion: req.body.requiereInteraccion === true || tipo === 'urgente'
  };

  const destinatario = req.body.destinatario;   // username destino
  const dispositivo  = req.body.dispositivo;    // deviceId destino

  if (dispositivo) {
    push.sendPushToDevice(dispositivo, post);
  } else if (destinatario) {
    push.sendPushToUser(destinatario, post);
  } else {
    push.sendPush(post);
  }

  res.json({ ok: true, destino: dispositivo || destinatario || 'todos', post });
});


// Atajo semántico: enviar push a un usuario específico por nombre de ruta.
// POST /api/push/usuario/johndoe
router.post('/push/usuario/:username', (req, res) => {
  const tiposValidos = ['mensaje', 'mencion', 'alerta', 'bienvenida', 'urgente'];
  const tipo = tiposValidos.includes(req.body.tipo) ? req.body.tipo : 'mensaje';

  const post = {
    titulo:              req.body.titulo  || 'Notificación',
    cuerpo:              req.body.cuerpo  || '',
    usuario:             req.body.usuario || req.params.username,
    tipo:                tipo,
    requiereInteraccion: req.body.requiereInteraccion === true || tipo === 'urgente'
  };

  push.sendPushToUser(req.params.username, post);
  res.json({ ok: true, destino: req.params.username, post });
});


module.exports = router;
