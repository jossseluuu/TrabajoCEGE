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
        nombre: "Pistas de Pádel",
        ubicacion: "Ceuta",
        deporte: "Pádel",
        precio: 20,
        imagen: "https://images.unsplash.com/photo-1622279457486-62dcc4a431d6?w=900",
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
