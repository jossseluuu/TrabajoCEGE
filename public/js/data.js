// Datos de la web (antes estaban en core/views.py de Django).
// Para añadir o cambiar instalaciones, deportes o datos de ejemplo, edita solo este archivo.

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

// Usuarios de prueba que se crean la primera vez que se abre la web.
// Todos tienen la contraseña "demo1234".
const USUARIOS_DEMO = [
    { nombre: "Ana", email: "ana@ceutaplay.es", password: "demo1234" },
    { nombre: "Luis", email: "luis@ceutaplay.es", password: "demo1234" },
    { nombre: "Marta", email: "marta@ceutaplay.es", password: "demo1234" },
];

// Subastas de ejemplo. Los tiempos son relativos al momento en que se crean:
// - terminaEnMin: minutos que quedan para que termine la subasta
// - partidoEnHoras: horas que faltan para el partido
const SUBASTAS_DEMO = [
    {
        instalacionId: 1,
        vendedor: "ana@ceutaplay.es",
        descripcion: "No puedo ir a mi reserva, la subasto. Incluye palas.",
        precioSalida: 10,
        incremento: 1,
        terminaEnMin: 90,
        partidoEnHoras: 4,
        pujas: [
            { email: "luis@ceutaplay.es", cantidad: 12 },
            { email: "marta@ceutaplay.es", cantidad: 14 },
        ],
    },
    {
        instalacionId: 2,
        vendedor: "luis@ceutaplay.es",
        descripcion: "Campo de fútbol 7 libre esta tarde.",
        precioSalida: 25,
        incremento: 2,
        terminaEnMin: 240,
        partidoEnHoras: 8,
        pujas: [],
    },
    {
        instalacionId: 3,
        vendedor: "marta@ceutaplay.es",
        descripcion: "Pista de tenis para mañana por la mañana.",
        precioSalida: 8,
        incremento: 1,
        terminaEnMin: 20,
        partidoEnHoras: 18,
        pujas: [
            { email: "ana@ceutaplay.es", cantidad: 9 },
        ],
    },
];
