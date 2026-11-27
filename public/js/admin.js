// Panel de administración (admin.html). Solo para cuentas con es_admin = true
// (ver supabase/admin.sql). Las comprobaciones de verdad las hace el servidor:
// aunque alguien abra esta página, sin permisos no puede cambiar nada.
//
// Secciones:
//   Resumen        → cifras clave, avisos pendientes y actividad reciente
//   Facturación    → comisiones de la plataforma, IPSI y liquidación a cada
//                    instalación (modelo de negocio: comisión por transacción)
//   Subastas       → seguimiento, anular pujas y cancelar subastas
//   Reservas       → reservas de pistas
//   Usuarios       → suspender, reactivar y renombrar cuentas
//   Interacción    → opiniones (moderación) y toda la actividad
//   Nombres        → lista de nombres de usuario no permitidos

const esc = (t) => UI.escapeHTML(t);
const $ = (id) => document.getElementById(id);

const DIA = 24 * 60 * 60 * 1000;
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

const estado = {
    pestana: "resumen",
    usuarios: [],
    opiniones: [],
    prohibidos: [],
    ajustes: { ...FACTURACION_DEFECTO },
    filtroSubastas: "todas",
    filtroUsuarios: "todos",
    abiertas: new Set(), // subastas con el detalle de pujas desplegado
    peticiones: [],      // peticiones de pista solidaria
    avisoServidor: "",
};

// ---------- utilidades ----------

const euros = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" });
const dinero = (n) => euros.format(n || 0);
const redondear = (n) => Math.round(n * 100) / 100;
const formatoFecha = (ms) => (ms ? new Date(ms).toLocaleDateString("es-ES") : "—");
const formatoDia = (iso) => iso.split("-").reverse().join("/");
const instalacion = (id) => INSTALACIONES.find((i) => i.id === Number(id)) || null;
const nombreInstalacion = (id) => instalacion(id)?.nombre || `Instalación ${id}`;
const nombreUsuario = (id) => Store.getUsuario(id)?.nombre || estado.usuarios.find((u) => u.id === id)?.nombre || "—";
const ahoraCeuta = () => ceutaDateTime();

function haceCuanto(ms) {
    const min = Math.round((Store.ahora() - ms) / 60000);
    if (min < 1) return "ahora";
    if (min < 60) return `hace ${min} min`;
    const h = Math.round(min / 60);
    if (h < 24) return `hace ${h} h`;
    const d = Math.round(h / 24);
    return d < 30 ? `hace ${d} d` : formatoFecha(ms);
}

function quedan(ms) {
    if (ms <= 0) return "—";
    const min = Math.ceil(ms / 60000);
    if (min < 60) return `${min} min`;
    const h = Math.floor(min / 60);
    return h < 48 ? `${h} h ${min % 60} min` : `${Math.floor(h / 24)} d`;
}

function coincide(...textos) {
    const q = $("admin-buscar").value.trim().toLowerCase();
    return !q || textos.some((t) => String(t ?? "").toLowerCase().includes(q));
}

const filaVacia = (columnas, texto) => `<tr><td colspan="${columnas}" class="admin-empty">${texto}</td></tr>`;
const stat = (titulo, valor, nota = "") =>
    `<div><dt>${titulo}</dt><dd>${valor}</dd>${nota ? `<p class="admin-stat-note">${nota}</p>` : ""}</div>`;
const boton = (accion, texto, datos = {}, clase = "admin-action") =>
    `<button type="button" class="${clase}" data-accion="${accion}" ${Object.entries(datos)
        .map(([k, v]) => `data-${k}="${esc(v)}"`).join(" ")}>${texto}</button>`;

// ¿Hay algo que revisar en este usuario?
function motivoRevision(u) {
    if (u.nombreRechazado) return `Intentó registrarse como «${u.nombreRechazado}»`;
    if (u.admin) return null; // los nombres de los administradores los pone el equipo
    return Store.motivoNombre(u.nombre);
}


// =====================================================================
// FACTURACIÓN
// =====================================================================

function comisionDe(instalacionId, tipo) {
    const bonificada = estado.ajustes.bonificadas?.[instalacionId];
    if (bonificada !== undefined) return Number(bonificada);
    return tipo === "Reserva" ? estado.ajustes.comisionReservas : estado.ajustes.comisionSubastas;
}

const TIPOS = {
    "Reserva": "reserva",          // reserva directa: se liquida a la instalación
    "Última hora": "auto",         // subasta automática: se liquida a la instalación
    "Reventa": "reventa",          // reventa de un usuario: se paga al usuario vendedor
};
const esReventa = (m) => m.tipo === "Reventa";

// Todas las transacciones que generan ingresos: reservas directas (precio de
// la instalación), subastas de última hora y reventas (precio final de la
// puja ganadora). En las subastas se usa la comisión guardada al crearlas.
function movimientos() {
    const ahora = ahoraCeuta();
    const lista = [];
    for (const r of Store.todasLasReservas()) {
        const inst = instalacion(r.facility);
        // los bloqueos de la instalación y las pistas solidarias no facturan
        if (!inst || (r.tipo || "normal") !== "normal" || r.importe === 0) continue;
        lista.push({
            fecha: r.date, hora: r.time, tipo: "Reserva", instalacionId: inst.id,
            cliente: nombreUsuario(r.userId), importe: r.importe ?? precioTurno(inst, r.date, r.time, r.duracion || 60),
            jugada: `${r.date}T${r.time}` <= ahora,
        });
    }
    for (const s of Store.listarSubastas()) {
        if (s.estado !== "finalizada" || !s.ganador) continue;
        const reventa = s.tipo !== "automatica";
        lista.push({
            fecha: s.fecha, hora: s.hora, tipo: reventa ? "Reventa" : "Última hora",
            instalacionId: Number(s.instalacionId), pista: s.pista || "",
            cliente: s.ganador.nombre, vendedor: reventa ? (s.vendedor?.nombre || "—") : "",
            importe: s.precioActual, pctFijo: s.comisionPct, ipsiFijo: s.ipsiPct,
            jugada: `${s.fecha}T${s.hora}` <= ahora,
        });
    }
    return lista.map((m) => {
        const pct = m.pctFijo ?? comisionDe(m.instalacionId, m.tipo);
        const comision = redondear(m.importe * pct / 100);
        const ipsi = redondear(comision * (m.ipsiFijo ?? estado.ajustes.ipsi) / 100);
        return { ...m, pct, comision, ipsi, liquidar: redondear(m.importe - comision - ipsi) };
    }).sort((a, b) => `${b.fecha}T${b.hora}`.localeCompare(`${a.fecha}T${a.hora}`));
}

const periodoActual = () => $("fact-periodo").value;
const enPeriodo = (m, periodo = periodoActual()) => !periodo || m.fecha.startsWith(periodo);

function nombrePeriodo(periodo) {
    if (!periodo) return "Todo el histórico";
    const [y, m] = periodo.split("-");
    return `${MESES[Number(m) - 1]} ${y}`;
}

function pintarSelectorPeriodo() {
    const select = $("fact-periodo");
    const hoy = ahoraCeuta().slice(0, 7);
    const elegido = select.options.length ? select.value : hoy; // la primera vez, el mes actual
    const meses = new Set([hoy, ...movimientos().map((m) => m.fecha.slice(0, 7))]);
    select.innerHTML = `<option value="">Todo el histórico</option>` +
        [...meses].sort().reverse().map((p) => `<option value="${p}">${nombrePeriodo(p)}</option>`).join("");
    select.value = select.querySelector(`option[value="${elegido}"]`) ? elegido : hoy;
}

const sumar = (lista, campo) => redondear(lista.reduce((n, m) => n + m[campo], 0));

function porInstalacion(lista) {
    const grupos = new Map();
    for (const m of lista) {
        if (!grupos.has(m.instalacionId)) grupos.set(m.instalacionId, []);
        grupos.get(m.instalacionId).push(m);
    }
    return [...grupos.entries()].map(([id, ms]) => ({
        id, nombre: nombreInstalacion(id), movimientos: ms,
        reservas: ms.filter((m) => m.tipo === "Reserva").length,
        subastas: ms.filter((m) => m.tipo === "Última hora").length,
        importe: sumar(ms, "importe"), comision: sumar(ms, "comision"),
        ipsi: sumar(ms, "ipsi"), liquidar: sumar(ms, "liquidar"),
        pct: [...new Set([comisionDe(id, "Reserva"), comisionDe(id, "Subasta")])].join(" / "),
    })).sort((a, b) => b.importe - a.importe);
}

function pintarGrafico(todos) {
    const hoy = ahoraCeuta().slice(0, 7);
    let [y, m] = hoy.split("-").map(Number);
    const meses = [];
    for (let i = 0; i < 6; i++) {
        meses.unshift(`${y}-${String(m).padStart(2, "0")}`);
        if (--m === 0) { m = 12; y--; }
    }
    const datos = meses.map((p) => {
        const ms = todos.filter((mv) => enPeriodo(mv, p));
        return { p, comision: sumar(ms, "comision"), n: ms.length };
    });
    const maximo = Math.max(...datos.map((d) => d.comision), 1);
    $("fact-grafico").setAttribute("aria-label",
        "Ingresos por comisiones: " + datos.map((d) => `${nombrePeriodo(d.p)} ${dinero(d.comision)}`).join(", "));
    $("fact-grafico").innerHTML = datos.map((d) => `
        <div class="admin-bar ${d.p === periodoActual() ? "is-selected" : ""}" tabindex="0">
            <span class="admin-bar-value">${d.comision ? dinero(d.comision) : ""}</span>
            <span class="admin-bar-fill" style="height:${Math.max(2, (d.comision / maximo) * 100)}%"></span>
            <span class="admin-bar-label">${nombrePeriodo(d.p).split(" ")[0]}</span>
            <span class="admin-bar-tip" role="tooltip">
                <strong>${nombrePeriodo(d.p)}</strong><br>
                Comisiones: ${dinero(d.comision)}<br>${d.n} transacciones
            </span>
        </div>`).join("");
}

function pintarFacturacion() {
    pintarSelectorPeriodo();
    const todos = movimientos();
    const lista = todos.filter((m) => enPeriodo(m));
    const importe = sumar(lista, "importe");
    const comision = sumar(lista, "comision");

    $("fact-stats").innerHTML =
        stat("Volumen gestionado", dinero(importe), nombrePeriodo(periodoActual())) +
        stat("Ingresos (comisiones)", dinero(comision), importe ? `${(comision / importe * 100).toLocaleString("es-ES", { maximumFractionDigits: 1 })} % del volumen` : "") +
        stat("IPSI repercutido", dinero(sumar(lista, "ipsi")), `${estado.ajustes.ipsi} % sobre la comisión`) +
        stat("A liquidar a instalaciones", dinero(sumar(lista.filter((m) => !esReventa(m)), "liquidar")),
            "reservas y subastas de última hora") +
        stat("A pagar a usuarios", dinero(sumar(lista.filter(esReventa), "liquidar")), "por reventas de reservas") +
        stat("Transacciones", lista.length, Object.keys(TIPOS)
            .map((t) => `${lista.filter((m) => m.tipo === t).length} ${t.toLowerCase()}`).join(" · ")) +
        stat("Ticket medio", dinero(lista.length ? importe / lista.length : 0));

    pintarGrafico(todos);

    const deInstalaciones = lista.filter((m) => !esReventa(m));
    const grupos = porInstalacion(deInstalaciones);
    $("fact-instalaciones").innerHTML = grupos.map((g) => `
        <tr>
            <td>${esc(g.nombre)}${estado.ajustes.bonificadas?.[g.id] !== undefined ? ` <span class="admin-tag">bonificada</span>` : ""}</td>
            <td class="num">${g.reservas}</td>
            <td class="num">${g.subastas}</td>
            <td class="num">${dinero(g.importe)}</td>
            <td class="num">${g.pct} %</td>
            <td class="num">${dinero(g.comision)}</td>
            <td class="num">${dinero(g.ipsi)}</td>
            <td class="num"><strong>${dinero(g.liquidar)}</strong></td>
            <td>${boton("liquidacion", "📄 Liquidación", { id: g.id }, "admin-action admin-action-neutral")}</td>
        </tr>`).join("") || filaVacia(9, "No hay transacciones en este periodo.");
    $("fact-totales").innerHTML = grupos.length ? `
        <tr>
            <th>Total</th>
            <td class="num">${grupos.reduce((n, g) => n + g.reservas, 0)}</td>
            <td class="num">${grupos.reduce((n, g) => n + g.subastas, 0)}</td>
            <td class="num">${dinero(sumar(deInstalaciones, "importe"))}</td><td></td>
            <td class="num">${dinero(sumar(deInstalaciones, "comision"))}</td>
            <td class="num">${dinero(sumar(deInstalaciones, "ipsi"))}</td>
            <td class="num"><strong>${dinero(sumar(deInstalaciones, "liquidar"))}</strong></td><td></td>
        </tr>` : "";

    const reventas = lista.filter(esReventa);
    $("fact-reventas").innerHTML = reventas.map((m) => `
        <tr>
            <td>${formatoDia(m.fecha)} ${esc(m.hora)}</td>
            <td>${esc(nombreInstalacion(m.instalacionId))}${m.pista ? ` · ${esc(m.pista)}` : ""}</td>
            <td>${esc(m.vendedor)}</td>
            <td>${esc(m.cliente)}</td>
            <td class="num">${dinero(m.importe)}</td>
            <td class="num">${dinero(m.comision)} <small>(${m.pct} %)</small></td>
            <td class="num">${dinero(m.ipsi)}</td>
            <td class="num"><strong>${dinero(m.liquidar)}</strong></td>
        </tr>`).join("") || filaVacia(8, "No hay reventas adjudicadas en este periodo.");

    $("fact-movimientos").innerHTML = lista.slice(0, 200).map((m) => `
        <tr>
            <td>${formatoDia(m.fecha)} ${esc(m.hora)}</td>
            <td><span class="admin-tag tag-${TIPOS[m.tipo]}">${m.tipo}</span></td>
            <td>${esc(nombreInstalacion(m.instalacionId))}</td>
            <td>${esc(m.cliente)}</td>
            <td class="num">${dinero(m.importe)}</td>
            <td class="num">${dinero(m.comision)} <small>(${m.pct} %)</small></td>
            <td>${m.jugada ? "Jugada" : "Próxima"}</td>
        </tr>`).join("") || filaVacia(7, "No hay movimientos en este periodo.");

    pintarAjustes();
}

function pintarAjustes() {
    const form = $("fact-ajustes");
    if (form.contains(document.activeElement)) return; // no pisar lo que se está escribiendo
    form.comisionReservas.value = estado.ajustes.comisionReservas;
    form.comisionSubastas.value = estado.ajustes.comisionSubastas;
    form.ipsi.value = estado.ajustes.ipsi;
    pintarBonificadas();
}

function pintarBonificadas() {
    const bonificadas = estado.ajustes.bonificadas || {};
    $("fact-bonificadas").innerHTML = Object.entries(bonificadas).map(([id, pct]) => `
        <li class="admin-chip">${esc(nombreInstalacion(id))}: <strong>${pct} %</strong>
            <button type="button" data-accion="quitar-bonificada" data-id="${esc(id)}" aria-label="Quitar">×</button></li>`).join("")
        || `<li class="admin-hint">Ninguna instalación con comisión bonificada.</li>`;
    $("fact-bonif-instalacion").innerHTML = INSTALACIONES
        .filter((i) => bonificadas[i.id] === undefined)
        .map((i) => `<option value="${i.id}">${esc(i.nombre)}</option>`).join("");
}

function exportarCSV() {
    const lista = movimientos().filter((m) => enPeriodo(m));
    const cabecera = ["Fecha", "Hora", "Tipo", "Instalación", "Cliente", "Importe", "% comisión", "Comisión", "IPSI", "A liquidar", "Estado"];
    const celda = (v) => `"${String(v).replace(/"/g, '""')}"`;
    const numero = (n) => String(n.toFixed(2)).replace(".", ",");
    const filas = lista.map((m) => [m.fecha, m.hora, m.tipo, nombreInstalacion(m.instalacionId), m.cliente,
        numero(m.importe), m.pct, numero(m.comision), numero(m.ipsi), numero(m.liquidar), m.jugada ? "Jugada" : "Próxima"]);
    // ; y BOM para que Excel en español lo abra bien
    const csv = "﻿" + [cabecera, ...filas].map((f) => f.map(celda).join(";")).join("\r\n");
    const enlace = document.createElement("a");
    enlace.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    enlace.download = `ceutaplay-movimientos-${periodoActual() || "historico"}.csv`;
    enlace.click();
    URL.revokeObjectURL(enlace.href);
}

function mostrarLiquidacion(instalacionId) {
    const periodo = periodoActual();
    const grupo = porInstalacion(movimientos().filter((m) => enPeriodo(m) && !esReventa(m)))
        .find((g) => g.id === Number(instalacionId));
    if (!grupo) return;
    const inst = instalacion(instalacionId);
    const numero = `CP-${(periodo || "TOTAL").replace("-", "")}-${String(instalacionId).padStart(3, "0")}`;
    $("liquidacion-contenido").innerHTML = `
        <header class="liq-cabecera">
            <div><p class="logo">CEUTA<span>PLAY</span></p><p>Liquidación de comisiones</p></div>
            <dl><dt>Nº</dt><dd>${numero}</dd><dt>Periodo</dt><dd>${nombrePeriodo(periodo)}</dd>
                <dt>Emitida</dt><dd>${new Date(Store.ahora()).toLocaleDateString("es-ES")}</dd></dl>
        </header>
        <p><strong>${esc(inst.nombre)}</strong><br>${esc(inst.ubicacion || "")}</p>
        <table class="admin-table">
            <thead><tr><th>Fecha</th><th>Concepto</th><th class="num">Importe</th><th class="num">Comisión</th></tr></thead>
            <tbody>${grupo.movimientos.map((m) => `
                <tr><td>${formatoDia(m.fecha)}</td><td>${m.tipo} · ${esc(m.cliente)}</td>
                    <td class="num">${dinero(m.importe)}</td><td class="num">${dinero(m.comision)}</td></tr>`).join("")}
            </tbody>
        </table>
        <dl class="liq-totales">
            <dt>Volumen cobrado a clientes</dt><dd>${dinero(grupo.importe)}</dd>
            <dt>Comisión CeutaPlay</dt><dd>− ${dinero(grupo.comision)}</dd>
            <dt>IPSI sobre la comisión (${estado.ajustes.ipsi} %)</dt><dd>− ${dinero(grupo.ipsi)}</dd>
            <dt class="liq-total">Importe a transferir a la instalación</dt><dd class="liq-total">${dinero(grupo.liquidar)}</dd>
        </dl>
        <p class="admin-hint">Documento interno de liquidación. La factura de la comisión se emite aparte según la normativa del IPSI de Ceuta.</p>`;
    $("liquidacion").showModal();
}


// =====================================================================
// SUBASTAS
// =====================================================================

function pintarSubastas() {
    const subastas = Store.listarSubastas();
    const finalizadas = subastas.filter((s) => s.estado === "finalizada");
    const adjudicadas = finalizadas.filter((s) => s.ganador);
    const enCurso = subastas.filter((s) => s.estado === "activa");
    const solidarias = finalizadas.filter((s) => !s.pujas.length);
    $("subastas-stats").innerHTML =
        stat("En curso", enCurso.length, `${enCurso.filter((s) => !s.pujas.length).length} todavía sin pujas`) +
        stat("Adjudicadas", adjudicadas.length) +
        stat("Tasa de éxito", finalizadas.length ? `${Math.round(adjudicadas.length / finalizadas.length * 100)} %` : "—",
            "subastas finalizadas con ganador") +
        stat("Precio medio final", dinero(adjudicadas.length ? sumar(adjudicadas, "precioActual") / adjudicadas.length : 0)) +
        stat("Candidatas a pista solidaria", solidarias.length, "finalizadas sin pujas (RSC)");

    const orden = { activa: 0, finalizada: 1, cancelada: 2 };
    const filtro = estado.filtroSubastas;
    const filas = subastas
        .filter((s) => filtro === "todas" || (filtro === "sin-pujas" ? !s.pujas.length && s.estado !== "cancelada" : s.estado === filtro))
        .filter((s) => coincide(s.titulo, s.deporte, s.vendedor?.nombre))
        .sort((a, b) => orden[a.estado] - orden[b.estado] || a.fin - b.fin)
        .map((s) => {
            const abierta = estado.abiertas.has(s.id);
            const detalle = abierta ? `
                <tr class="admin-detalle"><td colspan="9">
                    ${s.descripcion ? `<p>“${esc(s.descripcion)}”</p>` : ""}
                    ${s.pujas.length ? `<ol class="admin-pujas">${s.pujas.map((p, i) => `
                        <li>${i === 0 ? "🏆 " : ""}<strong>${p.cantidad} €</strong> · ${esc(nombreUsuario(p.usuarioId))}
                            · ${haceCuanto(p.fecha)}
                            ${s.estado === "activa" ? boton("borrar-puja", "Anular", { id: p.id }) : ""}</li>`).join("")}</ol>`
                        : `<p class="admin-hint">Sin pujas${s.estado === "finalizada" ? " · se podría ceder como pista solidaria." : "."}</p>`}
                </td></tr>` : "";
            return `
            <tr>
                <td>${esc(s.titulo)}${s.pista ? `<br><small>${esc(s.pista)}</small>` : ""}</td>
                <td><span class="admin-tag tag-${s.tipo === "automatica" ? "auto" : "reventa"}">${s.tipo === "automatica" ? "Última hora" : "Reventa"}</span></td>
                <td>${formatoDia(s.fecha)} ${esc(s.hora)}</td>
                <td>${esc(s.tipo === "automatica" ? "Instalación" : s.vendedor ? s.vendedor.nombre : "—")}</td>
                <td><span class="admin-estado estado-${s.estado}">${s.estado}</span></td>
                <td class="num">${s.precioActual} €</td>
                <td class="num">${s.pujas.length}</td>
                <td>${s.estado === "activa" ? quedan(s.restanteMs) : formatoFecha(s.fin)}</td>
                <td><div class="admin-acciones">
                    ${boton("ver-pujas", abierta ? "Ocultar" : "Ver pujas", { id: s.id }, "admin-action admin-action-neutral")}
                    ${s.estado === "activa" ? boton("cancelar-subasta", "Cancelar", { id: s.id }) : ""}
                </div></td>
            </tr>${detalle}`;
        });
    $("admin-subastas").innerHTML = filas.join("") || filaVacia(9, "No hay subastas que coincidan.");
}


// =====================================================================
// RESERVAS
// =====================================================================

function pintarReservas() {
    const ahora = ahoraCeuta();
    const soloProximas = $("admin-solo-proximas").checked;
    const filas = Store.todasLasReservas()
        .filter((r) => !soloProximas || `${r.date}T${r.time}` > ahora)
        .map((r) => ({ ...r, usuario: nombreUsuario(r.userId), inst: instalacion(r.facility) }))
        .filter((r) => coincide(r.inst?.nombre, r.court, r.usuario))
        .sort((a, b) => `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`))
        .map((r) => `
        <tr>
            <td>${esc(r.inst?.nombre || nombreInstalacion(r.facility))}</td>
            <td>${esc(r.court)}</td>
            <td>${formatoDia(r.date)}</td>
            <td>${esc(r.time)}</td>
            <td>${esc(r.usuario)}</td>
            <td class="num">${r.importe != null ? formatoCC(r.importe) : "—"}</td>
            <td>${boton("borrar-reserva", "Borrar", { id: r.id })}</td>
        </tr>`);
    $("admin-reservas").innerHTML = filas.join("") || filaVacia(7, "No hay reservas que coincidan.");
}


// =====================================================================
// USUARIOS
// =====================================================================

function pintarUsuarios() {
    const yo = Store.usuarioActual();
    const revisar = estado.usuarios.filter(motivoRevision);
    $("cuenta-revisar").textContent = revisar.length;
    $("cuenta-revisar").hidden = !revisar.length;

    const filtros = {
        todos: () => true,
        revisar: (u) => motivoRevision(u),
        suspendidos: (u) => u.bloqueado,
        admins: (u) => u.admin,
    };
    const filas = estado.usuarios
        .filter(filtros[estado.filtroUsuarios])
        .filter((u) => coincide(u.nombre, u.email, u.nombreRechazado))
        .map((u) => {
            const motivo = motivoRevision(u);
            const estadoCuenta = u.admin ? `<span class="admin-badge">ADMIN</span>`
                : u.bloqueado ? `<span class="admin-estado estado-cancelada" title="${esc(u.motivoBloqueo)}">Suspendido</span>`
                : `<span class="admin-estado estado-finalizada">Activo</span>`;
            return `
            <tr>
                <td>${esc(u.nombre)}${motivo ? ` <span class="admin-warn" title="${esc(motivo)}">⚠️ ${esc(motivo)}</span>` : ""}</td>
                <td>${esc(u.email)}</td>
                <td>${formatoFecha(u.creado)}</td>
                <td class="num">${u.reservas}</td>
                <td class="num">${u.subastas}</td>
                <td class="num">${u.pujas}</td>
                <td class="num">${u.saldo != null ? formatoCC(u.saldo) : "—"}</td>
                <td>${estadoCuenta}${u.bloqueado && u.motivoBloqueo ? `<br><small>${esc(u.motivoBloqueo)}</small>` : ""}</td>
                <td><div class="admin-acciones">
                    ${boton("renombrar", "Renombrar", { id: u.id }, "admin-action admin-action-neutral")}
                    ${boton("saldo", "🪙 Saldo", { id: u.id }, "admin-action admin-action-neutral")}
                    ${u.admin || u.id === yo.id ? ""
                        : u.bloqueado ? boton("reactivar", "Reactivar", { id: u.id }, "admin-action admin-action-ok")
                        : boton("suspender", "Suspender", { id: u.id })}
                </div></td>
            </tr>`;
        });
    $("admin-usuarios").innerHTML = filas.join("") || filaVacia(9, "No hay usuarios que coincidan.");
}


// =====================================================================
// INTERACCIÓN
// =====================================================================

// Eventos de la plataforma para el registro de actividad
function actividad() {
    const eventos = [];
    for (const u of estado.usuarios) {
        if (u.creado) eventos.push({ t: u.creado, icono: "👤", texto: `<strong>${esc(u.nombre)}</strong> se ha registrado` });
    }
    for (const s of Store.listarSubastas()) {
        if (s.creada) eventos.push({ t: s.creada, icono: "🔨", texto: `<strong>${esc(s.vendedor?.nombre || "—")}</strong> subasta ${esc(s.titulo)} (${formatoDia(s.fecha)} ${esc(s.hora)})` });
        for (const p of s.pujas) {
            eventos.push({ t: p.fecha, icono: "💸", texto: `<strong>${esc(nombreUsuario(p.usuarioId))}</strong> puja ${p.cantidad} € en ${esc(s.titulo)}` });
        }
        if (s.estado === "finalizada" && s.ganador) {
            eventos.push({ t: s.fin, icono: "🏆", texto: `<strong>${esc(s.ganador.nombre)}</strong> gana ${esc(s.titulo)} por ${s.precioActual} €` });
        }
    }
    for (const r of Store.todasLasReservas()) {
        if (r.creada) eventos.push({ t: r.creada, icono: "📅", texto: `<strong>${esc(nombreUsuario(r.userId))}</strong> reserva ${esc(nombreInstalacion(r.facility))} · ${esc(r.court)} (${formatoDia(r.date)} ${esc(r.time)})` });
    }
    for (const o of estado.opiniones) {
        if (o.creada) eventos.push({ t: o.creada, icono: "⭐", texto: `<strong>${esc(o.nombre || "—")}</strong> opina sobre ${esc(nombreInstalacion(o.instalacionId))} (${o.puntuacion}/5)` });
    }
    return eventos.filter((e) => e.t <= Store.ahora() + 60000).sort((a, b) => b.t - a.t);
}

const pintarFeed = (id, eventos, vacio) => {
    $(id).innerHTML = eventos.map((e) => `
        <li><span class="admin-feed-icon" aria-hidden="true">${e.icono}</span>
            <span>${e.texto}</span><time>${haceCuanto(e.t)}</time></li>`).join("")
        || `<li class="admin-hint">${vacio}</li>`;
};

function pintarInteraccion() {
    const ahora = Store.ahora();
    const pujas = Store.listarSubastas().flatMap((s) => s.pujas);
    const reservas = Store.todasLasReservas();
    const media = estado.opiniones.length
        ? (estado.opiniones.reduce((n, o) => n + o.puntuacion, 0) / estado.opiniones.length).toFixed(1) : "—";
    const activos = new Set([
        ...pujas.filter((p) => ahora - p.fecha < 7 * DIA).map((p) => p.usuarioId),
        ...reservas.filter((r) => r.creada && ahora - r.creada < 7 * DIA).map((r) => r.userId),
    ]);
    $("interaccion-stats").innerHTML =
        stat("Usuarios activos (7 días)", activos.size, `de ${estado.usuarios.length} registrados`) +
        stat("Pujas (24 h)", pujas.filter((p) => ahora - p.fecha < DIA).length) +
        stat("Reservas nuevas (7 días)", reservas.filter((r) => r.creada && ahora - r.creada < 7 * DIA).length) +
        stat("Opiniones", estado.opiniones.length, `nota media ${media}`);

    const filas = estado.opiniones
        .filter((o) => coincide(o.nombre, o.comentario, nombreInstalacion(o.instalacionId)))
        .sort((a, b) => (b.creada || 0) - (a.creada || 0))
        .map((o) => {
            const sospechosa = Store.textoProhibido(o.comentario);
            return `
            <tr class="${sospechosa ? "admin-row-warn" : ""}">
                <td>${esc(nombreInstalacion(o.instalacionId))}</td>
                <td>${esc(o.nombre || "—")}</td>
                <td>${"★".repeat(o.puntuacion)}<span class="admin-stars-off">${"★".repeat(5 - o.puntuacion)}</span></td>
                <td class="admin-wrap">${sospechosa ? `<span class="admin-warn">⚠️ lenguaje no permitido</span><br>` : ""}${esc(o.comentario)}</td>
                <td>${formatoFecha(o.creada)}</td>
                <td>${boton("borrar-opinion", "Borrar", { instalacion: o.instalacionId, usuario: o.usuarioId })}</td>
            </tr>`;
        });
    $("admin-opiniones").innerHTML = filas.join("") || filaVacia(6, "No hay opiniones que coincidan.");

    const eventos = actividad().filter((e) => coincide(e.texto.replace(/<[^>]+>/g, "")));
    pintarFeed("interaccion-actividad", eventos.slice(0, 100), "Todavía no hay actividad.");
}


// =====================================================================
// NOMBRES PROHIBIDOS
// =====================================================================

function pintarNombres() {
    $("nombres-total").textContent = estado.prohibidos.length;
    $("nombres-lista").innerHTML = estado.prohibidos.map((e) => `
        <li class="admin-chip ${e.modo === "palabra" ? "chip-palabra" : ""}" title="${e.modo === "palabra" ? "Solo palabra completa" : "En cualquier parte del nombre"}">
            ${esc(e.termino)}${e.modo === "palabra" ? " <small>(palabra)</small>" : ""}
            <button type="button" data-accion="quitar-termino" data-termino="${esc(e.termino)}" aria-label="Quitar ${esc(e.termino)}">×</button>
        </li>`).join("") || `<li class="admin-hint">La lista está vacía.</li>`;

    const infractores = estado.usuarios.filter(motivoRevision);
    $("nombres-infractores").innerHTML = infractores.map((u) => `
        <li><span>⚠️ <strong>${esc(u.nombre)}</strong> (${esc(u.email)}) — ${esc(motivoRevision(u))}</span>
            <span class="admin-acciones">${boton("renombrar", "Renombrar", { id: u.id }, "admin-action admin-action-neutral")}
            ${u.bloqueado || u.admin ? "" : boton("suspender", "Suspender", { id: u.id })}</span></li>`).join("")
        || `<li class="admin-hint">✅ Ningún usuario tiene un nombre no permitido.</li>`;
    probarNombre();
}

// =====================================================================
// RSC (pista solidaria, voluntariado) Y GESTORES DE INSTALACIONES
// =====================================================================

const ESTADO_PETICION = {
    pendiente: ["⏳ Pendiente", "estado-activa"],
    cumplida: ["✅ Pista cedida", "estado-finalizada"],
    caducada: ["Caducada", "estado-cancelada"],
    cancelada: ["Cancelada", "estado-cancelada"],
};

function pintarRsc() {
    const entidades = estado.usuarios.filter((u) => u.entidad);
    const porAcreditar = entidades.filter((u) => !u.entidadAcreditada);
    $("cuenta-rsc").textContent = porAcreditar.length;
    $("cuenta-rsc").hidden = !porAcreditar.length;
    const cedidas = Store.todasLasReservas().filter((r) => r.tipo === "solidaria");
    const sinPujas = Store.listarSubastas().filter((s) => s.tipo === "automatica" && s.estado === "finalizada" && !s.pujas.length);
    const valorCedido = cedidas.reduce((n, r) => n + precioTurno(instalacion(r.facility), r.date, r.time, r.duracion || 60), 0);

    $("rsc-stats").innerHTML =
        stat("Entidades acreditadas", entidades.length - porAcreditar.length, porAcreditar.length ? `${porAcreditar.length} esperando acreditación` : "") +
        stat("Peticiones pendientes", estado.peticiones.filter((p) => p.estado === "pendiente").length) +
        stat("Pistas solidarias cedidas", cedidas.length, `valor ${formatoCC(valorCedido)}`) +
        stat("Gestores", estado.usuarios.filter((u) => u.gestiona.length).length, "cuentas de instalaciones");

    $("rsc-entidades").innerHTML = entidades.map((u) => `
        <tr>
            <td><strong>${esc(u.entidad)}</strong></td>
            <td>${esc(u.nombre)}<br><small>${esc(u.email)}</small></td>
            <td class="num">${cedidas.filter((r) => r.userId === u.id).length}</td>
            <td>${u.entidadAcreditada ? `<span class="admin-estado estado-finalizada">Acreditada</span>` : `<span class="admin-estado estado-activa">Por revisar</span>`}</td>
            <td>${u.entidadAcreditada
                ? boton("retirar-entidad", "Retirar acreditación", { id: u.id })
                : boton("acreditar-entidad", "Acreditar", { id: u.id }, "admin-action admin-action-ok")}</td>
        </tr>`).join("") || filaVacia(5, "Ninguna entidad lo ha solicitado todavía. Se solicita desde «Mi perfil».");

    $("rsc-peticiones").innerHTML = estado.peticiones.map((p) => {
        const [texto, clase] = ESTADO_PETICION[p.estado] || [p.estado, ""];
        return `<tr>
            <td>${formatoDia(p.fecha)}</td><td>${esc(p.entidad)}</td><td>${esc(p.deporte)}</td>
            <td>${p.instalacionId ? esc(nombreInstalacion(p.instalacionId)) : "Cualquiera"}</td>
            <td>${p.desde}–${p.hasta}</td><td><span class="admin-estado ${clase}">${texto}</span></td></tr>`;
    }).join("") || filaVacia(6, `Sin peticiones.${sinPujas.length ? ` Hay ${sinPujas.length} pista(s) de última hora que se quedaron sin pujas.` : ""}`);

    // voluntariado: se conserva lo elegido al repintar
    const lista = $("rsc-voluntarios-lista");
    const elegidos = new Set([...lista.selectedOptions].map((o) => o.value));
    lista.replaceChildren(...estado.usuarios.filter((u) => !u.admin && !u.bloqueado)
        .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"))
        .map((u) => { const o = new Option(`${u.nombre} (${u.email})`, u.id); o.selected = elegidos.has(u.id); return o; }));

    // gestores
    const selInst = $("rsc-gestor-instalacion");
    const selUsu = $("rsc-gestor-usuario");
    const instElegida = selInst.value;
    const usuElegido = selUsu.value;
    selInst.replaceChildren(...INSTALACIONES.filter(esReservable).map((i) => new Option(i.nombre, i.id)));
    selUsu.replaceChildren(...estado.usuarios.filter((u) => !u.admin)
        .sort((a, b) => a.nombre.localeCompare(b.nombre, "es")).map((u) => new Option(`${u.nombre} (${u.email})`, u.id)));
    if (instElegida) selInst.value = instElegida;
    if (usuElegido) selUsu.value = usuElegido;
    const gestores = estado.usuarios.flatMap((u) => u.gestiona.map((id) => ({ u, id })));
    $("rsc-gestores").innerHTML = gestores.map(({ u, id }) => `
        <li><span>🏟️ <strong>${esc(nombreInstalacion(id))}</strong> · ${esc(u.nombre)} <small>(${esc(u.email)})</small></span>
            ${boton("quitar-gestor", "Quitar", { id: u.id, instalacion: id })}</li>`).join("")
        || `<li class="admin-hint">Ninguna instalación tiene gestor todavía.</li>`;
}

function probarNombre() {
    const nombre = $("nombres-probar").value;
    const resultado = $("nombres-resultado");
    if (!nombre.trim()) {
        resultado.textContent = "";
        resultado.className = "admin-test";
        return;
    }
    const motivo = Store.motivoNombre(nombre);
    resultado.textContent = motivo ? `❌ ${motivo}` : "✅ Nombre permitido";
    resultado.className = `admin-test ${motivo ? "is-bad" : "is-ok"}`;
}


// =====================================================================
// RESUMEN
// =====================================================================

function pintarResumen() {
    const subastas = Store.listarSubastas();
    const ahora = ahoraCeuta();
    const reservas = Store.todasLasReservas();
    const mes = ahora.slice(0, 7);
    const delMes = movimientos().filter((m) => enPeriodo(m, mes));
    const enCurso = subastas.filter((s) => s.estado === "activa");

    $("resumen-stats").innerHTML =
        stat("Usuarios", estado.usuarios.length, `${estado.usuarios.filter((u) => u.bloqueado).length} suspendidos`) +
        stat("Ingresos del mes", dinero(sumar(delMes, "comision")), `${delMes.length} transacciones en ${nombrePeriodo(mes)}`) +
        stat("Reservas próximas", reservas.filter((r) => `${r.date}T${r.time}` > ahora).length) +
        stat("Subastas en curso", enCurso.length, `${enCurso.reduce((n, s) => n + s.pujas.length, 0)} pujas`) +
        stat("Instalaciones", INSTALACIONES.length, `${new Set(INSTALACIONES.map((i) => i.deporte)).size} deportes`);

    const alertas = [];
    const revisar = estado.usuarios.filter(motivoRevision);
    if (revisar.length) alertas.push(["⚠️", `${revisar.length} usuario(s) con nombre no permitido`, "usuarios", "revisar"]);
    const sospechosas = estado.opiniones.filter((o) => Store.textoProhibido(o.comentario));
    if (sospechosas.length) alertas.push(["💬", `${sospechosas.length} opinión(es) con lenguaje no permitido`, "interaccion"]);
    const urgentes = enCurso.filter((s) => !s.pujas.length && s.restanteMs < 60 * 60 * 1000);
    if (urgentes.length) alertas.push(["⏳", `${urgentes.length} subasta(s) terminan en menos de 1 h sin pujas (posible pista solidaria)`, "subastas", "sin-pujas"]);
    const suspendidos = estado.usuarios.filter((u) => u.bloqueado);
    if (suspendidos.length) alertas.push(["🔒", `${suspendidos.length} cuenta(s) suspendida(s)`, "usuarios", "suspendidos"]);
    if (estado.avisoServidor) alertas.push(["🛠️", estado.avisoServidor, "resumen"]);

    $("resumen-alertas").innerHTML = alertas.map(([icono, texto, tab, filtro]) => `
        <li><span>${icono} ${esc(texto)}</span>
            ${tab !== "resumen" ? `<button type="button" class="admin-action admin-action-neutral" data-ir="${tab}" data-filtro="${filtro || ""}">Ver</button>` : ""}</li>`).join("")
        || `<li class="admin-hint">✅ Todo en orden: no hay nada pendiente.</li>`;

    pintarFeed("resumen-actividad", actividad().slice(0, 12), "Todavía no hay actividad.");
}


// =====================================================================
// NAVEGACIÓN Y CARGA
// =====================================================================

const pintores = {
    resumen: pintarResumen,
    facturacion: pintarFacturacion,
    subastas: pintarSubastas,
    reservas: pintarReservas,
    usuarios: pintarUsuarios,
    interaccion: pintarInteraccion,
    nombres: pintarNombres,
    rsc: pintarRsc,
};

function pintar() {
    if ($("admin-panel").hidden) return;
    $("admin-aviso-servidor").hidden = !estado.avisoServidor;
    $("admin-aviso-servidor").textContent = estado.avisoServidor;
    pintarUsuarios(); // también actualiza el contador de la pestaña
    if (estado.pestana !== "rsc") pintarRsc();
    pintores[estado.pestana]();
}

function cambiarPestana(nueva, filtro) {
    estado.pestana = nueva;
    document.querySelectorAll(".admin-tabs [data-tab]").forEach((b) => {
        const activa = b.dataset.tab === nueva;
        b.classList.toggle("active", activa);
        b.setAttribute("aria-selected", activa);
    });
    document.querySelectorAll(".admin-section").forEach((s) => (s.hidden = s.dataset.seccion !== nueva));
    $("admin-search-box").hidden = !["subastas", "reservas", "usuarios", "interaccion"].includes(nueva);
    if (filtro) {
        const grupo = nueva === "subastas" ? "subastas-filtros" : "usuarios-filtros";
        $(grupo).querySelector(`[data-filtro="${filtro}"]`)?.click();
    }
    pintar();
}

async function intentar(promesa, porDefecto) {
    try {
        return await promesa;
    } catch (error) {
        if (/supabase\/admin\.sql/.test(error.message)) estado.avisoServidor = error.message;
        else UI.toast(error.message, "error");
        return porDefecto;
    }
}

async function cargar() {
    estado.avisoServidor = "";
    const [usuarios, opiniones, prohibidos, ajustes, peticiones] = await Promise.all([
        intentar(Store.adminListarUsuarios(), estado.usuarios),
        intentar(Store.adminListarOpiniones(), []),
        intentar(Store.adminListarNombresProhibidos(), NOMBRES_PROHIBIDOS_BASE),
        intentar(Store.adminLeerAjustesFacturacion(), { ...FACTURACION_DEFECTO }),
        intentar(Store.adminListarPeticionesSolidarias(), []),
    ]);
    Object.assign(estado, { usuarios, opiniones, prohibidos, ajustes, peticiones });
}

async function mostrar() {
    $("admin-cargando").hidden = true;
    if (!requireLogin()) return;

    const usuario = Store.usuarioActual();
    if (!usuario.admin) {
        $("admin-panel").hidden = true;
        $("admin-denegado").hidden = false;
        $("admin-denegado-ayuda").hidden = Store.modo !== "remoto";
        return;
    }
    $("admin-denegado").hidden = true;
    $("admin-panel").hidden = false;
    await cargar();
    pintar();
}


// ---------- eventos ----------

document.querySelectorAll(".admin-tabs [data-tab]").forEach((b) => {
    b.addEventListener("click", () => cambiarPestana(b.dataset.tab));
});

for (const [grupo, clave] of [["subastas-filtros", "filtroSubastas"], ["usuarios-filtros", "filtroUsuarios"]]) {
    $(grupo).addEventListener("click", (event) => {
        const b = event.target.closest("[data-filtro]");
        if (!b) return;
        estado[clave] = b.dataset.filtro;
        $(grupo).querySelectorAll("[data-filtro]").forEach((x) => x.classList.toggle("active", x === b));
        pintar();
    });
}

$("admin-buscar").addEventListener("input", pintar);
$("admin-solo-proximas").addEventListener("change", pintar);
$("fact-periodo").addEventListener("change", pintarFacturacion);
$("fact-exportar").addEventListener("click", exportarCSV);
$("nombres-probar").addEventListener("input", probarNombre);
UI.prepararModal($("liquidacion"));
$("liquidacion-imprimir").addEventListener("click", () => window.print());

$("fact-bonif-anadir").addEventListener("click", () => {
    const id = $("fact-bonif-instalacion").value;
    const pct = Number($("fact-bonif-pct").value);
    if (!id) return;
    if (!(pct >= 0 && pct <= 100)) {
        UI.toast("Indica un porcentaje entre 0 y 100.", "error");
        return;
    }
    estado.ajustes.bonificadas = { ...estado.ajustes.bonificadas, [id]: pct };
    pintarBonificadas();
    UI.toast("Bonificación añadida. Pulsa «Guardar ajustes» para aplicarla.");
});

$("rsc-voluntarios").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.target;
    const ids = [...$("rsc-voluntarios-lista").selectedOptions].map((o) => o.value);
    const importe = Number(form.importe.value);
    if (!ids.length || !(importe >= 1)) return;
    if (!confirm(`¿Sumar ${formatoCC(importe)} a ${ids.length} voluntario(s)?`)) return;
    try {
        for (const id of ids) await Store.adminBonificar(id, importe, form.motivo.value.trim() || "Voluntariado CeutaPlay");
        estado.usuarios = await Store.adminListarUsuarios();
        $("rsc-voluntarios-lista").selectedIndex = -1;
        UI.toast(`Recompensa enviada a ${ids.length} voluntario(s).`);
    } catch (error) {
        UI.toast(error.message, "error");
    }
    pintar();
});

$("fact-ajustes").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.target;
    try {
        estado.ajustes = await Store.adminGuardarAjustesFacturacion({
            comisionReservas: form.comisionReservas.value,
            comisionSubastas: form.comisionSubastas.value,
            ipsi: form.ipsi.value,
            bonificadas: estado.ajustes.bonificadas,
        });
        document.activeElement.blur();
        UI.toast("Ajustes de facturación guardados.");
        pintar();
    } catch (error) {
        UI.toast(error.message, "error");
    }
});

$("nombres-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.target;
    try {
        estado.prohibidos = await Store.adminAnadirNombreProhibido(form.termino.value, form.modo.value);
        UI.toast(`«${form.termino.value.trim()}» añadido a la lista.`);
        form.reset();
        pintar();
    } catch (error) {
        UI.toast(error.message, "error");
    }
});

// Acciones de las tablas (botones con data-accion)
document.querySelector(".admin-page").addEventListener("click", async (event) => {
    const ir = event.target.closest("[data-ir]");
    if (ir) {
        cambiarPestana(ir.dataset.ir, ir.dataset.filtro);
        return;
    }
    const b = event.target.closest("[data-accion]");
    if (!b) return;
    const { accion, id } = b.dataset;
    const usuario = estado.usuarios.find((u) => u.id === id);
    let recargarUsuarios = false;
    try {
        switch (accion) {
        case "ver-pujas":
            if (!estado.abiertas.delete(id)) estado.abiertas.add(id);
            break;
        case "cancelar-subasta":
            if (!confirm("¿Cancelar esta subasta? Se anulan también sus pujas.")) return;
            await Store.adminCancelarSubasta(id);
            UI.toast("Subasta cancelada.");
            break;
        case "borrar-puja":
            if (!confirm("¿Anular esta puja? La subasta vuelve a la puja anterior.")) return;
            await Store.adminBorrarPuja(id);
            UI.toast("Puja anulada.");
            recargarUsuarios = true;
            break;
        case "borrar-reserva":
            if (!confirm("¿Borrar esta reserva? El usuario perderá la pista.")) return;
            await Store.adminBorrarReserva(id);
            UI.toast("Reserva borrada.");
            recargarUsuarios = true;
            break;
        case "liquidacion":
            mostrarLiquidacion(id);
            return;
        case "quitar-bonificada": {
            const { [id]: _, ...resto } = estado.ajustes.bonificadas || {};
            estado.ajustes.bonificadas = resto;
            pintarBonificadas();
            UI.toast("Bonificación quitada. Pulsa «Guardar ajustes» para aplicarlo.");
            return;
        }
        case "renombrar": {
            const nombre = prompt(`Nuevo nombre visible para ${usuario.nombre}:`, usuario.nombre);
            if (nombre === null || nombre.trim() === usuario.nombre) return;
            await Store.adminRenombrarUsuario(id, nombre);
            UI.toast("Nombre actualizado.");
            recargarUsuarios = true;
            break;
        }
        case "suspender": {
            const motivo = prompt(`¿Por qué se suspende la cuenta de ${usuario.nombre}? (lo verán los administradores)`, "Nombre o comportamiento abusivo");
            if (motivo === null) return;
            await Store.adminBloquearUsuario(id, true, motivo);
            UI.toast(`Cuenta de ${usuario.nombre} suspendida.`);
            recargarUsuarios = true;
            break;
        }
        case "saldo": {
            const actual = usuario.saldo ?? 0;
            const respuesta = prompt(
                `Saldo de ${usuario.nombre}: ${formatoCC(actual)}

` +
                "Escribe el nuevo saldo (p. ej. 2000000), o una cantidad con + o − para sumar o restar (p. ej. +500 o −200):",
                String(actual));
            if (respuesta === null || !respuesta.trim()) return;
            const texto = respuesta.trim().replace(/\./g, "").replace(",", ".").replace("−", "-");
            const motivo = prompt("Motivo (aparecerá en su historial de movimientos):", "Ajuste del administrador") ?? "";
            if (/^[+-]/.test(texto)) {
                await Store.adminBonificar(id, Number(texto), motivo || "Bonificación de CeutaPlay");
            } else {
                await Store.adminFijarSaldo(id, Number(texto), motivo);
            }
            UI.toast(`Saldo de ${usuario.nombre} actualizado.`);
            recargarUsuarios = true;
            break;
        }
        case "reactivar":
            if (!confirm(`¿Reactivar la cuenta de ${usuario.nombre}?`)) return;
            await Store.adminBloquearUsuario(id, false);
            UI.toast(`Cuenta de ${usuario.nombre} reactivada.`);
            recargarUsuarios = true;
            break;
        case "borrar-opinion":
            if (!confirm("¿Borrar esta opinión?")) return;
            await Store.adminBorrarOpinion(Number(b.dataset.instalacion), b.dataset.usuario);
            estado.opiniones = await Store.adminListarOpiniones();
            UI.toast("Opinión borrada.");
            break;
        case "acreditar-entidad":
        case "retirar-entidad": {
            const acreditar = accion === "acreditar-entidad";
            if (!confirm(acreditar ? `¿Acreditar a «${usuario.entidad}» como entidad solidaria?`
                : `¿Retirar la acreditación a «${usuario.entidad}»? Ya no podrá pedir pista solidaria.`)) return;
            await Store.adminAcreditarEntidad(id, acreditar);
            UI.toast(acreditar ? "Entidad acreditada." : "Acreditación retirada.");
            recargarUsuarios = true;
            break;
        }
        case "asignar-gestor": {
            const usuarioId = $("rsc-gestor-usuario").value;
            const instalacionId = Number($("rsc-gestor-instalacion").value);
            if (!usuarioId) return;
            await Store.adminAsignarGestor(usuarioId, instalacionId, true);
            UI.toast(`${nombreUsuario(usuarioId)} ya gestiona ${nombreInstalacion(instalacionId)}.`);
            recargarUsuarios = true;
            break;
        }
        case "quitar-gestor":
            if (!confirm(`¿Quitar a ${usuario.nombre} como gestor de ${nombreInstalacion(b.dataset.instalacion)}?`)) return;
            await Store.adminAsignarGestor(id, Number(b.dataset.instalacion), false);
            UI.toast("Gestor quitado.");
            recargarUsuarios = true;
            break;
        case "quitar-termino":
            if (!confirm(`¿Quitar «${b.dataset.termino}» de la lista de nombres prohibidos?`)) return;
            estado.prohibidos = await Store.adminQuitarNombreProhibido(b.dataset.termino);
            UI.toast("Término quitado.");
            break;
        default:
            return;
        }
        if (recargarUsuarios) {
            estado.usuarios = await Store.adminListarUsuarios();
            estado.peticiones = await Store.adminListarPeticionesSolidarias().catch(() => estado.peticiones);
        }
    } catch (error) {
        UI.toast(error.message, "error");
    }
    pintar();
});

Store.inicializar().then(mostrar);
document.addEventListener("datos-cambiados", pintar);
document.addEventListener("sesion-cambiada", mostrar);
// La cuenta atrás de las subastas y la actividad ("hace 5 min") se refrescan solas
setInterval(() => {
    if (["resumen", "subastas", "interaccion"].includes(estado.pestana)) pintar();
}, 30000);
