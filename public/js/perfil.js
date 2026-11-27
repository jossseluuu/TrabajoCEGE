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

// ---------- nivel e insignias ----------

function showLevel(usuario) {
    const nivel = Store.puntosDe(usuario.id);
    document.getElementById("my-level").innerHTML = `
        <div class="my-level-card">
            ${Comunidad.avatar(usuario, "avatar-lg")}
            ${Comunidad.nivelHTML(nivel)}
        </div>`;
    document.getElementById("my-badges").innerHTML = Comunidad.insigniasHTML(nivel.insignias, { todas: true });
    document.getElementById("public-profile-link").href = `comunidad.html?jugador=${encodeURIComponent(usuario.id)}`;
    document.getElementById("points-rules").innerHTML = Store.PUNTOS.map((p) =>
        `<li><strong>+${p.valor}</strong> ${p.texto} <span class="form-hint">(llevas ${nivel.detalle[p.clave] || 0})</span></li>`).join("");
    document.getElementById("levels-rules").textContent = "Niveles: " +
        Store.NIVELES.map((n) => `${n.icono} ${n.nombre} (${n.min} pts)`).join(" · ");
}

// ---------- perfil público editable ----------

const profileForm = document.getElementById("profile-form");
const inputName = document.getElementById("profile-input-name");
const inputSport = document.getElementById("profile-input-sport");
const inputBio = document.getElementById("profile-input-bio");
let formFor = null; // usuario cuyos datos hay en el formulario (no se pisa lo que se está escribiendo)

inputSport.append(...DEPORTES.map((d) => new Option(`${d.icono} ${d.nombre}`, d.nombre)));
const updateBioCount = () => (document.getElementById("bio-count").textContent = `${inputBio.value.length}/280`);
inputBio.addEventListener("input", updateBioCount);

function fillProfileForm(usuario, force = false) {
    if (!force && formFor === usuario.id) return;
    formFor = usuario.id;
    const publico = Store.getUsuario(usuario.id) || usuario;
    inputName.value = usuario.nombre;
    inputSport.value = publico.deporteFavorito || "";
    inputBio.value = publico.bio || "";
    updateBioCount();
}

profileForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const status = document.getElementById("profile-status");
    const motivo = Store.motivoNombre(inputName.value);
    if (motivo) {
        status.textContent = motivo;
        status.className = "status-error";
        return;
    }
    const button = profileForm.querySelector("button[type=submit]");
    button.disabled = true;
    try {
        await Store.actualizarPerfil({ nombre: inputName.value, bio: inputBio.value, deporteFavorito: inputSport.value });
        status.textContent = "✅ Perfil guardado.";
        status.className = "status-ok";
        fillProfileForm(Store.usuarioActual(), true);
    } catch (error) {
        status.textContent = error.message;
        status.className = "status-error";
    } finally {
        button.disabled = false;
    }
});

// ---------- pista solidaria (entidades sociales) ----------

const ESTADOS_PETICION = { pendiente: "⏳ Esperando pista", cumplida: "✅ Pista cedida", caducada: "Caducada", cancelada: "Cancelada" };

function showSolidaria() {
    const zona = document.getElementById("solidaria-contenido");
    if (zona.contains(document.activeElement)) return; // no se pisa un formulario a medio rellenar
    const entidad = Store.entidad();
    const esc = Comunidad.esc;
    if (!entidad) {
        zona.innerHTML = `
            <details class="points-help">
                <summary>¿Representas a una entidad social? Solicita la acreditación</summary>
                <form class="login-form" data-form="entidad">
                    <label for="entidad-nombre">Nombre de la entidad</label>
                    <input id="entidad-nombre" name="nombre" minlength="3" maxlength="80" required placeholder="Ej.: Club de Deporte Adaptado Ceuta">
                    <label for="entidad-descripcion">¿A quién ayudáis?</label>
                    <textarea id="entidad-descripcion" name="descripcion" rows="2" maxlength="280"></textarea>
                    <button type="submit" class="register-btn">Solicitar acreditación</button>
                </form>
            </details>`;
        return;
    }
    if (!entidad.acreditada) {
        zona.innerHTML = `<p class="tag-soft">⏳ <strong>${esc(entidad.nombre)}</strong>: solicitud enviada. El equipo de CeutaPlay revisará la acreditación.</p>`;
        return;
    }
    const hoy = ceutaDateTime().slice(0, 10);
    const deportes = [...new Set(INSTALACIONES.filter((i) => esReservable(i) && (i.subastaAutomatica ?? SUBASTA_AUTOMATICA.deportes.includes(i.deporte))).map((i) => i.deporte))];
    const peticiones = Store.peticionesSolidarias();
    zona.innerHTML = `
        <p><span class="badge">✅ ${esc(entidad.nombre)} · entidad acreditada</span></p>
        <form class="login-form solidaria-form" data-form="peticion">
            <label>Deporte<select name="deporte">${deportes.map((d) => `<option>${esc(d)}</option>`).join("")}</select></label>
            <label>Instalación<select name="instalacion"><option value="">Cualquiera</option>${INSTALACIONES.filter((i) => deportes.includes(i.deporte) && esReservable(i)).map((i) => `<option value="${i.id}">${esc(i.nombre)}</option>`).join("")}</select></label>
            <label>Día<input type="date" name="fecha" min="${hoy}" value="${hoy}" required></label>
            <label>Desde<input type="time" name="desde" step="1800" value="16:00" required></label>
            <label>Hasta<input type="time" name="hasta" step="1800" value="20:00" required></label>
            <button type="submit" class="register-btn">Pedir pista solidaria</button>
        </form>
        <ul class="wallet-moves">${peticiones.map((p) => `
            <li><span>${p.fecha.split("-").reverse().join("/")} · ${esc(p.deporte)} · ${p.desde}–${p.hasta}${p.instalacionId ? ` · ${esc(INSTALACIONES.find((i) => i.id === Number(p.instalacionId))?.nombre || "")}` : ""}</span>
                <span>${ESTADOS_PETICION[p.estado] || p.estado}${p.estado === "pendiente" ? ` <button type="button" class="login-btn" data-cancelar-peticion="${p.id}">Cancelar</button>` : ""}</span></li>`).join("")
            || "<li>Aún no habéis pedido ninguna pista.</li>"}</ul>`;
}

document.getElementById("solidaria-contenido").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.target;
    const button = form.querySelector("button[type=submit]");
    button.disabled = true;
    try {
        if (form.dataset.form === "entidad") {
            await Store.solicitarEntidad(form.nombre.value, form.descripcion.value);
            UI.toast("Solicitud enviada. Te avisaremos al acreditarla.");
        } else {
            await Store.crearPeticionSolidaria({
                deporte: form.deporte.value, instalacionId: form.instalacion.value || null,
                fecha: form.fecha.value, desde: form.desde.value, hasta: form.hasta.value,
            });
            UI.toast("Petición registrada: si una pista de esa franja se queda sin pujas, es vuestra.");
        }
        document.activeElement.blur();
        showSolidaria();
    } catch (error) {
        UI.toast(error.message, "error");
    } finally {
        button.disabled = false;
    }
});

document.getElementById("solidaria-contenido").addEventListener("click", async (event) => {
    const b = event.target.closest("[data-cancelar-peticion]");
    if (!b || !confirm("¿Cancelar esta petición?")) return;
    try {
        await Store.cancelarPeticionSolidaria(b.dataset.cancelarPeticion);
        showSolidaria();
    } catch (error) {
        UI.toast(error.message, "error");
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
    fillProfileForm(usuario);
    showLevel(usuario);
    showWallet();
    showSolidaria();
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

