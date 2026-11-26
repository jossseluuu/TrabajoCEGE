// Página de reservas (reservas.html)
//
// · Duración elegible (30 min a 3 h) con inicio cada 30 min; la
//   disponibilidad tiene en cuenta los solapes con otras reservas.
// · Precio por franja (hora valle / punta) y pago con CeutaCoins.
// · Reserva abierta: otros jugadores pueden pedir unirse (comunidad).
// · Instalaciones públicas del ICD: no se reservan aquí, se redirige al ICD.

const facilities = INSTALACIONES.filter((installation) => installation.pistas);
const selectedId = new URLSearchParams(window.location.search).get("pista");
const requestedFacility = facilities.find(({ id }) => String(id) === selectedId);
const selectableFacilities = requestedFacility
    ? facilities.filter(({ deporte }) => deporte === requestedFacility.deporte)
    : facilities;
const $id = (id) => document.getElementById(id);
const form = $id("reservation-form");
const reservationTitle = $id("reservation-title");
const facilitySelect = $id("facility");
const courtOptions = $id("court-options");
const courtStatus = $id("court-status");
const dateInput = $id("booking-date");
const durationSelect = $id("booking-duration");
const timeSelect = $id("booking-time");
const statusMessage = $id("reservation-status");
const reservationList = $id("reservation-list");
const bookingPrice = $id("booking-price");
const reservationPreview = $id("reservation-preview");
const reservationPreviewPhoto = $id("reservation-preview-photo");
const reservationPreviewCaption = $id("reservation-preview-caption");
const locationSection = $id("ubicacion");
const submitButton = form.querySelector('button[type="submit"]');
const shareBooking = $id("share-booking-name");
const agenda = $id("agenda-semanal");
const agendaDays = $id("agenda-days");
const agendaActivity = $id("agenda-activity");
const schedule = $id("horarios-del-dia");
const scheduleScroll = $id("schedule-scroll");
const scheduleHead = $id("schedule-head");
const scheduleBody = $id("schedule-body");
const scheduleSelection = $id("schedule-selection");
const agendaDayFormat = new Intl.DateTimeFormat("es-ES", {
    weekday: "short", day: "numeric", month: "short", timeZone: "UTC",
});
let agendaDate = ceutaDateTime().slice(0, 10);

const currentFacility = () => facilities.find(({ id }) => id === Number(facilitySelect.value));
const duration = () => Number(durationSelect.value) || 60;
const endTime = (booking) => aHora(aMinutos(booking.time) + (booking.duracion || 60));
const unitWord = (facility) => (facility.contacto ? "equipos" : "pistas");

function shiftDate(date, days) {
    const result = new Date(`${date}T00:00:00Z`);
    result.setUTCDate(result.getUTCDate() + days);
    return result.toISOString().slice(0, 10);
}

function ownerLabel(booking) {
    if (booking.enSubasta) return "⚡ En subasta de última hora";
    if (booking.tipo === "bloqueo") return "🚧 Bloqueada por la instalación";
    if (booking.tipo === "solidaria") return "🤝 Pista solidaria";
    if (booking.userId === Store.usuarioActual()?.id) return "Tú";
    if (booking.anonima) return "Ocupada";
    return booking.mostrarNombre ? Store.getUsuario(booking.userId)?.nombre || "Usuario" : "Nombre no compartido";
}

function dayBookings(facility, date) {
    return Store.reservasParaAgenda().filter((booking) => booking.facility === facility.id && booking.date === date);
}

// Reserva que ocupa una pista en un minuto concreto (o null)
function bookingAt(bookings, court, minute) {
    return bookings.find((b) => b.court === court &&
        aMinutos(b.time) <= minute && minute < aMinutos(b.time) + (b.duracion || 60)) || null;
}

function syncScheduleSelection() {
    const court = form.querySelector('input[name="court"]:checked')?.value;
    const time = timeSelect.value;
    const start = aMinutos(time || "00:00");
    for (const slot of scheduleBody.querySelectorAll("button")) {
        const m = aMinutos(slot.dataset.time);
        const inRange = time && slot.dataset.court === court && m >= start && m < start + duration();
        slot.setAttribute("aria-pressed", String(Boolean(inRange)));
    }
    scheduleSelection.hidden = !court || !time;
    scheduleSelection.textContent = court && time
        ? `Turno elegido: ${court}, de ${time} a ${aHora(start + duration())}.` : "";
}

// ---------- tabla de horarios del día (tramos de 30 min) ----------

function renderSchedule() {
    const facility = currentFacility();
    if (schedule.hidden || !esReservable(facility)) {
        schedule.hidden = schedule.hidden || !esReservable(facility);
        return;
    }
    const date = dateInput.value;
    scheduleScroll.hidden = !date;
    $id("schedule-empty").hidden = Boolean(date);
    if (!date) {
        scheduleSelection.hidden = true;
        return;
    }

    const now = ceutaDateTime();
    const bookings = dayBookings(facility, date);
    const { apertura, cierre } = horarioDe(facility);
    $id("schedule-caption").textContent = `${facility.nombre} · ${agendaDayFormat.format(new Date(`${date}T00:00:00Z`))}`;
    const heading = document.createElement("tr");
    for (const title of ["Hora", ...facility.pistas]) {
        const cell = document.createElement("th");
        cell.scope = "col";
        cell.textContent = title;
        heading.append(cell);
    }
    scheduleHead.replaceChildren(heading);

    const rows = [];
    for (let m = apertura; m < cierre; m += TURNOS.tramoMin) {
        const time = aHora(m);
        const row = document.createElement("tr");
        const hour = document.createElement("th");
        hour.scope = "row";
        hour.textContent = time;
        row.append(hour);
        for (const court of facility.pistas) {
            const cell = document.createElement("td");
            const taken = bookingAt(bookings, court, m);
            const past = `${date}T${time}` <= now;
            const available = !taken && !past;
            const state = document.createElement(available ? "button" : "span");
            state.className = `schedule-state ${available ? "schedule-free" : taken ? "schedule-booked" : "schedule-past"}`;
            state.textContent = available ? "Libre" : taken ? (taken.time === time ? ownerLabel(taken) : "·") : "Pasado";
            if (taken && taken.time === time) state.title = `${ownerLabel(taken)} · ${taken.time}–${endTime(taken)}`;
            if (available) {
                state.type = "button";
                state.dataset.time = time;
                state.dataset.court = court;
                state.setAttribute("aria-label", `Libre: ${court}, ${time}`);
                state.addEventListener("click", () => {
                    if (![...timeSelect.options].some((o) => o.value === time && !o.disabled)) {
                        // con esta duración no cabe: se prueba con la más corta
                        durationSelect.value = String(TURNOS.duracionMin);
                        refreshTimes();
                    }
                    timeSelect.value = time;
                    updateCourtAvailability(court);
                    form.scrollIntoView({ behavior: "smooth", block: "start" });
                });
            }
            cell.append(state);
            row.append(cell);
        }
        rows.push(row);
    }
    scheduleBody.replaceChildren(...rows);
    syncScheduleSelection();
}

// ---------- agenda semanal ----------

function renderAgenda() {
    const facility = currentFacility();
    if (!Store.usuarioActual() || !esReservable(facility)) {
        agenda.hidden = true;
        return;
    }
    const { apertura, cierre } = horarioDe(facility);
    const weekday = new Date(`${agendaDate}T00:00:00Z`).getUTCDay();
    const monday = shiftDate(agendaDate, -((weekday + 6) % 7));
    const sunday = shiftDate(monday, 6);
    const bookings = Store.reservasParaAgenda().filter((booking) =>
        booking.facility === facility.id && booking.date >= monday && booking.date <= sunday &&
        facility.pistas.includes(booking.court));
    const minutesBooked = (list) => list.reduce((n, b) => n + (b.duracion || 60), 0);
    const dailyCapacity = facility.pistas.length * (cierre - apertura);
    const formatDay = (date) => agendaDayFormat.format(new Date(`${date}T00:00:00Z`));
    const pct = (part, total) => Math.round(part / total * 100);

    $id("agenda-facility").textContent = facility.nombre;
    $id("agenda-range").textContent = `${formatDay(monday)} – ${formatDay(sunday)}`;
    $id("agenda-occupancy").textContent =
        `${bookings.length} reservas · ocupación ${pct(minutesBooked(bookings), dailyCapacity * 7)} % de las horas disponibles.`;
    $id("agenda-source").textContent = "Las reservas privadas de otros usuarios aparecen como «Ocupada».";
    agenda.hidden = false;

    agendaDays.replaceChildren(...Array.from({ length: 7 }, (_, index) => {
        const date = shiftDate(monday, index);
        const booked = minutesBooked(bookings.filter((booking) => booking.date === date));
        const item = document.createElement("li");
        const button = document.createElement("button");
        button.type = "button";
        button.className = "agenda-day";
        button.setAttribute("aria-pressed", String(date === agendaDate));
        button.setAttribute("aria-label", `${formatDay(date)}, ocupación ${pct(booked, dailyCapacity)} %`);
        const title = document.createElement("strong");
        title.textContent = formatDay(date);
        const meter = document.createElement("progress");
        meter.max = dailyCapacity;
        meter.value = booked;
        meter.setAttribute("aria-hidden", "true");
        const count = document.createElement("span");
        count.textContent = `${pct(booked, dailyCapacity)} %`;
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
    $id("activity-title").textContent = `Actividad · ${formatDay(agendaDate)}`;
    agendaActivity.replaceChildren(...activity.map((booking) => {
        const item = document.createElement("li");
        const player = document.createElement("strong");
        player.textContent = ownerLabel(booking);
        const slot = document.createElement("span");
        slot.textContent = `${booking.time}–${endTime(booking)} · ${booking.court}${booking.publica && booking.userId !== Store.usuarioActual()?.id ? " · 🙋 abierta" : ""}`;
        item.append(player, slot);
        return item;
    }));
    if (!activity.length) {
        const empty = document.createElement("li");
        empty.textContent = "Este día aún no tiene reservas.";
        agendaActivity.append(empty);
    }
}

// ---------- formulario ----------

function refreshTimes() {
    const facility = currentFacility();
    const selected = timeSelect.value;
    const date = dateInput.value;
    const now = ceutaDateTime();
    const starts = iniciosPosibles(facility, duration());
    timeSelect.replaceChildren(new Option("Selecciona una hora", ""), ...starts.map((time) => {
        const option = new Option(time, time);
        if (date && `${date}T${time}` <= now) {
            option.disabled = true;
            option.textContent = `${time} (ya ha pasado)`;
        }
        return option;
    }));
    if (starts.includes(selected) && !timeSelect.querySelector(`option[value="${selected}"]`).disabled) timeSelect.value = selected;
}

function updatePrice() {
    const facility = currentFacility();
    const date = dateInput.value;
    const time = timeSelect.value;
    $id("booking-price-label").textContent = `Precio · ${textoDuracion(duration())}`;
    if (!date || !time) {
        bookingPrice.textContent = `desde ${formatoCC(precioTurno(facility, date || ceutaDateTime().slice(0, 10), "09:00", duration()))}`;
        $id("booking-price-detail").textContent = `${facility.precioPrueba} CC/h en hora punta · hora valle (L-V antes de las ${TURNOS.inicioPunta}) un ${Math.round((1 - TURNOS.factorValle) * 100)} % más barata.`;
        return;
    }
    const price = precioTurno(facility, date, time, duration());
    const punta = esHoraPunta(date, aMinutos(time));
    bookingPrice.textContent = formatoCC(price);
    $id("booking-price-detail").textContent = `${time}–${aHora(aMinutos(time) + duration())} · ${punta ? "🔥 hora punta" : "🌙 hora valle"}${Store.usuarioActual() ? ` · tu saldo: ${formatoCC(Store.saldo())}` : ""}`;
}

function updateCourtAvailability(preferredCourt = form.querySelector('input[name="court"]:checked')?.value) {
    const facility = currentFacility();
    const date = dateInput.value;
    const time = timeSelect.value;
    const hasSlot = Boolean(date && time);
    const futureSlot = hasSlot && `${date}T${time}` > ceutaDateTime();
    const bookings = dayBookings(facility, date);
    const conflict = (court) => bookings.find((b) => Store.solapan(b, { facility: facility.id, court, date, time, duracion: duration() }));
    const available = futureSlot ? facility.pistas.filter((court) => !conflict(court)) : [];
    const selected = available.includes(preferredCourt) ? preferredCourt : available[0];

    if (!hasSlot) courtStatus.textContent = "Elige fecha, duración y hora para ver la disponibilidad.";
    else if (!futureSlot) courtStatus.textContent = "Elige un turno futuro.";
    else courtStatus.textContent = `${available.length} de ${facility.pistas.length} ${unitWord(facility)} libres de ${time} a ${aHora(aMinutos(time) + duration())}.`;

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
        const taken = futureSlot ? conflict(court) : null;
        if (hasSlot) state.textContent = isAvailable ? "Libre" : futureSlot ? `Ocupada · ${ownerLabel(taken)} (${taken.time}–${endTime(taken)})` : "Turno pasado";
        option.append(input, court, state);
        return option;
    }));
    submitButton.disabled = !available.length;
    updatePrice();
    syncScheduleSelection();
}

function showReservations() {
    const user = Store.usuarioActual();
    if (!user) return;
    const now = ceutaDateTime();
    const participants = Store.participantes();
    const enSubasta = new Set(Store.listarSubastas().filter((s) => s.reservaId && !s.cancelada && !s.cerrada).map((s) => s.reservaId));
    const mine = Store.misReservas()
        .filter((r) => (r.tipo || "normal") !== "bloqueo")
        .sort((a, b) => `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`));
    const upcoming = mine.filter((r) => `${r.date}T${endTime(r)}` > now);
    const joined = participants.filter((x) => x.usuarioId === user.id)
        .map((x) => ({ ...x, reserva: Store.todasLasReservas().find((r) => r.id === x.reservaId) }))
        .filter((x) => x.reserva && `${x.reserva.date}T${x.reserva.time}` > now);

    const items = upcoming.map((r) => {
        const facility = facilities.find(({ id }) => id === r.facility);
        const item = document.createElement("li");
        item.className = "my-booking";
        const requests = participants.filter((x) => x.reservaId === r.id);
        const accepted = requests.filter((x) => x.estado === "aceptado");
        const pending = requests.filter((x) => x.estado === "pendiente");
        const date = r.date.split("-").reverse().join("/");
        const hoursLeft = (Store.msMadrid(r.date, r.time) - Store.ahora()) / 3600000;
        item.innerHTML = `
            <div class="my-booking-main">
                <strong>${UI.escapeHTML(facility?.nombre || "Instalación")} · ${UI.escapeHTML(r.court)}</strong>
                <span>${date} · ${r.time}–${endTime(r)} (${textoDuracion(r.duracion || 60)})${r.importe != null ? ` · ${formatoCC(r.importe)}` : ""}</span>
                ${r.tipo === "solidaria" ? `<span class="tag-soft">🤝 Pista solidaria</span>` : ""}
                ${enSubasta.has(r.id) ? `<span class="tag-soft">🔁 En subasta</span>` : ""}
                ${r.publica ? `<span class="tag-soft">🙋 Abierta · ${accepted.length + 1}/${r.plazas} jugadores${r.nota ? ` · “${UI.escapeHTML(r.nota)}”` : ""}</span>` : ""}
            </div>
            ${pending.length ? `<ul class="join-requests">${pending.map((x) => `
                <li><span>🙋 <strong>${UI.escapeHTML(Store.getUsuario(x.usuarioId)?.nombre || "Usuario")}</strong> quiere unirse${x.mensaje ? `: “${UI.escapeHTML(x.mensaje)}”` : ""}</span>
                    <span><button type="button" class="login-btn" data-accion="aceptar" data-reserva="${r.id}" data-usuario="${x.usuarioId}">Aceptar</button>
                    <button type="button" class="login-btn" data-accion="rechazar" data-reserva="${r.id}" data-usuario="${x.usuarioId}">Rechazar</button></span></li>`).join("")}</ul>` : ""}
            ${accepted.length ? `<p class="form-hint">Juegan contigo: ${accepted.map((x) => UI.escapeHTML(Store.getUsuario(x.usuarioId)?.nombre || "Usuario")).join(", ")}</p>` : ""}
            <div class="my-booking-actions">
                ${r.tipo === "normal" && !enSubasta.has(r.id) ? `<button type="button" class="login-btn" data-accion="abrir" data-reserva="${r.id}">${r.publica ? "Cerrar a nuevos jugadores" : "Abrir a más jugadores"}</button>` : ""}
                ${!enSubasta.has(r.id) ? `<button type="button" class="login-btn" data-accion="cancelar" data-reserva="${r.id}" data-horas="${hoursLeft.toFixed(1)}">Cancelar${hoursLeft > MONEDERO.reembolsoHorasAntes ? " (se te devuelve)" : " (sin reembolso)"}</button>` : ""}
            </div>`;
        return item;
    });

    for (const x of joined) {
        const facility = facilities.find(({ id }) => id === x.reserva.facility);
        const item = document.createElement("li");
        item.className = "my-booking";
        const date = x.reserva.date.split("-").reverse().join("/");
        item.innerHTML = `
            <div class="my-booking-main">
                <strong>${UI.escapeHTML(facility?.nombre || "Instalación")} · ${UI.escapeHTML(x.reserva.court)}</strong>
                <span>${date} · ${x.reserva.time}–${endTime(x.reserva)} · reserva de ${UI.escapeHTML(Store.getUsuario(x.reserva.userId)?.nombre || "otro usuario")}</span>
                <span class="tag-soft">${x.estado === "aceptado" ? "✅ Te han aceptado" : x.estado === "pendiente" ? "⏳ Esperando respuesta" : "❌ Solicitud rechazada"}</span>
            </div>
            <div class="my-booking-actions"><button type="button" class="login-btn" data-accion="salir" data-reserva="${x.reservaId}">${x.estado === "aceptado" ? "Salir del partido" : "Retirar solicitud"}</button></div>`;
        items.push(item);
    }

    if (!items.length) {
        const empty = document.createElement("li");
        empty.textContent = "No tienes reservas próximas.";
        items.push(empty);
    }
    reservationList.replaceChildren(...items);
}

reservationList.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-accion]");
    if (!button) return;
    const { accion, reserva, usuario } = button.dataset;
    button.disabled = true;
    try {
        if (accion === "aceptar" || accion === "rechazar") {
            await Store.responderSolicitud(reserva, usuario, accion === "aceptar");
            statusMessage.textContent = accion === "aceptar" ? "Jugador aceptado." : "Solicitud rechazada.";
        }
        if (accion === "abrir") {
            const r = Store.todasLasReservas().find((x) => x.id === reserva);
            let nota = r.nota;
            if (!r.publica) {
                nota = prompt("Mensaje para la comunidad (opcional):", r.nota || "¡Nos faltan jugadores!");
                if (nota === null) return;
            }
            await Store.configurarReserva(reserva, { publica: !r.publica, plazas: r.plazas, nota });
            statusMessage.textContent = r.publica ? "Tu reserva ya no admite nuevos jugadores." : "Tu reserva está abierta en la comunidad.";
        }
        if (accion === "cancelar") {
            const sinReembolso = Number(button.dataset.horas) <= MONEDERO.reembolsoHorasAntes;
            if (!confirm(sinReembolso
                ? `Faltan menos de ${MONEDERO.reembolsoHorasAntes} h: si cancelas no se devuelven las CeutaCoins. ¿Cancelar igualmente?`
                : "¿Cancelar la reserva? Se te devolverán las CeutaCoins.")) return;
            const devuelto = await Store.cancelarReserva(reserva);
            statusMessage.textContent = devuelto ? `Reserva cancelada. Te hemos devuelto ${formatoCC(devuelto)}.` : "Reserva cancelada.";
        }
        if (accion === "salir") {
            await Store.salirDeReserva(reserva);
            statusMessage.textContent = "Has salido de la reserva.";
        }
    } catch (error) {
        statusMessage.textContent = error.message;
    } finally {
        button.disabled = false;
    }
});

function showFacilityPhoto(facility) {
    const photo = FOTOS_RESERVA[facility.id];
    const fallback = FOTOS_RESERVA_ILUSTRATIVAS[facility.deporte];
    reservationPreview.hidden = true;
    reservationPreviewPhoto.replaceChildren();

    function loadPhoto(source, illustrative) {
        if (!source) return;
        const image = document.createElement("img");
        image.alt = source.descripcion;
        image.decoding = "async";
        image.addEventListener("load", () => {
            if (image.parentElement !== reservationPreviewPhoto) return;
            const caption = illustrative ? `Imagen ilustrativa · ${source.descripcion}` : source.descripcion;
            reservationPreviewCaption.textContent = `${caption} · ${source.credito}`;
            reservationPreview.hidden = false;
        }, { once: true });
        image.addEventListener("error", () => {
            if (image.parentElement !== reservationPreviewPhoto) return;
            if (!illustrative && source.src !== fallback?.src) loadPhoto(fallback, true);
        }, { once: true });
        reservationPreviewPhoto.replaceChildren(image);
        image.src = source.src;
    }

    loadPhoto(photo || fallback, !photo);
}

function updateFacility() {
    const facility = currentFacility();
    const icd = esInstalacionIcd(facility);
    $id("icd-panel").hidden = !icd;
    $id("icd-link").href = facility.informacion || URL_ICD;
    $id("icd-link").textContent = facility.informacion ? "Ver la instalación y reservar en el ICD" : "Reservar en el ICD";
    form.hidden = icd;
    refreshTimes();
    showFacilityPhoto(facility);
    updateCourtAvailability();
    reservationTitle.textContent = `Reservar ${facility.deporte.toLowerCase()}`;
    $id("football-booking-note").hidden = true;
    $id("activity-booking-note").hidden = !facility.contacto;
    $id("court-label").textContent = facility.contacto ? "Equipo" : "Pista";
    document.title = `${reservationTitle.textContent} | CeutaPlay`;
    const mapQuery = encodeURIComponent(facility.mapa || facility.ubicacion);
    $id("location-address").textContent = facility.ubicacion;
    $id("location-note").textContent = facility.mapaNota || "";
    $id("location-note").hidden = !facility.mapaNota;
    $id("location-map").title = `Mapa de ${facility.nombre}`;
    $id("location-map").src = `https://maps.google.com/maps?q=${mapQuery}&output=embed`;
    $id("location-link").href = `https://www.google.com/maps/search/?api=1&query=${mapQuery}`;
    $id("facility-information").hidden = !facility.informacion;
    $id("facility-information").href = facility.informacion || "";
    $id("facility-contact").hidden = !facility.contacto;
    $id("facility-contact").href = facility.contacto || "";
    locationSection.hidden = false;
    if (Store.usuarioActual() && !icd) schedule.hidden = false;
    renderAgenda();
    renderSchedule();
}

function showWallet() {
    const chip = $id("saldo-reserva");
    chip.hidden = !Store.usuarioActual();
    if (!chip.hidden) chip.innerHTML = `🪙 Tu saldo: <strong>${formatoCC(Store.saldo())}</strong> · <a href="perfil.html#monedero">ver monedero</a>`;
}

for (const { nombre, id, gestion } of selectableFacilities) {
    facilitySelect.add(new Option(gestion === "icd" ? `${nombre} (ICD)` : nombre, id));
}
durationSelect.replaceChildren(...duracionesPosibles().map((d) => new Option(textoDuracion(d), d)));
durationSelect.value = "60";
if (requestedFacility) facilitySelect.value = selectedId;
dateInput.min = ceutaDateTime().slice(0, 10);
dateInput.max = shiftDate(dateInput.min, 60);
dateInput.value = dateInput.min;
updateFacility();
if (window.location.hash === "#ubicacion") locationSection.scrollIntoView();

facilitySelect.addEventListener("change", updateFacility);
dateInput.addEventListener("change", () => {
    if (dateInput.value) agendaDate = dateInput.value;
    refreshTimes();
    updateCourtAvailability();
    renderAgenda();
    renderSchedule();
});
durationSelect.addEventListener("change", () => {
    refreshTimes();
    updateCourtAvailability();
});
timeSelect.addEventListener("change", () => updateCourtAvailability());
courtOptions.addEventListener("change", syncScheduleSelection);
shareBooking.addEventListener("change", () => ($id("open-booking-fields").hidden = !shareBooking.checked));
window.addEventListener("pageshow", () => {
    updateCourtAvailability();
    renderSchedule();
});
for (const [id, offset] of [["previous-week", -7], ["next-week", 7]]) {
    $id(id).addEventListener("click", () => {
        agendaDate = shiftDate(agendaDate, offset);
        renderAgenda();
    });
}

form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const facility = currentFacility();
    const court = new FormData(form).get("court");
    const date = dateInput.value;
    const time = timeSelect.value;
    if (!court || !date || !time) {
        updateCourtAvailability();
        statusMessage.textContent = "Elige una pista y un turno futuro.";
        return;
    }
    const price = precioTurno(facility, date, time, duration());
    if (!confirm(`Vas a pagar ${formatoCC(price)} por ${facility.nombre} · ${court}, ${date.split("-").reverse().join("/")} de ${time} a ${aHora(aMinutos(time) + duration())}. ¿Confirmar?`)) return;

    submitButton.disabled = true;
    try {
        // El servidor comprueba los solapes, el horario y el saldo, y cobra
        await Store.reservar({
            facility: facility.id, court, date, time, duracion: duration(),
            publica: shareBooking.checked, plazas: Number($id("booking-plazas").value), nota: $id("booking-nota").value,
        });
        shareBooking.checked = false;
        $id("open-booking-fields").hidden = true;
        statusMessage.textContent = `✅ Reserva pagada (${formatoCC(price)}). La tienes en «Mis reservas».`;
    } catch (error) {
        statusMessage.textContent = error.message;
    } finally {
        updateCourtAvailability();
        renderSchedule();
        showWallet();
    }
});

// Reservas hechas desde otro dispositivo o pestaña
document.addEventListener("datos-cambiados", () => {
    showReservations();
    showWallet();
    updateCourtAvailability();
    renderAgenda();
    renderSchedule();
});

// Hay que haber iniciado sesión para reservar
Store.inicializar().then(() => {
    if (!requireLogin()) return;
    if (esReservable(currentFacility())) schedule.hidden = false;
    showReservations();
    showWallet();
    refreshTimes();
    updateCourtAvailability();
    renderAgenda();
    renderSchedule();
});
