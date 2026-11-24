// Panel de administración (admin.html). Solo para cuentas con es_admin = true
// (ver supabase/admin.sql). Las comprobaciones de verdad las hace el servidor:
// aunque alguien abra esta página, sin permisos no puede borrar nada.

const esc = (t) => UI.escapeHTML(t);
const $ = (id) => document.getElementById(id);

let usuarios = [];
let pestana = "usuarios";

const formatoFecha = (ms) => (ms ? new Date(ms).toLocaleDateString("es-ES") : "—");
const formatoDia = (iso) => iso.split("-").reverse().join("/");
const nombreInstalacion = (id) => (INSTALACIONES.find((i) => i.id === Number(id)) || {}).nombre || `Instalación ${id}`;

function coincide(...textos) {
    const q = $("admin-buscar").value.trim().toLowerCase();
    return !q || textos.some((t) => String(t ?? "").toLowerCase().includes(q));
}

function filaVacia(columnas, texto) {
    return `<tr><td colspan="${columnas}" class="admin-empty">${texto}</td></tr>`;
}

function pintarResumen() {
    const subastas = Store.listarSubastas();
    const ahora = ceutaDateTime();
    const reservas = Store.todasLasReservas();
    const proximas = reservas.filter((r) => `${r.date}T${r.time}` > ahora);
    $("admin-stats").innerHTML = `
        <div><dt>Usuarios</dt><dd>${usuarios.length}</dd></div>
        <div><dt>Subastas en curso</dt><dd>${subastas.filter((s) => s.estado === "activa").length}</dd></div>
        <div><dt>Pujas totales</dt><dd>${subastas.reduce((n, s) => n + s.pujas.length, 0)}</dd></div>
        <div><dt>Reservas próximas</dt><dd>${proximas.length}</dd></div>`;
}

function pintarUsuarios() {
    const filas = usuarios.filter((u) => coincide(u.nombre, u.email)).map((u) => `
        <tr>
            <td>${esc(u.nombre)}</td>
            <td>${esc(u.email)}</td>
            <td>${formatoFecha(u.creado)}</td>
            <td>${u.reservas}</td>
            <td>${u.subastas}</td>
            <td>${u.pujas}</td>
            <td>${u.admin ? `<span class="admin-badge">ADMIN</span>` : "Usuario"}</td>
        </tr>`);
    $("admin-usuarios").innerHTML = filas.join("") || filaVacia(7, "No hay usuarios que coincidan.");
}

function pintarSubastas() {
    const orden = { activa: 0, finalizada: 1, cancelada: 2 };
    const filas = Store.listarSubastas()
        .filter((s) => coincide(s.titulo, s.deporte, s.vendedor && s.vendedor.nombre))
        .sort((a, b) => orden[a.estado] - orden[b.estado] || b.fin - a.fin)
        .map((s) => `
        <tr>
            <td>${esc(s.titulo)}</td>
            <td>${formatoDia(s.fecha)} ${esc(s.hora)}</td>
            <td>${esc(s.vendedor ? s.vendedor.nombre : "—")}</td>
            <td><span class="admin-estado estado-${s.estado}">${s.estado}</span></td>
            <td>${s.precioActual} €</td>
            <td>${s.pujas.length}</td>
            <td>${s.estado === "activa"
                ? `<button type="button" class="admin-action" data-accion="cancelar-subasta" data-id="${esc(s.id)}">Cancelar</button>`
                : ""}</td>
        </tr>`);
    $("admin-subastas").innerHTML = filas.join("") || filaVacia(7, "No hay subastas que coincidan.");
}

function pintarReservas() {
    const ahora = ceutaDateTime();
    const soloProximas = $("admin-solo-proximas").checked;
    const filas = Store.todasLasReservas()
        .filter((r) => !soloProximas || `${r.date}T${r.time}` > ahora)
        .map((r) => ({ ...r, usuario: Store.getUsuario(r.userId), instalacion: nombreInstalacion(r.facility) }))
        .filter((r) => coincide(r.instalacion, r.court, r.usuario && r.usuario.nombre))
        .sort((a, b) => `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`))
        .map((r) => `
        <tr>
            <td>${esc(r.instalacion)}</td>
            <td>${esc(r.court)}</td>
            <td>${formatoDia(r.date)}</td>
            <td>${esc(r.time)}</td>
            <td>${esc(r.usuario ? r.usuario.nombre : "—")}</td>
            <td><button type="button" class="admin-action" data-accion="borrar-reserva" data-id="${esc(r.id)}">Borrar</button></td>
        </tr>`);
    $("admin-reservas").innerHTML = filas.join("") || filaVacia(6, "No hay reservas que coincidan.");
}

function pintar() {
    if ($("admin-panel").hidden) return;
    pintarResumen();
    pintarUsuarios();
    pintarSubastas();
    pintarReservas();
}

function cambiarPestana(nueva) {
    pestana = nueva;
    document.querySelectorAll(".admin-tabs [data-tab]").forEach((b) => {
        const activa = b.dataset.tab === nueva;
        b.classList.toggle("active", activa);
        b.setAttribute("aria-selected", activa);
    });
    document.querySelectorAll(".admin-section").forEach((s) => (s.hidden = s.dataset.seccion !== nueva));
}

async function cargarUsuarios() {
    try {
        usuarios = await Store.adminListarUsuarios();
    } catch (error) {
        UI.toast(`No se pudieron cargar los usuarios: ${error.message}`, "error");
    }
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
    await cargarUsuarios();
    pintar();
}

document.querySelectorAll(".admin-tabs [data-tab]").forEach((b) => {
    b.addEventListener("click", () => cambiarPestana(b.dataset.tab));
});
$("admin-buscar").addEventListener("input", pintar);
$("admin-solo-proximas").addEventListener("change", pintarReservas);

document.querySelector(".admin-page").addEventListener("click", async (event) => {
    const boton = event.target.closest("[data-accion]");
    if (!boton) return;
    const { accion, id } = boton.dataset;
    try {
        if (accion === "cancelar-subasta" && confirm("¿Cancelar esta subasta? Se anulan también sus pujas.")) {
            await Store.adminCancelarSubasta(id);
            UI.toast("Subasta cancelada.");
        }
        if (accion === "borrar-reserva" && confirm("¿Borrar esta reserva? El usuario perderá la pista.")) {
            await Store.adminBorrarReserva(id);
            await cargarUsuarios();
            UI.toast("Reserva borrada.");
        }
    } catch (error) {
        UI.toast(error.message, "error");
    }
    pintar();
});

Store.inicializar().then(mostrar);
document.addEventListener("datos-cambiados", pintar);
document.addEventListener("sesion-cambiada", mostrar);
