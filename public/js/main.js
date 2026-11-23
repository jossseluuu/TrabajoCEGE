// Lógica de la página. Sustituye a las plantillas de Django:
// pinta las tarjetas de instalaciones y gestiona el buscador.
// El login está en auth.js y las subastas en subastas.js.

function fechaISO(fecha) {
    const y = fecha.getFullYear();
    const m = String(fecha.getMonth() + 1).padStart(2, "0");
    const d = String(fecha.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
}

function crearTarjetaInstalacion(instalacion) {
    return `
        <article class="card" data-deporte="${instalacion.deporte}">
            <div class="card-image">
                <img src="${instalacion.imagen}" alt="${instalacion.nombre}">
                <span class="card-tag">${instalacion.deporte}</span>
            </div>
            <div class="card-content">
                <h3>${instalacion.nombre}</h3>
                <p class="location">📍 ${instalacion.ubicacion}</p>
                <div class="card-footer">
                    <div class="price">
                        <small>Desde</small>
                        <strong>${instalacion.precio} €</strong>
                    </div>
                    <button type="button" class="reserve-btn">Ver horarios →</button>
                </div>
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
