// Service worker de CeutaPlay: permite instalar la web como app y abrirla
// sin conexión (con los datos guardados la última vez).
//
// · Archivos de la web (html, css, js, imágenes): primero la red; si no hay
//   conexión, la copia guardada.
// · Datos (Supabase), previsión del viento y mapas: siempre de la red; nunca
//   se guardan aquí.
// Sube VERSION cuando cambie la lista de archivos.

const VERSION = "ceutaplay-v1";
const ARCHIVOS = [
    "./", "index.html", "reservas.html", "comunidad.html", "perfil.html", "mapa.html", "login.html",
    "registro.html", "gestor.html", "admin.html", "como-funciona.html", "legal.html",
    "css/styles.css", "manifest.webmanifest",
    "js/tema.js", "js/i18n.js", "js/config.js", "js/data.js", "js/store.js", "js/nav.js", "js/auth.js",
    "js/avisos.js", "js/viento.js", "js/booking-storage.js", "js/main.js", "js/subastas.js", "js/portada.js",
    "js/reservas.js", "js/opiniones.js", "js/perfil.js", "js/comunidad.js", "js/comunidad-comun.js",
    "js/gestor.js", "js/admin.js", "js/mapa.js", "js/login.js",
    "img/app/icono-192.png", "img/app/icono-512.png",
];

self.addEventListener("install", (event) => {
    event.waitUntil(caches.open(VERSION)
        .then((cache) => Promise.allSettled(ARCHIVOS.map((a) => cache.add(a))))
        .then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
    event.waitUntil(caches.keys()
        .then((claves) => Promise.all(claves.filter((c) => c !== VERSION).map((c) => caches.delete(c))))
        .then(() => self.clients.claim()));
});

self.addEventListener("fetch", (event) => {
    const peticion = event.request;
    const url = new URL(peticion.url);
    // solo GET de esta misma web (los datos de Supabase y la previsión, siempre de la red)
    if (peticion.method !== "GET" || url.origin !== self.location.origin) return;

    // Primero la red (así siempre se ve la última versión publicada); sin
    // conexión, lo guardado la última vez
    event.respondWith(caches.open(VERSION).then((cache) => fetch(peticion)
        .then((respuesta) => {
            if (respuesta.ok) cache.put(peticion, respuesta.clone());
            return respuesta;
        })
        .catch(async () => (await cache.match(peticion, { ignoreSearch: peticion.mode === "navigate" })) ||
            (peticion.mode === "navigate" ? cache.match("index.html") : Response.error()))));
});
