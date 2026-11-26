const profilePanel = document.getElementById("profile-panel");
const profileName = document.getElementById("profile-name");
const profileEmail = document.getElementById("profile-email");

function bookingStart(booking) {
    return `${booking.date}T${booking.time}`;
}

function bookingEnd(booking) {
    const start = Date.parse(`${bookingStart(booking)}:00Z`);
    return new Date(start + (booking.duracion || 60) * 60 * 1000).toISOString().slice(0, 16);
}

function bookingDescription(booking) {
    const date = booking.date.split("-").reverse().join("/");
    return `${booking.facilityName} · ${booking.court} · ${date}, ${booking.time} (${textoDuracion(booking.duracion || 60)})`;
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
    return `${auction.titulo} · ${date}, ${auction.hora} · ${auction.precioActual} CC`;
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

const fechaMovimiento = new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

function showWallet() {
    document.getElementById("wallet-balance").textContent = formatoCC(Store.saldo());
    const moves = Store.movimientos().slice(0, 30);
    const items = moves.map((m) => {
        const item = document.createElement("li");
        const concept = document.createElement("span");
        concept.textContent = `${fechaMovimiento.format(new Date(m.creado))} · ${m.concepto}`;
        const amount = document.createElement("strong");
        amount.className = m.importe >= 0 ? "move-in" : "move-out";
        amount.textContent = `${m.importe >= 0 ? "+" : "−"}${formatoCC(Math.abs(m.importe))}`;
        item.append(concept, amount);
        return item;
    });
    if (!items.length) {
        const empty = document.createElement("li");
        empty.textContent = "Todavía no hay movimientos.";
        items.push(empty);
    }
    document.getElementById("wallet-moves").replaceChildren(...items);
}

document.querySelector(".wallet-actions").addEventListener("click", async (event) => {
    const button = event.target.closest("[data-recarga]");
    if (!button) return;
    button.disabled = true;
    try {
        await Store.recargarSaldo(Number(button.dataset.recarga));
    } catch (error) {
        alert(error.message);
    } finally {
        button.disabled = false;
    }
});

function showProfile() {
    if (!requireLogin()) {
        profilePanel.hidden = true;
        return;
    }
    const usuario = Store.usuarioActual();
    profileName.textContent = `Hola, ${usuario.nombre}`;
    profileName.hidden = false;
    profileEmail.textContent = usuario.email;
    showWallet();
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

