const facilities = INSTALACIONES.filter((installation) => installation.pistas);
const form = document.getElementById("reservation-form");
const facilitySelect = document.getElementById("facility");
const courtSelect = document.getElementById("court");
const dateInput = document.getElementById("booking-date");
const timeSelect = document.getElementById("booking-time");
const statusMessage = document.getElementById("reservation-status");
const reservationList = document.getElementById("reservation-list");
const times = Array.from({ length: 13 }, (_, index) => `${String(index + 9).padStart(2, "0")}:00`);

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
        cancel.addEventListener("click", () => {
            saveReservations(getReservations().filter(({ id }) => id !== reservation.id));
            showReservations();
            statusMessage.textContent = "Reserva de prueba cancelada.";
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

function updateCourts() {
    const facility = facilities.find(({ id }) => id === Number(facilitySelect.value));
    courtSelect.replaceChildren(...facility.pistas.map((court) => new Option(court, court)));
}

for (const { nombre, id } of facilities) facilitySelect.add(new Option(nombre, id));
const selectedId = new URLSearchParams(window.location.search).get("pista");
if (facilities.some(({ id }) => String(id) === selectedId)) facilitySelect.value = selectedId;
updateCourts();
dateInput.min = ceutaDateTime().slice(0, 10);
timeSelect.add(new Option("Selecciona una hora", ""));
for (const time of times) timeSelect.add(new Option(time, time));

facilitySelect.addEventListener("change", updateCourts);
form.addEventListener("submit", (event) => {
    event.preventDefault();
    const facility = facilities.find(({ id }) => id === Number(facilitySelect.value));
    const court = courtSelect.value;
    const date = dateInput.value;
    const time = timeSelect.value;
    if (!facility?.pistas.includes(court) || !times.includes(time) || `${date}T${time}` <= ceutaDateTime()) {
        statusMessage.textContent = "Elige una pista y un turno futuro.";
        return;
    }

    const reservations = getReservations();
    if (reservations.some((booking) => booking.facility === facility.id && booking.court === court && booking.date === date && booking.time === time)) {
        statusMessage.textContent = "Ya has guardado esa pista para ese turno.";
        return;
    }

    reservations.push({ id: crypto.randomUUID(), facility: facility.id, court, date, time });
    saveReservations(reservations);
    showReservations();
    statusMessage.textContent = "Reserva de prueba guardada en este navegador.";
});

showReservations();
form.querySelector('button[type="submit"]').disabled = false;
