// Sonidos de notificación cargados desde archivos MP3.
//
// Coloca los archivos en public/sounds/ (raíz web del proyecto):
//   public/sounds/mensaje.mp3    — sonido para mensajes nuevos
//   public/sounds/mencion.mp3    — sonido para menciones directas
//   public/sounds/alerta.mp3     — sonido para alertas urgentes
//   public/sounds/bienvenida.mp3 — sonido para notificaciones de bienvenida
//
// Uso:
//   NotifSounds.mensaje()
//   NotifSounds.mencion()
//   NotifSounds.alerta()
//   NotifSounds.bienvenida()
//
// Nota: los sonidos sólo se reproducen cuando la pestaña está abierta.
// Cuando la app está cerrada el SW intenta usar la propiedad `sound` de la
// notificación, pero el soporte de navegadores es limitado (Chrome/Firefox
// no la implementan aún); en ese caso el SO usa su sonido de sistema.

var NotifSounds = (function () {
    'use strict';

    var BASE = '/sounds/';

    // ── Utilidad interna ─────────────────────────────────────────────────────

    // Crea un elemento Audio, ajusta volumen y reproduce.
    // Devuelve la promesa de play() para poder encadenar .then/.catch si hace falta.
    function reproducir(archivo, volumen) {
        var audio = new Audio(BASE + archivo);
        audio.volume = volumen !== undefined ? volumen : 0.7;
        return audio.play().catch(function (err) {
            console.warn('[Sounds] No se pudo reproducir "' + archivo + '":', err.message);
        });
    }

    // ── Ejemplo 1: Mensaje nuevo ─────────────────────────────────────────────
    // Archivo: public/sounds/mensaje.mp3
    // Sonido suave para notificaciones de chat genéricas.
    function mensaje() {
        return reproducir('mensaje.mp3', 0.7);
    }

    // ── Ejemplo 2: Mención directa ───────────────────────────────────────────
    // Archivo: public/sounds/mencion.mp3
    // Sonido más llamativo para cuando alguien te menciona directamente.
    function mencion() {
        return reproducir('mencion.mp3', 0.8);
    }

    // ── Ejemplo 3: Alerta urgente ────────────────────────────────────────────
    // Archivo: public/sounds/alerta.mp3
    // Sonido con urgencia para alertas críticas; volumen más alto.
    function alerta() {
        return reproducir('alerta.mp3', 1.0);
    }

    // ── Ejemplo 4: Bienvenida ────────────────────────────────────────────────
    // Archivo: public/sounds/bienvenida.mp3
    // Sonido cálido y agradable para el primer contacto del usuario.
    function bienvenida() {
        return reproducir('bienvenida.mp3', 0.6);
    }

    // ── Ejemplo 5: Urgente ───────────────────────────────────────────────────
    // Archivo: public/sounds/urgente.mp3
    // Sonido de máxima atención; volumen al 100%. Acompaña notificaciones que
    // requieren interacción obligatoria (requireInteraction: true).
    function urgente() {
        return reproducir('urgente.mp3', 1.0);
    }

    // ── API pública ──────────────────────────────────────────────────────────
    return {
        mensaje:    mensaje,
        mencion:    mencion,
        alerta:     alerta,
        bienvenida: bienvenida,
        urgente:    urgente
    };

}());
