const profilePanel = document.getElementById("profile-panel");
const profileName = document.getElementById("profile-name");
const profileEmail = document.getElementById("profile-email");

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
        facilityName: INSTALACIONES.find(({ id }) => id === booking.facility)?.nombre || "Instalación deportiva",
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

function auctionDescription(auction) {
    const date = auction.fecha.split("-").reverse().join("/");
    return `${auction.titulo} · ${date}, ${auction.hora} · ${auction.precioActual} €`;
}

function showAuctionSummary(usuario) {
    const auctions = Store.listarSubastas();
    const created = auctions.filter((auction) => auction.vendedorId === usuario.id);
    const bidding = auctions.filter((auction) => auction.estado === "activa" &&
        auction.pujas.some((bid) => bid.usuarioId === usuario.id));
    const won = auctions.filter((auction) => auction.ganador && auction.ganador.id === usuario.id);

    document.getElementById("auctions-created").textContent = created.length;
    document.getElementById("auctions-bidding").textContent = bidding.length;
    document.getElementById("auctions-won").textContent = won.length;

    const biddingTexts = bidding.map((auction) => {
        const winning = auction.mejorPuja.usuarioId === usuario.id;
        return `${auctionDescription(auction)} · ${winning ? "🏆 vas ganando" : "⚠️ te han superado"}`;
    });
    showList("bidding-list", biddingTexts, "No estás pujando en ninguna subasta.");
    showList("won-list", won.map(auctionDescription), "Todavía no has ganado ninguna subasta.");
}

function showList(id, texts, emptyMessage) {
    const items = (texts.length ? texts : [emptyMessage]).map((text) => {
        const item = document.createElement("li");
        item.textContent = text;
        return item;
    });
    document.getElementById(id).replaceChildren(...items);
}

function showProfile() {
    if (!requireLogin()) {
        profilePanel.hidden = true;
        return;
    }
    const usuario = Store.usuarioActual();
    profileName.textContent = `Hola, ${usuario.nombre}`;
    profileName.hidden = false;
    profileEmail.textContent = usuario.email;
    showBookingSummary();
    showAuctionSummary(usuario);
    profilePanel.hidden = false;
}

Store.inicializar().then(() => {
    showProfile();
    window.addEventListener("pageshow", showProfile);
});

// Si cambian reservas, subastas o la sesión (en otro dispositivo o pestaña), se actualiza
document.addEventListener("datos-cambiados", showProfile);
document.addEventListener("sesion-cambiada", showProfile);

