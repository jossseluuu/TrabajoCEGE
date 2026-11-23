const bookingStorageKey = "ceutaplay-padel-reservations";
const ceutaDateFormat = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Madrid" });
const ceutaTimeFormat = new Intl.DateTimeFormat("es-ES", {
    timeZone: "Europe/Madrid", hour: "2-digit", minute: "2-digit",
});

function ceutaDateTime(now = new Date()) {
    return `${ceutaDateFormat.format(now)}T${ceutaTimeFormat.format(now)}`;
}

function getReservations() {
    return JSON.parse(localStorage.getItem(bookingStorageKey) || "[]");
}

function saveReservations(reservations) {
    localStorage.setItem(bookingStorageKey, JSON.stringify(reservations));
}
