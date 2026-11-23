// Lógica de la página. Sustituye a las plantillas de Django:
// pinta las tarjetas a partir de data.js y gestiona el buscador.

function fechaISO(fecha) {
    const y = fecha.getFullYear();
    const m = String(fecha.getMonth() + 1).padStart(2, "0");
    const d = String(fecha.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
}

function crearTarjetaInstalacion(instalacion) {
    const etiqueta = `<span class="card-tag">${instalacion.deporte}</span>`;
    const imagenAlternativa = instalacion.imagenAlternativa ? ` data-image-fallback="${instalacion.imagenAlternativa}"` : "";
    const imagen = instalacion.imagen
        ? `<div class="card-image"><img src="${instalacion.imagen}" alt="${instalacion.imagenAlt || ""}"${imagenAlternativa}>${etiqueta}</div>`
        : `<div class="card-image card-image-placeholder">Foto pendiente${etiqueta}</div>`;
    const credito = instalacion.fuenteImagen
        ? `<p class="photo-credit"><a href="${instalacion.fuenteImagen}">${instalacion.creditoImagen}</a></p>`
        : instalacion.creditoImagen ? `<p class="photo-credit">${instalacion.creditoImagen}</p>` : "";
    const precio = instalacion.precio == null ? "" : `
        <div class="price">
            <small>Desde</small>
            <strong>${instalacion.precio} €</strong>
        </div>`;
    const reserva = instalacion.pistas
        ? `<div class="card-footer booking-card-footer">
            <div class="price">
                <small>Precio de prueba</small>
                <strong>${formatoEuros.format(instalacion.precioPrueba)} / hora</strong>
            </div>
            <div class="booking-card-actions">
                <a class="reserve-btn" href="reservas.html?pista=${instalacion.id}">Reservar ${instalacion.deporte.toLowerCase()}</a>
                <a class="login-btn" href="reservas.html?pista=${instalacion.id}#ubicacion">Ver mapa</a>
            </div>
        </div>`
        : "";
    const accion = instalacion.informacion
        ? `<a class="reserve-btn" href="${instalacion.informacion}">Información de la instalación</a>`
        : `<button type="button" class="reserve-btn">Ver horarios →</button>`;
    const pie = instalacion.informacion || precio ? `<div class="card-footer">${precio}${accion}</div>` : "";

    return `
        <article class="card" data-deporte="${instalacion.deporte}">
            ${imagen}
            <div class="card-content">
                ${credito}
                <h3>${instalacion.nombre}</h3>
                <p class="location">📍 ${instalacion.ubicacion}</p>
                ${instalacion.detalle ? `<p class="location">${instalacion.detalle}</p>` : ""}
                ${reserva || pie}
            </div>
        </article>`;
}

function crearTarjetaSubasta(subasta) {
    return `
        <article class="auction-card">
            <div class="auction-top">
                <span class="auction-badge">🔥 DEMOSTRACIÓN</span>
                <span class="discount-badge">OFERTA</span>
            </div>
            <h3>${subasta.nombre}</h3>
            <p class="auction-hour">🕒 Comienza a las ${subasta.hora}</p>
            <div class="auction-price">
                <div>
                    <small>Precio original</small>
                    <del>${subasta.precio_original} €</del>
                </div>
                <div>
                    <small>Precio de ejemplo</small>
                    <strong>${subasta.precio_actual} €</strong>
                </div>
            </div>
            <button type="button" class="auction-btn">Próximamente</button>
        </article>`;
}

document.addEventListener("DOMContentLoaded", () => {

    // Opciones del desplegable de deportes
    const selectDeporte = document.getElementById("deporte");
    DEPORTES.forEach((deporte) => {
        const option = document.createElement("option");
        option.value = deporte.nombre;
        option.textContent = deporte.nombre;
        selectDeporte.appendChild(option);
    });

    // Rango de fechas: de hoy a dentro de 30 días
    const hoy = new Date();
    const maxima = new Date();
    maxima.setDate(hoy.getDate() + 30);
    const inputFecha = document.getElementById("fecha");
    inputFecha.min = fechaISO(hoy);
    inputFecha.max = fechaISO(maxima);
    inputFecha.value = fechaISO(hoy);

    // Tarjetas
    const instalacionesGrid = document.getElementById("instalaciones-grid");
    instalacionesGrid.addEventListener("error", (event) => {
        const image = event.target;
        if (!(image instanceof HTMLImageElement)) return;
        if (image.dataset.imageFallback) {
            image.src = image.dataset.imageFallback;
            delete image.dataset.imageFallback;
            return;
        }

        const frame = image.parentElement;
        frame.classList.add("card-image-placeholder");
        image.replaceWith(document.createTextNode("Foto no disponible"));
    }, true);
    instalacionesGrid.innerHTML = INSTALACIONES.map(crearTarjetaInstalacion).join("");
    document.getElementById("subastas-grid").innerHTML =
        SUBASTAS.map(crearTarjetaSubasta).join("");

    // Año del pie de página
    document.getElementById("anio").textContent = hoy.getFullYear();

    // Buscador: filtra las instalaciones por deporte
    const form = document.getElementById("search-form");
    const cards = document.querySelectorAll(".card");
    const emptyResults = document.getElementById("empty-results");

    form.addEventListener("submit", (event) => {
        event.preventDefault();

        const selectedSport = selectDeporte.value;
        let visibleCards = 0;

        cards.forEach((card) => {
            const visible = !selectedSport || card.dataset.deporte === selectedSport;
            card.hidden = !visible;
            if (visible) {
                visibleCards++;
            }
        });

        emptyResults.hidden = visibleCards > 0;

        document.getElementById("instalaciones").scrollIntoView({
            behavior: "smooth"
        });
    });

});

const loginLink = document.querySelector('.nav-actions a[href="login.html"]');
const registerLink = document.querySelector('.nav-actions a[href="registro.html"]');
const profileLink = document.getElementById("profile-link");
const logoutButton = document.getElementById("logout-btn");

function updateDemoSession() {
    const signedIn = sessionStorage.getItem("ceutaplay-demo-session") === "active";
    loginLink.hidden = signedIn;
    registerLink.hidden = signedIn;
    profileLink.hidden = !signedIn;
    logoutButton.hidden = !signedIn;
}

window.addEventListener("pageshow", updateDemoSession);
logoutButton.addEventListener("click", () => {
    sessionStorage.removeItem("ceutaplay-demo-session");
    sessionStorage.removeItem("ceutaplay-profile-name");
    updateDemoSession();
    loginLink.focus();
});
