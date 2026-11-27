// Panel del gestor de una instalación (gestor.html)
//
// Lo usan las cuentas a las que el administrador asigna una instalación
// (Panel admin → RSC y gestores). Un gestor ve todas las reservas de su
// instalación, bloquea turnos y consulta la ocupación y su liquidación.
// El administrador también puede entrar y elegir cualquier instalación.

const $g = (id) => document.getElementById(id);
const escG = (t) => UI.escapeHTML(t);
const fechaLarga = new Intl.DateTimeFormat("es-ES", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
const dinero = (n) => formatoCC(Math.round(n * 100) / 100);
let fecha = ceutaDateTime().slice(0, 10);

function misInstalaciones() {
    const yo = Store.usuarioActual();
    if (!yo) return [];
    const ids = yo.admin ? INSTALACIONES.filter(esReservable).map((i) => i.id) : Store.gestiona();
    return ids.map((id) => INSTALACIONES.find((i) => i.id === Number(id))).filter(Boolean);
}

const actual = () => INSTALACIONES.find((i) => i.id === Number($g("gestor-instalacion").value));
const sumarDias = (iso, n) => {
    const d = new Date(`${iso}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
};
const fin = (r) => aHora(aMinutos(r.time) + (r.duracion || 60));

// Reservas, bloqueos y turnos en subasta de la instalación
function turnos(inst) {
    const propias = Store.todasLasReservas().filter((r) => r.facility === inst.id);
    const vistas = new Set(propias.map((r) => r.id));
    const resto = Store.turnosOcupados().filter((r) => r.facility === inst.id && !vistas.has(r.id));
    const subastas = Store.reservasParaAgenda().filter((r) => r.enSubasta && r.facility === inst.id);
    return [...propias, ...resto, ...subastas];
}

function etiqueta(r) {
    if (r.enSubasta) return "⚡ Subasta";
    if (r.tipo === "bloqueo") return `🚧 ${r.nota || "Bloqueo"}`;
    if (r.tipo === "solidaria") return "🤝 Solidaria";
    return Store.getUsuario(r.userId)?.nombre || "Reservada";
}

function claseDe(r) {
    if (r.enSubasta) return "gestor-subasta";
    if (r.tipo === "bloqueo") return "gestor-bloqueo";
    return "schedule-booked";
}

// ---------- cifras ----------

function minutosOcupados(lista) {
    return lista.filter((r) => !r.enSubasta).reduce((n, r) => n + (r.duracion || 60), 0);
}

function pintarCifras(inst, todos) {
    const { apertura, cierre } = horarioDe(inst);
    const capacidadDia = inst.pistas.length * (cierre - apertura);
    const hoy = ceutaDateTime().slice(0, 10);
    const delDia = (d) => todos.filter((r) => r.date === d);
    const lunes = sumarDias(hoy, -((new Date(`${hoy}T00:00:00Z`).getUTCDay() + 6) % 7));
    const semana = todos.filter((r) => r.date >= lunes && r.date <= sumarDias(lunes, 6));
    const pct = (a, b) => `${Math.round(a / b * 100)} %`;
    const normalesSemana = semana.filter((r) => (r.tipo || "normal") === "normal" && !r.enSubasta);
    $g("gestor-stats").innerHTML = [
        ["Reservas hoy", delDia(hoy).filter((r) => (r.tipo || "normal") === "normal").length, `ocupación ${pct(minutosOcupados(delDia(hoy)), capacidadDia)}`],
        ["Ocupación esta semana", pct(minutosOcupados(semana), capacidadDia * 7), `${normalesSemana.length} reservas`],
        ["Ingresos de la semana", dinero(normalesSemana.reduce((n, r) => n + (r.importe || 0), 0)), "antes de comisión"],
        ["Turnos bloqueados", todos.filter((r) => r.tipo === "bloqueo" && r.date >= hoy).length, "próximos"],
    ].map(([t, v, n]) => `<div><dt>${t}</dt><dd>${v}</dd><p class="admin-stat-note">${n}</p></div>`).join("");

    // liquidación del mes en curso (comisión estándar de CeutaPlay)
    const mes = hoy.slice(0, 7);
    const delMes = todos.filter((r) => r.date.startsWith(mes) && (r.tipo || "normal") === "normal" && !r.enSubasta && r.importe != null);
    const bruto = delMes.reduce((n, r) => n + r.importe, 0);
    const pctComision = FACTURACION_DEFECTO.bonificadas?.[inst.id] ?? FACTURACION_DEFECTO.comisionReservas;
    const comision = bruto * pctComision / 100;
    const ipsi = comision * FACTURACION_DEFECTO.ipsi / 100;
    $g("gestor-liq-nota").textContent = `Mes en curso. Comisión de CeutaPlay del ${pctComision} % por reserva más el IPSI (${FACTURACION_DEFECTO.ipsi} %) de esa comisión. Cifras estimadas: la liquidación definitiva la emite el administrador.`;
    $g("gestor-liquidacion").innerHTML = [
        ["Reservas cobradas", delMes.length],
        ["Importe bruto", dinero(bruto)],
        ["Comisión + IPSI", `−${dinero(comision + ipsi)}`],
        ["A liquidar", dinero(bruto - comision - ipsi)],
    ].map(([t, v]) => `<div><dt>${t}</dt><dd>${v}</dd></div>`).join("");
}

// ---------- agenda del día ----------

function pintarAgenda(inst, todos) {
    $g("gestor-fecha").value = fecha;
    $g("gestor-caption").textContent = `${inst.nombre} · ${fechaLarga.format(new Date(`${fecha}T00:00:00Z`))}`;
    const { apertura, cierre } = horarioDe(inst);
    const delDia = todos.filter((r) => r.date === fecha);
    const ahora = ceutaDateTime();
    $g("gestor-head").innerHTML = `<tr><th scope="col">Hora</th>${inst.pistas.map((p) => `<th scope="col">${escG(p)}</th>`).join("")}</tr>`;
    const filas = [];
    for (let m = apertura; m < cierre; m += TURNOS.tramoMin) {
        const hora = aHora(m);
        const celdas = inst.pistas.map((pista) => {
            const r = delDia.find((x) => x.court === pista && aMinutos(x.time) <= m && m < aMinutos(x.time) + (x.duracion || 60));
            if (r) {
                const texto = aMinutos(r.time) === m ? escG(etiqueta(r)) : "·";
                return `<td><span class="schedule-state ${claseDe(r)}" title="${escG(etiqueta(r))} · ${r.time}–${fin(r)}">${texto}</span></td>`;
            }
            if (`${fecha}T${hora}` <= ahora) return `<td><span class="schedule-state schedule-past">Pasado</span></td>`;
            return `<td><button type="button" class="schedule-state schedule-free" data-pista="${escG(pista)}" data-hora="${hora}" aria-label="Bloquear ${escG(pista)} a las ${hora}">Libre</button></td>`;
        });
        filas.push(`<tr><th scope="row">${hora}</th>${celdas.join("")}</tr>`);
    }
    $g("gestor-body").innerHTML = filas.join("");
}

// ---------- listas ----------

function pintarListas(inst, todos) {
    const hoy = ceutaDateTime().slice(0, 10);
    const orden = (a, b) => `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`) || a.court.localeCompare(b.court, "es", { numeric: true });
    const bloqueos = todos.filter((r) => r.tipo === "bloqueo" && r.date >= hoy).sort(orden);
    $g("gestor-bloqueos").innerHTML = bloqueos.map((r) => `
        <li><span>🚧 <strong>${r.date.split("-").reverse().join("/")}</strong> · ${r.time}–${fin(r)} · ${escG(r.court)} · ${escG(r.nota)}</span>
            <button type="button" class="admin-action" data-desbloquear="${r.id}">Quitar bloqueo</button></li>`).join("")
        || `<li class="admin-hint">No hay bloqueos próximos.</li>`;

    const hasta = sumarDias(hoy, 7);
    const proximas = todos.filter((r) => !r.enSubasta && r.tipo !== "bloqueo" && r.date >= hoy && r.date <= hasta &&
        `${r.date}T${fin(r)}` > ceutaDateTime()).sort(orden);
    $g("gestor-proximas").innerHTML = proximas.map((r) => `
        <tr><td>${r.date.split("-").reverse().join("/")}</td><td>${r.time}–${fin(r)}</td><td>${escG(r.court)}</td>
            <td>${r.anonima ? "—" : escG(Store.getUsuario(r.userId)?.nombre || "—")}</td>
            <td>${r.tipo === "solidaria" ? "🤝 Solidaria" : r.publica ? "🙋 Abierta" : "Normal"}</td>
            <td class="num">${r.importe != null ? dinero(r.importe) : "—"}</td></tr>`).join("")
        || `<tr><td colspan="6" class="admin-empty">Sin reservas en los próximos 7 días.</td></tr>`;
}

// ---------- formulario de bloqueo ----------

function prepararFormulario(inst) {
    const pista = $g("bloqueo-pista").value;
    $g("bloqueo-pista").replaceChildren(...inst.pistas.map((p) => new Option(p, p)));
    if (inst.pistas.includes(pista)) $g("bloqueo-pista").value = pista;
    const hora = $g("bloqueo-hora").value;
    $g("bloqueo-hora").replaceChildren(...iniciosPosibles(inst, TURNOS.duracionMin).map((h) => new Option(h, h)));
    if (hora) $g("bloqueo-hora").value = hora;
    if (!$g("bloqueo-duracion").options.length) {
        $g("bloqueo-duracion").replaceChildren(...[30, 60, 90, 120, 180, 240, 360, 480, 720]
            .map((d) => new Option(textoDuracion(d), d)));
        $g("bloqueo-duracion").value = "60";
    }
    $g("bloqueo-fecha").min = ceutaDateTime().slice(0, 10);
    if (!$g("bloqueo-fecha").value) $g("bloqueo-fecha").value = fecha;
}

// ---------- pintar ----------

function pintar() {
    const lista = misInstalaciones();
    const yo = Store.usuarioActual();
    if (!yo) return;
    $g("gestor-denegado").hidden = lista.length > 0;
    $g("gestor-panel").hidden = !lista.length;
    if (!lista.length) return;
    const select = $g("gestor-instalacion");
    const elegida = select.value;
    if (select.options.length !== lista.length) {
        select.replaceChildren(...lista.map((i) => new Option(i.nombre, i.id)));
        if (lista.some((i) => String(i.id) === elegida)) select.value = elegida;
    }
    const inst = actual();
    const todos = turnos(inst);
    pintarCifras(inst, todos);
    pintarAgenda(inst, todos);
    pintarListas(inst, todos);
    prepararFormulario(inst);
}

$g("gestor-instalacion").addEventListener("change", pintar);
$g("gestor-fecha").addEventListener("change", (e) => { if (e.target.value) { fecha = e.target.value; pintar(); } });
document.querySelector(".agenda-navigation").addEventListener("click", (e) => {
    const b = e.target.closest("[data-dia]");
    if (!b) return;
    fecha = sumarDias(fecha, Number(b.dataset.dia));
    pintar();
});

$g("gestor-body").addEventListener("click", (e) => {
    const b = e.target.closest("[data-pista]");
    if (!b) return;
    $g("bloqueo-pista").value = b.dataset.pista;
    $g("bloqueo-fecha").value = fecha;
    $g("bloqueo-hora").value = b.dataset.hora;
    $g("gestor-bloqueo").scrollIntoView({ behavior: "smooth", block: "center" });
    $g("gestor-bloqueo").nota.focus();
});

$g("gestor-bloqueo").addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = e.target;
    const boton = f.querySelector("button[type=submit]");
    boton.disabled = true;
    try {
        await Store.gestorBloquear({
            facility: actual().id, court: f.pista.value, date: f.fecha.value,
            time: f.hora.value, duracion: Number(f.duracion.value), nota: f.nota.value,
        });
        UI.toast(`Bloqueado: ${f.pista.value}, ${f.fecha.value.split("-").reverse().join("/")} desde las ${f.hora.value}.`);
        fecha = f.fecha.value;
        pintar();
    } catch (error) {
        UI.toast(error.message, "error");
    } finally {
        boton.disabled = false;
    }
});

$g("gestor-bloqueos").addEventListener("click", async (e) => {
    const b = e.target.closest("[data-desbloquear]");
    if (!b || !confirm("¿Quitar este bloqueo? El turno vuelve a poder reservarse.")) return;
    try {
        await Store.gestorDesbloquear(b.dataset.desbloquear);
        UI.toast("Bloqueo quitado.");
        pintar();
    } catch (error) {
        UI.toast(error.message, "error");
    }
});

document.addEventListener("datos-cambiados", pintar);
document.addEventListener("sesion-cambiada", pintar);
Store.inicializar().then(() => {
    if (!requireLogin()) return;
    pintar();
});
