// Routes.js - Módulo de rutas
const express = require('express');
const router = express.Router();
const push = require('./push');

const mensajes = [

  {
    _id: 'XXX',
    user: 'spiderman',
    mensaje: 'Hola Mundo'
  }

];


// Get mensajes
router.get('/', function (req, res) {
  // res.json('Obteniendo mensajes');
  res.json( mensajes );
});


// Post mensaje
router.post('/', function (req, res) {
  
  const mensaje = {
    mensaje: req.body.mensaje,
    user: req.body.user
  };

  mensajes.push( mensaje );

  console.log(mensajes);

  // Enviar notificación push a todos los suscritos (tipo 'mensaje')
  const notificacion = {
    titulo: `Nuevo mensaje de @${mensaje.user}`,
    cuerpo: mensaje.mensaje,
    usuario: mensaje.user,
    tipo: 'mensaje'
  };

  push.sendPush( notificacion );

  res.json({
    ok: true,
    mensaje
  });
});


// Almacenar la suscripción y enviar notificación de bienvenida
router.post('/subscribe', (req, res) => {

  const suscripcion = req.body;

  push.addSubscription( suscripcion );

  // Notificación de bienvenida (tipo 'bienvenida') — solo para este suscriptor
  push.sendPushToOne( suscripcion, {
    titulo: '¡Notificaciones activadas!',
    cuerpo: 'Recibirás alertas de nuevos mensajes aunque la app esté cerrada.',
    usuario: 'spiderman',
    tipo: 'bienvenida'
  });

  res.json('subscribe');

});

// Almacenar la suscripción
router.get('/key', (req, res) => {

  const key = push.getKey();


  res.send(key);

});


// Verificar si un endpoint sigue registrado en el servidor
router.post('/validar-suscripcion', (req, res) => {
  const { endpoint } = req.body;
  if (!endpoint) {
    return res.json({ valida: false });
  }
  const suscripciones = push.getSuscripciones();
  const valida = suscripciones.some(s => s.endpoint === endpoint);
  res.json({ valida });
});

// Envar una notificación PUSH a las personas
// que nosotros queramos
// ES ALGO que se controla del lado del server
router.post('/push', (req, res) => {

  const post = {
    titulo: req.body.titulo,
    cuerpo: req.body.cuerpo,
    usuario: req.body.usuario,
    tipo: req.body.tipo || 'mensaje'   // admite: 'mensaje', 'mencion', 'alerta', 'bienvenida'
  };


  push.sendPush( post );

  res.json( post );

});





module.exports = router;