var url = window.location.href;
var swLocation = '/sw.js';

var swReg;
window.enviarNotificacion = enviarNotificacion;

if (navigator.serviceWorker) {

    if (url.includes('localhost')) {
        swLocation = '/sw.js';
    }

    window.addEventListener('load', function () {

        navigator.serviceWorker.register(swLocation).then(function (reg) {

            swReg = reg;
            comprobarYRenovarSuscripcion();

        });

    });

    // Recibir mensajes del SW: push en tiempo real y clics en notificación
    navigator.serviceWorker.addEventListener('message', function (event) {
        var msg = event.data;
        if (!msg || !msg.tipo) return;

        if (msg.tipo === 'push-recibido' && msg.payload) {
            var payload = msg.payload;

            // El SW reenvía el push a TODAS las pestañas abiertas, incluida la del
            // usuario que acaba de enviar el mensaje. Ese mensaje ya se añadió al
            // timeline de forma optimista al pulsar "enviar", así que lo saltamos
            // para evitar la duplicación.
            if (payload.usuario === usuario) return;

            // ── Reproducir sonido personalizado según el tipo de notificación ──
            // Nota: solo funciona cuando la pestaña está abierta porque el SW no
            // tiene acceso a AudioContext. Al llegar en segundo plano, el SO usa
            // su sonido de sistema por defecto.
            var tipoNoti = payload.tipo || 'mensaje';
            switch (tipoNoti) {
                case 'mencion':    NotifSounds.mencion();    break;
                case 'alerta':     NotifSounds.alerta();     break;
                case 'bienvenida': NotifSounds.bienvenida(); break;
                case 'urgente':    NotifSounds.urgente();    break;
                default:           NotifSounds.mensaje();    break;
            }

            if (!timeline.hasClass('oculto')) {
                if (tipoNoti === 'urgente') {
                    $.mdtoast('ALERTA URGENTE: ' + (payload.cuerpo || payload.mensaje || ''), {
                        interaction: true,
                        interactionTimeout: 6000,
                        actionText: 'OK',
                        type: 'warning'
                    });
                } else {
                    crearMensajeHTML(payload.cuerpo || payload.mensaje || '', payload.usuario);
                }
            } else {
                $.mdtoast('Nuevo mensaje de @' + payload.usuario, {
                    interaction: true,
                    interactionTimeout: 4000,
                    actionText: 'OK'
                });
            }
        }

        if (msg.tipo === 'notificacion-click') {
            var accion  = msg.accion;
            var payload = msg.payload || {};

            switch (accion) {

                // ── Ver mensaje / mención: ir directo a esa conversación ──────
                case 'ver-mensaje':
                case 'ver-mencion':
                    if (!usuarioAuth) { mostrarLogin(); break; }
                    if (payload.usuario) {
                        irAConversacion(payload.usuario);
                    } else {
                        mostrarSeleccionHero();
                    }
                    break;

                // ── Urgente confirmado: toast de acuse de recibo ──────────────
                case 'confirmar':
                    if (!usuarioAuth) { mostrarLogin(); break; }
                    $.mdtoast('✔ Notificación urgente confirmada', {
                        interaction: true,
                        interactionTimeout: 5000,
                        actionText: 'OK'
                    });
                    break;

                // ── Alerta / unirse / abrir app: pantalla de selección ────────
                case 'ver-detalles':
                case 'unirse':
                case 'ver-app':
                case 'abrir':
                    if (!usuarioAuth) { mostrarLogin(); break; }
                    if (!timeline.hasClass('oculto') && payload.usuario) {
                        $.mdtoast('Notificación de @' + payload.usuario, {
                            interaction: true,
                            interactionTimeout: 4000,
                            actionText: 'OK'
                        });
                    } else {
                        mostrarSeleccionHero();
                    }
                    break;

                // ── Responder: ir a la conversación y abrir el modal ──────────
                case 'responder':
                    if (!usuarioAuth) { mostrarLogin(); break; }
                    if (payload.usuario) {
                        irAConversacion(payload.usuario);
                        setTimeout(function () { nuevoBtn.click(); }, 350);
                    } else if (!timeline.hasClass('oculto')) {
                        nuevoBtn.click();
                    } else {
                        mostrarSeleccionHero();
                    }
                    break;
            }
        }
    });

}


// Referencias de jQuery

var titulo = $('#titulo');
var nuevoBtn = $('#nuevo-btn');
var salirBtn = $('#salir-btn');
var cancelarBtn = $('#cancel-btn');
var postBtn = $('#post-btn');
var avatarSel = $('#seleccion');
var timeline = $('#timeline');

var modal = $('#modal');
var modalAvatar = $('#modal-avatar');
var avatarBtns = $('.seleccion-avatar');
var txtMensaje = $('#txtMensaje');

var btnActivadas = $('.btn-noti-activadas');
var btnDesactivadas = $('.btn-noti-desactivadas');

// Referencias de autenticación
var loginSection = $('#login-section');
var registroSection = $('#registro-section');
var loginForm = $('#login-form');
var registroForm = $('#registro-form');
var loginError = $('#login-error');
var registroError = $('#registro-error');
var usuarioNombre = $('#usuario-nombre');
var logoutBtn = $('#logout-btn');

// El héroe seleccionado y el usuario autenticado
var usuario;
var usuarioAuth = null;

var NOTIF_PREF_KEY = 'notificacionesDeseadas';


// ===== Navegación entre pantallas de auth =====

function mostrarLogin() {
    loginSection.removeClass('oculto');
    registroSection.addClass('oculto');
    avatarSel.addClass('oculto');
    timeline.addClass('oculto');
    nuevoBtn.addClass('oculto');
    salirBtn.addClass('oculto');
    loginError.addClass('oculto');
}

function mostrarRegistro() {
    registroSection.removeClass('oculto');
    loginSection.addClass('oculto');
    avatarSel.addClass('oculto');
    registroError.addClass('oculto');
}

function mostrarSeleccionHero() {
    loginSection.addClass('oculto');
    registroSection.addClass('oculto');
    avatarSel.removeClass('oculto');
    timeline.addClass('oculto');
    nuevoBtn.addClass('oculto');
    salirBtn.addClass('oculto');
    titulo.html('<i class="fa fa-user"></i> Seleccione Personaje');
    usuarioNombre.text(usuarioAuth ? usuarioAuth.nombre : 'Usuario');
}


// ===== Inicialización de autenticación =====

AuthDB.initDB()
    .then(function () {
        return AuthDB.obtenerSesion();
    })
    .then(function (sesion) {
        if (sesion) {
            usuarioAuth = sesion;
            mostrarSeleccionHero();
            manejarParametrosUrl();   // navegar si la app fue abierta desde notificación
        } else {
            mostrarLogin();
        }
    })
    .catch(function (err) {
        console.error('Error iniciando AuthDB:', err);
        mostrarLogin();
    });


// ===== Formulario de Login =====

loginForm.on('submit', function (e) {
    e.preventDefault();

    var username = $('#login-username').val().trim();
    var password = $('#login-password').val();

    if (!username || !password) {
        loginError.text('Por favor completa todos los campos.').removeClass('oculto');
        return;
    }

    var btn = loginForm.find('button[type="submit"]');
    btn.prop('disabled', true).text('Verificando...');

    AuthDB.loginUsuario(username, password)
        .then(function (usuario) {
            return AuthDB.guardarSesion(usuario).then(function () {
                return usuario;
            });
        })
        .then(function (usuarioData) {
            usuarioAuth = {
                username: usuarioData.username,
                nombre: usuarioData.nombre,
                hero: usuarioData.heroeFavorito
            };
            loginForm[0].reset();
            loginError.addClass('oculto');
            mostrarSeleccionHero();
        })
        .catch(function (err) {
            loginError.text(err).removeClass('oculto');
        })
        .finally(function () {
            btn.prop('disabled', false).text('Iniciar Sesión');
        });
});


// ===== Formulario de Registro =====

registroForm.on('submit', function (e) {
    e.preventDefault();

    var nombre = $('#reg-nombre').val().trim();
    var username = $('#reg-username').val().trim();
    var password = $('#reg-password').val();
    var password2 = $('#reg-password2').val();

    if (!nombre || !username || !password || !password2) {
        registroError.text('Por favor completa todos los campos.').removeClass('oculto');
        return;
    }

    if (username.length < 3) {
        registroError.text('El nombre de usuario debe tener al menos 3 caracteres.').removeClass('oculto');
        return;
    }

    if (password.length < 4) {
        registroError.text('La contraseña debe tener al menos 4 caracteres.').removeClass('oculto');
        return;
    }

    if (password !== password2) {
        registroError.text('Las contraseñas no coinciden.').removeClass('oculto');
        return;
    }

    var btn = registroForm.find('button[type="submit"]');
    btn.prop('disabled', true).text('Creando cuenta...');

    AuthDB.registrarUsuario(username, password, nombre)
        .then(function (nuevoUsuario) {
            return AuthDB.guardarSesion(nuevoUsuario).then(function () {
                return nuevoUsuario;
            });
        })
        .then(function (nuevoUsuario) {
            usuarioAuth = {
                username: nuevoUsuario.username,
                nombre: nuevoUsuario.nombre,
                hero: null
            };
            registroForm[0].reset();
            registroError.addClass('oculto');
            mostrarSeleccionHero();
        })
        .catch(function (err) {
            registroError.text(err).removeClass('oculto');
        })
        .finally(function () {
            btn.prop('disabled', false).text('Crear Cuenta');
        });
});


// ===== Alternar entre Login y Registro =====

$('#link-registro').on('click', function (e) {
    e.preventDefault();
    mostrarRegistro();
});

$('#link-login').on('click', function (e) {
    e.preventDefault();
    mostrarLogin();
});


// ===== Cerrar sesión completa =====

logoutBtn.on('click', function () {
    AuthDB.cerrarSesion()
        .then(function () {
            usuarioAuth = null;
            usuario = null;
            mostrarLogin();
        })
        .catch(function (err) {
            console.error('Error al cerrar sesión:', err);
        });
});


// ===== Codigo de la aplicación =====

function crearMensajeHTML(mensaje, personaje) {

    var content = `
    <li class="animated fadeIn fast">
        <div class="avatar">
            <img src="img/avatars/${personaje}.jpg">
        </div>
        <div class="bubble-container">
            <div class="bubble">
                <h3>@${personaje}</h3>
                <br/>
                ${mensaje}
            </div>

            <div class="arrow"></div>
        </div>
    </li>
    `;

    timeline.prepend(content);
    cancelarBtn.click();

}


function logIn(ingreso) {

    if (ingreso) {
        nuevoBtn.removeClass('oculto');
        salirBtn.removeClass('oculto');
        timeline.removeClass('oculto');
        avatarSel.addClass('oculto');
        modalAvatar.attr('src', 'img/avatars/' + usuario + '.jpg');
    } else {
        nuevoBtn.addClass('oculto');
        salirBtn.addClass('oculto');
        timeline.addClass('oculto');
        avatarSel.removeClass('oculto');
        titulo.html('<i class="fa fa-user"></i> Seleccione Personaje');
    }

}


// Navega directamente a la conversación con el héroe indicado.
// Equivale a hacer clic en su avatar desde la pantalla de selección.
var AVATARES_VALIDOS = ['spiderman', 'ironman', 'wolverine', 'thor', 'hulk'];

function irAConversacion(heroe) {
    if (!AVATARES_VALIDOS.includes(heroe)) return;
    usuario = heroe;
    titulo.text('@' + heroe);
    if (usuarioAuth) {
        AuthDB.actualizarHero(usuarioAuth.username, heroe);
        usuarioAuth.hero = heroe;
    }
    logIn(true);
}


// Lee los parámetros de URL que el SW inyecta al abrir la app desde una
// notificación y navega a la pantalla correcta.
//
//   ?conversacion=X          → abre el chat con el héroe X
//   ?conversacion=X&accion=responder → abre chat + modal de redacción
//   ?conversacion=X&origen=mencion   → abre el chat (mención resaltada)
//   ?vista=alerta            → muestra la pantalla de selección de héroe
function manejarParametrosUrl() {
    if (!usuarioAuth) return;
    var params       = new URLSearchParams(window.location.search);
    var conversacion = params.get('conversacion');
    var vista        = params.get('vista');
    var accion       = params.get('accion');

    if (conversacion) {
        irAConversacion(conversacion);
        if (accion === 'responder') {
            setTimeout(function () { nuevoBtn.click(); }, 350);
        }
    } else if (vista === 'alerta') {
        mostrarSeleccionHero();
    }
}


// Seleccion de personaje
avatarBtns.on('click', function () {

    usuario = $(this).data('user');
    titulo.text('@' + usuario);

    // Asociar el héroe con el usuario autenticado en IndexedDB
    if (usuarioAuth) {
        AuthDB.actualizarHero(usuarioAuth.username, usuario);
        usuarioAuth.hero = usuario;
    }

    logIn(true);

});

// Boton de salir (vuelve a selección de héroe, mantiene sesión)
salirBtn.on('click', function () {

    logIn(false);

});

// Boton de nuevo mensaje
nuevoBtn.on('click', function () {

    modal.removeClass('oculto');
    modal.animate({
        marginTop: '-=1000px',
        opacity: 1
    }, 200);

});


// Boton de cancelar mensaje
cancelarBtn.on('click', function () {
    if (!modal.hasClass('oculto')) {
        modal.animate({
            marginTop: '+=1000px',
            opacity: 0
        }, 200, function () {
            modal.addClass('oculto');
            txtMensaje.val('');
        });
    }
});

// Boton de enviar mensaje
postBtn.on('click', function () {

    var mensaje = txtMensaje.val();
    if (mensaje.length === 0) {
        cancelarBtn.click();
        return;
    }

    var data = {
        mensaje: mensaje,
        user: usuario
    };


    fetch('api', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
    })
        .then(res => res.json())
        .then(res => console.log('app.js', res))
        .catch(err => console.log('app.js error:', err));

    crearMensajeHTML(mensaje, usuario);

});


// Obtener mensajes del servidor
function getMensajes() {

    fetch('api')
        .then(res => res.json())
        .then(posts => {

            console.log(posts);
            posts.forEach(post =>
                crearMensajeHTML(post.mensaje, post.user));

        });

}

getMensajes();


// Detectar cambios de conexión
function isOnline() {

    if (navigator.onLine) {
        $.mdtoast('Online', {
            interaction: true,
            interactionTimeout: 1000,
            actionText: 'OK!'
        });

    } else {
        $.mdtoast('Offline', {
            interaction: true,
            actionText: 'OK',
            type: 'warning'
        });
    }

}

window.addEventListener('online', isOnline);
window.addEventListener('offline', isOnline);

// Revalida la suscripción cada vez que la pestaña vuelve a ser visible
document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible') {
        comprobarYRenovarSuscripcion();
    }
});

isOnline();


// Comprueba el estado real de la suscripción y la renueva si es necesario
async function comprobarYRenovarSuscripcion() {
    if (!swReg) return;

    try {
        var suscripcion = await swReg.pushManager.getSubscription();
        var quiereNotificaciones = localStorage.getItem(NOTIF_PREF_KEY) === 'true';
        var permisoOk = Notification.permission === 'granted';

        var expirada = suscripcion &&
            suscripcion.expirationTime !== null &&
            suscripcion.expirationTime < Date.now();

        var activa = suscripcion && !expirada;

        verificaSuscripcion(activa ? suscripcion : null);

        if (quiereNotificaciones && permisoOk && !activa) {
            console.log('Suscripción inactiva. Renovando automáticamente...');
            await renovarSuscripcion();
            return;
        }

        if (activa) {
            var validaEnServidor = await validarConServidor(suscripcion.endpoint);
            if (!validaEnServidor) {
                verificaSuscripcion(null);
                if (quiereNotificaciones && permisoOk) {
                    console.log('Suscripción eliminada en servidor. Renovando...');
                    await renovarSuscripcion();
                }
            }
        }
    } catch (err) {
        console.error('Error al comprobar suscripción:', err);
    }
}

// Cancela la suscripción vieja (si existe) y crea una nueva
async function renovarSuscripcion() {
    try {
        var oldSub = await swReg.pushManager.getSubscription();
        if (oldSub) {
            await oldSub.unsubscribe();
        }

        var key = await getPublicKey();
        var nuevaSuscripcion = await swReg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: key
        });

        await fetch('api/subscribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(nuevaSuscripcion)
        });

        localStorage.setItem(NOTIF_PREF_KEY, 'true');
        verificaSuscripcion(nuevaSuscripcion);

        $.mdtoast('Notificaciones renovadas automáticamente', {
            interaction: true,
            interactionTimeout: 3000,
            actionText: 'OK'
        });

    } catch (err) {
        console.error('Error al renovar suscripción:', err);
        verificaSuscripcion(null);
    }
}

// Consulta al servidor si el endpoint sigue registrado
function validarConServidor(endpoint) {
    return fetch('api/validar-suscripcion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: endpoint })
    })
        .then(function (res) { return res.json(); })
        .then(function (data) { return data.valida === true; })
        .catch(function () { return true; }); // Si falla la consulta, asumir válida
}

// Notificaciones
function verificaSuscripcion(activadas) {

    var statusLabel = $('#notif-status');
    var permiso = Notification.permission;

    statusLabel.text('Status: ' + permiso.toUpperCase());

    if (permiso === 'granted') {
        statusLabel.css('color', '#2ecc71');
    } else if (permiso === 'denied') {
        statusLabel.css('color', '#e74c3c');
    } else {
        statusLabel.css('color', 'gold');
    }

    if (activadas) {
        btnActivadas.removeClass('oculto');
        btnDesactivadas.addClass('oculto');
    } else {
        btnActivadas.addClass('oculto');
        btnDesactivadas.removeClass('oculto');
    }

}


async function enviarNotificacion() {

    if (!swReg) {
        console.log('No hay registro de Service Worker');
        return;
    }
    if (!('Notification' in window)) {
        console.log('Este navegador no soporta notificaciones');
        return;
    }

    if (Notification.permission !== 'granted') {
        console.log('No hay permiso para mostrar notificaciones');
        return;
    }
    try {
        console.log('Mostrando notificación de prueba...');
        await swReg.showNotification('Notificación de prueba', {
            body: 'Las notificaciones funcionan correctamente en Chrome',
            icon: 'img/icons/icon-192x192.png',
            badge: 'img/favicon.ico',
            data: {
                url: '/index.html'
            },
            requireInteraction: true
        });
    } catch (err) {
        console.log('Error mostrando notificación de prueba:', err);
    }

}

async function solicitarPermisoNotificaciones() {
    if (!('Notification' in window)) {
        console.log('Este navegador no soporta notificaciones');
        return false;
    }

    if (Notification.permission === 'granted') {
        console.log('El permiso para las notificaciones se ha concedido!');
        return true;
    }

    if (Notification.permission === 'denied') {
        console.log('El usuario bloqueó las notificaciones');
        return false;
    }

    const permiso = await Notification.requestPermission();
    return permiso === 'granted';
}


// Get Key
function getPublicKey() {

    return fetch('api/key')
        .then(res => res.arrayBuffer())
        .then(key => new Uint8Array(key));

}

/* btnDesactivadas.on( 'click', function() {

    if ( !swReg ) return console.log('No hay registro de SW');

    getPublicKey().then( function( key ) {

        swReg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: key
        })
        .then( res => res.toJSON() )
        .then( suscripcion => {

            // console.log(suscripcion);
            fetch('api/subscribe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify( suscripcion )
            })
            .then( verificaSuscripcion )
            .catch( cancelarSuscripcion );


        });


    });


});
 */

btnDesactivadas.on('click', async function () {

    try {
        if (!swReg) {
            console.log('No hay registro de SW');
            return;
        }

        const permitido = await solicitarPermisoNotificaciones();

        if (!permitido) {
            console.log('El usuario no concedió permisos');
            return;
        }

        const key = await getPublicKey();

        const subscription = await swReg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: key
        });

        await fetch('api/subscribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(subscription)
        });

        localStorage.setItem(NOTIF_PREF_KEY, 'true');
        verificaSuscripcion(subscription);

    } catch (err) {
        console.error('Error al activar notificaciones push:', err);
        verificaSuscripcion(null);
    }

});


function cancelarSuscripcion() {

    swReg.pushManager.getSubscription().then(subs => {

        subs.unsubscribe().then(function () {
            localStorage.removeItem(NOTIF_PREF_KEY);
            verificaSuscripcion(false);
        });

    });

}

btnActivadas.on('click', function () {

    cancelarSuscripcion();

});
