const mapLocations = new Map();
for (const facility of INSTALACIONES) {
    if (!facility.puntoMapa) continue;

    const key = facility.puntoMapa.join(",");
    if (!mapLocations.has(key)) mapLocations.set(key, []);
    mapLocations.get(key).push(facility);
}

const mapElement = document.getElementById("facility-map");
const mapStatus = document.getElementById("map-status");
const locationList = document.getElementById("map-locations");
const locationCount = document.getElementById("map-location-count");
locationCount.textContent = mapLocations.size;
locationCount.hidden = false;
let map;

if (window.L) {
    mapElement.hidden = false;
    map = L.map(mapElement, { scrollWheelZoom: false });
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).on("tileerror", () => {
        mapStatus.textContent = "El mapa base no se ha cargado por completo. Puedes consultar los marcadores o abrir una ubicación en Google Maps.";
        mapStatus.hidden = false;
    }).addTo(map);
} else {
    mapStatus.textContent = "El mapa interactivo no está disponible. Puedes abrir cada ubicación en Google Maps.";
    mapStatus.hidden = false;
}

for (const facilities of mapLocations.values()) {
    const facility = facilities[0];
    const name = facility.nombreMapa || facility.nombre;
    const approximateNote = facility.notaPuntoMapa || facility.mapaNota;
    const content = document.createElement("div");
    const title = document.createElement("h3");
    title.textContent = name;
    content.append(title);

    const address = document.createElement("p");
    address.textContent = facility.ubicacion;
    content.append(address);

    if (approximateNote) {
        const note = document.createElement("p");
        note.textContent = approximateNote;
        content.append(note);
    }

    const actions = document.createElement("div");
    actions.className = "map-location-actions";
    for (const option of facilities) {
        const link = document.createElement("a");
        link.textContent = `Reservar ${option.deporte.toLowerCase()}`;
        link.href = `reservas.html?pista=${option.id}`;
        actions.append(link);
    }

    const directions = document.createElement("a");
    directions.textContent = "Abrir en Google Maps";
    directions.href = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(facility.mapa || facility.ubicacion)}`;
    directions.target = "_blank";
    directions.rel = "noopener noreferrer";
    content.append(actions);

    const item = document.createElement("li");
    item.append(content);
    locationList.append(item);

    if (map) {
        const popup = content.cloneNode(true);
        popup.className = "map-popup";
        popup.lastElementChild.append(directions);
        const marker = L.marker(facility.puntoMapa, {
            title: name,
            alt: name,
            icon: L.divIcon({
                className: approximateNote ? "facility-marker facility-marker-approximate" : "facility-marker",
                iconSize: [22, 22],
            }),
        }).addTo(map).bindPopup(popup);
        marker.on("popupopen", () => item.classList.add("map-location-selected"));
        marker.on("popupclose", () => item.classList.remove("map-location-selected"));
        const locate = document.createElement("button");
        locate.type = "button";
        locate.className = "map-locate-btn";
        locate.textContent = "Ver punto";
        locate.setAttribute("aria-label", `Ver ${name} en el mapa`);
        locate.addEventListener("click", () => {
            marker.openPopup();
            mapElement.scrollIntoView({ block: "nearest" });
        });
        actions.append(locate);
    } else {
        actions.append(directions);
    }
}

if (map) {
    map.fitBounds([...mapLocations.values()].map(([facility]) => facility.puntoMapa), {
        padding: [24, 24],
        maxZoom: 16,
    });
}
