// Datos de la web (antes estaban en core/views.py de Django).
// Para añadir o cambiar instalaciones, deportes o subastas, edita solo este archivo.

const DEPORTES = [
    { nombre: "Pádel", icono: "🎾" },
    { nombre: "Fútbol", icono: "⚽" },
    { nombre: "Tenis", icono: "🎾" },
    { nombre: "Baloncesto", icono: "🏀" },
];

const INSTALACIONES = [
    {
        id: 1,
        nombre: "Pádel La Marina",
        ubicacion: "Parque Marítimo del Mediterráneo, Ceuta",
        deporte: "Pádel",
        pistas: ["Pista 1", "Pista 2", "Pista 3"],
        detalle: "3 pistas de pádel y vestuarios en el recinto.",
        informacion: "https://www.parquemaritimo.es/",
        imagen: "https://equidesa.com/media/redactor/Pistas%20de%20padel%20panoramicas%20Cueta%20equidesa%205.JPG",
        imagenAlt: "Pistas azules de pádel de La Marina junto al puerto de Ceuta",
        fuenteImagen: "https://equidesa.com/noticias/2025/10/8/pistas-padel-panoramica-ceuta",
        creditoImagen: "Foto de Equidesa",
    },
    {
        id: 4,
        nombre: "Pádel Jardines de la Hípica",
        ubicacion: "Avenida de España, s/n, Ceuta",
        deporte: "Pádel",
        pistas: ["Doble 1", "Doble 2", "Individual"],
        detalle: "2 pistas dobles y 1 individual. Consulta las condiciones de acceso con el centro.",
        informacion: "https://ejercito.defensa.gob.es/documents/2155244/2175298/CDM_CEUTA_CCE.pdf/912b2c78-312f-8261-a4af-5247958f031f",
        imagen: "https://media.pistaenjuego.ovh/images/center/8/5/5/l.club-de-tenis-y-padel-loma-margarita-2_1372772558.jpg",
        imagenAlt: "Dos jugadores en una pista verde de pádel al aire libre",
        fuenteImagen: "https://www.pistaenjuego.com/club-de-tenis-y-padel-loma-margarita-p916",
        creditoImagen: "Foto ilustrativa · PistaEnJuego",
    },
    {
        id: 5,
        nombre: "Pádel Loma Colmenar",
        ubicacion: "Loma Colmenar, Ceuta",
        deporte: "Pádel",
        pistas: ["Pista de demostración"],
        detalle: "Instalación pendiente de confirmar.",
        imagen: "img/padel-loma-colmenar.jpg",
        imagenAlt: "Pista azul de pádel con cerramiento de cristal",
        creditoImagen: "Imagen ilustrativa generada con IA",
    },
    {
        id: 2,
        nombre: "Campo de Fútbol",
        ubicacion: "Ceuta",
        deporte: "Fútbol",
        precio: 45,
        imagen: "https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=900",
    },
    {
        id: 3,
        nombre: "Pistas de Tenis",
        ubicacion: "Ceuta",
        deporte: "Tenis",
        precio: 15,
        imagen: "https://images.unsplash.com/photo-1595435934249-5df7ed86e1c0?w=900",
    },
];

const SUBASTAS = [
    {
        nombre: "Pista de Pádel",
        precio_original: 24,
        precio_actual: 16,
        hora: "19:00",
    },
    {
        nombre: "Pista de Tenis",
        precio_original: 20,
        precio_actual: 12,
        hora: "20:30",
    },
];
