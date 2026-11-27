// Avisos de CeutaPlay: la campana del menú (🔔) con lo que le interesa al
// usuario. Se calculan a partir de los datos que ya ve (no hace falta una
// tabla nueva):
//   · te han superado en una subasta, has ganado una, tu reventa se ha vendido
//   · alguien quiere unirse a tu partido; te han aceptado o rechazado
//   · tu partido empieza pronto
//   · pista solidaria cedida (entidades)
//   · pistas de tu deporte a mitad de precio (última hora)
//   · mejora el viento para kayak, paddle surf o piragüismo
// Lo leído se guarda en este navegador. Opcionalmente, también como
// notificación del navegador mientras la web está abierta.

const Avisos = (() => {

    const esc = (t) => String(t ?? "").replace(/[&<>"']/g, (c) =>
        ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
    const yo = () => Store.usuarioActual();
    const claveLeidos = () => `cp_avisos_leidos:${yo()?.id}`;
    const claveNotificados = () => `cp_avisos_notificados:${yo()?.id}`;
    const leer = (k) => new Set(JSON.parse(localStorage.getItem(k) || "[]"));
    const guardar = (k, set) => localStorage.setItem(k, JSON.stringify([...set].slice(-300)));
    const HORA = 3600 * 1000;
    const nombreInst = (id) => INSTALACIONES.find((i) => i.id === Number(id))?.nombre || "la instalación";
    const dia = (fecha) => fecha.split("-").reverse().slice(0, 2).join("/");
    let horasViento = null;
    // "AAAA-MM-DDTHH:MM" en Ceuta (no depende de booking-storage.js)
    const ahoraCeuta = () => Store.textoMadrid(Store.ahora()).replace(" ", "T");

    function lista() {
        const u = yo();
        if (!u) return [];
        const ahora = Store.ahora();
        const avisos = [];
        const add = (id, icono, texto, cuando, enlace) => avisos.push({ id, icono, texto, cuando, enlace });

        // subastas
        for (const s of Store.listarSubastas()) {
            const mias = s.pujas.filter((p) => p.usuarioId === u.id);
            if (s.estado === "activa" && mias.length && s.mejorPuja && s.mejorPuja.usuarioId !== u.id) {
                add(`superado-${s.id}-${s.mejorPuja.id}`, "⚠️", `Te han superado en la subasta de ${s.titulo} (${dia(s.fecha)} ${s.hora}): ahora va por ${formatoCC(s.precioActual)}.`, s.mejorPuja.fecha, "index.html#subastas");
            }
            if (s.estado === "finalizada" && ahora - s.fin < 7 * 24 * HORA) {
                if (s.ganador?.id === u.id) add(`ganada-${s.id}`, "🏆", `¡Has ganado la subasta de ${s.titulo} por ${formatoCC(s.precioActual)}! La pista ya es tuya (${dia(s.fecha)} ${s.hora}).`, s.fin, "reservas.html");
                if (s.vendedorId === u.id && s.ganador) add(`vendida-${s.id}`, "💸", `Tu reserva de ${s.titulo} se ha revendido por ${formatoCC(s.precioActual)}. Recibes ${formatoCC(s.reparto.neto)}.`, s.fin, "perfil.html#monedero");
            }
        }

        // comunidad
        const reservas = Store.todasLasReservas();
        const futura = (r) => r && Store.msMadrid(r.date, r.time) > ahora;
        for (const x of Store.participantes()) {
            const r = reservas.find((y) => y.id === x.reservaId);
            if (!futura(r)) continue;
            if (r.userId === u.id && x.estado === "pendiente") {
                add(`solicitud-${x.reservaId}-${x.usuarioId}`, "🙋", `${Store.getUsuario(x.usuarioId)?.nombre || "Un jugador"} quiere unirse a tu partido en ${nombreInst(r.facility)} (${dia(r.date)} ${r.time}).`, x.creado, "reservas.html#history-title");
            }
            if (x.usuarioId === u.id && x.estado !== "pendiente") {
                const aceptado = x.estado === "aceptado";
                add(`respuesta-${x.reservaId}-${x.estado}`, aceptado ? "✅" : "❌", `${Store.getUsuario(r.userId)?.nombre || "El organizador"} ${aceptado ? "te ha aceptado" : "no ha aceptado tu solicitud"} en el partido de ${nombreInst(r.facility)} (${dia(r.date)} ${r.time}).`, x.creado, "reservas.html#history-title");
            }
        }

        // partidos propios que empiezan en menos de 24 h
        for (const r of Store.misReservas()) {
            const inicio = Store.msMadrid(r.date, r.time);
            if (inicio > ahora && inicio - ahora < 24 * HORA && r.tipo !== "bloqueo") {
                add(`pronto-${r.id}`, "⏰", `Tu reserva en ${nombreInst(r.facility)} · ${r.court} es ${r.date === ahoraCeuta().slice(0, 10) ? "hoy" : "mañana"} a las ${r.time}.`, inicio - 24 * HORA, "reservas.html#history-title");
            }
        }

        // pista solidaria
        for (const p of Store.peticionesSolidarias()) {
            if (p.estado === "cumplida") add(`solidaria-${p.id}`, "🤝", `Os hemos cedido una pista solidaria de ${p.deporte.toLowerCase()} (${dia(p.fecha)}). La tenéis en «Mis reservas».`, Store.msMadrid(p.fecha, p.desde), "reservas.html#history-title");
        }

        // última hora de su deporte favorito
        const perfil = Store.getUsuario(u.id) || {};
        const favorito = perfil.deporteFavorito;
        if (favorito) {
            const huecos = Store.listarHuecosAutomaticos().filter((h) => h.deporte === favorito);
            if (huecos.length) {
                const primero = huecos.sort((a, b) => `${a.fecha}${a.hora}`.localeCompare(`${b.fecha}${b.hora}`))[0];
                add(`ultima-${primero.fecha}-${primero.hora}`, "⚡", `${huecos.length} ${huecos.length === 1 ? "turno" : "turnos"} de ${favorito.toLowerCase()} a mitad de precio en subasta de última hora (desde las ${primero.hora}).`, ahora - 1, "index.html#subastas");
            }
        }

        // viento para náutica
        const nautico = (typeof Viento !== "undefined") && (Viento.esNautico(favorito) || Store.misReservas().some((r) =>
            futura(r) && Viento.esNautico(INSTALACIONES.find((i) => i.id === r.facility)?.deporte)));
        if (nautico && horasViento) {
            const ahoraTexto = ahoraCeuta();
            const actual = horasViento.find((h) => h.fecha === ahoraTexto.slice(0, 10) && h.hora.slice(0, 2) === ahoraTexto.slice(11, 13));
            const buena = Viento.mejorVentana(horasViento, ahoraTexto);
            if (buena && (!actual || actual.estado !== "bueno")) {
                add(`viento-${buena.fecha}-${buena.hora}`, "🌊", `Mejora el viento: ${buena.fecha === ahoraTexto.slice(0, 10) ? "hoy" : "mañana"} a las ${buena.hora} habrá ${buena.velocidad} km/h. Buen momento para reservar kayak o paddle surf. ${Viento.consejo(buena.tipo)}`, ahora - 2, "reservas.html?pista=16");
            } else if (actual && actual.estado === "bueno") {
                add(`viento-ahora-${actual.fecha}-${actual.hora}`, "🌊", `Ahora hay poco viento (${actual.velocidad} km/h): buen momento para salir al agua. ${Viento.consejo(actual.tipo)}`, ahora - 2, "reservas.html?pista=16");
            }
        }

        return avisos.sort((a, b) => b.cuando - a.cuando);
    }

    // ---------- interfaz ----------

    let panel;

    function crearPanel() {
        panel = document.createElement("section");
        panel.id = "avisos-panel";
        panel.className = "avisos-panel";
        panel.hidden = true;
        panel.setAttribute("aria-label", "Avisos");
        document.body.append(panel);
        panel.addEventListener("click", (e) => {
            if (e.target.closest("[data-avisos=leer]")) {
                guardar(claveLeidos(), new Set([...leer(claveLeidos()), ...lista().map((a) => a.id)]));
                pintar();
            }
            if (e.target.closest("[data-avisos=permiso]")) {
                Notification.requestPermission().then(pintar);
            }
            const enlace = e.target.closest("a[data-aviso]");
            if (enlace) guardar(claveLeidos(), new Set([...leer(claveLeidos()), enlace.dataset.aviso]));
        });
        document.addEventListener("click", (e) => {
            if (!panel.hidden && !panel.contains(e.target) && !e.target.closest("[data-nav=avisos]")) cerrar();
        });
        document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !panel.hidden) cerrar(); });
    }

    const haceRato = new Intl.RelativeTimeFormat("es", { numeric: "auto" });
    function cuando(ms) {
        const min = Math.round((ms - Store.ahora()) / 60000);
        if (Math.abs(min) < 60) return haceRato.format(min, "minute");
        if (Math.abs(min) < 1440) return haceRato.format(Math.round(min / 60), "hour");
        return haceRato.format(Math.round(min / 1440), "day");
    }

    function pintar() {
        const avisos = lista();
        const leidos = leer(claveLeidos());
        const sinLeer = avisos.filter((a) => !leidos.has(a.id)).length;
        for (const c of document.querySelectorAll(".bell-count")) {
            c.textContent = sinLeer > 9 ? "9+" : sinLeer;
            c.hidden = !sinLeer;
        }
        for (const b of document.querySelectorAll("[data-nav=avisos]")) {
            b.setAttribute("aria-label", sinLeer ? `Avisos: ${sinLeer} sin leer` : "Avisos");
        }
        if (!panel || panel.hidden) return;
        const permiso = "Notification" in window && Notification.permission === "default";
        panel.innerHTML = `
            <header><h2>Avisos</h2>${sinLeer ? `<button type="button" class="login-btn" data-avisos="leer">Marcar todo como leído</button>` : ""}</header>
            <ul>${avisos.map((a) => `
                <li class="${leidos.has(a.id) ? "" : "aviso-nuevo"}">
                    <a href="${a.enlace}" data-aviso="${esc(a.id)}">
                        <span class="aviso-icono" aria-hidden="true">${a.icono}</span>
                        <span><span>${esc(a.texto)}</span><small>${cuando(a.cuando)}</small></span>
                    </a>
                </li>`).join("") || `<li class="aviso-vacio">No tienes avisos. Te contaremos aquí cuándo te superan en una subasta, quién quiere unirse a tus partidos o cuándo mejora el viento.</li>`}</ul>
            ${permiso ? `<footer><button type="button" class="register-btn" data-avisos="permiso">🔔 Avisarme también con notificaciones del navegador</button></footer>` : ""}`;
    }

    function abrir() {
        if (!panel) crearPanel();
        panel.hidden = false;
        pintar();
        const boton = document.querySelector("[data-nav=avisos]");
        boton?.setAttribute("aria-expanded", "true");
    }

    function cerrar() {
        panel.hidden = true;
        document.querySelector("[data-nav=avisos]")?.setAttribute("aria-expanded", "false");
    }

    const alternar = () => (panel && !panel.hidden ? cerrar() : abrir());

    // Notificaciones del navegador para los avisos nuevos (la primera vez solo
    // se apuntan los que ya había, para no llenar la pantalla)
    function notificarNuevos() {
        if (!yo()) return;
        const avisos = lista();
        const clave = claveNotificados();
        const primeraVez = localStorage.getItem(clave) === null;
        const ya = leer(clave);
        const nuevos = avisos.filter((a) => !ya.has(a.id));
        if (!nuevos.length && !primeraVez) return;
        guardar(clave, new Set([...ya, ...avisos.map((a) => a.id)]));
        if (primeraVez || !("Notification" in window) || Notification.permission !== "granted") return;
        for (const a of nuevos.slice(0, 3)) {
            try {
                const n = new Notification("CeutaPlay", { body: `${a.icono} ${a.texto}`, tag: a.id });
                n.onclick = () => { window.focus(); location.href = a.enlace; };
            } catch { /* algunos navegadores solo lo permiten desde un service worker */ }
        }
    }

    function actualizar() {
        pintar();
        notificarNuevos();
    }

    async function cargarViento() {
        if (!(typeof Viento !== "undefined") || !yo()) return;
        try {
            horasViento = await Viento.obtener();
            actualizar();
        } catch { /* sin conexión con la previsión: no hay aviso de viento */ }
    }

    function iniciar() {
        document.addEventListener("datos-cambiados", actualizar);
        document.addEventListener("sesion-cambiada", () => { actualizar(); cargarViento(); });
        Store.inicializar().then(() => { actualizar(); cargarViento(); });
        setInterval(actualizar, 60000);
        setInterval(cargarViento, 30 * 60000);
    }

    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar);
    else iniciar();

    return { lista, pintar, alternar, cerrar };
})();
