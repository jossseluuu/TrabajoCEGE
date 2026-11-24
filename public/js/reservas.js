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
const shareBooking = document.getElementById("share-booking-name");
const shareBookingOption = document.getElementById("share-booking-option");
const agenda = document.getElementById("agenda-semanal");
const agendaDays = document.getElementById("agenda-days");
const agendaActivity = document.getElementById("agenda-activity");
const agendaDayFormat = new Intl.DateTimeFormat("es-ES", {
    weekday: "short", day: "numeric", month: "short", timeZone: "UTC",
});
let agendaDate = ceutaDateTime().slice(0, 10);

function shiftDate(date, days) {
    const result = new Date(`${date}T00:00:00Z`);
    result.setUTCDate(result.getUTCDate() + days);
    return result.toISOString().slice(0, 10);
}

function ownerLabel(booking) {
    if (booking.userId === Store.usuarioActual()?.id) return "Tú";
    return booking.mostrarNombre ? Store.getUsuario(booking.userId)?.nombre || "Usuario" : "Nombre no compartido";
}

function renderAgenda() {
    if (!Store.usuarioActual()) {
        agenda.hidden = true;
        shareBookingOption.hidden = true;
        shareBooking.disabled = true;
        return;
    }

    const facility = facilities.find(({ id }) => id === Number(facilitySelect.value));
    const weekday = new Date(`${agendaDate}T00:00:00Z`).getUTCDay();
    const monday = shiftDate(agendaDate, -((weekday + 6) % 7));
    const sunday = shiftDate(monday, 6);
    const bookings = Store.reservasParaAgenda().filter((booking) =>
        booking.facility === facility.id && booking.date >= monday && booking.date <= sunday &&
        facility.pistas.includes(booking.court) && times.includes(booking.time)
    );
    const dailyCapacity = facility.pistas.length * times.length;
    const totalSlots = dailyCapacity * 7;
    const formatDay = (date) => agendaDayFormat.format(new Date(`${date}T00:00:00Z`));

    document.getElementById("agenda-facility").textContent = facility.nombre;
    document.getElementById("agenda-range").textContent = `${formatDay(monday)} – ${formatDay(sunday)}`;
    document.getElementById("agenda-occupancy").textContent = `${bookings.length} de ${totalSlots} turnos reservados (${Math.round(bookings.length / totalSlots * 100)} %).`;
    document.getElementById("agenda-source").textContent = Store.modo === "remoto"
        ? "Ocupación según las reservas registradas en CeutaPlay."
        : "Ocupación según las reservas guardadas en este navegador.";
    shareBookingOption.hidden = !Store.permiteMostrarNombre();
    shareBooking.disabled = shareBookingOption.hidden;
    agenda.hidden = false;

    agendaDays.replaceChildren(...Array.from({ length: 7 }, (_, index) => {
        const date = shiftDate(monday, index);
        const booked = bookings.filter((booking) => booking.date === date).length;
        const item = document.createElement("li");
        const button = document.createElement("button");
        button.type = "button";
        button.className = "agenda-day";
        button.setAttribute("aria-pressed", String(date === agendaDate));
        button.setAttribute("aria-label", `${formatDay(date)}, ${booked} de ${dailyCapacity} turnos reservados`);
        const title = document.createElement("strong");
        title.textContent = formatDay(date);
        const meter = document.createElement("progress");
        meter.max = dailyCapacity;
        meter.value = booked;
        meter.setAttribute("aria-hidden", "true");
        const count = document.createElement("span");
        count.textContent = `${booked}/${dailyCapacity}`;
        button.append(title, meter, count);
        button.addEventListener("click", () => {
            agendaDate = date;
            renderAgenda();
            agendaDays.querySelector('[aria-pressed="true"]').focus();
        });
        item.append(button);
        return item;
    }));

    const activity = bookings.filter((booking) => booking.date === agendaDate)
        .sort((a, b) => a.time.localeCompare(b.time) || a.court.localeCompare(b.court, "es", { numeric: true }));
    document.getElementById("activity-title").textContent = `Actividad · ${formatDay(agendaDate)}`;
    agendaActivity.replaceChildren(...activity.map((booking) => {
        const item = document.createElement("li");
        const player = document.createElement("strong");
        player.textContent = ownerLabel(booking);
        const slot = document.createElement("span");
        slot.textContent = `${booking.time} · ${booking.court}`;
        item.append(player, slot);
        return item;
    }));
    if (!activity.length) {
        const empty = document.createElement("li");
        empty.textContent = "Este día aún no tiene reservas.";
        agendaActivity.append(empty);
    }
}

function updateCourtAvailability() {
    const facility = facilities.find(({ id }) => id === Number(facilitySelect.value));
    const date = dateInput.value;
    const time = timeSelect.value;
    const selectedCourt = form.elements.namedItem("court")?.value;
    const hasSlot = Boolean(date && times.includes(time));
    const futureSlot = hasSlot && `${date}T${time}` > ceutaDateTime();
    const reservations = Store.reservasParaAgenda();
    const reserved = new Map(reservations.filter((booking) =>
        booking.facility === facility.id && booking.date === date && booking.time === time
    ).map((booking) => [booking.court, booking]));
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
        if (futureSlot && reserved.has(court)) state.textContent += ` · ${ownerLabel(reserved.get(court))}`;
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
    document.getElementById("football-booking-note").hidden = facility.deporte !== "Fútbol";
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
    renderAgenda();
}

for (const { nombre, id } of selectableFacilities) facilitySelect.add(new Option(nombre, id));
if (requestedFacility) facilitySelect.value = selectedId;
dateInput.min = ceutaDateTime().slice(0, 10);
timeSelect.add(new Option("Selecciona una hora", ""));
for (const time of times) timeSelect.add(new Option(time, time));
updateFacility();
if (window.location.hash === "#ubicacion") locationSection.scrollIntoView();

facilitySelect.addEventListener("change", updateFacility);
dateInput.addEventListener("change", () => {
    if (dateInput.value) agendaDate = dateInput.value;
    updateCourtAvailability();
    renderAgenda();
});
timeSelect.addEventListener("change", updateCourtAvailability);
window.addEventListener("pageshow", updateCourtAvailability);
for (const [id, offset] of [["previous-week", -7], ["next-week", 7]]) {
    document.getElementById(id).addEventListener("click", () => {
        agendaDate = shiftDate(agendaDate, offset);
        renderAgenda();
    });
}
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
        await Store.reservar({ facility: facility.id, court, date, time, mostrarNombre: !shareBooking.disabled && shareBooking.checked });
        shareBooking.checked = false;
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
    renderAgenda();
});

// Hay que haber iniciado sesión para reservar
Store.inicializar().then(() => {
    if (!requireLogin()) return;
    showReservations();
    updateCourtAvailability();
    renderAgenda();
});
