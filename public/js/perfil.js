const profilePanel = document.getElementById("profile-panel");
const profileName = document.getElementById("profile-name");
const profileNameKey = "ceutaplay-profile-name";

function bookingStart(booking) {
    return `${booking.date}T${booking.time}`;
}

function bookingEnd(booking) {
    const start = Date.parse(`${bookingStart(booking)}:00Z`);
    return new Date(start + 60 * 60 * 1000).toISOString().slice(0, 16);
}

function bookingDescription(booking) {
    const date = booking.date.split("-").reverse().join("/");
    return `${booking.facilityName} · ${booking.court} · ${date}, ${booking.time}`;
}

function showBookingList(id, bookings, emptyMessage) {
    const descriptions = bookings.length ? bookings.map(bookingDescription) : [emptyMessage];
    const items = descriptions.map((description) => {
        const item = document.createElement("li");
        item.textContent = description;
        return item;
    });
    document.getElementById(id).replaceChildren(...items);
}

function showBookingSummary() {
    const now = ceutaDateTime();
    const bookings = getReservations().map((booking) => ({
        ...booking,
        facilityName: INSTALACIONES.find(({ id }) => id === booking.facility)?.nombre || "Instalación de pádel",
    })).sort((first, second) => bookingStart(first).localeCompare(bookingStart(second)));
    const active = bookings.filter((booking) => bookingEnd(booking) > now);
    const past = bookings.filter((booking) => bookingEnd(booking) <= now).reverse();
    const next = active.find((booking) => bookingStart(booking) > now);

    document.getElementById("active-count").textContent = active.length;
    document.getElementById("past-count").textContent = past.length;
    document.getElementById("total-count").textContent = bookings.length;
    document.getElementById("next-booking").textContent = next ? bookingDescription(next) : "Sin partidas programadas";
    showBookingList("active-bookings", active, "No tienes reservas activas.");
    showBookingList("past-bookings", past, "Todavía no tienes reservas anteriores.");
}

window.addEventListener("pageshow", () => {
    if (sessionStorage.getItem("ceutaplay-demo-session") !== "active") {
        profilePanel.hidden = true;
        window.location.replace("login.html");
        return;
    }

    profileName.textContent = sessionStorage.getItem(profileNameKey) || "";
    profileName.hidden = !profileName.textContent;
    showBookingSummary();
    profilePanel.hidden = false;
});

window.addEventListener("storage", (event) => {
    if (!profilePanel.hidden && (event.key === bookingStorageKey || event.key === null)) {
        showBookingSummary();
    }
});

