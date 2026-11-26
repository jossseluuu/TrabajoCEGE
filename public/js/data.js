// Datos de la web (antes estaban en core/views.py de Django).
// Para añadir o cambiar instalaciones, deportes o datos de ejemplo, edita solo este archivo.

const DEPORTES = [
    { nombre: "Pádel", icono: "🎾" },
    { nombre: "Fútbol", icono: "⚽" },
    { nombre: "Tenis", icono: "🎾" },
    { nombre: "Baloncesto", icono: "🏀" },
    { nombre: "Kayak", icono: "🛶" },
    { nombre: "Paddle surf", icono: "🏄" },
    { nombre: "Piragüismo", icono: "🛶" },
];

const CEUTA_KAYAK = {
    ubicacion: "Playa de la Ribera, Ceuta · junto al Mercado Central",
    mapa: "Ceuta Kayak, Playa de la Ribera, Ceuta",
    puntoMapa: [35.88682, -5.31518],
    nombreMapa: "Ceuta Kayak · Playa de la Ribera",
    notaPuntoMapa: "Marcador orientativo en la playa de la Ribera.",
    informacion: "https://www.tur4all.com/resources/ceuta-kayak",
    contacto: "tel:+34676278086",
    horario: Array.from({ length: 9 }, (_, index) => `${10 + index}:00`),
    subastable: false,
};

const INSTALACIONES = [
    {
        id: 1,
        nombre: "Pádel La Marina",
        precioPrueba: 20,
        ubicacion: "Parque Marítimo del Mediterráneo, Ceuta",
        mapa: "Pistas de pádel Parque Marítimo del Mediterráneo, Ceuta",
        puntoMapa: [35.89002, -5.30937],
        nombreMapa: "La Marina",
        deporte: "Pádel",
        pistas: ["Pista 1", "Pista 2", "Pista 3"],
        detalle: "3 pistas de pádel y vestuarios en el recinto.",
        informacion: "https://www.parquemaritimo.es/",
    },
    {
        id: 4,
        nombre: "Pádel Jardines de la Hípica",
        precioPrueba: 15,
        ubicacion: "Avenida de España, s/n, Ceuta",
        mapa: "Jardines de la Hípica Centro Cultural del Ejército, Avenida de España, Ceuta",
        puntoMapa: [35.89432, -5.32768],
        nombreMapa: "Jardines de la Hípica",
        deporte: "Pádel",
        pistas: ["Doble 1", "Doble 2", "Individual"],
        detalle: "2 pistas dobles y 1 individual. Consulta las condiciones de acceso con el centro.",
        informacion: "https://ejercito.defensa.gob.es/documents/2155244/2175298/CDM_CEUTA_CCE.pdf/912b2c78-312f-8261-a4af-5247958f031f",
    },
    {
        id: 5,
        nombre: "Pádel Loma Colmenar",
        precioPrueba: 12,
        ubicacion: "Loma Colmenar, Ceuta",
        mapa: "Loma Colmenar, Ceuta",
        puntoMapa: [35.88034, -5.34032],
        nombreMapa: "Loma Colmenar",
        mapaNota: "El mapa muestra el barrio. La ubicación exacta de la pista está pendiente de confirmar.",
        deporte: "Pádel",
        pistas: ["Pista de demostración"],
        detalle: "Instalación pendiente de confirmar.",
    },
    {
        id: 2,
        nombre: "Campo Federativo José Benoliel",
        ubicacion: "Calle Calderón de la Barca, Villajovita, Ceuta",
        mapa: "Campo Federativo José Benoliel, Ceuta",
        puntoMapa: [35.88968, -5.33289],
        deporte: "Fútbol",
        gestion: "icd", // instalación pública: se reserva en el ICD
        pistas: ["Campo José Benoliel"],
        precioPrueba: 45,
        detalle: "Campo federativo de césped artificial.",
        informacion: "https://www.opsa.es/portfolio-items/campo-de-futbol-jose-benoliel-ceuta/",
    },
    {
        id: 9,
        nombre: "Pista Polideportiva José Zurrón",
        ubicacion: "Barriada José Zurrón, Ceuta",
        mapa: "Pista Polideportiva José Zurrón, Ceuta",
        puntoMapa: [35.88846, -5.3312],
        notaPuntoMapa: "Marcador orientativo en la barriada José Zurrón.",
        deporte: "Fútbol",
        gestion: "icd", // instalación pública: se reserva en el ICD
        pistas: ["Pista de fútbol sala"],
        precioPrueba: 12,
        detalle: "Pista polideportiva al aire libre utilizada para fútbol sala.",
        informacion: "https://elfarodeceuta.es/deportes/pistoletazo-salida-torneo-ua-ceuti-futbol-sala/",
    },
    {
        id: 10,
        nombre: "Campos de Fútbol del Príncipe",
        ubicacion: "Puente del Quemadero, Príncipe Alfonso, Ceuta",
        mapa: "Campos de fútbol Tuhami Al Lal y Aiman Aomar, Puente del Quemadero, Ceuta",
        puntoMapa: [35.88352, -5.34533],
        notaPuntoMapa: "Marcador orientativo en Puente del Quemadero.",
        deporte: "Fútbol",
        gestion: "icd", // instalación pública: se reserva en el ICD
        pistas: ["Tuhami Al Lal", "Aiman Aomar"],
        precioPrueba: 25,
        detalle: "Dos campos de fútbol 7 con césped artificial, iluminación y vestuarios.",
        informacion: "https://www.ceuta.es/gobiernodeceuta/index.php/noticia/21-deportes/10549-los-campos-de-futbol-7-que-la-ciudad-construye-en-el-principe-estaran-abiertos-en-abril",
    },
    {
        id: 11,
        nombre: "Pista Polígono Virgen de África",
        ubicacion: "Barriada Polígono Virgen de África, Ceuta",
        mapa: "Pista polideportiva Polígono Virgen de África, Avenida de Barcelona, Ceuta",
        puntoMapa: [35.88793, -5.32514],
        notaPuntoMapa: "Marcador orientativo en la avenida de Barcelona.",
        deporte: "Fútbol",
        gestion: "icd", // instalación pública: se reserva en el ICD
        pistas: ["Pista de fútbol sala"],
        precioPrueba: 12,
        detalle: "Pista de barrio utilizada para fútbol sala y baloncesto.",
        informacion: "https://elfarodeceuta.es/actualidad/muro-pista-deportiva-poligono/",
    },
    {
        id: 12,
        nombre: "Campo José Martínez Pirri",
        ubicacion: "Zona de El Sarchal, Ceuta",
        mapa: "Campo de Fútbol José Martínez Pirri, Ceuta",
        puntoMapa: [35.8916, -5.29923],
        deporte: "Fútbol",
        gestion: "icd", // instalación pública: se reserva en el ICD
        pistas: ["Campo José Martínez Pirri"],
        precioPrueba: 45,
        detalle: "Campo federativo conocido como el 54.",
        informacion: "https://mapcarta.com/W178424973",
    },
    {
        id: 13,
        nombre: "Campo Emilio Cózar",
        ubicacion: "Ciudad del Fútbol de Ceuta, El Morro",
        mapa: "Campo Emilio Cózar, Ciudad del Fútbol de Ceuta",
        puntoMapa: [35.8841, -5.3265],
        deporte: "Fútbol",
        gestion: "icd", // instalación pública: se reserva en el ICD
        pistas: ["Campo Emilio Cózar"],
        precioPrueba: 25,
        detalle: "Campo federativo en la Ciudad del Fútbol de Ceuta.",
        informacion: "https://rffce.es/pnfg/NNws_ShwNewDup?cod_primaria=5000289&cod_secundaria=5000289&codigo=57116",
    },
    {
        id: 14,
        nombre: "Pista Deportiva Juan XXIII",
        ubicacion: "Barriada Juan XXIII, Ceuta",
        mapa: "Pista deportiva Juan XXIII, Ceuta",
        puntoMapa: [35.87898, -5.32862],
        notaPuntoMapa: "Marcador orientativo en la barriada Juan XXIII.",
        deporte: "Fútbol",
        gestion: "icd", // instalación pública: se reserva en el ICD
        pistas: ["Pista polideportiva"],
        precioPrueba: 15,
        detalle: "Pista polideportiva exterior junto al local social de la barriada.",
        informacion: "https://www.ceuta.es/gobiernodeceuta/index.php/noticia/6-fomento/13616-la-ciudad-concluye-las-obras-de-la-nueva-pista-deportiva-y-el-local-social-de-juan-xxiii",
    },
    {
        id: 15,
        nombre: "Polideportivo Santa Amelia",
        ubicacion: "Loma Larga, junto al CEIP Santa Amelia, Ceuta",
        mapa: "Polideportivo Santa Amelia, Ceuta",
        puntoMapa: [35.88813, -5.34387],
        notaPuntoMapa: "Marcador orientativo en el entorno del CEIP Santa Amelia.",
        deporte: "Fútbol",
        gestion: "icd", // instalación pública: se reserva en el ICD
        pistas: ["Pista cubierta de fútbol sala"],
        precioPrueba: 20,
        detalle: "Pabellón cubierto con gradas y pista de fútbol sala.",
        informacion: "https://icdceuta.es/polideportivo-cubierto-santa-amelia-ceuta/",
    },
    {
        id: 3,
        nombre: "Tenis La Marina",
        ubicacion: "Parque Marítimo del Mediterráneo, Ceuta",
        mapa: "Pistas de tenis Parque Marítimo del Mediterráneo, Ceuta",
        puntoMapa: [35.89002, -5.30937],
        nombreMapa: "La Marina",
        deporte: "Tenis",
        pistas: ["Pista 1", "Pista 2"],
        precioPrueba: 15,
        detalle: "2 pistas de tenis y vestuarios en el recinto.",
        informacion: "https://www.parquemaritimo.es/",
    },
    {
        id: 6,
        nombre: "Club de Tenis y Pádel Loma Margarita",
        ubicacion: "Loma Margarita, 84, Ceuta",
        mapa: "Club de Tenis y Pádel Loma Margarita, Ceuta",
        puntoMapa: [35.89146, -5.34387],
        deporte: "Tenis",
        pistas: ["Pista 1", "Pista 2", "Pista 3", "Pista 4", "Pista 5", "Pista 6"],
        precioPrueba: 15,
        detalle: "6 pistas de tenis según el directorio de la RFET.",
        informacion: "https://www.rfet.es/es/club/cde-las-margaritas",
    },
    {
        id: 7,
        nombre: "Club de Tenis Perla del Mediterráneo",
        ubicacion: "Avenida de los Reyes Católicos, s/n, Ceuta",
        mapa: "Club de Tenis Perla del Mediterráneo, Avenida de los Reyes Católicos, Ceuta",
        puntoMapa: [35.88368, -5.32794],
        notaPuntoMapa: "Marcador orientativo en la avenida de los Reyes Católicos.",
        deporte: "Tenis",
        pistas: ["Pista 1", "Pista 2", "Pista 3"],
        precioPrueba: 15,
        detalle: "3 pistas de tenis según el directorio de la RFET.",
        informacion: "https://www.rfet.es/es/club/club-tenis-perla-mediterraneo",
    },
    {
        id: 8,
        nombre: "Club de Tenis Ceuta",
        ubicacion: "Zona de Loma Margarita, Ceuta",
        mapa: "35.88734,-5.34567",
        puntoMapa: [35.88734, -5.34567],
        deporte: "Tenis",
        pistas: ["Pista 1", "Pista 2", "Pista 3"],
        precioPrueba: 15,
        detalle: "3 pistas de tenis según el directorio de la RFET.",
        informacion: "https://www.rfet.es/es/club/club-de-tenis-ceuta",
    },
    {
        ...CEUTA_KAYAK,
        id: 16,
        nombre: "Kayak con Ceuta Kayak",
        deporte: "Kayak",
        pistas: ["Kayak 1", "Kayak 2", "Kayak 3"],
        precioPrueba: 12,
        detalle: "Alquiler de kayak en la Ribera. Turnos de prueba de una hora.",
    },
    {
        ...CEUTA_KAYAK,
        id: 17,
        nombre: "Paddle surf con Ceuta Kayak",
        deporte: "Paddle surf",
        pistas: ["Tabla 1", "Tabla 2", "Tabla 3"],
        precioPrueba: 15,
        detalle: "Alquiler de tablas de paddle surf. Turnos de prueba de una hora.",
    },
    {
        ...CEUTA_KAYAK,
        id: 18,
        nombre: "Piragüismo con Ceuta Kayak",
        deporte: "Piragüismo",
        pistas: ["Piragua 1", "Piragua 2"],
        precioPrueba: 14,
        detalle: "Alquiler de piragua en la Ribera. Turnos de prueba de una hora.",
    },
];

// Fotos destinadas al formulario de reserva. El catálogo usa fichas de texto.
const FOTOS_RESERVA = {
    1: { src: "https://equidesa.com/media/redactor/Pistas%20de%20padel%20panoramicas%20Cueta%20equidesa%205.JPG", descripcion: "Pistas de pádel de La Marina junto al puerto", credito: "Equidesa" },
    2: { src: "https://www.opsa.es/wp-content/uploads/2019/11/PHOTO-2019-10-25-21-19-29.jpg", descripcion: "Campo de fútbol José Benoliel", credito: "OPSA" },
    3: { src: "https://static.wixstatic.com/media/3196bb_254c33eb094244a1a9c47af069a324ed~mv2.jpg/v1/fill/w_1000%2Ch_750%2Cal_c%2Cq_85%2Cusm_0.66_1.00_0.01/3196bb_254c33eb094244a1a9c47af069a324ed~mv2.jpg", descripcion: "Zona deportiva de La Marina", credito: "Parque Marítimo del Mediterráneo" },
    6: { src: "https://res.cloudinary.com/playtomic/image/upload/v1677764524/pro/tenants/d44c6a04-7b1d-4386-b2be-2e361b50b7ea/1677764523875.jpg", descripcion: "Pistas cubiertas de pádel del Club Loma Margarita", credito: "Playtomic" },
    9: { src: "https://www.ceutaldia.com/media/ceutaldia/images/2023/05/06/2023050615101832840.jpg", descripcion: "Pista polideportiva de José Zurrón", credito: "Ceuta al Día" },
    10: { src: "https://www.ceutaldia.com/media/ceutaldia/images/2025/09/24/2025092408171033476.jpg", descripcion: "Gradas de los campos de fútbol del Príncipe", credito: "Ceuta al Día" },
    11: { src: "https://static.elpueblodeceuta.es/clip/5c75ea57-eb29-4731-b83b-aa242da6b882_16-9-aspect-ratio_1600w_0.jpg", descripcion: "Pista del Polígono Virgen de África", credito: "El Pueblo de Ceuta" },
    12: { src: "https://album.mediaset.es/eimg/2025/11/11/campo-jose-martinez-pirri-de-ceuta-001-jpeg-16-9-aspect-ratio-default-0_da39.jpg?w=1024", descripcion: "Campo de fútbol José Martínez Pirri", credito: "ElDesmarque" },
    13: { src: "https://www.ceutaldia.com/media/ceutaldia/images/2017/10/05/2017100513520831605.jpg", descripcion: "Campo de fútbol Emilio Cózar", credito: "Ceuta al Día" },
    14: { src: "https://www.ceutaactualidad.com/media/ceutaactualidad/images/2024/12/06/2024120622572216518.jpg", descripcion: "Pista deportiva Juan XXIII", credito: "Ceuta Actualidad" },
    15: { src: "https://www.ceutaactualidad.com/media/ceutaactualidad/images/2024/12/09/2024120913302711187.jpg", descripcion: "Pista interior de Santa Amelia", credito: "Ceuta Actualidad" },
};

const FOTOS_RESERVA_ILUSTRATIVAS = {
    "Pádel": { src: "img/padel-loma-colmenar.jpg", descripcion: "Pista de pádel vacía", credito: "Ilustración generada con IA" },
    "Tenis": FOTOS_RESERVA[3],
    "Fútbol": FOTOS_RESERVA[2],
};

const formatoEuros = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", minimumFractionDigits: 0 });



// ---------------------------------------------------------------------
// Moderación de nombres de usuario
//
// Términos que no se permiten en el nombre visible (insultos, odio,
// contenido sexual y nombres que suplantan al equipo). El administrador
// puede añadir o quitar términos desde el panel; esta es la lista inicial
// (la misma que siembra supabase/admin.sql).
//
// modo "contiene": se rechaza si aparece en cualquier parte del nombre
//                  (también escrito con trucos: "1d10t4", "i.d.i.o.t.a"…).
// modo "palabra":  solo si es una palabra completa. Se usa para términos
//                  cortos que forman parte de nombres reales
//                  (p. ej. "puta" en "Diputado", "zorra" en "Zorrilla").
// ---------------------------------------------------------------------
const NOMBRES_PROHIBIDOS_BASE = [
    // Suplantación del equipo / cuentas oficiales
    { termino: "admin", modo: "contiene" },
    { termino: "administrador", modo: "contiene" },
    { termino: "moderador", modo: "contiene" },
    { termino: "ceutaplay", modo: "contiene" },
    { termino: "soporte", modo: "palabra" },
    { termino: "oficial", modo: "palabra" },
    { termino: "root", modo: "palabra" },
    { termino: "staff", modo: "palabra" },
    // Insultos
    { termino: "mierda", modo: "contiene" },
    { termino: "cabron", modo: "contiene" },
    { termino: "gilipollas", modo: "contiene" },
    { termino: "imbecil", modo: "contiene" },
    { termino: "idiota", modo: "contiene" },
    { termino: "subnormal", modo: "contiene" },
    { termino: "retrasado", modo: "contiene" },
    { termino: "mongolo", modo: "contiene" },
    { termino: "capullo", modo: "contiene" },
    { termino: "pringado", modo: "contiene" },
    { termino: "hijoputa", modo: "contiene" },
    { termino: "malparido", modo: "contiene" },
    { termino: "puta", modo: "palabra" },
    { termino: "puto", modo: "palabra" },
    { termino: "zorra", modo: "palabra" },
    { termino: "joder", modo: "contiene" },
    // Odio y discriminación
    { termino: "maricon", modo: "contiene" },
    { termino: "negrata", modo: "contiene" },
    { termino: "sudaca", modo: "contiene" },
    { termino: "panchito", modo: "contiene" },
    { termino: "hitler", modo: "contiene" },
    { termino: "nazi", modo: "palabra" },
    { termino: "kkk", modo: "contiene" },
    { termino: "terrorista", modo: "contiene" },
    // Contenido sexual o violento
    { termino: "polla", modo: "palabra" },
    { termino: "verga", modo: "palabra" },
    { termino: "culo", modo: "palabra" },
    { termino: "cono", modo: "palabra" },
    { termino: "follar", modo: "contiene" },
    { termino: "porno", modo: "contiene" },
    { termino: "pedofilo", modo: "contiene" },
    { termino: "violador", modo: "contiene" },
    // Inglés
    { termino: "fuck", modo: "contiene" },
    { termino: "shit", modo: "contiene" },
    { termino: "bitch", modo: "contiene" },
    { termino: "nigger", modo: "contiene" },
    { termino: "nigga", modo: "contiene" },
    { termino: "whore", modo: "contiene" },
    { termino: "cunt", modo: "palabra" },
];

// ---------------------------------------------------------------------
// Facturación (modelo de negocio: comisión por transacción)
//
// Valores iniciales del panel de facturación. El administrador los puede
// cambiar desde el panel. El IPSI es el impuesto indirecto de Ceuta (en
// lugar del IVA); confirmad el tipo aplicable con la asesoría.
// ---------------------------------------------------------------------
// ---------------------------------------------------------------------
// Subastas: dos formatos
//
//  · "automatica" (última hora): una pista que sigue libre cuando faltan
//    12 horas o menos para el turno sale sola a subasta, con un precio de
//    salida de la mitad de su precio normal. Se cierra poco antes del
//    partido y el ganador se queda la reserva. Lo cobra la instalación
//    (menos la comisión de CeutaPlay).
//  · "reventa": un usuario que no puede ir subasta su reserva. Al cerrar,
//    la reserva pasa al ganador y el usuario recibe el precio final menos
//    la comisión de CeutaPlay (y el IPSI de esa comisión).
//
// Si cambias estos valores, cambia también supabase/subastas.sql.
// ---------------------------------------------------------------------
const SUBASTA_AUTOMATICA = {
    horasAntes: 12,          // las pistas libres salen a subasta 12 h antes del turno
    cierreMinAntes: 15,      // la subasta se cierra 15 min antes de empezar
    descuentoSalida: 0.5,    // precio de salida = mitad del precio normal
    // Instalaciones con reserva directa (centros privados). Las públicas del
    // ICD no entran. Una instalación puede forzarlo con subastaAutomatica: true/false.
    deportes: ["Pádel", "Tenis"],
};

// Horario por defecto de las pistas (igual que en reservas.html)
const HORARIO_DEFECTO = Array.from({ length: 13 }, (_, i) => `${String(i + 9).padStart(2, "0")}:00`);

// ---------------------------------------------------------------------
// Turnos, duración y precios por franja
//
// Las reservas empiezan en tramos de 30 minutos y duran de 30 min a 3 h.
// Precio: precioPrueba es el precio por hora en hora punta. En hora valle
// (lunes a viernes antes de las 17:00) se cobra un 20 % menos.
// Si cambias esto, cambia también precio_turno() en supabase/plataforma.sql.
// ---------------------------------------------------------------------
const TURNOS = {
    tramoMin: 30,          // las reservas empiezan cada 30 min
    duracionMin: 30,       // duración mínima
    duracionMax: 180,      // duración máxima (3 h)
    inicioPunta: "17:00",  // de lunes a viernes, desde esta hora es hora punta
    factorValle: 0.8,      // hora valle: 20 % más barata
};

// Instalaciones públicas (gestion: "icd"): no se reservan en CeutaPlay,
// se redirige al Instituto Ceutí de Deportes. Cambia la dirección si el ICD
// publica una página de reservas propia.
const URL_ICD = "https://www.ceuta.es/";

const esInstalacionIcd = (i) => i && i.gestion === "icd";
const esReservable = (i) => Boolean(i && i.pistas && i.pistas.length) && !esInstalacionIcd(i);

const aMinutos = (hora) => {
    const [h, m] = String(hora).split(":").map(Number);
    return h * 60 + (m || 0);
};
const aHora = (min) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

// Apertura y cierre: el horario de la instalación son las horas de inicio de
// los turnos de 1 h (la última empieza 1 h antes de cerrar)
function horarioDe(instalacion) {
    const horas = (instalacion && instalacion.horario) || HORARIO_DEFECTO;
    return { apertura: aMinutos(horas[0]), cierre: aMinutos(horas[horas.length - 1]) + 60 };
}

// Horas de inicio posibles (cada 30 min) para una duración dada
function iniciosPosibles(instalacion, duracion = TURNOS.duracionMin) {
    const { apertura, cierre } = horarioDe(instalacion);
    const lista = [];
    for (let m = apertura; m + duracion <= cierre; m += TURNOS.tramoMin) lista.push(aHora(m));
    return lista;
}

const duracionesPosibles = () => {
    const lista = [];
    for (let d = TURNOS.duracionMin; d <= TURNOS.duracionMax; d += TURNOS.tramoMin) lista.push(d);
    return lista;
};

const textoDuracion = (min) => (min % 60 === 0 ? `${min / 60} h` : min > 60 ? `${Math.floor(min / 60)} h ${min % 60} min` : `${min} min`);

function esHoraPunta(fecha, minuto) {
    const dia = new Date(`${fecha}T12:00:00Z`).getUTCDay(); // 0 domingo · 6 sábado
    return dia === 0 || dia === 6 || minuto >= aMinutos(TURNOS.inicioPunta);
}

// Precio de una reserva: se suma tramo a tramo (30 min) según la franja
function precioTurno(instalacion, fecha, hora, duracion = 60) {
    const base = (instalacion && instalacion.precioPrueba) || 0;
    let total = 0;
    for (let m = aMinutos(hora); m < aMinutos(hora) + duracion; m += TURNOS.tramoMin) {
        total += (base * (esHoraPunta(fecha, m) ? 1 : TURNOS.factorValle) * TURNOS.tramoMin) / 60;
    }
    return Math.round(total * 100) / 100;
}

// ---------------------------------------------------------------------
// Monedero (simulacro de pago)
//
// Se paga con CeutaCoins (CC), 1 CC = 1 €. Cada cuenta nueva empieza con
// 1.000.000 CC. Con ellas se pagan reservas y subastas; quien revende su
// reserva cobra en CC. En producción, las recargas vendrían de una pasarela
// de pago real (Redsys, Bizum…).
// ---------------------------------------------------------------------
const MONEDERO = {
    moneda: "CC",
    nombre: "CeutaCoins",
    saldoInicial: 1000000,
    reembolsoHorasAntes: 24, // cancelar con más de 24 h de antelación: se devuelve todo
};

const formatoCC = (n) => `${new Intl.NumberFormat("es-ES", { maximumFractionDigits: 2 }).format(n || 0)} CC`;

const FACTURACION_DEFECTO = {
    comisionReservas: 10,   // % sobre el precio de cada reserva directa
    comisionSubastas: 15,   // % sobre el precio final de cada subasta adjudicada
    ipsi: 4,                // % de IPSI sobre la comisión de la plataforma
    // Comisión bonificada por instalación (RSC: escuelas deportivas base,
    // deporte femenino…). { [instalacionId]: porcentaje }
    bonificadas: {},
};

// ---------------------------------------------------------------------
// DATOS DE EJEMPLO (ficticios)
//
// Se crean la primera vez que se abre la web en modo local, y con ellos se
// genera supabase/seed.sql para poblar el servidor de pruebas.
// Todos los usuarios tienen la contraseña "demo1234". Personas, correos y
// comentarios son inventados.
//
// Las fechas son relativas al día en que se crean:
//   dias: 0 = hoy, -3 = hace tres días, 2 = pasado mañana…
// ---------------------------------------------------------------------
const USUARIOS_DEMO = [
    { clave: "ana", nombre: "Ana Martín", email: "ana@ceutaplay.es", password: "demo1234", deporte: "Pádel",
      bio: "Pádel tres veces por semana en La Marina. Busco pareja de nivel medio para jugar por las tardes." },
    { clave: "luis", nombre: "Luis Benítez", email: "luis@ceutaplay.es", password: "demo1234", deporte: "Fútbol",
      bio: "Fútbol 7 con los compañeros del trabajo y algo de tenis los domingos." },
    { clave: "marta", nombre: "Marta Ríos", email: "marta@ceutaplay.es", password: "demo1234", deporte: "Paddle surf",
      bio: "Si no hay levante, me encontrarás en la Ribera con la tabla. También juego al tenis." },
    { clave: "karim", nombre: "Karim Ahmed", email: "karim@ceutaplay.es", password: "demo1234", deporte: "Pádel",
      bio: "Jugador de pádel desde hace 6 años. Nivel 4. Me apunto a partidos de última hora." },
    { clave: "lucia", nombre: "Lucía Gómez", email: "lucia@ceutaplay.es", password: "demo1234", deporte: "Tenis",
      bio: "Entreno tenis en Loma Margarita. Me encanta jugar dobles mixtos." },
    { clave: "youssef", nombre: "Youssef Mohamed", email: "youssef@ceutaplay.es", password: "demo1234", deporte: "Pádel",
      bio: "Estudiante de la UGR en Ceuta. Pádel y kayak cuando el tiempo acompaña." },
    { clave: "paula", nombre: "Paula Navarro", email: "paula@ceutaplay.es", password: "demo1234", deporte: "Tenis",
      bio: "Tenis y running. Organizo partidos los sábados por la mañana, ¡únete!" },
    { clave: "hamza", nombre: "Hamza Larbi", email: "hamza@ceutaplay.es", password: "demo1234", deporte: "Kayak",
      bio: "Monitor de deportes náuticos en verano. El resto del año, pádel." },
    { clave: "sara", nombre: "Sara Ortega", email: "sara@ceutaplay.es", password: "demo1234", deporte: "Pádel",
      bio: "Empecé con el pádel hace un año y ya no puedo parar. Busco gente para aprender." },
    { clave: "ivan", nombre: "Iván Ruiz", email: "ivan@ceutaplay.es", password: "demo1234", deporte: "Tenis",
      bio: "Tenista de club. Si te falta uno para dobles, avísame." },
    { clave: "nora", nombre: "Nora Haddou", email: "nora@ceutaplay.es", password: "demo1234", deporte: "Piragüismo",
      bio: "Piragüismo en la bahía sur y pádel con amigas los jueves." },
    // Cuentas con permisos especiales
    { clave: "admin", nombre: "Equipo CeutaPlay", email: "admin@ceutaplay.es", password: "demo1234", admin: true,
      bio: "Cuenta de administración de CeutaPlay." },
    { clave: "gestor", nombre: "Gestión La Marina", email: "gestor@ceutaplay.es", password: "demo1234", gestiona: [1, 3],
      bio: "Gestores de las pistas de pádel y tenis de La Marina." },
    { clave: "entidad", nombre: "Asociación Estrella del Sur", email: "entidad@ceutaplay.es", password: "demo1234",
      entidad: { nombre: "Asociación Juvenil Estrella del Sur", descripcion: "Deporte para jóvenes de los barrios del sur de Ceuta.", acreditada: true },
      bio: "Asociación juvenil. Usamos la pista solidaria para nuestros grupos de deporte." },
];

// Reservas de ejemplo. publica: abierta para que otros pidan unirse.
const RESERVAS_DEMO = [
    // pasadas (para el historial, las reseñas y la facturación)
    { usuario: "ana", instalacionId: 1, pista: "Pista 1", dias: -40, hora: "19:00", duracion: 90 },
    { usuario: "karim", instalacionId: 4, pista: "Doble 1", dias: -33, hora: "18:00", duracion: 60 },
    { usuario: "lucia", instalacionId: 6, pista: "Pista 4", dias: -27, hora: "10:00", duracion: 120 },
    { usuario: "paula", instalacionId: 7, pista: "Pista 2", dias: -21, hora: "09:30", duracion: 90 },
    { usuario: "marta", instalacionId: 17, pista: "Tabla 2", dias: -18, hora: "11:00", duracion: 60 },
    { usuario: "hamza", instalacionId: 16, pista: "Kayak 1", dias: -15, hora: "12:00", duracion: 120 },
    { usuario: "sara", instalacionId: 5, pista: "Pista de demostración", dias: -12, hora: "17:30", duracion: 60 },
    { usuario: "ivan", instalacionId: 8, pista: "Pista 1", dias: -9, hora: "19:00", duracion: 60 },
    { usuario: "youssef", instalacionId: 1, pista: "Pista 2", dias: -6, hora: "20:00", duracion: 90 },
    { usuario: "nora", instalacionId: 18, pista: "Piragua 1", dias: -4, hora: "10:00", duracion: 60 },
    { usuario: "luis", instalacionId: 3, pista: "Pista 1", dias: -2, hora: "18:00", duracion: 60 },
    { usuario: "ana", instalacionId: 1, pista: "Pista 3", dias: -1, hora: "19:30", duracion: 60 },
    // próximas
    { usuario: "ana", instalacionId: 1, pista: "Pista 2", dias: 1, hora: "19:00", duracion: 90, publica: true, plazas: 4,
      nota: "Partido de nivel medio. ¡Nos faltan dos!",
      participantes: [{ usuario: "karim", estado: "aceptado", mensaje: "¡Me apunto!" }, { usuario: "sara", estado: "pendiente", mensaje: "¿Puedo ir aunque esté empezando?" }] },
    { usuario: "paula", instalacionId: 7, pista: "Pista 1", dias: 2, hora: "10:00", duracion: 120, publica: true, plazas: 4,
      nota: "Dobles de los sábados. Buen ambiente.",
      participantes: [{ usuario: "ivan", estado: "aceptado", mensaje: "Cuenta conmigo" }, { usuario: "lucia", estado: "aceptado", mensaje: "" }] },
    { usuario: "karim", instalacionId: 4, pista: "Doble 2", dias: 3, hora: "18:30", duracion: 60, publica: true, plazas: 4,
      nota: "Pádel nivel 4, partido rápido después del trabajo.",
      participantes: [{ usuario: "youssef", estado: "pendiente", mensaje: "Nivel 3,5, ¿vale?" }] },
    { usuario: "lucia", instalacionId: 6, pista: "Pista 2", dias: 4, hora: "17:00", duracion: 90, publica: true, plazas: 4,
      nota: "Dobles mixtos, falta una pareja." },
    { usuario: "youssef", instalacionId: 5, pista: "Pista de demostración", dias: 5, hora: "16:00", duracion: 60 },
    { usuario: "hamza", instalacionId: 16, pista: "Kayak 2", dias: 2, hora: "11:00", duracion: 120, publica: true, plazas: 3,
      nota: "Salida en kayak por la Ribera si no sopla levante." },
    { usuario: "luis", instalacionId: 3, pista: "Pista 2", dias: 6, hora: "20:00", duracion: 60 },
    { usuario: "marta", instalacionId: 6, pista: "Pista 5", dias: 3, hora: "09:00", duracion: 60 },
    { usuario: "sara", instalacionId: 1, pista: "Pista 3", dias: 7, hora: "18:00", duracion: 90, publica: true, plazas: 4,
      nota: "Partido para principiantes, sin presión." },
    { usuario: "nora", instalacionId: 8, pista: "Pista 3", dias: 8, hora: "19:30", duracion: 60 },
];

// Reseñas de las instalaciones
const OPINIONES_DEMO = [
    { usuario: "ana", instalacionId: 1, puntuacion: 5, dias: -39, comentario: "Pistas cuidadas y vistas al mar. Por la tarde se llena, mejor reservar con tiempo." },
    { usuario: "karim", instalacionId: 1, puntuacion: 4, dias: -30, comentario: "Buen cristal y buena luz. Los vestuarios podrían estar mejor." },
    { usuario: "youssef", instalacionId: 1, puntuacion: 5, dias: -5, comentario: "La subasta de última hora me salió a mitad de precio. ¡Genial!" },
    { usuario: "karim", instalacionId: 4, puntuacion: 4, dias: -32, comentario: "Ambiente tranquilo y bien de precio." },
    { usuario: "sara", instalacionId: 5, puntuacion: 3, dias: -11, comentario: "Está bien para empezar, aunque solo hay una pista." },
    { usuario: "lucia", instalacionId: 6, puntuacion: 5, dias: -26, comentario: "Las mejores pistas de tenis de Ceuta. Muy buen mantenimiento." },
    { usuario: "marta", instalacionId: 6, puntuacion: 4, dias: -20, comentario: "Muchas pistas disponibles, casi siempre hay hueco." },
    { usuario: "paula", instalacionId: 7, puntuacion: 4, dias: -20, comentario: "Buen club y buen trato. Aparcar es un poco complicado." },
    { usuario: "ivan", instalacionId: 8, puntuacion: 4, dias: -8, comentario: "Pistas rápidas, ideales para jugar de noche." },
    { usuario: "luis", instalacionId: 3, puntuacion: 4, dias: -1, comentario: "Tenis junto al mar. Con viento cuesta un poco más." },
    { usuario: "marta", instalacionId: 17, puntuacion: 5, dias: -17, comentario: "Tablas en muy buen estado y la bahía en calma. Repetiré." },
    { usuario: "hamza", instalacionId: 16, puntuacion: 5, dias: -14, comentario: "Salida perfecta por la Ribera. Atentos al parte del levante." },
    { usuario: "nora", instalacionId: 18, puntuacion: 4, dias: -3, comentario: "Piraguas cómodas. El monitor explica muy bien." },
];

// Subastas de ejemplo (reventas de reservas). Los tiempos son relativos al
// momento en que se crean:
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
        instalacionId: 6,
        vendedor: "lucia@ceutaplay.es",
        descripcion: "Me ha surgido un viaje. Pista de tenis cubierta.",
        precioSalida: 8,
        incremento: 1,
        terminaEnMin: 240,
        partidoEnHoras: 30,
        pujas: [],
    },
    {
        instalacionId: 3,
        vendedor: "ivan@ceutaplay.es",
        descripcion: "Pista de tenis para mañana por la mañana.",
        precioSalida: 8,
        incremento: 1,
        terminaEnMin: 20,
        partidoEnHoras: 18,
        pujas: [
            { email: "ana@ceutaplay.es", cantidad: 9 },
            { email: "paula@ceutaplay.es", cantidad: 10 },
        ],
    },
];
