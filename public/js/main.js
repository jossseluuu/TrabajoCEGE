// Lógica de la página. Sustituye a las plantillas de Django:
// pinta las tarjetas de instalaciones y gestiona el buscador.
// El login está en auth.js y las subastas en subastas.js.

function crearTarjetaInstalacion(instalacion) {
    const etiqueta = `<span class="card-tag">${instalacion.deporte}</span>`;
    const precio = instalacion.precio == null ? "" : `
        <div class="price">
            <small>Desde</small>
            <strong>${instalacion.precio} €</strong>
        </div>`;
    const icd = esInstalacionIcd(instalacion);
    const reserva = instalacion.pistas && icd
        ? `<div class="card-footer booking-card-footer">
            <div class="price">
                <small>Instalación pública</small>
                <strong>Gestión del ICD</strong>
            </div>
            <div class="booking-card-actions">
                <a class="reserve-btn" href="${instalacion.informacion || URL_ICD}" target="_blank" rel="noopener noreferrer">Reservar en el ICD</a>
                <a class="login-btn" href="reservas.html?pista=${instalacion.id}#ubicacion">Ver mapa</a>
            </div>
        </div>`
        : instalacion.pistas
        ? `<div class="card-footer booking-card-footer">
            <div class="price">
                <small>Hora punta · valle −${Math.round((1 - TURNOS.factorValle) * 100)} %</small>
                <strong>${instalacion.precioPrueba} CC / hora</strong>
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
            <div class="card-content">
                ${etiqueta}
                <h3>${instalacion.nombre}</h3>
                <p class="location">${instalacion.ubicacion}</p>
                ${instalacion.detalle ? `<p class="card-detail">${instalacion.detalle}</p>` : ""}
                ${reserva || pie}
            </div>
        </article>`;
}

document.addEventListener("DOMContentLoaded", () => {

    // Opciones del desplegable de deportes
    const selectDeporte = document.getElementById("deporte");
    const availableSports = new Set(INSTALACIONES.map(({ deporte }) => deporte));
    DEPORTES.filter(({ nombre }) => availableSports.has(nombre)).forEach((deporte) => {
        const option = document.createElement("option");
        option.value = deporte.nombre;
        option.textContent = deporte.nombre;
        selectDeporte.appendChild(option);
    });

    // Tarjetas
    const instalacionesGrid = document.getElementById("instalaciones-grid");
    instalacionesGrid.innerHTML = INSTALACIONES.map(crearTarjetaInstalacion).join("");

    // Año del pie de página
    document.getElementById("anio").textContent = new Date().getFullYear();

    // Buscador: filtra las instalaciones por deporte
    const form = document.getElementById("search-form");
    const cards = instalacionesGrid.querySelectorAll(".card");
    const emptyResults = document.getElementById("empty-results");
    const installationCount = document.getElementById("installation-count");

    function filterInstallations() {
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
        installationCount.textContent = visibleCards === 1 ? "1 instalación" : `${visibleCards} instalaciones`;
    }

    filterInstallations();
    form.addEventListener("submit", (event) => {
        event.preventDefault();
        filterInstallations();

        document.getElementById("instalaciones").scrollIntoView({
            behavior: "smooth"
        });
    });

});
