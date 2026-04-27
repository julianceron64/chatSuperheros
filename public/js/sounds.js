// Sonidos de notificación generados con Web Audio API (sin archivos de audio).
//
// La Web Notifications API define la propiedad `sound` en el spec, pero ningún
// navegador la implementa — los Service Workers tampoco tienen acceso a
// AudioContext. Por eso los sonidos se reproducen desde la pestaña abierta
// cuando el SW reenvía el push via postMessage.
//
// Cuando la app está cerrada el SO reproduce su sonido de sistema por defecto.
//
// Ejemplos disponibles:
//   NotifSounds.mensaje()    — ding suave de dos tonos  (mensajes nuevos)
//   NotifSounds.mencion()    — triple ping ascendente   (menciones directas)
//   NotifSounds.alerta()     — pulsos de onda cuadrada  (alertas urgentes)
//   NotifSounds.bienvenida() — arpegio Do-Mi-Sol-Do     (bienvenida)

var NotifSounds = (function () {
    'use strict';

    var AC = window.AudioContext || window.webkitAudioContext;

    // Si el navegador no soporta Web Audio API las funciones son no-ops silenciosas
    if (!AC) {
        var noop = function () {};
        return { mensaje: noop, mencion: noop, alerta: noop, bienvenida: noop };
    }

    // ── Utilidades internas ──────────────────────────────────────────────────

    // Programa una nota en el contexto de audio dado.
    // tipo: 'sine' | 'square' | 'triangle' | 'sawtooth'
    function nota(ctx, frecuencia, inicio, duracion, tipo, volumen) {
        var osc  = ctx.createOscillator();
        var gain = ctx.createGain();

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.type = tipo;
        osc.frequency.setValueAtTime(frecuencia, inicio);

        // Envolvente: ataque instantáneo → decaimiento suave hasta silencio
        gain.gain.setValueAtTime(volumen, inicio);
        gain.gain.exponentialRampToValueAtTime(0.0001, inicio + duracion);

        osc.start(inicio);
        osc.stop(inicio + duracion + 0.02);   // pequeño margen para el fade
    }

    // Crea un AudioContext, lo resume si está suspendido y ejecuta fn(ctx).
    // Cierra el contexto después de duracionTotal segundos para liberar recursos.
    function reproducir(duracionTotal, fn) {
        try {
            var ctx = new AC();
            var ejecutar = function () {
                fn(ctx);
                setTimeout(function () {
                    try { ctx.close(); } catch (_) {}
                }, (duracionTotal + 0.15) * 1000);
            };
            if (ctx.state === 'suspended') {
                ctx.resume().then(ejecutar).catch(function () {});
            } else {
                ejecutar();
            }
        } catch (_) {}
    }

    // ── Ejemplo 1: Mensaje nuevo ─────────────────────────────────────────────
    // Ding suave de dos tonos (A5 → D6), estilo mensajería clásica.
    // Onda sinusoidal, volumen moderado, duración ~0.4 s.
    function mensaje() {
        reproducir(0.45, function (ctx) {
            var t = ctx.currentTime;
            nota(ctx, 880,  t,        0.15, 'sine', 0.30);  // A5
            nota(ctx, 1175, t + 0.16, 0.22, 'sine', 0.25);  // D6
        });
    }

    // ── Ejemplo 2: Mención directa ───────────────────────────────────────────
    // Triple ping C6-C6-E6: dos toques iguales y uno más agudo al final.
    // Más vivo que el de mensaje para llamar más la atención.
    function mencion() {
        reproducir(0.55, function (ctx) {
            var t = ctx.currentTime;
            nota(ctx, 1047, t,        0.09, 'sine', 0.38);  // C6
            nota(ctx, 1047, t + 0.13, 0.09, 'sine', 0.38);  // C6
            nota(ctx, 1319, t + 0.26, 0.20, 'sine', 0.32);  // E6
        });
    }

    // ── Ejemplo 3: Alerta urgente ────────────────────────────────────────────
    // Cuatro pulsos alternados entre A4 y C#5 con onda cuadrada.
    // El timbre áspero de la onda cuadrada transmite urgencia.
    function alerta() {
        reproducir(0.75, function (ctx) {
            var t = ctx.currentTime;
            for (var i = 0; i < 4; i++) {
                nota(ctx,
                    i % 2 === 0 ? 440 : 554,   // A4 / C#5
                    t + i * 0.17,
                    0.13,
                    'square',
                    0.18
                );
            }
        });
    }

    // ── Ejemplo 4: Bienvenida ────────────────────────────────────────────────
    // Arpegio ascendente Do-Mi-Sol-Do (C5-E5-G5-C6), onda sinusoidal suave.
    // Las notas se superponen ligeramente para un efecto de "chime" acogedor.
    function bienvenida() {
        reproducir(0.75, function (ctx) {
            var t = ctx.currentTime;
            [523, 659, 784, 1047].forEach(function (freq, i) {
                nota(ctx, freq, t + i * 0.13, 0.30, 'sine', 0.22);
            });
        });
    }

    // ── API pública ──────────────────────────────────────────────────────────
    return {
        mensaje:    mensaje,
        mencion:    mencion,
        alerta:     alerta,
        bienvenida: bienvenida
    };

}());
