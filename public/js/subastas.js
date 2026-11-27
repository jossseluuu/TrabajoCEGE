// Subastas: listado, pujas, cuenta atrás y reventa de reservas.
// Los datos se leen y guardan a través de `Store` (store.js).
//
// Dos formatos (ver SUBASTA_AUTOMATICA en data.js):
//   ⚡ automatica → pistas libres a 12 h o menos, salen solas a mitad de precio
//   🔁 reventa    → un usuario subasta su reserva y cobra el precio final menos
//                   la comisión de CeutaPlay

const Subastas = (() => {

    const DURACIONES = [
        { minutos: 2, texto: "2 minutos (demo)" },
        { minutos: 15, texto: "15 minutos" },
        { minutos: 60, texto: "1 hora" },
        { minutos: 360, texto: "6 horas" },
        { minutos: 1440, texto: "1 día" },
        { minutos: 4320, texto: "3 días" },
    ];

    let filtro = "activas";
    let deporteFiltro = "";
    let orden = "fin";
    let subastaAbierta = null; // id de la subasta que se ve en el modal de puja
    let activasPintadas = new Set();

    // Para avisar al usuario cuando le superan una puja o gana una subasta
    // mientras tiene la página abierta: { usuarioId, subastas: Map(id → estado) }
    let ultimoEstado = { usuarioId: null, subastas: new Map() };

    const $ = (id) => document.getElementById(id);
    const esc = (t) => UI.escapeHTML(t);

    // ---------- formatos de subasta ----------

    function lineaVendedor(s) {
        if (s.tipo === "automatica") {
            const pistas = s.pista ? esc(s.pista)
                : `${s.pistasLibres.length} ${s.pistasLibres.length === 1 ? "pista libre" : "pistas libres"}`;
            return `⚡ Subasta automática de la instalación · ${pistas}`;
        }
        return `Subastada por <strong>${esc(s.vendedor ? s.vendedor.nombre : "—")}</strong>${s.pista ? ` · ${esc(s.pista)}` : ""}`;
    }

    // Cuánto recibe quien revende su reserva (solo lo ve el vendedor)
    function lineaReparto(s, usuario) {
        if (!usuario || s.tipo === "automatica" || s.vendedorId !== usuario.id) return "";
        const { neto } = s.reparto;
        if (s.estado === "finalizada" && s.ganador) {
            return `<p class="auction-payout">💰 Recibes <strong>${formatoCC(neto)}</strong>
                    (${s.precioActual} CC − comisión ${s.comisionPct} % − IPSI)</p>`;
        }
        if (s.estado === "activa") {
            return `<p class="auction-payout">💰 Si se vende a este precio recibirás <strong>${formatoCC(neto)}</strong>
                    · comisión CeutaPlay ${s.comisionPct} % + IPSI</p>`;
        }
        return "";
    }

    // ---------- precio normal y ahorro ----------

    function instalacionDe(s) {
        return INSTALACIONES.find((i) => i.id === Number(s.instalacionId)) || null;
    }

    function precioNormal(s) {
        const instalacion = instalacionDe(s);
        return instalacion && instalacion.precioPrueba ? instalacion.precioPrueba : null;
    }

    // Porcentaje que se ahorra respecto al precio normal de la pista (0 si no hay ahorro)
    function ahorro(s) {
        const normal = precioNormal(s);
        if (!normal || s.precioActual >= normal) return 0;
        return Math.round((1 - s.precioActual / normal) * 100);
    }


    function progreso(inicio, fin) {
        if (!inicio || fin <= inicio) return 100;
        return Math.min(100, Math.max(0, ((Store.ahora() - inicio) / (fin - inicio)) * 100));
    }

    // ---------- formato ----------

    function formatoRestante(ms) {
        if (ms <= 0) return "Finalizada";
        const s = Math.floor(ms / 1000);
        const d = Math.floor(s / 86400);
        const h = Math.floor((s % 86400) / 3600);
        const m = Math.floor((s % 3600) / 60);
        const seg = s % 60;
        if (d > 0) return `${d}d ${h}h ${m}m`;
        if (h > 0) return `${h}h ${m}m ${String(seg).padStart(2, "0")}s`;
        return `${m}m ${String(seg).padStart(2, "0")}s`;
    }

    function formatoPartido(fecha, hora) {
        const dia = new Date(`${fecha}T${hora}`).toLocaleDateString("es-ES", {
            weekday: "short", day: "numeric", month: "short",
        });
        return `📅 ${dia} · 🕒 ${hora}`;
    }

    function haceCuanto(ms) {
        const min = Math.round((Store.ahora() - ms) / 60000);
        if (min < 1) return "ahora mismo";
        if (min < 60) return `hace ${min} min`;
        const h = Math.round(min / 60);
        if (h < 24) return `hace ${h} h`;
        return `hace ${Math.round(h / 24)} d`;
    }

    function iconoDeporte(nombre) {
        const deporte = DEPORTES.find((d) => d.nombre === nombre);
        return deporte ? deporte.icono : "🏅";
    }

    // ---------- tarjetas ----------

    function botonAdmin(s, usuario) {
        if (!usuario || !usuario.admin || s.estado !== "activa") return "";
        if (s.vendedorId === usuario.id && s.pujas.length === 0) return ""; // ya tiene "Cancelar mi subasta"
        return `<button type="button" class="auction-btn btn-secondary btn-admin" data-accion="admin-cancelar" data-id="${s.id}">
                    🛡️ Cancelar subasta (admin)
                </button>`;
    }

    function botonTarjeta(s, usuario) {
        if (s.estado === "cancelada") {
            return `<button type="button" class="auction-btn" disabled>Subasta cancelada</button>`;
        }
        if (s.estado === "finalizada") {
            if (!s.ganador) return `<button type="button" class="auction-btn" disabled>Terminó sin pujas</button>`;
            if (usuario && s.ganador.id === usuario.id) {
                return `<button type="button" class="auction-btn btn-win" disabled>🏆 ¡La has ganado por ${s.precioActual} CC!</button>`;
            }
            return `<button type="button" class="auction-btn" disabled>Ganada por ${esc(s.ganador.nombre)}</button>`;
        }
        if (!usuario) {
            return `<button type="button" class="auction-btn" data-accion="pujar" data-id="${s.id}">Inicia sesión para pujar</button>`;
        }
        if (s.vendedorId === usuario.id) {
            return s.pujas.length === 0
                ? `<button type="button" class="auction-btn btn-secondary" data-accion="cancelar" data-id="${s.id}">Cancelar mi subasta</button>`
                : `<button type="button" class="auction-btn" disabled>Es tu subasta</button>`;
        }
        if (s.mejorPuja && s.mejorPuja.usuarioId === usuario.id) {
            return `<button type="button" class="auction-btn btn-win" data-accion="pujar" data-id="${s.id}">🏆 Vas ganando · ver pujas</button>`;
        }
        return `<button type="button" class="auction-btn btn-primary" data-accion="pujar" data-id="${s.id}">Pujar · mín. ${s.pujaMinima} CC</button>`;
    }

    function avisoTarjeta(s, usuario) {
        if (!usuario || s.estado !== "activa") return "";
        const hePujado = s.pujas.some((p) => p.usuarioId === usuario.id);
        const voyGanando = s.mejorPuja && s.mejorPuja.usuarioId === usuario.id;
        if (hePujado && !voyGanando) {
            return `<p class="auction-alert">⚠️ Te han superado. ¡Vuelve a pujar!</p>`;
        }
        return "";
    }

    function crearTarjeta(s, usuario) {
        const badge = {
            activa: s.tipo === "automatica" ? `<span class="auction-badge badge-auto">⚡ ÚLTIMA HORA</span>`
                : s.tipo === "reventa" ? `<span class="auction-badge">🔁 REVENTA</span>`
                : `<span class="auction-badge">🔥 EN CURSO</span>`,
            finalizada: `<span class="auction-badge badge-ended">FINALIZADA</span>`,
            cancelada: `<span class="auction-badge badge-ended">CANCELADA</span>`,
        }[s.estado];

        const etiquetaPrecio = s.estado === "finalizada" ? "Precio final"
            : s.pujas.length ? "Puja actual" : "Puja mínima";

        const normal = precioNormal(s);
        const pct = ahorro(s);
        const lineaAhorro = !normal ? "" : pct > 0
            ? `<p class="auction-saving">💸 ${s.estado === "finalizada" ? "Se ahorró" : "Ahorras"} un <strong>${pct}%</strong> · precio normal ${normal} CC/h</p>`
            : `<p class="auction-saving is-neutral">Precio normal de la pista: ${normal} CC/h</p>`;

        const barra = s.estado === "activa" ? `
                <div class="auction-progress" aria-hidden="true">
                    <span data-progreso data-inicio="${s.creada || ""}" data-fin-barra="${s.fin}"
                          style="width:${progreso(s.creada, s.fin).toFixed(1)}%"></span>
                </div>` : "";

        return `
            <article class="auction-card ${s.estado !== "activa" ? "is-ended" : ""}">
                <div class="auction-top">
                    ${badge}
                    <span class="discount-badge">${iconoDeporte(s.deporte)} ${esc(s.deporte)}</span>
                </div>
                <h3>${esc(s.titulo)}</h3>
                <p class="auction-hour">${formatoPartido(s.fecha, s.hora)}</p>
                <p class="auction-seller">${lineaVendedor(s)}</p>
                ${s.descripcion ? `<p class="auction-desc">“${esc(s.descripcion)}”</p>` : ""}
                <div class="auction-price">
                    <div>
                        <small>Precio de salida</small>
                        ${s.pujas.length ? `<del>${s.precioSalida} CC</del>` : `<span class="price-start">${s.precioSalida} CC</span>`}
                    </div>
                    <div>
                        <small>${etiquetaPrecio}</small>
                        <strong>${s.precioActual} CC</strong>
                    </div>
                </div>
                ${lineaAhorro}
                ${lineaReparto(s, usuario)}
                ${barra}
                <div class="auction-meta">
                    <span>👥 ${s.pujas.length} ${s.pujas.length === 1 ? "puja" : "pujas"}</span>
                    <span class="countdown ${s.restanteMs < 5 * 60000 && s.estado === "activa" ? "is-urgent" : ""}"
                          ${s.estado === "activa" ? `data-fin="${s.fin}"` : ""}>
                        ⏱ ${s.estado === "activa" ? formatoRestante(s.restanteMs) : "Cerrada"}
                    </span>
                </div>
                ${avisoTarjeta(s, usuario)}
                ${botonTarjeta(s, usuario)}
                ${botonAdmin(s, usuario)}
            </article>`;
    }

    const ORDENES = {
        fin: (a, b) => (filtro === "finalizadas" ? b.fin - a.fin : a.fin - b.fin),
        precio: (a, b) => a.precioActual - b.precioActual,
        ahorro: (a, b) => ahorro(b) - ahorro(a),
        pujas: (a, b) => b.pujas.length - a.pujas.length,
        recientes: (a, b) => (b.creada || 0) - (a.creada || 0),
    };

    function filtrar(lista, usuario) {
        let resultado;
        switch (filtro) {
            case "activas":
                resultado = lista.filter((s) => s.estado === "activa" && !s.virtual);
                break;
            case "ultima-hora":
                resultado = lista.filter((s) => s.estado === "activa" && s.tipo === "automatica");
                break;
            case "finalizadas":
                resultado = lista.filter((s) => s.estado !== "activa" && !s.virtual);
                break;
            case "mias":
                resultado = lista.filter((s) => usuario && s.vendedorId === usuario.id);
                break;
            case "pujas":
                resultado = lista.filter((s) => usuario && s.pujas.some((p) => p.usuarioId === usuario.id));
                break;
            default:
                resultado = [...lista];
        }
        if (deporteFiltro) resultado = resultado.filter((s) => s.deporte === deporteFiltro);
        // En "Mis subastas" y "Mis pujas" primero las que siguen en curso
        const activasPrimero = (a, b) => (a.estado !== "activa") - (b.estado !== "activa");
        return resultado.sort((a, b) => activasPrimero(a, b) || ORDENES[orden](a, b));
    }

    function pintarResumen(todas) {
        const activas = todas.filter((s) => s.estado === "activa");
        const pujas = todas.reduce((n, s) => n + s.pujas.length, 0);
        const pronto = activas.filter((s) => s.restanteMs < 60 * 60000).length;
        const vendidas = todas.filter((s) => s.estado === "finalizada" && s.ganador);
        const ahorroMedio = vendidas.length
            ? Math.round(vendidas.reduce((n, s) => n + ahorro(s), 0) / vendidas.length)
            : null;

        const ultimaHora = Store.listarHuecosAutomaticos().length +
            activas.filter((s) => s.tipo === "automatica").length;
        $("subastas-stats").innerHTML = `
            <div><dt>En curso</dt><dd>${activas.length}</dd></div>
            <div><dt>⚡ Pistas a mitad de precio</dt><dd>${ultimaHora}</dd></div>
            <div><dt>Terminan en menos de 1 h</dt><dd class="${pronto ? "is-urgent" : ""}">${pronto}</dd></div>
            <div><dt>Pujas realizadas</dt><dd>${pujas}</dd></div>
            <div><dt>Ahorro medio de las vendidas</dt><dd>${ahorroMedio === null ? "—" : `${ahorroMedio}%`}</dd></div>`;
    }

    // Compara con lo que se vio la última vez para avisar de los cambios importantes
    function avisarCambios(todas, usuario) {
        const nuevo = new Map(todas.map((s) => [s.id, {
            estado: s.estado,
            ganando: Boolean(usuario && s.mejorPuja && s.mejorPuja.usuarioId === usuario.id),
        }]));

        if (usuario && ultimoEstado.usuarioId === usuario.id) {
            for (const s of todas) {
                const antes = ultimoEstado.subastas.get(s.id);
                if (!antes || antes.estado !== "activa") continue;
                const ahora = nuevo.get(s.id);
                if (antes.ganando && ahora.estado === "activa" && !ahora.ganando) {
                    UI.toast(`⚠️ Te han superado en ${s.titulo}: ahora va por ${s.precioActual} CC.`, "error");
                } else if (antes.ganando && ahora.estado === "finalizada" && ahora.ganando) {
                    UI.toast(`🏆 ¡Has ganado la subasta de ${s.titulo} por ${s.precioActual} CC! La reserva ya es tuya.`);
                } else if (s.vendedorId === usuario.id && ahora.estado === "finalizada") {
                    UI.toast(s.ganador
                        ? `💰 Tu subasta de ${s.titulo} se ha cerrado: la gana ${s.ganador.nombre} por ${s.precioActual} CC. Recibes ${formatoCC(s.reparto.neto)}.`
                        : `Tu subasta de ${s.titulo} ha terminado sin pujas.`);
                }
            }
        }
        ultimoEstado = { usuarioId: usuario ? usuario.id : null, subastas: nuevo };
    }

    function mensajeVacio(usuario) {
        if ((filtro === "mias" || filtro === "pujas") && !usuario) {
            return `Inicia sesión para ver ${filtro === "mias" ? "tus subastas" : "tus pujas"}.
                <button type="button" class="link-btn" data-accion="login">Iniciar sesión</button>`;
        }
        if (deporteFiltro) return `No hay subastas de ${esc(deporteFiltro.toLowerCase())} en esta lista.`;
        return {
            activas: "No hay subastas de usuarios en curso. Mira las de ⚡ Última hora o subasta tu reserva.",
            "ultima-hora": "Ahora mismo no hay pistas libres en las próximas 12 horas.",
            finalizadas: "Todavía no ha terminado ninguna subasta.",
            mias: "Aún no has creado ninguna subasta.",
            pujas: "Aún no has pujado en ninguna subasta.",
        }[filtro];
    }

    // ---------- última hora agrupada: instalaciones × horas ----------
    let vistaUltima = "tabla";   // "tabla" o "tarjetas"
    let horaUltima = "";         // "" = todas

    function celdaUltima(items, usuario) {
        return items.map((s) => {
            const ganando = usuario && s.mejorPuja && s.mejorPuja.usuarioId === usuario.id;
            const superado = usuario && !ganando && s.pujas.some((p) => p.usuarioId === usuario.id);
            const detalle = s.virtual
                ? `${s.pistasLibres.length} ${s.pistasLibres.length === 1 ? "libre" : "libres"}`
                : `${s.pujas.length} ${s.pujas.length === 1 ? "puja" : "pujas"} · ${esc(s.pista || "")}`;
            return `<button type="button" class="ultima-cell ${ganando ? "is-winning" : superado ? "is-outbid" : s.virtual ? "" : "has-bids"}"
                        data-accion="pujar" data-id="${esc(s.id)}"
                        aria-label="${esc(s.titulo)}, ${s.hora}: ${s.precioActual} CC, ${detalle}">
                        <strong>${s.precioActual} CC</strong>
                        <small>${ganando ? "🏆 vas ganando" : superado ? "⚠️ superado" : detalle}</small>
                    </button>`;
        }).join("");
    }

    function tablaUltimaHora(lista, usuario) {
        const hoy = Store.textoMadrid(Store.ahora()).slice(0, 10);
        const clave = (s) => `${s.fecha}|${s.hora}`;
        const todasHoras = [...new Set(lista.map(clave))].sort();
        const horas = horaUltima ? todasHoras.filter((h) => h === horaUltima) : todasHoras;
        const etiquetaHora = (h) => { const [f, hh] = h.split("|"); return `${f === hoy ? "" : "mañ. "}${hh}`; };
        const instalaciones = [...new Set(lista.map((s) => Number(s.instalacionId)))]
            .map((id) => INSTALACIONES.find((i) => i.id === id)).filter(Boolean);
        const selector = `
            <div class="ultima-head">
                <label>¿A qué hora quieres jugar?
                    <select data-ultima="hora">
                        <option value="">Todas las horas</option>
                        ${todasHoras.map((h) => `<option value="${h}" ${h === horaUltima ? "selected" : ""}>${etiquetaHora(h).replace("mañ.", "mañana")}</option>`).join("")}
                    </select>
                </label>
                <p class="form-hint">Precio de salida: mitad del precio normal. Cada casilla es un turno de 1 h; pulsa para pujar. Cierra ${SUBASTA_AUTOMATICA.cierreMinAntes} min antes de empezar.</p>
                <button type="button" class="login-btn" data-ultima="tarjetas">Ver como tarjetas</button>
            </div>`;
        if (!horas.length) return selector + `<p class="empty-results">No hay turnos a esa hora.</p>`;
        const filas = instalaciones.map((inst) => {
            const celdas = horas.map((h) => {
                const items = lista.filter((s) => Number(s.instalacionId) === inst.id && clave(s) === h);
                return `<td>${items.length ? celdaUltima(items, usuario) : `<span class="ultima-empty" aria-label="Sin turno">—</span>`}</td>`;
            }).join("");
            const normal = precioTurno(inst, hoy, "18:00", 60);
            return `<tr><th scope="row"><span>${iconoDeporte(inst.deporte)} ${esc(inst.nombre)}</span><small>normal ${normal} CC/h</small></th>${celdas}</tr>`;
        }).join("");
        return `${selector}
            <div class="ultima-scroll" role="region" tabindex="0" aria-label="Turnos de última hora">
                <table class="ultima-table">
                    <thead><tr><th scope="col">Instalación</th>${horas.map((h) => `<th scope="col">${etiquetaHora(h)}</th>`).join("")}</tr></thead>
                    <tbody>${filas}</tbody>
                </table>
            </div>`;
    }

    function pintar() {
        const usuario = Store.usuarioActual();
        const todas = Store.listarSubastas();
        const huecos = Store.listarHuecosAutomaticos();
        const lista = filtrar(filtro === "ultima-hora" ? [...todas, ...huecos] : todas, usuario);

        avisarCambios(todas, usuario);
        pintarResumen(todas);

        const agrupada = filtro === "ultima-hora" && vistaUltima === "tabla" && lista.length > 0;
        $("subastas-grid").classList.toggle("ultima-grid", agrupada);
        $("subastas-grid").innerHTML = agrupada ? tablaUltimaHora(lista, usuario)
            : (filtro === "ultima-hora" && lista.length ? `<p class="ultima-switch"><button type="button" class="login-btn" data-ultima="tabla">Ver agrupado por hora</button></p>` : "") +
              lista.map((s) => crearTarjeta(s, usuario)).join("");

        const vacio = $("subastas-vacio");
        vacio.innerHTML = mensajeVacio(usuario);
        vacio.hidden = lista.length > 0;

        $("contador-activas").textContent = todas.filter((s) => s.estado === "activa").length;
        $("contador-ultima").textContent = huecos.length +
            todas.filter((s) => s.estado === "activa" && s.tipo === "automatica").length;

        activasPintadas = new Set(todas.filter((s) => s.estado === "activa").map((s) => s.id));

        if (subastaAbierta && $("bid-modal").open) pintarModalPuja();
    }

    // Actualiza las cuentas atrás cada segundo sin repintar todo
    function tic() {
        const ahora = Store.ahora();
        let algunaTerminada = false;

        document.querySelectorAll("[data-fin]").forEach((el) => {
            const restante = Number(el.dataset.fin) - ahora;
            if (restante <= 0) algunaTerminada = true;
            el.textContent = `⏱ ${formatoRestante(restante)}`;
            el.classList.toggle("is-urgent", restante < 5 * 60000);
        });

        document.querySelectorAll("[data-progreso]").forEach((barra) => {
            barra.style.width = `${progreso(Number(barra.dataset.inicio), Number(barra.dataset.finBarra)).toFixed(1)}%`;
        });

        // También hay que repintar si termina una subasta que no se ve en el filtro actual
        if (!algunaTerminada) {
            algunaTerminada = Store.listarSubastas()
                .some((s) => s.estado !== "activa" && activasPintadas.has(s.id));
        }
        if (algunaTerminada) {
            Store.cerrarSubastas(); // adjudica (crea o traspasa la reserva)
            pintar();
        }
        // los turnos de última hora aparecen y desaparecen con la hora
        if (++segundos % 60 === 0) pintar();
    }
    let segundos = 0;

    // ---------- modal de puja ----------

    function pintarModalPuja() {
        const s = Store.getSubasta(subastaAbierta);
        const usuario = Store.usuarioActual();
        if (!s) return;

        // Se repinta cada vez que llega un cambio del servidor: hay que conservar
        // lo que el usuario estaba escribiendo y el último error (si el precio
        // no ha cambiado entretanto)
        const formAnterior = $("bid-form");
        const anterior = formAnterior ? {
            precio: Number(formAnterior.dataset.precio),
            cantidad: $("bid-cantidad").dataset.editado ? $("bid-cantidad").value : null,
            error: formAnterior.querySelector(".form-error").hidden ? "" : formAnterior.querySelector(".form-error").textContent,
            foco: document.activeElement === $("bid-cantidad"),
        } : null;

        const historial = s.pujas.length
            ? s.pujas.map((p, i) => {
                const autor = Store.getUsuario(p.usuarioId);
                const soyYo = usuario && p.usuarioId === usuario.id;
                return `
                    <li class="${i === 0 ? "is-top" : ""}">
                        <span>${i === 0 ? "🏆 " : ""}${esc(autor ? autor.nombre : "—")}${soyYo ? " (tú)" : ""}</span>
                        <span class="bid-time">${haceCuanto(p.fecha)}</span>
                        <strong>${p.cantidad} CC</strong>
                    </li>`;
            }).join("")
            : `<li class="bid-empty">Nadie ha pujado todavía. ¡Sé el primero!</li>`;

        const voyGanando = usuario && s.mejorPuja && s.mejorPuja.usuarioId === usuario.id;
        const puedePujar = s.estado === "activa" && usuario && s.vendedorId !== usuario.id && !voyGanando;

        let estadoTexto = "";
        if (s.estado !== "activa") estadoTexto = `<p class="form-notice">Esta subasta ya está cerrada.</p>`;
        else if (voyGanando) estadoTexto = `<p class="form-notice notice-ok">🏆 Tienes la puja más alta. Te avisaremos aquí si alguien te supera.</p>`;

        $("bid-body").innerHTML = `
            <span class="section-label">${iconoDeporte(s.deporte)} ${esc(s.deporte.toUpperCase())}</span>
            <h2>${esc(s.titulo)}</h2>
            <p class="auction-hour">${formatoPartido(s.fecha, s.hora)}</p>
            <p class="auction-seller">${lineaVendedor(s)}</p>
            ${s.tipo === "automatica" ? `<p class="form-hint">Pista libre de última hora a mitad de precio. Si ganas, la reserva se crea a tu nombre al cerrar la subasta (${SUBASTA_AUTOMATICA.cierreMinAntes} min antes del partido).</p>`
                : s.tipo === "reventa" ? `<p class="form-hint">Reventa de una reserva. Si ganas, la reserva pasa a tu nombre al cerrar la subasta.</p>` : ""}
            ${lineaReparto(s, usuario)}

            <div class="bid-summary">
                <div>
                    <small>${s.pujas.length ? "Puja actual" : "Precio de salida"}</small>
                    <strong>${s.precioActual} CC</strong>
                </div>
                <div>
                    <small>Termina en</small>
                    <strong class="countdown" ${s.estado === "activa" ? `data-fin="${s.fin}"` : ""}>
                        ⏱ ${formatoRestante(s.restanteMs)}
                    </strong>
                </div>
            </div>

            ${precioNormal(s) ? `<p class="auction-saving">Precio normal de la pista: ${precioNormal(s)} CC/h${ahorro(s) > 0 ? ` · ahora mismo te ahorras un <strong>${ahorro(s)}%</strong>` : ""}</p>` : ""}

            ${estadoTexto}

            ${puedePujar ? `
            <form id="bid-form" class="modal-form" novalidate>
                <label for="bid-cantidad">Tu puja (mínimo ${s.pujaMinima} CC, incrementos de ${s.incremento} CC)</label>
                <div class="bid-input">
                    <input type="number" id="bid-cantidad" name="cantidad"
                           min="${s.pujaMinima}" step="1" value="${s.pujaMinima}" required>
                    <span>CC</span>
                </div>
                <div class="quick-bids">
                    ${[0, s.incremento, s.incremento * 3, s.incremento * 5].map((extra) =>
                        `<button type="button" data-puja="${s.pujaMinima + extra}">${s.pujaMinima + extra} CC</button>`
                    ).join("")}
                </div>
                <p class="form-error" hidden></p>
                <button type="submit" class="submit-btn">Confirmar puja</button>
            </form>` : ""}

            <h4 class="bid-history-title">Historial de pujas</h4>
            <ul class="bid-history">${historial}</ul>`;

        const form = $("bid-form");
        if (!form) return;

        const input = $("bid-cantidad");
        form.dataset.precio = s.precioActual;
        input.addEventListener("input", () => (input.dataset.editado = "1"));
        form.querySelectorAll("[data-puja]").forEach((b) => {
            b.addEventListener("click", () => {
                input.value = b.dataset.puja;
                input.dataset.editado = "1";
            });
        });

        if (anterior) {
            if (anterior.cantidad !== null) {
                input.value = anterior.cantidad;
                input.dataset.editado = "1";
            }
            if (anterior.error && anterior.precio === s.precioActual) {
                const e = form.querySelector(".form-error");
                e.textContent = anterior.error;
                e.hidden = false;
            }
            if (anterior.foco) input.focus();
        }

        form.addEventListener("submit", async (event) => {
            event.preventDefault();
            const cantidad = Number($("bid-cantidad").value);
            form.querySelector("[type=submit]").disabled = true;
            try {
                const actualizada = await Store.pujar(s.id, cantidad);
                if (actualizada) subastaAbierta = actualizada.id; // en un turno libre se crea la subasta
                UI.toast(`✅ Has pujado ${cantidad} CC por ${s.titulo}.`);
                pintar();
            } catch (error) {
                pintar(); // por si otra persona ha pujado mientras tanto
                const nuevoForm = $("bid-form");
                if (nuevoForm) {
                    const e = nuevoForm.querySelector(".form-error");
                    e.textContent = error.message;
                    e.hidden = false;
                } else {
                    UI.toast(error.message, "error");
                }
            }
        });
    }

    function abrirPuja(id) {
        Auth.requerirLogin(() => {
            subastaAbierta = id;
            pintarModalPuja();
            const modal = $("bid-modal");
            if (!modal.open) modal.showModal();
            const input = $("bid-cantidad");
            if (input) input.focus();
        }, "Inicia sesión para pujar en esta subasta.");
    }

    // ---------- modal de reventa (subastar mi reserva) ----------

    function prepararFormularioCrear() {
        const form = $("create-form");
        const selReserva = $("crear-desde-reserva");
        const selDuracion = $("crear-duracion");
        const inputPrecio = $("crear-precio");
        let reservas = [];

        // La reventa puede durar como máximo hasta que empieza la reserva
        selDuracion.innerHTML = DURACIONES.map((d) =>
            `<option value="${d.minutos}">${d.texto}</option>`).join("") +
            `<option value="inicio">Hasta que empiece la reserva</option>`;

        const reservaElegida = () => reservas.find((r) => String(r.id) === selReserva.value) || null;
        const instalacionReserva = (r) => INSTALACIONES.find((i) => i.id === r.facility) || null;

        // Reservas futuras propias que se pueden subastar y no están ya en subasta
        function reservasSubastables() {
            const usuario = Store.usuarioActual();
            const enSubasta = new Set(Store.listarSubastas()
                .filter((s) => s.reservaId && !s.cancelada && !s.cerrada).map((s) => s.reservaId));
            return Store.misReservas()
                .filter((r) => instalacionReserva(r)?.subastable !== false && (r.tipo || "normal") === "normal")
                .filter((r) => Store.msMadrid(r.date, r.time) > Store.ahora() + 5 * 60000)
                .filter((r) => usuario && !enSubasta.has(r.id))
                .sort((a, b) => `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`));
        }

        // La subasta tiene que terminar antes de que empiece el partido
        function actualizarDuraciones() {
            const r = reservaElegida();
            const margen = r ? Store.msMadrid(r.date, r.time) - Store.ahora() : Infinity;
            [...selDuracion.options].forEach((o) => (o.disabled = o.value !== "inicio" && Number(o.value) * 60000 > margen));
            if (!selDuracion.selectedOptions[0] || selDuracion.selectedOptions[0].disabled) {
                const validas = [...selDuracion.options].filter((o) => !o.disabled);
                const preferida = validas.filter((o) => o.value !== "inicio" && Number(o.value) <= 60).pop() || validas[0];
                if (preferida) selDuracion.value = preferida.value;
            }
        }

        function actualizarReparto() {
            const r = reservaElegida();
            const precio = Math.max(1, Math.round(Number(inputPrecio.value) || 0));
            const { comisionSubastas, ipsi } = Store.tarifasSubastas();
            const comision = Math.round(precio * comisionSubastas) / 100;
            const ipsiEuros = Math.round(comision * ipsi) / 100;
            $("crear-reparto").innerHTML = r ? `
                <p><strong>Si se vende al precio de salida (${precio} CC):</strong></p>
                <dl>
                    <dt>Comisión CeutaPlay (${comisionSubastas} %)</dt><dd>− ${formatoCC(comision)}</dd>
                    <dt>IPSI de la comisión (${ipsi} %)</dt><dd>− ${formatoCC(ipsiEuros)}</dd>
                    <dt><strong>Recibes</strong></dt><dd><strong>${formatoCC(precio - comision - ipsiEuros)}</strong></dd>
                </dl>
                <p class="form-hint">Si nadie puja, la reserva sigue siendo tuya.</p>` : "";
        }

        function elegirReserva() {
            const r = reservaElegida();
            const pagado = r && (r.importe ?? precioTurno(instalacionReserva(r), r.date, r.time, r.duracion || 60));
            inputPrecio.value = pagado ? Math.max(1, Math.round(pagado / 2)) : 10;
            $("crear-precio-ayuda").textContent = pagado
                ? `Pagaste ${formatoCC(pagado)} por esta reserva (${textoDuracion(r.duracion || 60)}). Te proponemos salir a la mitad para atraer pujas.` : "";
            if (r && !$("crear-descripcion").dataset.editado) {
                $("crear-descripcion").value = `Reserva de ${r.court}. No puedo ir.`;
            }
            actualizarDuraciones();
            actualizarReparto();
        }

        selReserva.addEventListener("change", elegirReserva);
        inputPrecio.addEventListener("input", actualizarReparto);
        $("crear-descripcion").addEventListener("input", (e) => (e.target.dataset.editado = "1"));

        $("btn-crear-subasta").addEventListener("click", () => {
            Auth.requerirLogin(() => {
                form.reset();
                selDuracion.value = "60";
                delete $("crear-descripcion").dataset.editado;
                reservas = reservasSubastables();
                selReserva.innerHTML = reservas.map((r) => {
                    const instalacion = instalacionReserva(r);
                    const dia = r.date.split("-").reverse().slice(0, 2).join("/");
                    return `<option value="${esc(r.id)}">${esc(instalacion ? instalacion.nombre : "Instalación")} · ${esc(r.court)} · ${dia} ${esc(r.time)} (${textoDuracion(r.duracion || 60)})</option>`;
                }).join("");
                $("crear-sin-reservas").hidden = reservas.length > 0;
                form.hidden = reservas.length === 0;
                if (reservas.length) elegirReserva();
                form.querySelector(".form-error").hidden = true;
                $("create-modal").showModal();
            }, "Inicia sesión para subastar una de tus reservas.");
        });

        form.addEventListener("submit", async (event) => {
            event.preventDefault();
            const datos = new FormData(form);
            const boton = form.querySelector("[type=submit]");
            boton.disabled = true;
            try {
                const s = await Store.crearSubastaReventa({
                    reservaId: datos.get("reserva"),
                    precioSalida: datos.get("precio"),
                    incremento: datos.get("incremento"),
                    duracionMin: datos.get("duracion"),
                    descripcion: datos.get("descripcion"),
                });
                $("create-modal").close();
                UI.toast(`🔁 Tu reserva de ${s.titulo} ya está en subasta.`);
                cambiarFiltro("mias");
            } catch (error) {
                const e = form.querySelector(".form-error");
                e.textContent = error.message;
                e.hidden = false;
            } finally {
                boton.disabled = false;
            }
        });
    }

    // ---------- filtros ----------

    function cambiarFiltro(nuevo) {
        filtro = nuevo;
        document.querySelectorAll(".auction-filter").forEach((b) => {
            const activo = b.dataset.filtro === nuevo;
            b.classList.toggle("active", activo);
            b.setAttribute("aria-pressed", activo);
        });
        pintar();
    }

    // ---------- inicio ----------

    function iniciar() {
        UI.prepararModal($("bid-modal"));
        UI.prepararModal($("create-modal"));
        $("bid-modal").addEventListener("close", () => (subastaAbierta = null));

        prepararFormularioCrear();

        document.querySelectorAll(".auction-filter").forEach((b) => {
            b.addEventListener("click", () => cambiarFiltro(b.dataset.filtro));
        });

        // Filtro por deporte (solo los deportes que tienen instalaciones) y orden
        const selDeporte = $("subastas-deporte");
        const deportes = new Set(INSTALACIONES.map((i) => i.deporte));
        DEPORTES.filter((d) => deportes.has(d.nombre)).forEach((d) => {
            selDeporte.insertAdjacentHTML("beforeend",
                `<option value="${esc(d.nombre)}">${d.icono} ${esc(d.nombre)}</option>`);
        });
        selDeporte.addEventListener("change", () => {
            deporteFiltro = selDeporte.value;
            pintar();
        });
        $("subastas-orden").addEventListener("change", (event) => {
            orden = event.target.value;
            pintar();
        });

        // Botones de las tarjetas
        document.getElementById("subastas").addEventListener("change", (event) => {
            if (event.target.dataset.ultima === "hora") {
                horaUltima = event.target.value;
                pintar();
            }
        });

        document.getElementById("subastas").addEventListener("click", async (event) => {
            const vista = event.target.closest("[data-ultima=tarjetas], [data-ultima=tabla]");
            if (vista) {
                vistaUltima = vista.dataset.ultima;
                pintar();
                return;
            }
            const boton = event.target.closest("[data-accion]");
            if (!boton) return;
            const { accion, id } = boton.dataset;

            if (accion === "pujar") abrirPuja(id);
            if (accion === "login") Auth.abrir("login");
            if (accion === "cancelar" && confirm("¿Seguro que quieres cancelar esta subasta?")) {
                try {
                    await Store.cancelarSubasta(id);
                    UI.toast("Subasta cancelada.");
                    pintar();
                } catch (error) {
                    UI.toast(error.message, "error");
                }
            }
            if (accion === "admin-cancelar" &&
                confirm("Vas a cancelar esta subasta como administrador (aunque tenga pujas). ¿Continuar?")) {
                try {
                    await Store.adminCancelarSubasta(id);
                    UI.toast("🛡️ Subasta cancelada por el administrador.");
                    pintar();
                } catch (error) {
                    UI.toast(error.message, "error");
                }
            }
        });

        document.addEventListener("sesion-cambiada", () => {
            if ($("bid-modal").open && !Store.usuarioActual()) $("bid-modal").close();
            pintar();
        });

        // Si otra persona (otro dispositivo u otra pestaña) puja o crea una
        // subasta, se ve al momento
        document.addEventListener("datos-cambiados", pintar);

        setInterval(tic, 1000);
        pintar();
    }

    return { iniciar };
})();


// Arranque: datos de ejemplo (solo la primera vez) → login → subastas
document.addEventListener("DOMContentLoaded", async () => {
    try {
        await Store.inicializar();
    } catch (error) {
        console.error(error);
        UI.toast("No se ha podido conectar con el servidor. Recarga la página.", "error");
    }
    Auth.iniciar();
    Subastas.iniciar();
});
