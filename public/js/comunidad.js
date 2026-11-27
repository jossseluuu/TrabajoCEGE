// Página de comunidad (comunidad.html)
//
// · Partidos abiertos: reservas de otros que buscan jugadores; se pide
//   unirse y el dueño de la reserva acepta o rechaza (en «Mis reservas»).
// · Jugadores: perfiles públicos (nombre, deporte favorito, biografía, nivel).
// · Ranking por puntos.
// · Ficha de cada jugador (también con comunidad.html?jugador=<id>).
//
// Privacidad: de los demás solo se ven sus reservas abiertas; del resto de
// su actividad, únicamente los recuentos que dan puntos.

const $c = (id) => document.getElementById(id);
const esc = Comunidad.esc;
let pestana = "partidos";

const instalacion = (id) => INSTALACIONES.find((i) => i.id === Number(id));
const finDe = (r) => aHora(aMinutos(r.time) + (r.duracion || 60));

function rellenarDeportes() {
    const nombres = DEPORTES.map((d) => d.nombre);
    for (const id of ["filtro-deporte-partidos", "filtro-deporte-jugadores"]) {
        $c(id).append(...nombres.map((n) => new Option(n, n)));
    }
}

// ---------- pestañas ----------

function mostrarPestana(nombre) {
    pestana = nombre;
    for (const tab of document.querySelectorAll("[role=tab]")) {
        const activa = tab.dataset.tab === nombre;
        tab.classList.toggle("active", activa);
        tab.setAttribute("aria-selected", String(activa));
        $c(tab.getAttribute("aria-controls")).hidden = !activa;
    }
    pintar();
}

// ---------- partidos abiertos ----------

function estadoSolicitud(reserva, yo) {
    if (reserva.userId === yo.id) return { texto: "Es tu partido", tipo: "mio" };
    const mia = Store.participantes().find((x) => x.reservaId === reserva.id && x.usuarioId === yo.id);
    if (mia?.estado === "aceptado") return { texto: "✅ Estás dentro", tipo: "dentro", salir: true };
    if (mia?.estado === "pendiente") return { texto: "⏳ Solicitud enviada", tipo: "pendiente", salir: true };
    if (reserva.libres <= 0) return { texto: "Completo", tipo: "completo" };
    return { texto: mia?.estado === "rechazado" ? "Volver a pedir" : "Pedir unirme", tipo: "pedir" };
}

function tarjetaPartido(r, yo) {
    const inst = instalacion(r.facility);
    const dueno = Store.getUsuario(r.userId) || { id: r.userId, nombre: "Jugador" };
    const jugadores = [dueno, ...r.aceptados.map((x) => Store.getUsuario(x.usuarioId) || { id: x.usuarioId, nombre: "Jugador" })];
    const estado = estadoSolicitud(r, yo);
    const ocupadas = jugadores.length;
    const accion = estado.tipo === "pedir"
        ? `<button type="button" class="register-btn" data-unirse="${r.id}">${estado.texto}</button>`
        : estado.salir
            ? `<span class="tag-soft">${estado.texto}</span>
               <button type="button" class="login-btn" data-salir="${r.id}">${estado.tipo === "dentro" ? "Salir" : "Retirar"}</button>`
            : `<span class="tag-soft">${estado.texto}</span>`;
    return `
        <li class="match-card">
            <div class="match-when">
                <strong>${esc(Comunidad.textoFecha(r.date))}</strong>
                <span>${r.time}–${finDe(r)}</span>
            </div>
            <div class="match-main">
                <span class="card-tag">${esc(inst?.deporte || "Deporte")}</span>
                <h3>${esc(inst?.nombre || "Instalación")} · ${esc(r.court)}</h3>
                ${r.nota ? `<p class="match-note">“${esc(r.nota)}”</p>` : ""}
                <p class="match-organizer">Organiza
                    <button type="button" class="player-link" data-jugador="${dueno.id}">${Comunidad.avatar(dueno, "avatar-sm")} ${esc(dueno.nombre)}</button>
                </p>
                <div class="match-players" aria-label="${ocupadas} de ${r.plazas} jugadores">
                    ${jugadores.map((j) => `<button type="button" class="player-dot" data-jugador="${j.id}" title="${esc(j.nombre)}">${Comunidad.avatar(j, "avatar-sm")}</button>`).join("")}
                    ${Array.from({ length: Math.max(0, r.plazas - ocupadas) }, () => `<span class="avatar avatar-sm avatar-empty" aria-hidden="true">+</span>`).join("")}
                    <span class="match-slots">${ocupadas}/${r.plazas} · ${r.libres ? `${r.libres} ${r.libres === 1 ? "plaza libre" : "plazas libres"}` : "completo"}</span>
                </div>
            </div>
            <div class="match-action">${accion}</div>
        </li>`;
}

function pintarPartidos(yo) {
    const deporte = $c("filtro-deporte-partidos").value;
    const todos = Store.reservasAbiertas();
    const otros = todos.filter((r) => r.userId !== yo.id && r.libres > 0).length;
    $c("count-partidos").textContent = otros;
    $c("count-partidos").hidden = !otros;
    const lista = todos.filter((r) => !deporte || instalacion(r.facility)?.deporte === deporte);
    $c("match-list").innerHTML = lista.length
        ? lista.map((r) => tarjetaPartido(r, yo)).join("")
        : `<li class="admin-empty">No hay partidos abiertos${deporte ? ` de ${esc(deporte.toLowerCase())}` : ""} ahora mismo. ¡Abre tú uno al reservar!</li>`;
}

// ---------- jugadores y ranking ----------

function pintarJugadores() {
    const texto = $c("buscar-jugador").value.trim();
    const deporte = $c("filtro-deporte-jugadores").value;
    const sinTildes = (t) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
    const lista = Store.ranking().filter((u) => !u.admin)
        .filter((u) => !deporte || u.deporteFavorito === deporte)
        .filter((u) => !texto || sinTildes(`${u.nombre} ${u.bio}`).includes(sinTildes(texto)))
        .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
    $c("player-count").textContent = lista.length === 1 ? "1 jugador" : `${lista.length} jugadores`;
    $c("player-list").innerHTML = lista.map((u) => `
        <li>
            <button type="button" class="player-card" data-jugador="${u.id}">
                <span class="player-card-head">
                    ${Comunidad.avatar(u, "avatar-md")}
                    <span>
                        <strong>${esc(u.nombre)}</strong>
                        <small>${u.deporteFavorito ? esc(u.deporteFavorito) : "Multideporte"} · ${u.nivel.icono} ${esc(u.nivel.nombre)}</small>
                    </span>
                </span>
                ${u.bio ? `<span class="player-bio">${esc(u.bio)}</span>` : ""}
                ${u.nivel.insignias.length ? `<span class="player-badges" aria-label="Insignias">${u.nivel.insignias.map((i) => `<span title="${esc(i.nombre)}">${i.icono}</span>`).join("")}</span>` : ""}
            </button>
        </li>`).join("") || `<li class="admin-empty">Nadie coincide con la búsqueda.</li>`;
}

function pintarRanking(yo) {
    const lista = Store.ranking().filter((u) => !u.admin);
    const medalla = ["🥇", "🥈", "🥉"];
    $c("ranking-list").innerHTML = lista.map((u, i) => `
        <li class="ranking-row ${u.id === yo.id ? "ranking-me" : ""}">
            <span class="ranking-pos">${medalla[i] || i + 1}</span>
            <button type="button" class="player-link" data-jugador="${u.id}">${Comunidad.avatar(u, "avatar-sm")} ${esc(u.nombre)}${u.id === yo.id ? " (tú)" : ""}</button>
            <span class="ranking-level">${u.nivel.icono} ${esc(u.nivel.nombre)}</span>
            <strong class="ranking-points">${u.nivel.puntos} pts</strong>
        </li>`).join("");
}

function pintarMiNivel(yo) {
    const nivel = Store.puntosDe(yo.id);
    const chip = $c("community-me");
    chip.innerHTML = `${Comunidad.avatar(yo, "avatar-md")}<span class="community-me-text"><small>Tu nivel</small>${Comunidad.nivelHTML(nivel, { compacto: true })}</span>`;
    chip.hidden = false;
}

// ---------- ficha de un jugador ----------

const fechaAlta = new Intl.DateTimeFormat("es-ES", { month: "long", year: "numeric" });

async function abrirJugador(id) {
    const usuario = Store.getUsuario(id);
    if (!usuario) return;
    const yo = Store.usuarioActual();
    const nivel = Store.puntosDe(id);
    const d = nivel.detalle;
    const partidos = Store.reservasAbiertas().filter((r) => r.userId === id ||
        r.aceptados.some((x) => x.usuarioId === id));
    const dialog = $c("player-modal");
    $c("player-detail").innerHTML = `
        <button type="button" class="modal-close" aria-label="Cerrar">×</button>
        <div class="player-hero">
            ${Comunidad.avatar(usuario, "avatar-xl")}
            <div>
                <h2 id="player-name">${esc(usuario.nombre)}${usuario.id === yo.id ? " <small>(tú)</small>" : ""}</h2>
                <p>${usuario.deporteFavorito ? `Deporte favorito: <strong>${esc(usuario.deporteFavorito)}</strong>` : "Multideporte"}
                   ${usuario.creado ? ` · en CeutaPlay desde ${fechaAlta.format(new Date(usuario.creado))}` : ""}</p>
            </div>
        </div>
        ${usuario.bio ? `<p class="player-detail-bio">${esc(usuario.bio)}</p>` : ""}
        ${Comunidad.nivelHTML(nivel)}
        <dl class="player-stats">
            <div><dt>Partidos</dt><dd>${d.jugadas}</dd></div>
            <div><dt>Se ha unido</dt><dd>${d.unidas}</dd></div>
            <div><dt>Subastas ganadas</dt><dd>${d.ganadas}</dd></div>
            <div><dt>Opiniones</dt><dd>${d.opiniones}</dd></div>
        </dl>
        <h3>Insignias</h3>
        ${Comunidad.insigniasHTML(nivel.insignias)}
        <h3>Próximos partidos abiertos</h3>
        ${partidos.length ? `<ul class="player-matches">${partidos.map((r) => `
            <li><span>${esc(instalacion(r.facility)?.nombre || "")} · ${esc(Comunidad.textoFecha(r.date))} ${r.time}</span>
                <span class="tag-soft">${r.userId === id ? "Organiza" : "Juega"} · ${r.libres ? `${r.libres} libres` : "completo"}</span></li>`).join("")}</ul>`
            : `<p class="form-hint">No tiene partidos abiertos ahora mismo.</p>`}
        <h3>Opiniones</h3>
        <ul class="player-reviews" id="player-reviews"><li class="form-hint">Cargando…</li></ul>
        ${usuario.id === yo.id ? `<p><a class="register-btn" href="perfil.html#editar-perfil">Editar mi perfil</a></p>` : ""}`;
    if (!dialog.open) dialog.showModal();
    history.replaceState(null, "", `?jugador=${encodeURIComponent(id)}`);

    const opiniones = await Store.listarOpinionesDe(id).catch(() => []);
    const zona = $c("player-reviews");
    if (!zona) return;
    zona.innerHTML = opiniones.length ? opiniones.map((o) => `
        <li><strong>${esc(instalacion(o.instalacionId)?.nombre || "Instalación")}</strong>
            <span class="stars" aria-label="${o.puntuacion} de 5 estrellas">${"★".repeat(o.puntuacion)}${"☆".repeat(5 - o.puntuacion)}</span>
            <p>${esc(o.comentario)}</p></li>`).join("")
        : `<li class="form-hint">Todavía no ha valorado ninguna instalación.</li>`;
}

// ---------- acciones ----------

async function unirse(reservaId, boton) {
    const mensaje = prompt("Mensaje para el organizador (opcional):", "¡Hola! Me apunto si os falta gente.");
    if (mensaje === null) return;
    boton.disabled = true;
    try {
        await Store.solicitarUnirse(reservaId, mensaje);
        UI.toast("Solicitud enviada. Te avisaremos cuando responda.");
    } catch (error) {
        UI.toast(error.message, "error");
    } finally {
        boton.disabled = false;
    }
}

async function salir(reservaId, boton) {
    if (!confirm("¿Seguro que quieres salir de este partido?")) return;
    boton.disabled = true;
    try {
        await Store.salirDeReserva(reservaId);
        UI.toast("Has salido del partido.");
    } catch (error) {
        UI.toast(error.message, "error");
    } finally {
        boton.disabled = false;
    }
}

document.addEventListener("click", (event) => {
    const jugador = event.target.closest("[data-jugador]");
    if (jugador) return abrirJugador(jugador.dataset.jugador);
    const tab = event.target.closest("[role=tab]");
    if (tab) return mostrarPestana(tab.dataset.tab);
    const unir = event.target.closest("[data-unirse]");
    if (unir) return unirse(unir.dataset.unirse, unir);
    const fuera = event.target.closest("[data-salir]");
    if (fuera) return salir(fuera.dataset.salir, fuera);
});

// ---------- pintar ----------

function pintar() {
    const yo = Store.usuarioActual();
    if (!yo) return;
    pintarMiNivel(yo);
    pintarPartidos(yo);
    if (pestana === "jugadores") pintarJugadores();
    if (pestana === "ranking") pintarRanking(yo);
}

rellenarDeportes();
UI.prepararModal($c("player-modal"));
$c("player-modal").addEventListener("close", () => history.replaceState(null, "", location.pathname));
$c("filtro-deporte-partidos").addEventListener("change", pintar);
$c("filtro-deporte-jugadores").addEventListener("change", pintarJugadores);
$c("buscar-jugador").addEventListener("input", pintarJugadores);
document.addEventListener("datos-cambiados", pintar);
document.addEventListener("sesion-cambiada", pintar);

Store.inicializar().then(() => {
    if (!requireLogin()) return;
    const params = new URLSearchParams(location.search);
    if (params.get("ver") === "jugadores" || params.get("ver") === "ranking") mostrarPestana(params.get("ver"));
    else pintar();
    if (params.get("jugador")) abrirJugador(params.get("jugador"));
});
