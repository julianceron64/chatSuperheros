// imports
importScripts('https://cdn.jsdelivr.net/npm/pouchdb@7.0.0/dist/pouchdb.min.js')

importScripts('js/sw-db.js');
importScripts('js/sw-utils.js');


const STATIC_CACHE    = 'static-v4';
const DYNAMIC_CACHE   = 'dynamic-v1';
const INMUTABLE_CACHE = 'inmutable-v1';


const APP_SHELL = [
    '/',
    'index.html',
    'css/style.css',
    'img/favicon.ico',
    'img/avatars/hulk.jpg',
    'img/avatars/ironman.jpg',
    'img/avatars/spiderman.jpg',
    'img/avatars/thor.jpg',
    'img/avatars/wolverine.jpg',
    'js/app.js',
    'js/auth-db.js',
    'js/sounds.js',
    'js/sw-utils.js',
    'js/libs/plugins/mdtoast.min.js',
    'js/libs/plugins/mdtoast.min.css'
];

const APP_SHELL_INMUTABLE = [
    'https://fonts.googleapis.com/css?family=Quicksand:300,400',
    'https://fonts.googleapis.com/css?family=Lato:400,300',
    //'https://use.fontawesome.com/releases/v5.3.1/css/all.css',
    'https://cdnjs.cloudflare.com/ajax/libs/animate.css/3.7.0/animate.css',
    'https://cdnjs.cloudflare.com/ajax/libs/jquery/3.3.1/jquery.min.js',
    'https://cdn.jsdelivr.net/npm/pouchdb@7.0.0/dist/pouchdb.min.js'
];



self.addEventListener('install', e => {

    // Activa el nuevo SW de inmediato sin esperar a que cierren las pestañas abiertas
    self.skipWaiting();

    const cacheStatic = caches.open( STATIC_CACHE ).then(cache =>
        cache.addAll( APP_SHELL ));

    const cacheInmutable = caches.open( INMUTABLE_CACHE ).then(cache =>
        cache.addAll( APP_SHELL_INMUTABLE ));

    e.waitUntil( Promise.all([ cacheStatic, cacheInmutable ]) );

});


self.addEventListener('activate', e => {

    const limpiarCaches = caches.keys().then( keys => {

        return Promise.all( keys.map( key => {

            if ( key !== STATIC_CACHE && key.includes('static') ) {
                return caches.delete(key);
            }

            if ( key !== DYNAMIC_CACHE && key.includes('dynamic') ) {
                return caches.delete(key);
            }

        }));

    });

    // Tomar el control de todos los clientes abiertos de inmediato
    e.waitUntil( Promise.all([ limpiarCaches, self.clients.claim() ]) );

});





self.addEventListener( 'fetch', e => {

    let respuesta;

    if ( e.request.url.includes('/api') ) {

        // return respuesta????
        respuesta = manejoApiMensajes( DYNAMIC_CACHE, e.request );

    } else {

        respuesta = caches.match( e.request ).then( res => {

            if ( res ) {
                
                actualizaCacheStatico( STATIC_CACHE, e.request, APP_SHELL_INMUTABLE );
                return res;
                
            } else {
    
                return fetch( e.request ).then( newRes => {
    
                    return actualizaCacheDinamico( DYNAMIC_CACHE, e.request, newRes );
    
                });
    
            }
    
        });

    }

    e.respondWith( respuesta );

});


// tareas asíncronas
self.addEventListener('sync', e => {

    console.log('SW: Sync');

    if ( e.tag === 'nuevo-post' ) {

        // postear a BD cuando hay conexión
        const respuesta = postearMensajes();
        
        e.waitUntil( respuesta );
    }

});

// ── Botones personalizados por tipo de notificación ──────────────────────────
//
// Tipos disponibles:
//   'mensaje'   – nuevo mensaje en el chat          (acciones: ver-mensaje, responder, descartar)
//   'mencion'   – alguien te mencionó               (acciones: ver-mencion, responder, descartar)
//   'alerta'    – evento urgente del chat            (acciones: unirse, ver-detalles, ignorar)
//   'bienvenida'– confirmación al activar notifs     (acciones: ver-app, descartar)
//
function construirAcciones(tipo, usuario) {
    // URLs absolutas: los iconos de las acciones se resuelven desde el contexto del SW,
    // que puede estar activo sin ninguna pestaña abierta, por lo que las rutas
    // relativas fallan en algunos navegadores basados en Chromium.
    const base        = self.location.origin;
    const iconAvatar  = `${base}/img/avatars/${usuario}.jpg`;
    const iconApp     = `${base}/img/icons/icon-192x192.png`;
    const iconCerrar  = `${base}/img/icons/cerrar.png`;
    const iconDetalles = `${base}/img/icons/ver-detalles.png`;

    switch (tipo) {

        // Ejemplo 1: mención directa — permite ver o responder rápido
        case 'mencion':
            return [
                { action: 'ver-mencion',  title: 'Ver mención',  icon: iconAvatar  },
                { action: 'responder',    title: 'Responder',    icon: iconApp     },
                { action: 'descartar',    title: 'Descartar',    icon: iconCerrar  }
            ];

        // Ejemplo 2: alerta urgente — permite unirse, ver detalles o ignorar
        case 'alerta':
            return [
                { action: 'unirse',       title: 'Unirse',       icon: iconAvatar  },
                { action: 'ver-detalles', title: 'Ver detalles', icon: iconDetalles },
                { action: 'ignorar',      title: 'Ignorar',      icon: iconCerrar  }
            ];

        // Ejemplo 3: bienvenida al activar notificaciones — solo abrir o cerrar
        case 'bienvenida':
            return [
                { action: 'ver-app',      title: 'Abrir app',    icon: iconApp     },
                { action: 'descartar',    title: 'OK',           icon: iconCerrar  }
            ];

        // Ejemplo 4: mensaje nuevo (tipo por defecto) — ver o responder
        case 'mensaje':
        default:
            return [
                { action: 'ver-mensaje',  title: 'Ver mensaje',  icon: iconAvatar  },
                { action: 'responder',    title: 'Responder',    icon: iconApp     },
                { action: 'descartar',    title: 'Descartar',    icon: iconCerrar  }
            ];
    }
}

// Escuchar PUSH — funciona aunque la app esté cerrada
self.addEventListener('push', e => {

    // Payload por defecto si el evento llega sin datos o con datos inválidos
    const defaultData = {
        titulo: 'Chat de Superhéroes',
        cuerpo:  'Tienes un nuevo mensaje',
        usuario: 'spiderman'
    };

    let data = Object.assign({}, defaultData);

    try {
        if (e.data) {
            Object.assign(data, JSON.parse(e.data.text()));
        }
    } catch (err) {
        console.error('SW Push: payload inválido, usando datos por defecto', err);
    }

    const avatares = ['spiderman', 'ironman', 'wolverine', 'thor', 'hulk'];
    const usuarioValido = avatares.includes(data.usuario) ? data.usuario : 'spiderman';
    const tipo = data.tipo || 'mensaje';

    // Las notificaciones de bienvenida no exigen interacción y no vibran
    const esBienvenida = tipo === 'bienvenida';

    const base = self.location.origin;

    // Mapa de sonidos por tipo: archivo MP3 en public/sounds/
    // (La propiedad `sound` está en el spec pero soporte de navegadores es limitado;
    //  cuando no se implementa el OS usa su sonido de sistema por defecto.)
    const sonidosPorTipo = {
        mensaje:    `${base}/sounds/mensaje.mp3`,
        mencion:    `${base}/sounds/mencion.mp3`,
        alerta:     `${base}/sounds/alerta.mp3`,
        bienvenida: `${base}/sounds/bienvenida.mp3`
    };

    // Patrones de vibración por tipo de notificación.
    // Formato: [vibrar_ms, pausa_ms, vibrar_ms, pausa_ms, ...]
    //
    // Ejemplo 1 — mensaje: doble golpe corto y suave; discreta para chats.
    //   ▮▮  ▮▮
    //
    // Ejemplo 2 — mencion: dos pulsos breves + uno largo; más llamativa.
    //   ▮▮  ▮▮  ▮▮▮▮▮▮
    //
    // Ejemplo 3 — alerta: tres golpes largos con pausa corta; sensación de urgencia.
    //   ▮▮▮▮▮▮  ▮▮▮▮▮▮  ▮▮▮▮▮▮
    //
    // Ejemplo 4 — bienvenida: sin vibración (notificación silenciosa).
    const patronesPorTipo = {
        mensaje:    [100, 60, 100],
        mencion:    [100, 60, 100, 60, 300],
        alerta:     [300, 100, 300, 100, 300],
        bienvenida: []
    };

    const options = {
        body: data.cuerpo,
        icon: `${base}/img/avatars/${usuarioValido}.jpg`,
        badge: `${base}/img/favicon.ico`,
        tag: `${tipo}-${usuarioValido}`,
        renotify: true,
        requireInteraction: !esBienvenida,
        silent: esBienvenida,
        sound: sonidosPorTipo[tipo] || sonidosPorTipo.mensaje,
        timestamp: Date.now(),
        dir: 'ltr',
        lang: 'es',
        vibrate: patronesPorTipo[tipo] ?? patronesPorTipo.mensaje,
        data: {
            url: '/',
            usuario: usuarioValido,
            cuerpo: data.cuerpo,
            tipo: tipo,
            mensajeId: data.id || null,
            timestamp: Date.now()
        },
        actions: construirAcciones(tipo, usuarioValido)
    };

    // Cada tarea tiene su propio .catch para que un fallo en postMessage
    // nunca impida que showNotification se ejecute (causa del problema en Opera).
    const mostrarNotificacion = self.registration
        .showNotification(data.titulo, options)
        .catch(err => console.error('SW Push: showNotification falló', err));

    const notificarClientes = clients
        .matchAll({ type: 'window', includeUncontrolled: false })
        .then(clientes => {
            clientes.forEach(cliente => {
                try { cliente.postMessage({ tipo: 'push-recibido', payload: data }); }
                catch (_) { /* cliente ya cerrado */ }
            });
        })
        .catch(err => console.error('SW Push: postMessage falló', err));

    // Promise.all ya no puede rechazar: ambas promesas tienen .catch propio
    e.waitUntil(Promise.all([mostrarNotificacion, notificarClientes]));
});


self.addEventListener('notificationclose', e => {
    console.log('SW: notificación descartada sin interacción', e.notification.tag);
});

self.addEventListener('notificationclick', e => {
    const notificacion = e.notification;
    const accion = e.action;
    const data = notificacion.data || {};

    notificacion.close();

    // Acciones silenciosas: solo cierran la notificación, sin abrir la app
    if (accion === 'descartar' || accion === 'ignorar') {
        return;
    }

    const respuesta = clients.matchAll({
        type: 'window',
        includeUncontrolled: true
    }).then(clientes => {

        const clienteExistente = clientes.find(c => {
            try { return new URL(c.url).origin === self.location.origin; }
            catch (_) { return false; }
        });

        if (clienteExistente) {
            // Informar a la pestaña abierta qué acción se pulsó
            // para que reaccione en consecuencia (ver chat, abrir modal, etc.)
            clienteExistente.postMessage({
                tipo: 'notificacion-click',
                accion: accion,
                payload: data
            });
            return clienteExistente.focus();
        }

        // Sin ventana abierta → lanzar la app y pasarle la acción por URL
        const urlDestino = (accion === 'responder')
            ? `/?accion=responder&usuario=${data.usuario}`
            : '/';

        return clients.openWindow(urlDestino);
    });

    e.waitUntil(respuesta);
});