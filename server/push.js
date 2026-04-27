
const fs = require('fs');


const urlsafeBase64 = require('urlsafe-base64');
const vapid = require('./vapid.json');

const webpush = require('web-push');

webpush.setVapidDetails(
    'mailto:julian.ceron02@uptc.edu.co',
    vapid.publicKey,
    vapid.privateKey
  );




let suscripciones = require('./subs-db.json');


module.exports.getKey = () => {
    return urlsafeBase64.decode( vapid.publicKey );
};

module.exports.getSuscripciones = () => suscripciones;

// Enviar push solo a una suscripción específica (ej: notificación de bienvenida)
module.exports.sendPushToOne = ( suscripcion, post ) => {
    return webpush.sendNotification( suscripcion, JSON.stringify( post ) )
        .then( () => console.log('Push individual enviado') )
        .catch( err => console.error('Push individual falló:', err.statusCode) );
};



module.exports.addSubscription = ( suscripcion ) => {
    console.log('Antes enviar suscripción ');
    suscripciones.push( suscripcion );

    console.log('antes modificar subs-db.json');
    fs.writeFileSync(`${ __dirname }/subs-db.json`, JSON.stringify(suscripciones) );
    console.log('Nueva suscripción agregada');
};


module.exports.sendPush = ( post ) => {

    console.log('Mandando PUSHES');

    const notificacionesEnviadas = [];


    suscripciones.forEach( (suscripcion, i) => {


        const pushProm = webpush.sendNotification( suscripcion , JSON.stringify( post ) )
            .then( () => console.log( 'Notificacion enviada ') )
            .catch( err => {

                console.log('Notificación falló, código:', err.statusCode);

                // 410 Gone: suscripción expirada/eliminada por el servicio push
                // 404 Not Found: endpoint ya no existe
                if ( err.statusCode === 410 || err.statusCode === 404 ) {
                    suscripciones[i].borrar = true;
                }

            });

        notificacionesEnviadas.push( pushProm );

    });

    Promise.all( notificacionesEnviadas ).then( () => {


        suscripciones = suscripciones.filter( subs => !subs.borrar );

        fs.writeFileSync(`${ __dirname }/subs-db.json`, JSON.stringify(suscripciones) );

    });

}

