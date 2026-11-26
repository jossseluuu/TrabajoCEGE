// Subastas entre usuarios: listado, creación, pujas y cuenta atrás.
// Los datos se leen y guardan a través de `Store` (store.js).

const Subastas = (() => {

    const DURACIONES = [
        { minutos: 2, texto: "2 minutos (demo)" },
        { minutos: 15, texto: "15 minutos" },
        { minutos: 60, texto: "1 hora" },
        { minutos: 360, texto: "6 horas" },
        { minutos: 1440, texto: "1 día" },
        { minutos: 4320, texto: "3 días" },
    ];

    const HORAS = ["09:00", "10:00", "11:00", "12:00", "13:00", "16:00",
        "17:00", "18:00", "19:00", "20:00", "21:00", "22:00"];

    let filtro = "activas";
    let subastaAbierta = null; // id de la subasta que se ve en el modal de puja
    let activasPintadas = new Set();

    const $ = (id) => document.getElementById(id);
    const esc = (t) => UI.escapeHTML(t);

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

    function botonTarjeta(s, usuario) {
        if (s.estado === "cancelada") {
            return `<button type="button" class="auction-btn" disabled>Subasta cancelada</button>`;
        }
        if (s.estado === "finalizada") {
            if (!s.ganador) return `<button type="button" class="auction-btn" disabled>Terminó sin pujas</button>`;
            if (usuario && s.ganador.id === usuario.id) {
                return `<button type="button" class="auction-btn btn-win" disabled>🏆 ¡La has ganado por ${s.precioActual} €!</button>`;
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
        return `<button type="button" class="auction-btn btn-primary" data-accion="pujar" data-id="${s.id}">Pujar · mín. ${s.pujaMinima} €</button>`;
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
            activa: `<span class="auction-badge">🔥 EN CURSO</span>`,
            finalizada: `<span class="auction-badge badge-ended">FINALIZADA</span>`,
            cancelada: `<span class="auction-badge badge-ended">CANCELADA</span>`,
        }[s.estado];

        const etiquetaPrecio = s.estado === "finalizada" ? "Precio final"
            : s.pujas.length ? "Puja actual" : "Puja mínima";

        return `
            <article class="auction-card ${s.estado !== "activa" ? "is-ended" : ""}">
                <div class="auction-top">
                    ${badge}
                    <span class="discount-badge">${iconoDeporte(s.deporte)} ${esc(s.deporte)}</span>
                </div>
                <h3>${esc(s.titulo)}</h3>
                <p class="auction-hour">${formatoPartido(s.fecha, s.hora)}</p>
                <p class="auction-seller">Subastada por <strong>${esc(s.vendedor ? s.vendedor.nombre : "—")}</strong></p>
                ${s.descripcion ? `<p class="auction-desc">“${esc(s.descripcion)}”</p>` : ""}
                <div class="auction-price">
                    <div>
                        <small>Precio de salida</small>
                        ${s.pujas.length ? `<del>${s.precioSalida} €</del>` : `<span class="price-start">${s.precioSalida} €</span>`}
                    </div>
                    <div>
                        <small>${etiquetaPrecio}</small>
                        <strong>${s.precioActual} €</strong>
                    </div>
                </div>
                <div class="auction-meta">
                    <span>👥 ${s.pujas.length} ${s.pujas.length === 1 ? "puja" : "pujas"}</span>
                    <span class="countdown ${s.restanteMs < 5 * 60000 && s.estado === "activa" ? "is-urgent" : ""}"
                          ${s.estado === "activa" ? `data-fin="${s.fin}"` : ""}>
                        ⏱ ${s.estado === "activa" ? formatoRestante(s.restanteMs) : "Cerrada"}
                    </span>
                </div>
                ${avisoTarjeta(s, usuario)}
                ${botonTarjeta(s, usuario)}
            </article>`;
    }

    function filtrar(lista, usuario) {
        switch (filtro) {
            case "activas":
                return lista.filter((s) => s.estado === "activa").sort((a, b) => a.fin - b.fin);
            case "finalizadas":
                return lista.filter((s) => s.estado !== "activa").sort((a, b) => b.fin - a.fin);
            case "mias":
                return lista.filter((s) => usuario && s.vendedorId === usuario.id)
                    .sort((a, b) => b.creada - a.creada);
            case "pujas":
                return lista.filter((s) => usuario && s.pujas.some((p) => p.usuarioId === usuario.id))
                    .sort((a, b) => a.fin - b.fin);
            default:
                return lista;
        }
    }

    function mensajeVacio(usuario) {
        if ((filtro === "mias" || filtro === "pujas") && !usuario) {
            return `Inicia sesión para ver ${filtro === "mias" ? "tus subastas" : "tus pujas"}.
                <button type="button" class="link-btn" data-accion="login">Iniciar sesión</button>`;
        }
        return {
            activas: "No hay subastas activas ahora mismo. ¡Crea la primera!",
            finalizadas: "Todavía no ha terminado ninguna subasta.",
            mias: "Aún no has creado ninguna subasta.",
            pujas: "Aún no has pujado en ninguna subasta.",
        }[filtro];
    }

    function pintar() {
        const usuario = Store.usuarioActual();
        const todas = Store.listarSubastas();
        const lista = filtrar(todas, usuario);

        $("subastas-grid").innerHTML = lista.map((s) => crearTarjeta(s, usuario)).join("");

        const vacio = $("subastas-vacio");
        vacio.innerHTML = mensajeVacio(usuario);
        vacio.hidden = lista.length > 0;

        $("contador-activas").textContent = todas.filter((s) => s.estado === "activa").length;

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

        // También hay que repintar si termina una subasta que no se ve en el filtro actual
        if (!algunaTerminada) {
            algunaTerminada = Store.listarSubastas()
                .some((s) => s.estado !== "activa" && activasPintadas.has(s.id));
        }
        if (algunaTerminada) pintar();
    }

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
                        <strong>${p.cantidad} €</strong>
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
            <p class="auction-hour">${formatoPartido(s.fecha, s.hora)} · Subastada por ${esc(s.vendedor ? s.vendedor.nombre : "—")}</p>

            <div class="bid-summary">
                <div>
                    <small>${s.pujas.length ? "Puja actual" : "Precio de salida"}</small>
                    <strong>${s.precioActual} €</strong>
                </div>
                <div>
                    <small>Termina en</small>
                    <strong class="countdown" ${s.estado === "activa" ? `data-fin="${s.fin}"` : ""}>
                        ⏱ ${formatoRestante(s.restanteMs)}
                    </strong>
                </div>
            </div>

            ${estadoTexto}

            ${puedePujar ? `
            <form id="bid-form" class="modal-form" novalidate>
                <label for="bid-cantidad">Tu puja (mínimo ${s.pujaMinima} €, incrementos de ${s.incremento} €)</label>
                <div class="bid-input">
                    <input type="number" id="bid-cantidad" name="cantidad"
                           min="${s.pujaMinima}" step="1" value="${s.pujaMinima}" required>
                    <span>€</span>
                </div>
                <div class="quick-bids">
                    ${[0, s.incremento, s.incremento * 3, s.incremento * 5].map((extra) =>
                        `<button type="button" data-puja="${s.pujaMinima + extra}">${s.pujaMinima + extra} €</button>`
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
                await Store.pujar(s.id, cantidad);
                UI.toast(`✅ Has pujado ${cantidad} € por ${s.titulo}.`);
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

    // ---------- modal de crear subasta ----------

    function prepararFormularioCrear() {
        const form = $("create-form");
        const selInstalacion = $("crear-instalacion");
        const selHora = $("crear-hora");
        const selDuracion = $("crear-duracion");
        const inputFecha = $("crear-fecha");

        selInstalacion.innerHTML = INSTALACIONES.filter((i) => i.subastable !== false).map((i) =>
            `<option value="${i.id}">${esc(i.nombre)} (${esc(i.deporte)})</option>`).join("");
        selHora.innerHTML = HORAS.map((h) => `<option value="${h}">${h}</option>`).join("");
        selDuracion.innerHTML = DURACIONES.map((d) =>
            `<option value="${d.minutos}" ${d.minutos === 60 ? "selected" : ""}>${d.texto}</option>`).join("");

        // Precio de salida orientativo: la mitad del precio normal de la pista
        const sugerirPrecio = () => {
            const instalacion = INSTALACIONES.find((i) => i.id === Number(selInstalacion.value));
            // Algunas instalaciones (pádel) aún no tienen tarifa: se propone 10 €
            if (instalacion) $("crear-precio").value = instalacion.precio
                ? Math.max(1, Math.round(instalacion.precio / 2))
                : 10;
        };
        selInstalacion.addEventListener("change", sugerirPrecio);

        $("btn-crear-subasta").addEventListener("click", () => {
            Auth.requerirLogin(() => {
                form.reset();
                const hoy = new Date();
                const max = new Date();
                max.setDate(hoy.getDate() + 30);
                inputFecha.min = fechaISO(hoy);
                inputFecha.max = fechaISO(max);
                const manana = new Date();
                manana.setDate(hoy.getDate() + 1);
                inputFecha.value = fechaISO(manana);
                selDuracion.value = "60";
                sugerirPrecio();
                form.querySelector(".form-error").hidden = true;
                $("create-modal").showModal();
            }, "Inicia sesión para crear una subasta.");
        });

        form.addEventListener("submit", async (event) => {
            event.preventDefault();
            const datos = new FormData(form);
            const boton = form.querySelector("[type=submit]");
            boton.disabled = true;
            try {
                const s = await Store.crearSubasta({
                    instalacionId: datos.get("instalacion"),
                    fecha: datos.get("fecha"),
                    hora: datos.get("hora"),
                    precioSalida: datos.get("precio"),
                    incremento: datos.get("incremento"),
                    duracionMin: datos.get("duracion"),
                    descripcion: datos.get("descripcion"),
                });
                $("create-modal").close();
                UI.toast(`🔥 Subasta creada: ${s.titulo}`);
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

        // Botones de las tarjetas
        document.getElementById("subastas").addEventListener("click", async (event) => {
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
