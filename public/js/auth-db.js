var AuthDB = (function () {

    var DB_NAME = 'ChatHeroesDB';
    var DB_VERSION = 1;
    var db = null;

    function asegurarUsuarioPorDefecto() {
        var username = 'usuario';

        return new Promise(function (resolve, reject) {
            var tx = db.transaction('usuarios', 'readonly');
            var store = tx.objectStore('usuarios');
            var req = store.get(username);

            req.onsuccess = function (e) {
                if (e.target.result) {
                    resolve(false);
                    return;
                }

                hashPassword('usuario123').then(function (hash) {
                    var txCreate = db.transaction('usuarios', 'readwrite');
                    var storeCreate = txCreate.objectStore('usuarios');

                    storeCreate.add({
                        username: username,
                        password: hash,
                        nombre: 'Usuario',
                        creadoEn: Date.now(),
                        heroeFavorito: null
                    });

                    txCreate.oncomplete = function () { resolve(true); };
                    txCreate.onerror = function () { reject('Error al crear usuario por defecto'); };
                }).catch(reject);
            };

            req.onerror = function () { reject('Error al verificar usuario por defecto'); };
        });
    }

    function initDB() {
        return new Promise(function (resolve, reject) {
            var req = indexedDB.open(DB_NAME, DB_VERSION);

            req.onupgradeneeded = function (e) {
                var database = e.target.result;

                if (!database.objectStoreNames.contains('usuarios')) {
                    database.createObjectStore('usuarios', { keyPath: 'username' });
                }

                if (!database.objectStoreNames.contains('sesion')) {
                    database.createObjectStore('sesion', { keyPath: 'id' });
                }
            };

            req.onsuccess = function (e) {
                db = e.target.result;
                asegurarUsuarioPorDefecto()
                    .then(function () { resolve(db); })
                    .catch(reject);
            };

            req.onerror = function (e) {
                reject(e.target.error);
            };
        });
    }

    function hashPassword(password) {
        var encoder = new TextEncoder();
        var data = encoder.encode(password);
        return crypto.subtle.digest('SHA-256', data).then(function (buf) {
            return Array.from(new Uint8Array(buf))
                .map(function (b) { return b.toString(16).padStart(2, '0'); })
                .join('');
        });
    }

    function registrarUsuario(username, password, nombre) {
        return hashPassword(password).then(function (hash) {
            return new Promise(function (resolve, reject) {
                var tx = db.transaction('usuarios', 'readwrite');
                var store = tx.objectStore('usuarios');

                var usuario = {
                    username: username.toLowerCase().trim(),
                    password: hash,
                    nombre: nombre.trim(),
                    creadoEn: Date.now(),
                    heroeFavorito: null
                };

                var req = store.add(usuario);
                req.onsuccess = function () { resolve(usuario); };
                req.onerror = function () { reject('El nombre de usuario ya existe'); };
            });
        });
    }

    function loginUsuario(username, password) {
        return hashPassword(password).then(function (hash) {
            return new Promise(function (resolve, reject) {
                var tx = db.transaction('usuarios', 'readonly');
                var store = tx.objectStore('usuarios');
                var req = store.get(username.toLowerCase().trim());

                req.onsuccess = function (e) {
                    var usuario = e.target.result;
                    if (!usuario) {
                        reject('Usuario no encontrado');
                    } else if (usuario.password !== hash) {
                        reject('Contraseña incorrecta');
                    } else {
                        resolve(usuario);
                    }
                };

                req.onerror = function () { reject('Error al buscar usuario'); };
            });
        });
    }

    function guardarSesion(usuario) {
        return new Promise(function (resolve, reject) {
            var tx = db.transaction('sesion', 'readwrite');
            var store = tx.objectStore('sesion');

            var sesion = {
                id: 'current',
                username: usuario.username,
                nombre: usuario.nombre,
                hero: usuario.heroeFavorito || null,
                loginEn: Date.now()
            };

            var req = store.put(sesion);
            req.onsuccess = function () { resolve(sesion); };
            req.onerror = function () { reject('Error al guardar sesión'); };
        });
    }

    function obtenerSesion() {
        return new Promise(function (resolve, reject) {
            if (!db) { resolve(null); return; }
            var tx = db.transaction('sesion', 'readonly');
            var store = tx.objectStore('sesion');
            var req = store.get('current');

            req.onsuccess = function (e) { resolve(e.target.result || null); };
            req.onerror = function () { resolve(null); };
        });
    }

    function cerrarSesion() {
        return new Promise(function (resolve, reject) {
            var tx = db.transaction('sesion', 'readwrite');
            var store = tx.objectStore('sesion');
            var req = store.delete('current');

            req.onsuccess = function () { resolve(); };
            req.onerror = function () { reject('Error al cerrar sesión'); };
        });
    }

    function actualizarHero(username, hero) {
        // Update hero in the usuario record
        var tx1 = db.transaction('usuarios', 'readwrite');
        var store1 = tx1.objectStore('usuarios');
        var req1 = store1.get(username);
        req1.onsuccess = function (e) {
            var usuario = e.target.result;
            if (usuario) {
                usuario.heroeFavorito = hero;
                store1.put(usuario);
            }
        };

        // Update hero in the session record
        return new Promise(function (resolve, reject) {
            var tx2 = db.transaction('sesion', 'readwrite');
            var store2 = tx2.objectStore('sesion');
            var req2 = store2.get('current');

            req2.onsuccess = function (e) {
                var sesion = e.target.result;
                if (sesion) {
                    sesion.hero = hero;
                    store2.put(sesion);
                }
            };

            tx2.oncomplete = function () { resolve(); };
            tx2.onerror = function () { reject('Error al actualizar héroe'); };
        });
    }

    return {
        initDB: initDB,
        registrarUsuario: registrarUsuario,
        loginUsuario: loginUsuario,
        guardarSesion: guardarSesion,
        obtenerSesion: obtenerSesion,
        cerrarSesion: cerrarSesion,
        actualizarHero: actualizarHero
    };

})();
