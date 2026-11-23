const facilities = INSTALACIONES.filter((installation) => installation.pistas);
const selectedId = new URLSearchParams(window.location.search).get("pista");
const requestedFacility = facilities.find(({ id }) => String(id) === selectedId);
const selectableFacilities = requestedFacility
    ? facilities.filter(({ deporte }) => deporte === requestedFacility.deporte)
    : facilities;
const form = document.getElementById("reservation-form");
const reservationTitle = document.getElementById("reservation-title");
const facilitySelect = document.getElementById("facility");
const courtOptions = document.getElementById("court-options");
const courtStatus = document.getElementById("court-status");
const dateInput = document.getElementById("booking-date");
const timeSelect = document.getElementById("booking-time");
const statusMessage = document.getElementById("reservation-status");
const reservationList = document.getElementById("reservation-list");
const bookingPrice = document.getElementById("booking-price");
const locationSection = document.getElementById("ubicacion");
const locationAddress = document.getElementById("location-address");
const locationNote = document.getElementById("location-note");
const locationMap = document.getElementById("location-map");
const locationLink = document.getElementById("location-link");
const facilityInformation = document.getElementById("facility-information");
const times = Array.from({ length: 13 }, (_, index) => `${String(index + 9).padStart(2, "0")}:00`);
const submitButton = form.querySelector('button[type="submit"]');

function reservedCourts(reservations, facilityId, date, time) {
    return new Set(reservations.filter((booking) =>
        booking.facility === facilityId && booking.date === date && booking.time === time
    ).map((booking) => booking.court));
}

function updateCourtAvailability() {
    const facility = facilities.find(({ id }) => id === Number(facilitySelect.value));
    const date = dateInput.value;
    const time = timeSelect.value;
    const selectedCourt = form.elements.namedItem("court")?.value;
    const hasSlot = Boolean(date && times.includes(time));
    const futureSlot = hasSlot && `${date}T${time}` > ceutaDateTime();
    // Pistas ocupadas por cualquier usuario (en el servidor, si está conectado)
    const reserved = futureSlot
        ? new Set(facility.pistas.filter((court) => Store.pistaOcupada(facility.id, court, date, time)))
        : new Set();
    const available = futureSlot ? facility.pistas.filter((court) => !reserved.has(court)) : [];
    const selected = available.includes(selectedCourt) ? selectedCourt : available[0];

    if (!hasSlot) courtStatus.textContent = "Elige fecha y hora para ver la disponibilidad.";
    else if (!futureSlot) courtStatus.textContent = "Elige un turno futuro.";
    else courtStatus.textContent = `${available.length} de ${facility.pistas.length} pistas disponibles.`;

    courtOptions.replaceChildren(...facility.pistas.map((court) => {
        const isAvailable = available.includes(court);
        const option = document.createElement("label");
        option.className = "court-option";
        if (hasSlot) option.classList.add(isAvailable ? "court-available" : "court-unavailable");

        const input = document.createElement("input");
        input.type = "radio";
        input.name = "court";
        input.value = court;
        input.disabled = !isAvailable;
        input.checked = court === selected;

        const state = document.createElement("span");
        state.className = "court-option-state";
        if (hasSlot) state.textContent = isAvailable ? "Disponible" : futureSlot ? "Ocupada" : "Turno pasado";
        option.append(input, court, state);
        return option;
    }));
    submitButton.disabled = !available.length;
}

function showReservations() {
    reservationList.replaceChildren();
    for (const reservation of getReservations()) {
        const facility = facilities.find(({ id }) => id === reservation.facility);
        if (!facility) continue;

        const item = document.createElement("li");
        const date = reservation.date.split("-").reverse().join("/");
        item.textContent = `${facility.nombre} · ${reservation.court} · ${date}, ${reservation.time} `;
        const cancel = document.createElement("button");
        cancel.type = "button";
        cancel.className = "login-btn";
        cancel.textContent = "Cancelar";
        cancel.addEventListener("click", async () => {
            cancel.disabled = true;
            try {
                await Store.cancelarReserva(reservation.id);
                statusMessage.textContent = "Reserva cancelada.";
            } catch (error) {
                statusMessage.textContent = error.message;
                cancel.disabled = false;
            }
        });
        item.append(cancel);
        reservationList.append(item);
    }
    if (!reservationList.children.length) {
        const empty = document.createElement("li");
        empty.textContent = "Aún no tienes reservas guardadas.";
        reservationList.append(empty);
    }
}

function updateFacility() {
    const facility = facilities.find(({ id }) => id === Number(facilitySelect.value));
    updateCourtAvailability();
    reservationTitle.textContent = `Reservar ${facility.deporte.toLowerCase()}`;
    document.title = `${reservationTitle.textContent} | CeutaPlay`;
    bookingPrice.textContent = formatoEuros.format(facility.precioPrueba);
    const mapQuery = encodeURIComponent(facility.mapa || facility.ubicacion);
    locationAddress.textContent = facility.ubicacion;
    locationNote.textContent = facility.mapaNota || "";
    locationNote.hidden = !facility.mapaNota;
    locationMap.title = `Mapa de ${facility.nombre}`;
    locationMap.src = `https://maps.google.com/maps?q=${mapQuery}&output=embed`;
    locationLink.href = `https://www.google.com/maps/search/?api=1&query=${mapQuery}`;
    facilityInformation.hidden = !facility.informacion;
    facilityInformation.href = facility.informacion || "";
    locationSection.hidden = false;
}

for (const { nombre, id } of selectableFacilities) facilitySelect.add(new Option(nombre, id));
if (requestedFacility) facilitySelect.value = selectedId;
dateInput.min = ceutaDateTime().slice(0, 10);
timeSelect.add(new Option("Selecciona una hora", ""));
for (const time of times) timeSelect.add(new Option(time, time));
updateFacility();
if (window.location.hash === "#ubicacion") locationSection.scrollIntoView();

facilitySelect.addEventListener("change", updateFacility);
dateInput.addEventListener("change", updateCourtAvailability);
timeSelect.addEventListener("change", updateCourtAvailability);
window.addEventListener("pageshow", updateCourtAvailability);
form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const facility = facilities.find(({ id }) => id === Number(facilitySelect.value));
    const court = new FormData(form).get("court");
    const date = dateInput.value;
    const time = timeSelect.value;
    if (!facility?.pistas.includes(court) || !date || !times.includes(time) || `${date}T${time}` <= ceutaDateTime()) {
        updateCourtAvailability();
        statusMessage.textContent = "Elige una pista y un turno futuro.";
        return;
    }

    if (getReservations().some((booking) => booking.facility === facility.id && booking.court === court && booking.date === date && booking.time === time)) {
        statusMessage.textContent = "Ya has guardado esa pista para ese turno.";
        return;
    }

    const submit = form.querySelector('button[type="submit"]');
    submit.disabled = true;
    try {
        // El servidor comprueba que nadie más tenga esa pista en ese turno
        await Store.reservar({ facility: facility.id, court, date, time });
        statusMessage.textContent = "Reserva guardada.";
    } catch (error) {
        statusMessage.textContent = error.message;
    } finally {
        updateCourtAvailability();
    }
});

// Reservas hechas desde otro dispositivo o pestaña
document.addEventListener("datos-cambiados", () => {
    showReservations();
    updateCourtAvailability();
});

// Hay que haber iniciado sesión para reservar
Store.inicializar().then(() => {
    if (!requireLogin()) return;
    showReservations();
    updateCourtAvailability();
});
