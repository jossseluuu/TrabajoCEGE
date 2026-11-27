// Idiomas: español (original) e inglés.
//
// La web está escrita en español. Este archivo traduce los textos de la
// interfaz (menú, botones, títulos, formularios, avisos y «Cómo funciona»)
// sustituyendo cada texto por su traducción, también los que se pintan
// después con JavaScript (MutationObserver). Lo que escriben los usuarios
// (nombres, biografías, opiniones) no se traduce.
// El panel de administración, el del gestor y los textos legales quedan en
// español.
//
// Para añadir una traducción: "texto exacto en español": "English".
// Los párrafos largos llevan data-i18n="clave" y su traducción está en BLOQUES.

const I18n = (() => {
    const CLAVE = "cp_idioma";
    const IDIOMAS = { es: "Español", en: "English" };
    const idioma = (() => { try { return localStorage.getItem(CLAVE) === "en" ? "en" : "es"; } catch { return "es"; } })();

    const T = {
        // menú y pie
        "Inicio": "Home",
        "Instalaciones": "Facilities",
        "Mapa": "Map",
        "Reservar": "Book",
        "Subastas": "Auctions",
        "Comunidad": "Community",
        "Panel admin": "Admin panel",
        "Panel gestor": "Manager panel",
        "Iniciar sesión": "Log in",
        "Registrarse": "Sign up",
        "Cerrar sesión": "Log out",
        "Abrir menú": "Open menu",
        "Cómo funciona": "How it works",
        "Privacidad": "Privacy",
        "Cookies": "Cookies",
        "Condiciones de uso": "Terms of use",
        "Cancelaciones y reventa": "Cancellations and resale",
        "📲 Instalar app": "📲 Install app",
        "Idioma": "Language",
        "Tu deporte, tu pista, tu momento.": "Your sport, your court, your moment.",
        "Restablecer datos de ejemplo": "Reset sample data",
        "Avisos": "Notifications",
        "Marcar todo como leído": "Mark all as read",
        "🔔 Avisarme también con notificaciones del navegador": "🔔 Also notify me with browser notifications",
        "Cambiar a modo oscuro": "Switch to dark mode",
        "Cambiar a modo claro": "Switch to light mode",
        "Modo oscuro": "Dark mode",
        "Modo claro": "Light mode",

        // portada
        "Tu próxima partida empieza": "Your next game starts",
        "aquí.": "here.",
        "Deporte": "Sport",
        "Todos los deportes": "All sports",
        "Buscar pistas": "Find courts",
        "Ver mapa de instalaciones": "See facilities map",
        "Instalaciones deportivas": "Sports facilities",
        "Subastas de pistas": "Court auctions",
        "En curso": "Live",
        "⚡ Última hora": "⚡ Last minute",
        "Finalizadas": "Finished",
        "Mis subastas": "My auctions",
        "Mis pujas": "My bids",
        "Ordenar": "Sort",
        "Todos": "All",
        "Todas": "All",
        "Terminan antes": "Ending soonest",
        "Precio más bajo": "Lowest price",
        "Mayor ahorro": "Biggest saving",
        "Más pujas": "Most bids",
        "Más recientes": "Newest",
        "Subasta tu reserva": "Auction your booking",
        "No hay instalaciones de ese deporte.": "There are no facilities for that sport.",
        "¿A qué hora quieres jugar?": "What time do you want to play?",
        "Todas las horas": "All times",
        "Ver como tarjetas": "Show as cards",
        "Ver agrupado por hora": "Group by time",
        "Instalación": "Facility",
        "⚡ ÚLTIMA HORA": "⚡ LAST MINUTE",
        "🔁 REVENTA": "🔁 RESALE",
        "🔥 EN CURSO": "🔥 LIVE",
        "FINALIZADA": "FINISHED",
        "CANCELADA": "CANCELLED",
        "Precio de salida": "Starting price",
        "Puja actual": "Current bid",
        "Puja mínima": "Minimum bid",
        "Precio final": "Final price",
        "Inicia sesión para pujar": "Log in to bid",
        "⚠️ Te han superado. ¡Vuelve a pujar!": "⚠️ You've been outbid. Bid again!",
        "Cancelar mi subasta": "Cancel my auction",

        // acceso
        "Correo": "Email",
        "Correo electrónico": "Email address",
        "Contraseña": "Password",
        "Contraseña (mínimo 8 caracteres, con letras y números)": "Password (at least 8 characters, letters and numbers)",
        "Repite la contraseña": "Repeat the password",
        "Nombre": "Name",
        "Recordarme en este navegador": "Remember me on this browser",
        "Entrar": "Log in",
        "Crear cuenta": "Create account",
        "Crea tu cuenta": "Create your account",
        "Cuentas de prueba": "Test accounts",
        "Al crear la cuenta aceptas las": "By creating an account you accept the",
        "condiciones de uso": "terms of use",
        "política de privacidad": "privacy policy",
        "Volver al inicio": "Back to home",

        // reservas
        "Elige tu turno": "Choose your slot",
        "Fecha": "Date",
        "Tiempo de uso": "Duration",
        "Hora de inicio": "Start time",
        "Selecciona una hora": "Select a time",
        "Pista": "Court",
        "Equipo": "Equipment",
        "Precio": "Price",
        "Pagar y reservar": "Pay and book",
        "Libre": "Free",
        "Ocupada": "Taken",
        "Pasado": "Past",
        "Tú": "You",
        "Comparar horarios": "Compare times",
        "Ver agenda semanal": "See weekly schedule",
        "Horarios del día": "Today's schedule",
        "Agenda semanal": "Weekly schedule",
        "Semana anterior": "Previous week",
        "Semana siguiente": "Next week",
        "Volver al formulario": "Back to the form",
        "Ubicación": "Location",
        "Abrir en Google Maps": "Open in Google Maps",
        "Ficha de la instalación": "Facility details",
        "Opiniones": "Reviews",
        "Tu puntuación": "Your rating",
        "Tu comentario": "Your comment",
        "Publicar opinión": "Post review",
        "Mis reservas": "My bookings",
        "Jugadores en total": "Total players",
        "Mensaje para la comunidad": "Message for the community",
        "Ej.: Nivel medio, nos faltan dos": "E.g.: Intermediate level, we need two more",
        "🏛️ Instalación municipal del Instituto Ceutí de Deportes (ICD).": "🏛️ Municipal facility of the Ceuta Sports Institute (ICD).",
        "🌬️ Parte de viento": "🌬️ Wind forecast",
        "Cargando la previsión…": "Loading the forecast…",
        "Cancelar (se te devuelve)": "Cancel (refunded)",
        "Cancelar (sin reembolso)": "Cancel (no refund)",
        "Abrir a más jugadores": "Open to more players",
        "Cerrar a nuevos jugadores": "Close to new players",
        "Aceptar": "Accept",
        "Rechazar": "Decline",
        "No tienes reservas próximas.": "You have no upcoming bookings.",
        "Elige fecha, duración y hora para ver la disponibilidad.": "Choose date, duration and time to see availability.",

        // comunidad
        "Encuentra gente para jugar en Ceuta: únete a partidos abiertos, conoce a otros jugadores y sube de nivel.": "Find people to play with in Ceuta: join open games, meet other players and level up.",
        "🙋 Partidos abiertos": "🙋 Open games",
        "👥 Jugadores": "👥 Players",
        "🏆 Ranking": "🏆 Ranking",
        "Partidos que buscan jugadores": "Games looking for players",
        "Jugadores": "Players",
        "Buscar": "Search",
        "Deporte favorito": "Favourite sport",
        "Nombre o lo que cuenta en su perfil": "Name or anything in their profile",
        "Ranking de CeutaPlay": "CeutaPlay ranking",
        "Pedir unirme": "Ask to join",
        "Volver a pedir": "Ask again",
        "Es tu partido": "Your game",
        "✅ Estás dentro": "✅ You're in",
        "⏳ Solicitud enviada": "⏳ Request sent",
        "Completo": "Full",
        "Salir": "Leave",
        "Retirar": "Withdraw",
        "Organiza": "Organiser",
        "Tu nivel": "Your level",
        "Multideporte": "All-round",
        "Partidos": "Games",
        "Se ha unido": "Joined",
        "Subastas ganadas": "Auctions won",
        "Insignias": "Badges",
        "Próximos partidos abiertos": "Upcoming open games",
        "Editar mi perfil": "Edit my profile",
        "Novato": "Rookie",
        "Habitual": "Regular",
        "Competidor": "Competitor",
        "Veterano": "Veteran",
        "Leyenda de Ceuta": "Ceuta legend",
        "Nivel máximo": "Top level",
        "🌱 Novato": "🌱 Rookie",
        "🎾 Habitual": "🎾 Regular",
        "🔥 Competidor": "🔥 Competitor",
        "🏅 Veterano": "🏅 Veteran",
        "🏆 Leyenda de Ceuta": "🏆 Ceuta legend",
        "completo": "full",
        "Juega": "Plays",
        "Primer partido": "First game",
        "Fijo en la pista": "Court regular",
        "Buen compañero": "Good teammate",
        "Pujador": "Bidder",
        "Cazagangas": "Bargain hunter",
        "Ninguna pista vacía": "No empty courts",
        "Opinión que cuenta": "Opinion that counts",

        // perfil
        "Mi perfil": "My profile",
        "🏅 Mi nivel en la comunidad": "🏅 My community level",
        "Ver mi ficha pública": "See my public profile",
        "¿Cómo se ganan puntos?": "How do I earn points?",
        "✏️ Mi perfil público": "✏️ My public profile",
        "Nombre visible": "Display name",
        "Sobre mí": "About me",
        "Guardar cambios": "Save changes",
        "🪙 Mi monedero": "🪙 My wallet",
        "Recargar (simulado):": "Top up (simulated):",
        "Últimos movimientos": "Latest transactions",
        "Reservar pista": "Book a court",
        "Tus próximas partidas y las que ya has jugado.": "Your upcoming games and the ones you've played.",
        "Activas": "Active",
        "Anteriores": "Past",
        "Total": "Total",
        "Próxima partida": "Next game",
        "Reservas activas": "Active bookings",
        "Reservas anteriores": "Past bookings",
        "Ir a las subastas": "Go to auctions",
        "Creadas por mí": "Created by me",
        "Pujando (en curso)": "Bidding (live)",
        "Ganadas": "Won",
        "Pujas en curso": "Live bids",
        "🤝 Pista solidaria": "🤝 Solidarity court",
        "Sin partidas programadas": "No games scheduled",
        "No tienes reservas activas.": "You have no active bookings.",
        "Todavía no tienes reservas anteriores.": "You don't have past bookings yet.",
        "No estás pujando en ninguna subasta.": "You aren't bidding in any auction.",
        "Todavía no has ganado ninguna subasta.": "You haven't won any auction yet.",

        // deportes
        "Pádel": "Padel",
        "Tenis": "Tennis",
        "Fútbol": "Football",
        "Baloncesto": "Basketball",
        "Kayak": "Kayak",
        "Paddle surf": "Paddle surf",
        "Piragüismo": "Canoeing",
        "Reservar pádel": "Book padel",
        "Reservar tenis": "Book tennis",
        "Reservar fútbol": "Book football",
        "Reservar kayak": "Book kayak",
        "Reservar paddle surf": "Book paddle surf",
        "Reservar piragüismo": "Book canoeing",
        "Ver mapa": "See map",

        // mapa
        "Mapa de instalaciones": "Facilities map",
        "Ubicaciones": "Locations",

        // cómo funciona
        "GUÍA RÁPIDA": "QUICK GUIDE",
        "Cómo funciona CeutaPlay": "How CeutaPlay works",
        "Reservar una pista": "Book a court",
        "Ver subastas": "See auctions",
        "Para jugadores, en 5 pasos": "For players, in 5 steps",
        "Reserva": "Book",
        "Abre tu partido": "Open your game",
        "Aprovecha la última hora": "Grab last-minute deals",
        "¿No puedes ir? Revéndela": "Can't make it? Resell it",
        "🏛️ Instalaciones municipales": "🏛️ Municipal facilities",
        "🏅 Niveles e insignias": "🏅 Levels and badges",
        "🔔 Avisos": "🔔 Notifications",
        "🌬️ Viento para la náutica": "🌬️ Wind for water sports",
        "Para clubes e instalaciones": "For clubs and facilities",
        "Sin coste fijo": "No fixed fee",
        "Panel del gestor": "Manager panel",
        "🤝 Compromiso social": "🤝 Social commitment",
        "Pista solidaria": "Solidarity court",
        "Playas limpias": "Clean beaches",
        "Deporte base y femenino": "Grassroots and women's sport",
        "Preguntas frecuentes": "Frequently asked questions",
        "¿Las CeutaCoins son dinero real?": "Are CeutaCoins real money?",
        "¿Qué pasa si cancelo una reserva?": "What if I cancel a booking?",
        "¿Quién ve mis reservas?": "Who can see my bookings?",
        "¿Puedo revender una reserva del ICD?": "Can I resell an ICD booking?",
        "¿Puedo instalarla en el móvil?": "Can I install it on my phone?",
        "¿Hay modo oscuro y otros idiomas?": "Is there dark mode and other languages?",
    };

    // Párrafos con data-i18n="clave" (cómo funciona)
    const BLOQUES = {
        "portada-intro": "Find padel, tennis and football facilities. Check their slots and book through CeutaPlay.",
        "comunidad-ayuda": "Ask to join and the organiser decides. If you are accepted, the game appears in «My bookings». To open one of yours, tick «Open booking» when you <a href=\"reservas.html\">book</a>.",
        "cf-intro": "All the sports facilities of Ceuta in one place: private bookings, ICD municipal fields, last-minute auctions and a community to find people to play with.",
        "cf-paso1": "With your email and a password of at least 8 characters. You get <strong>1,000,000 CeutaCoins (CC)</strong> to try the platform: it is a payment simulation, 1 CC = €1.",
        "cf-paso2": "Choose the facility, day, start time (on the hour or half past) and how long you want to play: from 30 min to 3 h. Off-peak hours (Monday to Friday before 17:00) are 20% cheaper.",
        "cf-paso3": "Tick «Open booking» and other players can ask to join from the <a href=\"comunidad.html\">community</a>. You decide who to accept.",
        "cf-paso4": "Padel and tennis courts still free 12 h before go to auction automatically at <strong>half price</strong>. The auction closes 15 min before and the winner gets the booking.",
        "cf-paso5": "Auction your booking until the time it starts. You receive the final price minus CeutaPlay's fee. If you cancel more than 24 h before, you get everything back.",
        "cf-icd": "The fields and courts of the Ceuta Sports Institute can also be booked here. CeutaPlay acts as intermediary: you pay in the app and we handle the booking with the ICD. <em>In this test version the process is simulated.</em>",
        "cf-niveles": "You earn points by playing, joining other people's games, winning auctions and reviewing facilities. Go from 🌱 Rookie to 🏆 Ceuta legend and collect badges.",
        "cf-avisos": "The bell in the menu tells you when you are outbid, when someone wants to join your game, when you are accepted or when there are half-price courts for your sport.",
        "cf-viento": "Kayak, paddle surf and canoeing show the hourly wind forecast: whether the levante (east) or poniente (west) wind is blowing, which bay is better and the next good hour to go out.",
        "cf-coste": "Joining is free: we set up your schedule. CeutaPlay charges a <strong>10%</strong> fee per booking and <strong>15%</strong> per awarded auction (plus IPSI tax on that fee).",
        "cf-gestor": "You see all your bookings, block courts for maintenance or tournaments and check occupancy and your monthly payout.",
        "cf-vacia": "Last-minute cancellations go to auction and players resell what they won't use: the gaps fill themselves.",
        "cf-solidaria": "If a last-minute court gets no bids, it is given free of charge to youth associations, adapted sports clubs and accredited social organisations. Request it from <a href=\"perfil.html#pista-solidaria\">My profile</a>.",
        "cf-playas": "Litter clean-ups with the kayak and paddle surf schools (Ribera, Chorrillo, Benítez, Calamocarro). Volunteers receive free credit.",
        "cf-base": "Reduced fees for grassroots sports schools and visibility for local women's leagues.",
        "cf-faq1": "No. This version is a prototype and payment is simulated: 1 CC equals €1 so the figures are realistic. In the commercial version, the balance would be topped up with a payment gateway (card or Bizum).",
        "cf-faq2": "More than 24 h in advance, we refund all your CeutaCoins. With less notice there is no refund, but you can resell it at auction until the start time.",
        "cf-faq3": "Only you. Others see the slot as «Taken». If you open your booking to more players, your display name and your message are shown. Your email is never shown.",
        "cf-faq4": "No. Bookings at municipal facilities cannot be resold or auctioned.",
        "cf-faq5": "Yes. In Chrome or Edge press «📲 Install app» at the bottom of the page; on iPhone, in Safari, use «Share → Add to Home Screen».",
        "cf-faq6": "Yes: the 🌙 button in the menu switches between light and dark mode, and at the bottom you can choose Spanish or English.",
    };

    // Textos que llevan números
    const PATRONES = [
        [/^(\d+) instalaciones$/, "$1 facilities"],
        [/^1 instalación$/, "1 facility"],
        [/^(\d+) jugadores$/, "$1 players"],
        [/^1 jugador$/, "1 player"],
        [/^(\d+) pts$/, "$1 pts"],
        [/^Hola, (.+)$/, "Hello, $1"],
        [/^(\d+) pujas?$/, "$1 bids"],
        [/^(\d+)\/(\d+) · (\d+) plazas libres$/, "$1/$2 · $3 spots left"],
        [/^(\d+)\/(\d+) · 1 plaza libre$/, "$1/$2 · 1 spot left"],
        [/^(\d+)\/(\d+) · completo$/, "$1/$2 · full"],
        [/^(\d+) pts para (.+)$/, "$1 pts to $2"],
    ];

    const traducir = (texto) => {
        if (idioma === "es") return null;
        const limpio = texto.trim();
        if (!limpio) return null;
        if (T[limpio]) return texto.replace(limpio, T[limpio]);
        for (const [re, trad] of PATRONES) {
            if (re.test(limpio)) return texto.replace(limpio, limpio.replace(re, trad));
        }
        return null;
    };

    const SIN_TRADUCIR = "script, style, textarea, [translate=no], .admin-page, .gestor-page, .legal-page";
    const ATRIBUTOS = ["placeholder", "aria-label", "title"];

    function traducirNodo(raiz) {
        if (idioma === "es" || !raiz) return;
        if (raiz.nodeType === Node.TEXT_NODE) {
            if (raiz.parentElement?.closest(SIN_TRADUCIR)) return;
            const t = traducir(raiz.nodeValue);
            if (t !== null && t !== raiz.nodeValue) raiz.nodeValue = t;
            return;
        }
        if (raiz.nodeType !== Node.ELEMENT_NODE || raiz.closest(SIN_TRADUCIR)) return;
        const elementos = [raiz, ...raiz.querySelectorAll("*")];
        for (const el of elementos) {
            if (el.closest(SIN_TRADUCIR)) continue;
            const clave = el.dataset && el.dataset.i18n;
            if (clave && BLOQUES[clave] && !el.dataset.i18nHecho) {
                el.innerHTML = BLOQUES[clave];
                el.dataset.i18nHecho = "1";
            }
            for (const a of ATRIBUTOS) {
                const v = el.getAttribute(a);
                const t = v && traducir(v);
                if (t && t !== v) el.setAttribute(a, t);
            }
            if (el.tagName === "OPTION") {
                const t = traducir(el.textContent);
                if (t && t !== el.textContent) el.textContent = t;
            }
        }
        const recorrido = document.createTreeWalker(raiz, NodeFilter.SHOW_TEXT);
        for (let n = recorrido.nextNode(); n; n = recorrido.nextNode()) {
            if (n.parentElement?.closest(SIN_TRADUCIR)) continue;
            const t = traducir(n.nodeValue);
            if (t !== null && t !== n.nodeValue) n.nodeValue = t;
        }
    }

    function selector(contenedor) {
        if (!contenedor) return;
        contenedor.innerHTML = `<label class="lang-picker">🌐 <span class="sr-only">Idioma</span>
            <select aria-label="Idioma / Language">${Object.entries(IDIOMAS).map(([k, v]) =>
                `<option value="${k}" ${k === idioma ? "selected" : ""} lang="${k}">${v}</option>`).join("")}</select></label>`;
        contenedor.setAttribute("translate", "no");
        contenedor.querySelector("select").addEventListener("change", (e) => {
            try { localStorage.setItem(CLAVE, e.target.value); } catch { /* modo privado */ }
            location.reload();
        });
    }

    function iniciar() {
        if (idioma === "es") return;
        document.documentElement.lang = idioma;
        traducirNodo(document.body);
        document.title = traducir(document.title.split(" | ")[0]) ? `${traducir(document.title.split(" | ")[0])} | CeutaPlay` : document.title;
        new MutationObserver((cambios) => {
            for (const c of cambios) {
                if (c.type === "characterData") traducirNodo(c.target);
                else c.addedNodes.forEach(traducirNodo);
            }
        }).observe(document.body, { childList: true, subtree: true, characterData: true });
    }

    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar);
    else iniciar();

    return { idioma: () => idioma, selector, traducir: (t) => traducir(t) ?? t, IDIOMAS };
})();
