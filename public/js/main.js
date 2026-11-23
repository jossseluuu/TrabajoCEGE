// Lógica de la página. Sustituye a las plantillas de Django:
// pinta las tarjetas de instalaciones y gestiona el buscador.
// El login está en auth.js, las subastas en subastas.js y fechaISO() en store.js.

function crearTarjetaInstalacion(instalacion) {
    const etiqueta = `<span class="card-tag">${instalacion.deporte}</span>`;
    const imagen = instalacion.imagen
        ? `<div class="card-image"><img src="${instalacion.imagen}" alt="${instalacion.imagenAlt || ""}">${etiqueta}</div>`
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
        ? `<div class="card-footer"><a class="reserve-btn" href="reservas.html?pista=${instalacion.id}">Reservar pádel</a></div>`
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
    document.getElementById("instalaciones-grid").innerHTML =
        INSTALACIONES.map(crearTarjetaInstalacion).join("");

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
