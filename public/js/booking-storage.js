// Utilidades de las páginas de reservas y perfil.
// Las reservas se guardan a través de Store (store.js): en el servidor si está
// configurado, o en este navegador si no.

const ceutaDateFormat = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Madrid" });
const ceutaTimeFormat = new Intl.DateTimeFormat("es-ES", {
    timeZone: "Europe/Madrid", hour: "2-digit", minute: "2-digit",
});

// Fecha y hora actuales en Ceuta, en formato AAAA-MM-DDTHH:MM
function ceutaDateTime(now = new Date(Store.ahora())) {
    return `${ceutaDateFormat.format(now)}T${ceutaTimeFormat.format(now)}`;
}

// Reservas del usuario que ha iniciado sesión: [{ id, facility, court, date, time }]
function getReservations() {
    return Store.misReservas();
}

// Si no hay sesión, manda a login.html y vuelve a esta página después
function requireLogin() {
    if (Store.usuarioActual()) return true;
    const volver = location.pathname.split("/").pop() + location.search;
    location.replace(`login.html?volver=${encodeURIComponent(volver || "index.html")}`);
    return false;
}
