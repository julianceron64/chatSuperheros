
const fs         = require('fs');
const urlsafeBase64 = require('urlsafe-base64');
const vapid      = require('./vapid.json');
const webpush    = require('web-push');

webpush.setVapidDetails(
    'mailto:julian.ceron02@uptc.edu.co',
    vapid.publicKey,
    vapid.privateKey
);

let suscripciones = require('./subs-db.json');

// ── Utilidades internas ──────────────────────────────────────────────────────

// Normaliza una entrada al formato enriquecido { usuario, dispositivo, suscripcion }.
// Soporta entradas legadas (suscripción raw sin campos de usuario).
function normalizar(entrada) {
    if (entrada && entrada.suscripcion) return entrada;
    return { usuario: 'anonimo', dispositivo: 'legado', suscripcion: entrada };
}

function extraerRaw(entrada) {
    return normalizar(entrada).suscripcion;
}

function guardar() {
    fs.writeFileSync(`${__dirname}/subs-db.json`, JSON.stringify(suscripciones, null, 2));
}

// Envía `post` a un array de entradas; elimina las que hayan expirado (410/404).
function _enviar(entradas, post) {
    if (entradas.length === 0) {
        console.log('_enviar: no hay suscripciones destino');
        return;
    }
    console.log(`Enviando push a ${entradas.length} suscripción(es)`);

    const promesas = entradas.map(entrada => {
        const raw = extraerRaw(entrada);
        return webpush.sendNotification(raw, JSON.stringify(post))
            .then(() => console.log(`Push enviado → ${normalizar(entrada).usuario}`))
            .catch(err => {
                console.log('Push falló, código:', err.statusCode);
                if (err.statusCode === 410 || err.statusCode === 404) {
                    entrada._borrar = true;
                }
            });
    });

    Promise.all(promesas).then(() => {
        suscripciones = suscripciones.filter(s => !s._borrar);
        guardar();
    });
}

// ── API pública ──────────────────────────────────────────────────────────────

module.exports.getKey = () => urlsafeBase64.decode(vapid.publicKey);

module.exports.getSuscripciones = () => suscripciones;

// Registrar una suscripción con metadatos de usuario/dispositivo.
// Si ya existe el mismo endpoint se actualiza (re-suscripción o cambio de usuario).
module.exports.addSubscription = (entrada) => {
    const nueva    = normalizar(entrada);
    const endpoint = nueva.suscripcion.endpoint;

    const idx = suscripciones.findIndex(s => extraerRaw(s).endpoint === endpoint);
    if (idx >= 0) {
        suscripciones[idx] = nueva;
        console.log(`Suscripción actualizada: usuario="${nueva.usuario}" dispositivo="${nueva.dispositivo}"`);
    } else {
        suscripciones.push(nueva);
        console.log(`Nueva suscripción: usuario="${nueva.usuario}" dispositivo="${nueva.dispositivo}"`);
    }
    guardar();
};

// Enviar push a UNA suscripción específica (ej: notificación de bienvenida).
// Acepta tanto la suscripción raw como una entrada enriquecida.
module.exports.sendPushToOne = (entrada, post) => {
    const raw = extraerRaw(entrada);
    return webpush.sendNotification(raw, JSON.stringify(post))
        .then(() => console.log('Push individual enviado'))
        .catch(err => console.error('Push individual falló:', err.statusCode));
};

// Enviar push a TODAS las suscripciones activas (broadcast).
module.exports.sendPush = (post) => {
    _enviar(suscripciones, post);
};

// Enviar push a TODAS las suscripciones de un usuario específico
// (puede tener varios dispositivos).
module.exports.sendPushToUser = (nombreUsuario, post) => {
    const destinos = suscripciones.filter(s => normalizar(s).usuario === nombreUsuario);
    console.log(`sendPushToUser "${nombreUsuario}": ${destinos.length} dispositivo(s)`);
    _enviar(destinos, post);
};

// Enviar push a UN dispositivo específico identificado por su deviceId.
module.exports.sendPushToDevice = (dispositivo, post) => {
    const destinos = suscripciones.filter(s => normalizar(s).dispositivo === dispositivo);
    console.log(`sendPushToDevice "${dispositivo}": ${destinos.length} suscripción(es)`);
    _enviar(destinos, post);
};
