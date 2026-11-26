// Capa de datos de CeutaPlay: usuarios, sesión, subastas y reservas.
//
// Tiene dos modos:
//
//  · SERVIDOR (Supabase): si js/config.js tiene la URL y la clave del proyecto.
//    Los datos están en una base de datos en internet, así que todos los
//    dispositivos ven las mismas cuentas, subastas, pujas y reservas, y los
//    cambios llegan al momento (tiempo real). Las reglas de las pujas se
//    comprueban en el servidor (ver supabase/schema.sql).
//
//  · LOCAL: si no hay configuración. Todo se guarda en el navegador
//    (localStorage); sirve para probar la web sin servidor, pero cada
//    dispositivo tiene sus propios datos.
//
// El resto de la web solo habla con el objeto `Store`, que funciona igual en
// los dos modos:
//   - Las lecturas (usuarioActual, listarSubastas, misReservas…) son inmediatas.
//   - Las escrituras (login, pujar, crearSubasta, reservar…) devuelven una promesa.
//   - Cuando cambian los datos se lanza el evento "datos-cambiados" en document,
//     y cuando cambia la sesión desde fuera (otra pestaña), "sesion-cambiada".

// Fecha en formato AAAA-MM-DD (hora local). La usan varias páginas.
function fechaISO(fecha) {
    const y = fecha.getFullYear();
    const m = String(fecha.getMonth() + 1).padStart(2, "0");
    const d = String(fecha.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
}

const Store = (() => {

    const MINUTO = 60 * 1000;
    const CUENTA_SUSPENDIDA = "Tu cuenta está suspendida. Escribe a CeutaPlay si crees que es un error.";
    // CONFIG_SUPABASE viene de js/config.js; window.supabase, de la librería de Supabase
    const config = typeof CONFIG_SUPABASE !== "undefined" ? CONFIG_SUPABASE : {};
    const hayConfig = Boolean(config.url && config.anonKey);
    const modo = hayConfig && window.supabase ? "remoto" : "local";
    if (hayConfig && !window.supabase) {
        console.warn("No se ha podido cargar la librería de Supabase: se usa el modo local.");
    }

    // ---------- utilidades comunes ----------

    function avisar(evento) {
        document.dispatchEvent(new CustomEvent(evento));
    }

    function normalizarEmail(email) {
        return String(email || "").trim().toLowerCase();
    }

    // ---------- moderación de nombres ----------
    // La misma lógica está en SQL (supabase/admin.sql → motivo_nombre_no_permitido)
    // para que el servidor también lo compruebe.

    const LEET = { 0: "o", 1: "i", 3: "e", 4: "a", 5: "s", 7: "t", "@": "a", "$": "s" };

    // minúsculas, sin tildes y deshaciendo trucos como "1d10t4" → "idiota"
    function normalizarNombre(texto) {
        return String(texto || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
            .replace(/[013457@$]/g, (c) => LEET[c]);
    }

    const colapsar = (t) => t.replace(/(.)\1+/g, "$1"); // "puuuta" → "puta"

    function terminoEnNombre(nombre, { termino, modo }) {
        const t = normalizarNombre(termino).replace(/[^a-z0-9]/g, "");
        if (!t) return false;
        const palabras = normalizarNombre(nombre).split(/[^a-z0-9]+/).filter(Boolean);
        const junto = palabras.join("");           // "i.d.i.o.t.a" → "idiota"
        const tc = colapsar(t);
        const conColapso = tc.length >= 4;         // evita que "kkk" → "k" lo bloquee todo
        if (modo === "palabra") {
            return palabras.includes(t) || junto === t ||
                (conColapso && (colapsar(junto) === tc || palabras.some((p) => colapsar(p) === tc)));
        }
        return junto.includes(t) || (conColapso && colapsar(junto).includes(tc));
    }

    // Devuelve el motivo por el que un nombre no se permite, o null si es válido
    function motivoNombre(nombre, lista = NOMBRES_PROHIBIDOS_BASE) {
        const n = String(nombre || "").trim();
        if (n.length < 2) return "El nombre debe tener al menos 2 caracteres.";
        if (n.length > 40) return "El nombre no puede tener más de 40 caracteres.";
        if (/@|https?:|www\.|\.(com|es|net|org|io)\b/i.test(n)) return "No se permiten correos ni enlaces en el nombre.";
        if (!/^[\p{L}\p{M}\p{N} ._'-]+$/u.test(n)) return "El nombre solo puede tener letras, números, espacios y los signos . _ - '";
        if ((n.match(/\p{L}/gu) || []).length < 2) return "El nombre debe tener al menos 2 letras.";
        if (/(.)\1{3,}/u.test(n)) return "El nombre tiene demasiados caracteres repetidos seguidos.";
        if (lista.some((e) => terminoEnNombre(n, e))) return "Ese nombre no está permitido en CeutaPlay. Elige otro, por favor.";
        return null;
    }

    // Para comentarios: se mira palabra a palabra (no el texto junto)
    function textoConTerminoProhibido(texto, lista) {
        const palabras = normalizarNombre(texto).split(/[^a-z0-9]+/).filter(Boolean);
        return lista.some(({ termino, modo }) => {
            const t = normalizarNombre(termino).replace(/[^a-z0-9]/g, "");
            return t && palabras.some((p) => (modo === "palabra" ? p === t : p.includes(t)));
        });
    }

    function validarNombre(nombre, lista) {
        const motivo = motivoNombre(nombre, lista);
        if (motivo) throw new Error(motivo);
        return String(nombre).trim();
    }

    function validarTermino(termino, modo) {
        const t = String(termino || "").trim().toLowerCase();
        if (normalizarNombre(t).replace(/[^a-z0-9]/g, "").length < 3) {
            throw new Error("El término debe tener al menos 3 letras o números.");
        }
        if (t.length > 40) throw new Error("El término no puede tener más de 40 caracteres.");
        return { termino: t, modo: modo === "palabra" ? "palabra" : "contiene" };
    }

    function validarAjustes(a) {
        const pct = (v, nombre) => {
            const n = Number(v);
            if (!(n >= 0 && n <= 100)) throw new Error(`${nombre}: indica un porcentaje entre 0 y 100.`);
            return Math.round(n * 100) / 100;
        };
        const bonificadas = {};
        for (const [id, v] of Object.entries(a.bonificadas || {})) {
            if (INSTALACIONES.some((i) => i.id === Number(id))) bonificadas[id] = pct(v, "Comisión bonificada");
        }
        return {
            comisionReservas: pct(a.comisionReservas, "Comisión de reservas"),
            comisionSubastas: pct(a.comisionSubastas, "Comisión de subastas"),
            ipsi: pct(a.ipsi, "IPSI"),
            bonificadas,
        };
    }

    // Contraseña: al menos 8 caracteres, con letras y números
    function validarPassword(password) {
        const p = String(password || "");
        if (p.length < 8) throw new Error("La contraseña debe tener al menos 8 caracteres.");
        if (!/[A-Za-zÀ-ÿ]/.test(p) || !/\d/.test(p)) throw new Error("La contraseña debe tener letras y números.");
        if (/^(.)\1+$/.test(p) || /^(12345678|password|contraseña)/i.test(p)) throw new Error("Esa contraseña es demasiado fácil.");
    }

    // ---------- reservas por tramos ----------

    const solapan = (a, b) => a.facility === b.facility && a.court === b.court && a.date === b.date &&
        aMinutos(a.time) < aMinutos(b.time) + (b.duracion || 60) && aMinutos(b.time) < aMinutos(a.time) + (a.duracion || 60);

    function validarReserva({ facility, court, date, time, duracion = 60 }, ahoraMs) {
        const instalacion = INSTALACIONES.find((i) => i.id === Number(facility));
        if (!instalacion || !instalacion.pistas || !instalacion.pistas.includes(court)) throw new Error("Elige una pista.");
        if (esInstalacionIcd(instalacion)) throw new Error("Esta instalación es pública: se reserva en el Instituto Ceutí de Deportes.");
        duracion = Number(duracion);
        if (!duracionesPosibles().includes(duracion)) throw new Error("La duración tiene que ser de 30 min a 3 h, en tramos de 30 min.");
        if (!/^\d{2}:\d{2}$/.test(time || "") || aMinutos(time) % TURNOS.tramoMin) throw new Error("Las reservas empiezan a en punto o a y media.");
        const { apertura, cierre } = horarioDe(instalacion);
        if (aMinutos(time) < apertura || aMinutos(time) + duracion > cierre) {
            throw new Error(`Fuera del horario de la instalación (${aHora(apertura)} a ${aHora(cierre)}).`);
        }
        if (msMadrid(date, time) <= ahoraMs) throw new Error("Elige un turno futuro.");
        return { instalacion, facility: instalacion.id, court, date, time, duracion, importe: precioTurno(instalacion, date, time, duracion) };
    }

    // ---------- comunidad: puntos y niveles (gamificación) ----------

    const NIVELES = [
        { min: 0, nombre: "Novato", icono: "🌱" },
        { min: 30, nombre: "Habitual", icono: "🎾" },
        { min: 80, nombre: "Competidor", icono: "🔥" },
        { min: 160, nombre: "Veterano", icono: "🏅" },
        { min: 300, nombre: "Leyenda de Ceuta", icono: "🏆" },
    ];

    function nivelDe(puntos) {
        const actual = [...NIVELES].reverse().find((n) => puntos >= n.min);
        const siguiente = NIVELES.find((n) => n.min > puntos) || null;
        return { ...actual, puntos, siguiente, faltan: siguiente ? siguiente.min - puntos : 0 };
    }

    function validarRegistro({ nombre, email, password }, lista) {
        nombre = validarNombre(nombre, lista);
        email = normalizarEmail(email);
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("El correo no es válido.");
        validarPassword(password);
        return { nombre, email, password };
    }

    function validarSubasta(datos) {
        const instalacion = INSTALACIONES.find((i) => i.id === Number(datos.instalacionId));
        const precioSalida = Number(datos.precioSalida);
        const incremento = Number(datos.incremento);
        const duracionMin = Number(datos.duracionMin);

        if (!instalacion) throw new Error("Elige una instalación.");
        if (instalacion.subastable === false) throw new Error("Esta actividad no admite subastas.");
        if (!datos.fecha || !datos.hora) throw new Error("Indica la fecha y la hora del partido.");
        if (!(precioSalida >= 1)) throw new Error("El precio de salida debe ser de al menos 1 €.");
        if (!(incremento >= 1)) throw new Error("El incremento mínimo debe ser de al menos 1 €.");
        if (!(duracionMin >= 1)) throw new Error("Elige la duración de la subasta.");

        return {
            instalacion,
            fecha: datos.fecha,
            hora: datos.hora,
            precioSalida: Math.round(precioSalida),
            incremento: Math.round(incremento),
            duracionMin: Math.round(duracionMin),
            descripcion: String(datos.descripcion || "").trim().slice(0, 200),
        };
    }

    function validarOpinion({ instalacionId, puntuacion, comentario }) {
        if (!INSTALACIONES.some((i) => i.id === instalacionId && i.pistas)) throw new Error("Elige una instalación.");
        if (!Number.isInteger(puntuacion) || puntuacion < 1 || puntuacion > 5) throw new Error("Elige de 1 a 5 estrellas.");
        const texto = typeof comentario === "string" ? comentario.trim() : "";
        if (!texto || texto.length > 500) throw new Error("Escribe un comentario de entre 1 y 500 caracteres.");
        return { instalacionId, puntuacion, comentario: texto };
    }

    function validarReventa(datos) {
        const precioSalida = Number(datos.precioSalida);
        const incremento = Number(datos.incremento);
        const duracionMin = Number(datos.duracionMin);
        // "inicio" (o 0): la subasta dura hasta que empieza la reserva
        const hastaInicio = datos.duracionMin === "inicio" || duracionMin === 0;
        if (!datos.reservaId) throw new Error("Elige la reserva que quieres subastar.");
        if (!(precioSalida >= 1)) throw new Error("El precio de salida debe ser de al menos 1 CC.");
        if (!(incremento >= 1)) throw new Error("El incremento mínimo debe ser de al menos 1 CC.");
        if (!hastaInicio && !(duracionMin >= 1)) throw new Error("Elige la duración de la subasta.");
        return {
            hastaInicio,
            reservaId: datos.reservaId,
            precioSalida: Math.round(precioSalida),
            incremento: Math.round(incremento),
            duracionMin: Math.round(duracionMin),
            descripcion: String(datos.descripcion || "").trim().slice(0, 200),
        };
    }

    const redondear = (n) => Math.round(n * 100) / 100;

    // Lo que recibe quien revende su reserva: precio − comisión − IPSI de la comisión
    function reparto(precio, comisionPct, ipsiPct) {
        const comision = redondear(precio * comisionPct / 100);
        const ipsi = redondear(comision * ipsiPct / 100);
        return { comision, ipsi, neto: redondear(precio - comision - ipsi) };
    }

    // ---------- hora de Ceuta (Europe/Madrid) ----------

    const formatoMadrid = new Intl.DateTimeFormat("sv-SE", {
        timeZone: "Europe/Madrid", year: "numeric", month: "2-digit", day: "2-digit",
        hour: "2-digit", minute: "2-digit", hourCycle: "h23",
    });
    const textoMadrid = (ms) => formatoMadrid.format(new Date(ms)); // "AAAA-MM-DD HH:MM"

    // Milisegundos de una fecha y hora de Ceuta (sea cual sea la zona del dispositivo)
    function msMadrid(fecha, hora) {
        const supuesto = Date.parse(`${fecha}T${hora}:00Z`);
        const visto = Date.parse(`${textoMadrid(supuesto).replace(" ", "T")}:00Z`);
        return supuesto - (visto - supuesto);
    }

    // ---------- subastas automáticas de última hora ----------
    // Una pista libre de una instalación con reserva directa sale sola a
    // subasta cuando faltan SUBASTA_AUTOMATICA.horasAntes horas. Mientras nadie
    // puja, la subasta no existe en la base de datos: se calcula aquí igual en
    // todos los dispositivos. Con la primera puja se crea de verdad.

    const tieneSubastaAutomatica = (i) => esReservable(i) && i.subastable !== false &&
        (i.subastaAutomatica ?? SUBASTA_AUTOMATICA.deportes.includes(i.deporte));

    // Mitad del precio de 1 h en esa franja (hora valle o punta)
    const precioSalidaAutomatica = (i, fecha, hora) =>
        Math.max(1, Math.ceil(precioTurno(i, fecha, hora, 60) * SUBASTA_AUTOMATICA.descuentoSalida));

    const claveTurno = (instalacionId, pista, fecha, hora) => `${instalacionId}|${pista}|${fecha}|${hora}`;

    function calcularHuecos(ahora, ocupados, subastas) {
        const ventana = SUBASTA_AUTOMATICA.horasAntes * 60 * MINUTO;
        const cierre = SUBASTA_AUTOMATICA.cierreMinAntes * MINUTO;
        const autos = new Set(subastas.filter((sub) => sub.tipo === "automatica" && !sub.cancelada)
            .map((sub) => claveTurno(Number(sub.instalacionId), sub.pista, sub.fecha, sub.hora)));
        const libre = (inst, pista, fecha, hora) => !autos.has(claveTurno(inst.id, pista, fecha, hora)) &&
            !ocupados.some((r) => solapan(r, { facility: inst.id, court: pista, date: fecha, time: hora, duracion: 60 }));
        const dias = [textoMadrid(ahora).slice(0, 10), textoMadrid(ahora + 24 * 60 * MINUTO).slice(0, 10)];
        const huecos = [];
        for (const inst of INSTALACIONES.filter(tieneSubastaAutomatica)) {
            for (const fecha of dias) {
                const horario = horarioDe(inst);
                for (let m = horario.apertura; m + 60 <= horario.cierre; m += 60) {
                    const hora = aHora(m);
                    const inicio = msMadrid(fecha, hora);
                    const fin = inicio - cierre;
                    if (ahora < inicio - ventana || ahora >= fin) continue;
                    const libres = inst.pistas.filter((p) => libre(inst, p, fecha, hora));
                    if (!libres.length) continue;
                    huecos.push({
                        id: `auto|${inst.id}|${fecha}|${hora}`, virtual: true, tipo: "automatica",
                        instalacionId: inst.id, titulo: inst.nombre, deporte: inst.deporte, fecha, hora,
                        pista: null, pistasLibres: libres, descripcion: "",
                        precioSalida: precioSalidaAutomatica(inst, fecha, hora), incremento: 1,
                        fin, creada: inicio - ventana, vendedorId: null, cancelada: false, cerrada: false, pujas: [],
                    });
                }
            }
        }
        return huecos;
    }

    // Añade a una subasta los campos calculados (estado, puja actual, ganador…)
    function enriquecer(subasta, ahora, getUsuario) {
        const pujas = subasta.pujas.map((p) => ({ ...p, id: String(p.id ?? `${p.fecha}-${p.usuarioId}`) })).sort((a, b) => b.cantidad - a.cantidad || a.fecha - b.fecha);
        const mejor = pujas[0] || null;

        let estado = "activa";
        if (subasta.cancelada) estado = "cancelada";
        else if (ahora >= subasta.fin) estado = "finalizada";

        const precioActual = mejor ? mejor.cantidad : subasta.precioSalida;
        const comisionPct = subasta.comisionPct ?? FACTURACION_DEFECTO.comisionSubastas;
        const ipsiPct = subasta.ipsiPct ?? FACTURACION_DEFECTO.ipsi;

        return {
            ...subasta,
            tipo: subasta.tipo || "libre",
            pujas,
            estado,
            comisionPct,
            ipsiPct,
            reparto: reparto(precioActual, comisionPct, ipsiPct),
            precioActual,
            pujaMinima: mejor ? mejor.cantidad + subasta.incremento : subasta.precioSalida,
            mejorPuja: mejor,
            ganador: estado === "finalizada" && mejor
                ? getUsuario(mejor.usuarioId) || { id: mejor.usuarioId, nombre: "Usuario" }
                : null,
            vendedor: getUsuario(subasta.vendedorId),
            restanteMs: Math.max(0, subasta.fin - ahora),
        };
    }


    // =====================================================================
    // MODO SERVIDOR (Supabase)
    // =====================================================================

    function crearBackendRemoto() {

        // "Recordarme": la sesión se guarda en localStorage (se mantiene al
        // cerrar el navegador) o en sessionStorage (solo dura la pestaña).
        // Así también se puede tener un usuario distinto en cada pestaña.
        const RECORDAR = "cp_recordar";
        const almacenSesion = {
            getItem: (k) => sessionStorage.getItem(k) ?? localStorage.getItem(k),
            setItem: (k, v) => {
                const recordar = sessionStorage.getItem(RECORDAR);
                const usarLocal = recordar === "1" ||
                    (recordar === null && sessionStorage.getItem(k) === null && localStorage.getItem(k) !== null);
                if (usarLocal) {
                    localStorage.setItem(k, v);
                    sessionStorage.removeItem(k);
                } else {
                    sessionStorage.setItem(k, v);
                }
            },
            removeItem: (k) => {
                if (sessionStorage.getItem(k) !== null) sessionStorage.removeItem(k);
                else localStorage.removeItem(k);
            },
        };

        const client = window.supabase.createClient(config.url, config.anonKey, {
            auth: {
                storage: almacenSesion,
                storageKey: "cp-auth",
                persistSession: true,
                autoRefreshToken: true,
                detectSessionInUrl: false,
            },
        });

        let desfase = 0; // diferencia entre el reloj del servidor y el del dispositivo
        let sesion = null;
        let nombresEnAgenda = false;
        let tarifas = { comisionSubastas: FACTURACION_DEFECTO.comisionSubastas, ipsi: FACTURACION_DEFECTO.ipsi };
        // turnos ocupados de todo el mundo, sin datos personales
        let ocupados = [];
        let plataforma = true; // false si aún no se ha ejecutado supabase/plataforma.sql
        const datos = {
            perfiles: new Map(), subastas: [], pujas: [], reservas: [],
            participantes: [], movimientos: [], gestiona: [], entidad: null, peticiones: [],
        };

        const ahora = () => Date.now() + desfase;

        function traducirError(error) {
            const msg = (error && error.message) || String(error);
            if (error && error.code === "23505") return "Esa pista ya está reservada por otro usuario en ese turno.";
            if (/Invalid login credentials/i.test(msg)) return "Correo o contraseña incorrectos.";
            if (/already registered|already been registered/i.test(msg)) return "Ya existe una cuenta con ese correo.";
            if (/Email not confirmed/i.test(msg)) return "Tienes que confirmar tu correo antes de entrar (revisa tu bandeja de entrada).";
            if (/row-level security/i.test(msg)) return "No tienes permiso para hacer eso (¿has iniciado sesión? ¿el turno ya ha pasado?).";
            if (/rate limit/i.test(msg)) return "Demasiados intentos seguidos. Espera un momento y vuelve a probar.";
            if (/Failed to fetch|NetworkError|fetch failed/i.test(msg)) return "No se puede conectar con el servidor. Revisa tu conexión.";
            return msg;
        }

        function comprobar({ data, error }) {
            if (error) throw new Error(traducirError(error));
            return data;
        }

        // ---------- carga de datos ----------

        const cargadores = {
            async perfiles() {
                let r = await client.from("perfiles").select("id, nombre, creado, bio, deporte_favorito");
                if (r.error) r = await client.from("perfiles").select("id, nombre, creado");
                datos.perfiles = new Map(comprobar(r).map((p) => [p.id, {
                    id: p.id, nombre: p.nombre, creado: Date.parse(p.creado) || null,
                    bio: p.bio || "", deporteFavorito: p.deporte_favorito || "",
                }]));
            },
            async subastas() {
                const filas = comprobar(await client.from("subastas").select("*"));
                datos.subastas = filas.map((s) => ({
                    id: s.id,
                    instalacionId: s.instalacion_id,
                    titulo: s.titulo,
                    deporte: s.deporte,
                    fecha: s.fecha,
                    hora: s.hora,
                    descripcion: s.descripcion,
                    precioSalida: s.precio_salida,
                    incremento: s.incremento,
                    fin: Date.parse(s.fin),
                    vendedorId: s.vendedor_id,
                    cancelada: s.cancelada,
                    creada: Date.parse(s.creada),
                    // columnas de supabase/subastas.sql (si no se ha ejecutado, valores por defecto)
                    tipo: s.tipo || "libre",
                    pista: s.pista || null,
                    reservaId: s.reserva_id || null,
                    comisionPct: s.comision_pct != null ? Number(s.comision_pct) : null,
                    ipsiPct: s.ipsi_pct != null ? Number(s.ipsi_pct) : null,
                    cerrada: s.cerrada === true,
                }));
            },
            async pujas() {
                const filas = comprobar(await client.from("pujas").select("id, subasta_id, usuario_id, cantidad, fecha"));
                datos.pujas = filas.map((p) => ({
                    id: p.id,
                    subastaId: p.subasta_id,
                    usuarioId: p.usuario_id,
                    cantidad: p.cantidad,
                    fecha: Date.parse(p.fecha),
                }));
            },
            async reservas() {
                // Turnos ocupados (anónimos): para la disponibilidad de todos
                const t = await client.rpc("turnos_ocupados", {});
                ocupados = t.error ? [] : t.data.map((o) => ({
                    id: o.id, facility: o.instalacion_id, court: o.pista, date: o.fecha, time: o.hora,
                    duracion: o.duracion_min || 60, tipo: o.tipo || "normal", anonima: true,
                }));
                if (!sesion) {
                    datos.reservas = [];
                    return;
                }
                const campos = "id, usuario_id, instalacion_id, pista, fecha, hora, creada, mostrar_nombre";
                let resultado = await client.from("reservas")
                    .select(`${campos}, duracion_min, importe, publica, plazas, tipo, nota`);
                plataforma = !resultado.error;
                if (resultado.error) resultado = await client.from("reservas").select(campos);
                nombresEnAgenda = true;
                datos.reservas = comprobar(resultado).map((r) => ({
                    id: r.id,
                    userId: r.usuario_id,
                    facility: r.instalacion_id,
                    court: r.pista,
                    date: r.fecha,
                    time: r.hora,
                    duracion: r.duracion_min || 60,
                    importe: r.importe != null ? Number(r.importe) : null,
                    publica: r.publica === true,
                    plazas: r.plazas || 4,
                    tipo: r.tipo || "normal",
                    nota: r.nota || "",
                    creada: Date.parse(r.creada) || null,
                    mostrarNombre: r.mostrar_nombre === true || r.publica === true,
                }));
            },
            async participantes() {
                if (!sesion || !plataforma) { datos.participantes = []; return; }
                const r = await client.from("participantes").select("reserva_id, usuario_id, estado, mensaje, creado");
                datos.participantes = r.error ? [] : r.data.map((x) => ({
                    reservaId: x.reserva_id, usuarioId: x.usuario_id, estado: x.estado,
                    mensaje: x.mensaje || "", creado: Date.parse(x.creado),
                }));
            },
            async movimientos() {
                if (!sesion || !plataforma) { datos.movimientos = []; return; }
                const r = await client.from("movimientos").select("id, importe, tipo, concepto, referencia, creado")
                    .eq("usuario_id", sesion.id).order("creado", { ascending: false });
                datos.movimientos = r.error ? [] : r.data.map((m) => ({
                    id: m.id, importe: Number(m.importe), tipo: m.tipo, concepto: m.concepto,
                    referencia: m.referencia, creado: Date.parse(m.creado),
                }));
            },
            async gestores() {
                if (!sesion || !plataforma) { datos.gestiona = []; return; }
                const r = await client.from("gestores").select("instalacion_id").eq("usuario_id", sesion.id);
                datos.gestiona = r.error ? [] : r.data.map((g) => g.instalacion_id);
            },
            async peticiones_solidarias() {
                if (!sesion || !plataforma) { datos.entidad = null; datos.peticiones = []; return; }
                const [e, pt] = await Promise.all([
                    client.from("entidades_solidarias").select("nombre, descripcion, acreditada").eq("usuario_id", sesion.id).maybeSingle(),
                    client.from("peticiones_solidarias").select("*").eq("entidad_id", sesion.id).order("fecha", { ascending: false }),
                ]);
                datos.entidad = e.error || !e.data ? null : e.data;
                datos.peticiones = pt.error ? [] : pt.data.map((x) => ({
                    id: x.id, deporte: x.deporte, instalacionId: x.instalacion_id, fecha: x.fecha,
                    desde: x.desde, hasta: x.hasta, estado: x.estado, reservaId: x.reserva_id,
                }));
            },
        };

        async function recargar(...tablas) {
            if (!tablas.length) tablas = Object.keys(cargadores);
            try {
                await Promise.all(tablas.map((t) => cargadores[t]()));
                // Si aparece un usuario que aún no conocemos (p. ej. alguien que se
                // acaba de registrar en otro dispositivo), se recargan los perfiles
                const desconocido = (id) => id && !datos.perfiles.has(id);
                if (!tablas.includes("perfiles") &&
                    (datos.pujas.some((p) => desconocido(p.usuarioId)) ||
                     datos.subastas.some((s) => desconocido(s.vendedorId)) ||
                     datos.participantes.some((x) => desconocido(x.usuarioId)) ||
                     datos.reservas.some((r) => desconocido(r.userId)))) {
                    await cargadores.perfiles();
                }
            } catch (error) {
                console.error("Error al cargar datos del servidor:", error);
            }
            avisar("datos-cambiados");
        }

        // Agrupa varios cambios seguidos de la misma tabla en una sola recarga
        const pendientes = new Set();
        let temporizador = null;
        function programarRecarga(tabla) {
            pendientes.add(tabla);
            clearTimeout(temporizador);
            temporizador = setTimeout(() => {
                const tablas = [...pendientes];
                pendientes.clear();
                recargar(...tablas);
            }, 150);
        }

        async function leerSesion() {
            const { data } = await client.auth.getSession();
            const usuario = data.session && data.session.user;
            if (!usuario) {
                sesion = null;
                return;
            }
            let nombre = usuario.user_metadata && usuario.user_metadata.nombre;
            // es_admin solo existe si se ha ejecutado supabase/admin.sql
            let perfil = await client.from("perfiles").select("nombre, es_admin").eq("id", usuario.id).maybeSingle();
            if (perfil.error) {
                perfil = await client.from("perfiles").select("nombre").eq("id", usuario.id).maybeSingle();
            }
            if (perfil.data) nombre = perfil.data.nombre;
            // moderacion_usuarios solo existe si se ha ejecutado supabase/admin.sql
            const moderacion = await client.from("moderacion_usuarios")
                .select("bloqueado").eq("usuario_id", usuario.id).maybeSingle();
            sesion = {
                id: usuario.id,
                email: usuario.email,
                nombre: nombre || usuario.email.split("@")[0],
                admin: Boolean(perfil.data && perfil.data.es_admin),
                bloqueado: Boolean(!moderacion.error && moderacion.data && moderacion.data.bloqueado),
            };
        }

        // Lista de nombres prohibidos que conoce este navegador (la del
        // servidor solo la puede leer un administrador)
        let listaProhibidos = NOMBRES_PROHIBIDOS_BASE;

        // ¿Existe la función/tabla? (si no se ha ejecutado admin.sql, no)
        const noExiste = (error) => ["PGRST202", "PGRST205", "42P01", "42883"].includes(error && error.code);

        async function inicializar() {
            const [hora] = await Promise.all([
                client.rpc("hora_servidor").then((r) => r, () => ({})),
                leerSesion().catch(() => (sesion = null)),
            ]);
            if (hora && hora.data) desfase = Date.parse(hora.data) - Date.now();
            // La disponibilidad de los demás no llega en tiempo real (privacidad):
            // se refresca cada minuto
            setInterval(() => document.visibilityState === "visible" && recargar("reservas"), 60000);
            const t = await client.rpc("tarifas_subastas");
            if (!t.error && t.data) tarifas = { ...tarifas, ...t.data };

            await recargar();

            // Tiempo real: cualquier cambio en el servidor recarga esa tabla
            const canal = client.channel("ceutaplay");
            for (const tabla of Object.keys(cargadores)) {
                canal.on("postgres_changes", { event: "*", schema: "public", table: tabla },
                    () => programarRecarga(tabla));
            }
            canal.subscribe();

            // Al volver a la pestaña, por si se ha perdido algún cambio
            document.addEventListener("visibilitychange", () => {
                if (document.visibilityState === "visible") recargar();
            });

            // Cambios de sesión (caducidad, cierre en otra pestaña…). Se vuelve a
            // leer la sesión de ESTA pestaña (no la que anuncie otra pestaña).
            client.auth.onAuthStateChange(() => {
                setTimeout(async () => {
                    const antes = sesion && sesion.id;
                    await leerSesion().catch(() => (sesion = null));
                    if ((sesion && sesion.id) !== antes) {
                        avisar("sesion-cambiada");
                        recargar("reservas", "participantes", "movimientos", "gestores", "peticiones_solidarias");
                    }
                }, 0);
            });
        }

        // ---------- cuentas ----------

        async function registrar(datosRegistro) {
            const { nombre, email, password } = validarRegistro(datosRegistro, listaProhibidos);
            // El servidor tiene la lista actualizada por el administrador
            const control = await client.rpc("comprobar_nombre", { p_nombre: nombre });
            if (!control.error && control.data) throw new Error(control.data);
            if (control.error && !noExiste(control.error)) throw new Error(traducirError(control.error));
            sessionStorage.setItem(RECORDAR, "0");
            const resultado = comprobar(await client.auth.signUp({
                email,
                password,
                options: { data: { nombre } },
            }));
            if (!resultado.session) {
                throw new Error("Cuenta creada. Revisa tu correo para confirmarla y después inicia sesión.");
            }
            await leerSesion();
            await recargar();
            return sesion;
        }

        async function login(email, password, recordar) {
            sessionStorage.setItem(RECORDAR, recordar ? "1" : "0");
            comprobar(await client.auth.signInWithPassword({ email: normalizarEmail(email), password }));
            await leerSesion();
            await recargar();
            return sesion;
        }

        async function cerrarSesion() {
            sesion = null;
            Object.assign(datos, { reservas: [], participantes: [], movimientos: [], gestiona: [], entidad: null, peticiones: [] });
            await client.auth.signOut({ scope: "local" }).catch(() => {});
            sessionStorage.removeItem(RECORDAR);
        }

        const usuarioActual = () => sesion;
        const getUsuario = (id) => datos.perfiles.get(id) || null;

        // ---------- subastas ----------

        function listarSubastas() {
            const t = ahora();
            return datos.subastas.map((s) => enriquecer(
                { ...s, pujas: datos.pujas.filter((p) => p.subastaId === s.id) }, t, getUsuario));
        }

        const getSubasta = (id) => listarSubastas().find((s) => s.id === id) || null;

        function exigirSesion() {
            if (!sesion) throw new Error("Tienes que iniciar sesión.");
        }

        function exigirActivo() {
            exigirSesion();
            if (sesion.bloqueado) throw new Error(CUENTA_SUSPENDIDA);
        }

        async function crearSubasta(datosSubasta) {
            exigirActivo();
            const v = validarSubasta(datosSubasta);
            const id = comprobar(await client.rpc("crear_subasta", {
                p_instalacion_id: v.instalacion.id,
                p_titulo: v.instalacion.nombre,
                p_deporte: v.instalacion.deporte,
                p_fecha: v.fecha,
                p_hora: v.hora,
                p_precio_salida: v.precioSalida,
                p_incremento: v.incremento,
                p_duracion_min: v.duracionMin,
                p_descripcion: v.descripcion,
            }));
            await recargar("subastas");
            return getSubasta(id);
        }

        async function pujar(subastaId, cantidad) {
            exigirActivo();
            cantidad = Number(cantidad);
            if (!Number.isInteger(cantidad)) throw new Error("La puja tiene que ser un número entero de CeutaCoins.");
            try {
                comprobar(await client.rpc("pujar", { p_subasta: subastaId, p_cantidad: cantidad }));
            } finally {
                await recargar("pujas", "subastas");
            }
            return getSubasta(subastaId);
        }

        async function cancelarSubasta(subastaId) {
            exigirSesion();
            comprobar(await client.rpc("cancelar_subasta", { p_subasta: subastaId }));
            await recargar("subastas");
        }

        const faltaSubastasSql = () =>
            new Error("Falta actualizar el servidor: ejecuta supabase/plataforma.sql en el SQL Editor de Supabase.");

        // Llamada a una función de plataforma.sql con mensaje claro si falta
        async function rpcPlataforma(funcion, parametros, ...recargas) {
            const resultado = await client.rpc(funcion, parametros);
            if (noExiste(resultado.error)) throw faltaSubastasSql();
            const valor = comprobar(resultado);
            if (recargas.length) await recargar(...recargas);
            return valor;
        }

        async function crearSubastaReventa(datosReventa) {
            exigirActivo();
            const v = validarReventa(datosReventa);
            const resultado = await client.rpc("crear_subasta_reventa", {
                p_reserva: v.reservaId, p_precio_salida: v.precioSalida, p_incremento: v.incremento,
                p_duracion_min: v.hastaInicio ? 0 : v.duracionMin, p_descripcion: v.descripcion,
            });
            if (noExiste(resultado.error)) throw faltaSubastasSql();
            const id = comprobar(resultado);
            await recargar("subastas");
            return getSubasta(id);
        }

        async function pujarHueco(instalacionId, fecha, hora, cantidad) {
            exigirActivo();
            cantidad = Number(cantidad);
            if (!Number.isInteger(cantidad)) throw new Error("La puja tiene que ser un número entero de CeutaCoins.");
            const resultado = await client.rpc("pujar_hueco", {
                p_instalacion: instalacionId, p_fecha: fecha, p_hora: hora, p_cantidad: cantidad,
            });
            if (noExiste(resultado.error)) throw faltaSubastasSql();
            const id = comprobar(resultado);
            await recargar("subastas", "pujas", "reservas");
            return id;
        }

        let sinCierre = false; // si el servidor no tiene cerrar_subastas, no se insiste
        async function cerrarSubastas() {
            if (sinCierre) return 0;
            const resultado = await client.rpc("cerrar_subastas");
            if (resultado.error) {
                if (noExiste(resultado.error)) sinCierre = true;
                return 0;
            }
            if (resultado.data > 0) await recargar("subastas", "reservas", "movimientos", "peticiones_solidarias");
            return resultado.data;
        }

        // ---------- reservas ----------

        const misReservas = () => (sesion ? datos.reservas.filter((r) => r.userId === sesion.id) : []);

        // Todas las reservas (las visibles con datos y el resto como turno ocupado)
        function turnosOcupados() {
            const vistas = new Set(datos.reservas.map((r) => r.id));
            return [...datos.reservas, ...ocupados.filter((o) => !vistas.has(o.id))];
        }

        const pistaOcupada = (facility, court, date, time, duracion = 60) =>
            turnosOcupados().some((r) => solapan(r, { facility, court, date, time, duracion }));

        async function reservar(datosReserva) {
            exigirActivo();
            const v = validarReserva(datosReserva, ahora());
            const publica = Boolean(datosReserva.publica ?? datosReserva.mostrarNombre);
            const id = await rpcPlataforma("reservar_pista", {
                p_instalacion: v.facility, p_pista: v.court, p_fecha: v.date, p_hora: v.time,
                p_duracion: v.duracion, p_publica: publica, p_plazas: Number(datosReserva.plazas) || 4,
                p_nota: String(datosReserva.nota || "").slice(0, 140),
            }, "reservas", "movimientos");
            return id;
        }

        async function cancelarReserva(id) {
            exigirSesion();
            const devuelto = await rpcPlataforma("cancelar_reserva", { p_reserva: id }, "reservas", "movimientos", "participantes");
            return Number(devuelto) || 0;
        }

        async function configurarReserva(id, { publica, plazas, nota }) {
            exigirActivo();
            await rpcPlataforma("configurar_reserva", {
                p_reserva: id, p_publica: Boolean(publica), p_plazas: Number(plazas) || 4, p_nota: String(nota || "").slice(0, 140),
            }, "reservas");
        }

        // ---------- comunidad ----------

        async function solicitarUnirse(reservaId, mensaje = "") {
            exigirActivo();
            await rpcPlataforma("solicitar_unirse", { p_reserva: reservaId, p_mensaje: String(mensaje).slice(0, 140) }, "participantes");
        }

        async function responderSolicitud(reservaId, usuarioId, aceptar) {
            exigirActivo();
            await rpcPlataforma("responder_solicitud", { p_reserva: reservaId, p_usuario: usuarioId, p_aceptar: Boolean(aceptar) }, "participantes");
        }

        async function salirDeReserva(reservaId) {
            exigirSesion();
            await rpcPlataforma("salir_de_reserva", { p_reserva: reservaId }, "participantes", "reservas");
        }

        async function actualizarPerfil({ nombre, bio, deporteFavorito }) {
            exigirActivo();
            nombre = validarNombre(nombre, listaProhibidos);
            await rpcPlataforma("actualizar_perfil", { p_nombre: nombre, p_bio: String(bio || ""), p_deporte: String(deporteFavorito || "") }, "perfiles");
            await leerSesion();
            avisar("sesion-cambiada");
        }

        async function listarOpinionesDe(usuarioId) {
            if (!sesion) return [];
            const r = await client.from("opiniones").select("instalacion_id, usuario_id, puntuacion, comentario").eq("usuario_id", usuarioId);
            return r.error ? [] : r.data.map((o) => ({ instalacionId: o.instalacion_id, usuarioId: o.usuario_id, puntuacion: o.puntuacion, comentario: o.comentario }));
        }

        // ---------- monedero ----------

        const saldo = () => redondear(datos.movimientos.reduce((n, m) => n + m.importe, 0));

        async function recargarSaldo(importe) {
            exigirActivo();
            await rpcPlataforma("recargar_saldo", { p_importe: Number(importe) }, "movimientos");
        }

        // ---------- gestores de instalaciones ----------

        async function gestorBloquear({ facility, court, date, time, duracion, nota }) {
            exigirSesion();
            await rpcPlataforma("gestor_bloquear", {
                p_instalacion: Number(facility), p_pista: court, p_fecha: date, p_hora: time,
                p_duracion: Number(duracion), p_nota: String(nota || ""),
            }, "reservas");
        }

        async function gestorDesbloquear(id) {
            exigirSesion();
            await rpcPlataforma("gestor_desbloquear", { p_reserva: id }, "reservas");
        }

        // ---------- pista solidaria ----------

        async function solicitarEntidad(nombre, descripcion) {
            exigirActivo();
            await rpcPlataforma("solicitar_entidad", { p_nombre: String(nombre).trim(), p_descripcion: String(descripcion || "") }, "peticiones_solidarias");
        }

        async function crearPeticionSolidaria({ deporte, instalacionId, fecha, desde, hasta }) {
            exigirActivo();
            await rpcPlataforma("crear_peticion_solidaria", {
                p_deporte: deporte, p_instalacion: instalacionId ? Number(instalacionId) : null,
                p_fecha: fecha, p_desde: desde, p_hasta: hasta,
            }, "peticiones_solidarias");
        }

        async function cancelarPeticionSolidaria(id) {
            exigirSesion();
            await rpcPlataforma("cancelar_peticion_solidaria", { p_peticion: id }, "peticiones_solidarias");
        }

        async function listarOpiniones(instalacionId) {
            exigirSesion();
            const resultado = await client.from("opiniones")
                .select("usuario_id, puntuacion, comentario, perfiles(nombre)")
                .eq("instalacion_id", instalacionId)
                .order("usuario_id");
            if (resultado.error?.code === "PGRST205" || resultado.error?.code === "42P01") return null;
            return comprobar(resultado).map((o) => ({
                usuarioId: o.usuario_id, nombre: o.perfiles?.nombre,
                puntuacion: o.puntuacion, comentario: o.comentario,
            }));
        }

        async function guardarOpinion(datosOpinion) {
            exigirActivo();
            const { instalacionId, puntuacion, comentario } = validarOpinion(datosOpinion);
            comprobar(await client.from("opiniones").upsert({
                instalacion_id: instalacionId, usuario_id: sesion.id, puntuacion, comentario,
            }, { onConflict: "instalacion_id,usuario_id" }));
        }

        // ---------- administración (requiere supabase/admin.sql) ----------

        function exigirAdmin() {
            exigirSesion();
            if (!sesion.admin) throw new Error("Solo un administrador puede hacer esto.");
        }

        async function adminCancelarSubasta(subastaId) {
            exigirAdmin();
            comprobar(await client.rpc("admin_cancelar_subasta", { p_subasta: subastaId }));
            await recargar("subastas");
        }

        async function adminBorrarReserva(id) {
            exigirAdmin();
            await rpcPlataforma("cancelar_reserva", { p_reserva: id }, "reservas");
        }

        async function adminBonificar(usuarioId, importe, concepto) {
            exigirAdmin();
            await rpcPlataforma("admin_bonificar", { p_usuario: usuarioId, p_importe: Number(importe), p_concepto: String(concepto || "") }, "movimientos");
        }

        async function adminFijarSaldo(usuarioId, nuevoSaldo, concepto) {
            exigirAdmin();
            await rpcPlataforma("admin_fijar_saldo", { p_usuario: usuarioId, p_saldo: Number(nuevoSaldo), p_concepto: String(concepto || "") }, "movimientos");
        }

        async function adminAsignarGestor(usuarioId, instalacionId, asignar) {
            exigirAdmin();
            await rpcPlataforma("admin_asignar_gestor", { p_usuario: usuarioId, p_instalacion: Number(instalacionId), p_asignar: Boolean(asignar) }, "gestores");
        }

        async function adminAcreditarEntidad(usuarioId, acreditar) {
            exigirAdmin();
            await rpcPlataforma("admin_acreditar_entidad", { p_usuario: usuarioId, p_acreditar: Boolean(acreditar) });
        }

        async function adminListarPeticionesSolidarias() {
            exigirAdmin();
            const r = await client.from("peticiones_solidarias").select("*, entidades_solidarias(nombre)").order("fecha", { ascending: false });
            return r.error ? [] : r.data.map((x) => ({
                id: x.id, entidadId: x.entidad_id, entidad: x.entidades_solidarias?.nombre || "—", deporte: x.deporte,
                instalacionId: x.instalacion_id, fecha: x.fecha, desde: x.desde, hasta: x.hasta, estado: x.estado,
            }));
        }

        // Mensaje claro si falta la parte nueva de admin.sql
        async function rpcAdmin(funcion, parametros) {
            exigirAdmin();
            const resultado = await client.rpc(funcion, parametros);
            if (noExiste(resultado.error)) {
                throw new Error("Falta actualizar el servidor: ejecuta supabase/admin.sql en el SQL Editor de Supabase.");
            }
            return comprobar(resultado);
        }

        async function adminListarUsuarios() {
            const filas = await rpcAdmin("admin_listar_usuarios");
            return filas.map((u) => ({
                id: u.id, nombre: u.nombre, email: u.email, creado: Date.parse(u.creado),
                admin: u.es_admin, reservas: Number(u.reservas), subastas: Number(u.subastas), pujas: Number(u.pujas),
                bloqueado: Boolean(u.bloqueado), motivoBloqueo: u.motivo_bloqueo || "",
                nombreRechazado: u.nombre_rechazado || "",
                saldo: u.saldo != null ? Number(u.saldo) : null, gestiona: u.gestiona || [],
                entidad: u.entidad || "", entidadAcreditada: Boolean(u.entidad_acreditada),
            }));
        }

        async function adminBloquearUsuario(usuarioId, bloquear, motivo = "") {
            await rpcAdmin("admin_bloquear_usuario", {
                p_usuario: usuarioId, p_bloquear: Boolean(bloquear), p_motivo: String(motivo).slice(0, 200),
            });
        }

        async function adminRenombrarUsuario(usuarioId, nombre) {
            nombre = validarNombre(nombre, listaProhibidos);
            await rpcAdmin("admin_renombrar_usuario", { p_usuario: usuarioId, p_nombre: nombre });
            await recargar("perfiles");
        }

        async function adminBorrarPuja(pujaId) {
            await rpcAdmin("admin_borrar_puja", { p_puja: Number(pujaId) });
            await recargar("pujas", "subastas");
        }

        async function adminListarOpiniones() {
            exigirAdmin();
            let resultado = await client.from("opiniones")
                .select("instalacion_id, usuario_id, puntuacion, comentario, creada, perfiles(nombre)");
            if (resultado.error?.code === "42703") {
                resultado = await client.from("opiniones")
                    .select("instalacion_id, usuario_id, puntuacion, comentario, perfiles(nombre)");
            }
            if (noExiste(resultado.error)) return [];
            return comprobar(resultado).map((o) => ({
                instalacionId: o.instalacion_id, usuarioId: o.usuario_id, nombre: o.perfiles?.nombre,
                puntuacion: o.puntuacion, comentario: o.comentario, creada: o.creada ? Date.parse(o.creada) : null,
            }));
        }

        async function adminBorrarOpinion(instalacionId, usuarioId) {
            exigirAdmin();
            const filas = comprobar(await client.from("opiniones").delete()
                .eq("instalacion_id", instalacionId).eq("usuario_id", usuarioId).select("usuario_id"));
            if (!filas.length) throw new Error("No se ha podido borrar (¿has ejecutado supabase/admin.sql?).");
        }

        async function adminListarNombresProhibidos() {
            exigirAdmin();
            const resultado = await client.from("nombres_prohibidos").select("termino, modo").order("termino");
            if (noExiste(resultado.error)) {
                throw new Error("Falta actualizar el servidor: ejecuta supabase/admin.sql en el SQL Editor de Supabase.");
            }
            listaProhibidos = comprobar(resultado);
            return listaProhibidos;
        }

        async function adminAnadirNombreProhibido(termino, modo) {
            exigirAdmin();
            const fila = validarTermino(termino, modo);
            comprobar(await client.from("nombres_prohibidos").upsert(fila, { onConflict: "termino" }));
            return adminListarNombresProhibidos();
        }

        async function adminQuitarNombreProhibido(termino) {
            exigirAdmin();
            comprobar(await client.from("nombres_prohibidos").delete().eq("termino", termino));
            return adminListarNombresProhibidos();
        }

        async function adminLeerAjustesFacturacion() {
            exigirAdmin();
            const resultado = await client.from("ajustes").select("valor").eq("clave", "facturacion").maybeSingle();
            if (resultado.error || !resultado.data) return { ...FACTURACION_DEFECTO };
            return { ...FACTURACION_DEFECTO, ...resultado.data.valor };
        }

        async function adminGuardarAjustesFacturacion(ajustes) {
            exigirAdmin();
            const valor = validarAjustes(ajustes);
            const resultado = await client.from("ajustes").upsert({ clave: "facturacion", valor }, { onConflict: "clave" });
            if (noExiste(resultado.error)) {
                throw new Error("Falta actualizar el servidor: ejecuta supabase/admin.sql en el SQL Editor de Supabase.");
            }
            comprobar(resultado);
            return valor;
        }

        return {
            inicializar, ahora, registrar, login, cerrarSesion, usuarioActual, getUsuario,
            listarSubastas, getSubasta, crearSubasta, pujar, cancelarSubasta,
            misReservas, pistaOcupada, reservar, cancelarReserva,
            reservasParaAgenda: () => (sesion ? turnosOcupados() : []),
            todasLasReservas: () => datos.reservas,
            turnosOcupados,
            configurarReserva, solicitarUnirse, responderSolicitud, salirDeReserva, actualizarPerfil, listarOpinionesDe,
            participantes: () => datos.participantes,
            movimientos: () => datos.movimientos, saldo, recargarSaldo,
            gestiona: () => datos.gestiona, gestorBloquear, gestorDesbloquear,
            entidad: () => datos.entidad, peticionesSolidarias: () => datos.peticiones,
            solicitarEntidad, crearPeticionSolidaria, cancelarPeticionSolidaria,
            adminBonificar, adminFijarSaldo, adminAsignarGestor, adminAcreditarEntidad, adminListarPeticionesSolidarias,
            crearSubastaReventa, pujarHueco, cerrarSubastas,
            tarifasSubastas: () => tarifas,
            permiteMostrarNombre: () => nombresEnAgenda,
            listarOpiniones, guardarOpinion,
            motivoNombre: (nombre) => motivoNombre(nombre, listaProhibidos),
            textoProhibido: (texto) => textoConTerminoProhibido(texto, listaProhibidos),
            adminListarUsuarios, adminCancelarSubasta, adminBorrarReserva,
            adminBloquearUsuario, adminRenombrarUsuario, adminBorrarPuja,
            adminListarOpiniones, adminBorrarOpinion,
            adminListarNombresProhibidos, adminAnadirNombreProhibido, adminQuitarNombreProhibido,
            adminLeerAjustesFacturacion, adminGuardarAjustesFacturacion,
        };
    }


    // =====================================================================
    // MODO LOCAL (localStorage, sin servidor)
    // =====================================================================

    function crearBackendLocal() {

        // Cada versión publicada (/TrabajoCEGE/, /dev/, /devep/) comparte dominio
        // y por tanto localStorage: se añade la carpeta a la clave para separarlas.
        const CARPETA = location.pathname.replace(/[^/]*$/, "");
        const KEYS = {
            usuarios: `cp_usuarios:${CARPETA}`,
            subastas: `cp_subastas:${CARPETA}`,
            sesion: `cp_sesion:${CARPETA}`,
            reservas: `ceutaplay-padel-reservations:${CARPETA}`,
            opiniones: `cp_opiniones:${CARPETA}`,
            prohibidos: `cp_nombres_prohibidos:${CARPETA}`,
            ajustes: `cp_ajustes_facturacion:${CARPETA}`,
            participantes: `cp_participantes:${CARPETA}`,
            movimientos: `cp_movimientos:${CARPETA}`,
            gestores: `cp_gestores:${CARPETA}`,
            entidades: `cp_entidades:${CARPETA}`,
            peticiones: `cp_peticiones:${CARPETA}`,
            version: `cp_version_demo:${CARPETA}`,
        };
        // Si cambian los datos de ejemplo, se suben de versión y se recrean
        const VERSION_DEMO = "3";

        const ahora = () => Date.now();

        function leer(clave, porDefecto) {
            try {
                const valor = localStorage.getItem(clave);
                return valor ? JSON.parse(valor) : porDefecto;
            } catch {
                return porDefecto;
            }
        }

        function guardar(clave, valor) {
            localStorage.setItem(clave, JSON.stringify(valor));
        }

        function nuevoId() {
            return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
        }

        // Hash SHA-256 de la contraseña con una "sal" aleatoria por usuario
        async function hashPassword(password, sal) {
            const texto = `${sal}:${password}`;
            if (window.crypto && crypto.subtle) {
                const bytes = new TextEncoder().encode(texto);
                const hash = await crypto.subtle.digest("SHA-256", bytes);
                return Array.from(new Uint8Array(hash))
                    .map((b) => b.toString(16).padStart(2, "0"))
                    .join("");
            }
            let h = 0;
            for (let i = 0; i < texto.length; i++) {
                h = (Math.imul(31, h) + texto.charCodeAt(i)) | 0;
            }
            return "x" + (h >>> 0).toString(16);
        }

        function usuarioPublico(usuario) {
            if (!usuario) return null;
            return {
                id: usuario.id, nombre: usuario.nombre, email: usuario.email,
                admin: Boolean(usuario.admin), bloqueado: Boolean(usuario.bloqueado),
                creado: usuario.creado || null, bio: usuario.bio || "", deporteFavorito: usuario.deporteFavorito || "",
            };
        }

        // ---------- monedero ----------

        const todosMovimientos = () => leer(KEYS.movimientos, []);
        function moverSaldo(usuarioId, importe, tipo, concepto, referencia = null) {
            const lista = todosMovimientos();
            lista.push({ id: nuevoId(), usuarioId, importe: redondear(importe), tipo, concepto: String(concepto).slice(0, 160), referencia, creado: ahora() });
            guardar(KEYS.movimientos, lista);
        }
        const saldoDe = (usuarioId) => redondear(todosMovimientos().filter((m) => m.usuarioId === usuarioId).reduce((n, m) => n + m.importe, 0));

        // ---------- cuentas ----------

        const getUsuarios = () => leer(KEYS.usuarios, []);
        const getUsuario = (id) => usuarioPublico(getUsuarios().find((u) => u.id === id));
        const getProhibidos = () => leer(KEYS.prohibidos, NOMBRES_PROHIBIDOS_BASE);

        async function registrar(datosRegistro) {
            const { nombre, email, password } = validarRegistro(datosRegistro, getProhibidos());
            const usuarios = getUsuarios();
            if (usuarios.some((u) => u.email === email)) {
                throw new Error("Ya existe una cuenta con ese correo.");
            }
            const sal = nuevoId();
            const usuario = { id: nuevoId(), nombre, email, sal, hash: await hashPassword(password, sal), creado: Date.now() };
            usuarios.push(usuario);
            guardar(KEYS.usuarios, usuarios);
            moverSaldo(usuario.id, MONEDERO.saldoInicial, "bienvenida", "Saldo inicial de CeutaCoins");
            return usuarioPublico(usuario);
        }

        async function login(email, password, recordar) {
            email = normalizarEmail(email);
            const usuario = getUsuarios().find((u) => u.email === email);
            const hash = usuario ? await hashPassword(password, usuario.sal) : null;
            if (!usuario || hash !== usuario.hash) {
                throw new Error("Correo o contraseña incorrectos.");
            }
            cerrarSesion();
            (recordar ? localStorage : sessionStorage).setItem(KEYS.sesion, usuario.id);
            return usuarioPublico(usuario);
        }

        function cerrarSesion() {
            sessionStorage.removeItem(KEYS.sesion);
            localStorage.removeItem(KEYS.sesion);
        }

        function usuarioActual() {
            const id = sessionStorage.getItem(KEYS.sesion) || localStorage.getItem(KEYS.sesion);
            return id ? getUsuario(id) : null;
        }

        function exigirSesion() {
            const usuario = usuarioActual();
            if (!usuario) throw new Error("Tienes que iniciar sesión.");
            return usuario;
        }

        function exigirActivo() {
            const usuario = exigirSesion();
            if (usuario.bloqueado) throw new Error(CUENTA_SUSPENDIDA);
            return usuario;
        }

        // ---------- subastas ----------

        const getSubastasRaw = () => leer(KEYS.subastas, []);
        const listarSubastas = () => getSubastasRaw().map((s) => enriquecer(s, ahora(), getUsuario));

        function getSubasta(id) {
            const subasta = getSubastasRaw().find((s) => s.id === id);
            return subasta ? enriquecer(subasta, ahora(), getUsuario) : null;
        }

        async function crearSubasta(datosSubasta) {
            const usuario = exigirActivo();
            const v = validarSubasta(datosSubasta);
            const fin = Date.now() + v.duracionMin * MINUTO;
            if (new Date(`${v.fecha}T${v.hora}`).getTime() <= fin) {
                throw new Error("La subasta tiene que terminar antes de que empiece el partido.");
            }
            const subasta = {
                id: nuevoId(),
                instalacionId: v.instalacion.id,
                titulo: v.instalacion.nombre,
                deporte: v.instalacion.deporte,
                fecha: v.fecha,
                hora: v.hora,
                descripcion: v.descripcion,
                precioSalida: v.precioSalida,
                incremento: v.incremento,
                fin,
                vendedorId: usuario.id,
                pujas: [],
                cancelada: false,
                creada: Date.now(),
            };
            const subastas = getSubastasRaw();
            subastas.push(subasta);
            guardar(KEYS.subastas, subastas);
            avisar("datos-cambiados");
            return getSubasta(subasta.id);
        }

        async function pujar(subastaId, cantidad) {
            const usuario = exigirActivo();
            cantidad = Number(cantidad);
            const subastas = getSubastasRaw();
            const raw = subastas.find((s) => s.id === subastaId);
            if (!raw) throw new Error("La subasta no existe.");

            const subasta = enriquecer(raw, ahora(), getUsuario);
            if (subasta.estado !== "activa") throw new Error("Esta subasta ya no está activa.");
            if (subasta.vendedorId === usuario.id) throw new Error("No puedes pujar en tu propia subasta.");
            if (subasta.mejorPuja && subasta.mejorPuja.usuarioId === usuario.id) {
                throw new Error("Ya tienes la puja más alta.");
            }
            if (!Number.isInteger(cantidad) || cantidad < subasta.pujaMinima) {
                throw new Error(`La puja mínima es de ${subasta.pujaMinima} CC.`);
            }
            if (saldoDe(usuario.id) < cantidad) throw new Error("No tienes saldo suficiente para esa puja.");

            raw.pujas.push({ id: nuevoId(), usuarioId: usuario.id, cantidad, fecha: Date.now() });
            guardar(KEYS.subastas, subastas);
            avisar("datos-cambiados");
            return getSubasta(subastaId);
        }

        async function cancelarSubasta(subastaId) {
            const usuario = exigirSesion();
            const subastas = getSubastasRaw();
            const raw = subastas.find((s) => s.id === subastaId);
            if (!raw) throw new Error("La subasta no existe.");
            if (raw.vendedorId !== usuario.id) throw new Error("Solo el creador puede cancelarla.");
            if (raw.pujas.length > 0) throw new Error("No se puede cancelar una subasta que ya tiene pujas.");
            raw.cancelada = true;
            guardar(KEYS.subastas, subastas);
            avisar("datos-cambiados");
        }

        const subastaAbierta = (s) => !s.cancelada && !s.cerrada;

        function tarifasSubastas(instalacionId) {
            const ajustes = { ...FACTURACION_DEFECTO, ...leer(KEYS.ajustes, {}) };
            const bonificada = instalacionId != null ? ajustes.bonificadas?.[instalacionId] : undefined;
            return { comisionSubastas: Number(bonificada ?? ajustes.comisionSubastas), ipsi: Number(ajustes.ipsi) };
        }

        async function crearSubastaReventa(datosReventa) {
            const usuario = exigirActivo();
            const v = validarReventa(datosReventa);
            const reserva = todasLasReservas().find((r) => r.id === v.reservaId);
            if (!reserva || reserva.userId !== usuario.id || (reserva.tipo || "normal") !== "normal") {
                throw new Error("Solo puedes subastar tus propias reservas.");
            }
            const instalacion = INSTALACIONES.find((i) => i.id === reserva.facility);
            if (instalacion && instalacion.subastable === false) {
                throw new Error("Las reservas de esta instalación no se pueden subastar.");
            }
            const inicio = msMadrid(reserva.date, reserva.time);
            if (inicio <= ahora() + 2 * MINUTO) throw new Error("Esta reserva empieza ya: no da tiempo a subastarla.");
            const fin = v.hastaInicio ? inicio : ahora() + v.duracionMin * MINUTO;
            if (fin > inicio) throw new Error("La subasta puede durar como máximo hasta que empiece la reserva.");
            const subastas = getSubastasRaw();
            if (subastas.some((s) => s.reservaId === reserva.id && subastaAbierta(s))) {
                throw new Error("Esta reserva ya está en subasta.");
            }
            const tarifas = tarifasSubastas(reserva.facility);
            const subasta = {
                id: nuevoId(), tipo: "reventa", reservaId: reserva.id, pista: reserva.court,
                instalacionId: reserva.facility,
                titulo: instalacion ? instalacion.nombre : `Instalación ${reserva.facility}`,
                deporte: instalacion ? instalacion.deporte : "Deporte",
                fecha: reserva.date, hora: reserva.time, descripcion: v.descripcion,
                precioSalida: v.precioSalida, incremento: v.incremento, fin,
                vendedorId: usuario.id, pujas: [], cancelada: false, cerrada: false, creada: Date.now(),
                comisionPct: tarifas.comisionSubastas, ipsiPct: tarifas.ipsi,
            };
            subastas.push(subasta);
            guardar(KEYS.subastas, subastas);
            avisar("datos-cambiados");
            return getSubasta(subasta.id);
        }

        async function pujarHueco(instalacionId, fecha, hora, cantidad) {
            exigirActivo();
            const ahoraMs = ahora();
            const hueco = calcularHuecos(ahoraMs, todasLasReservas(), getSubastasRaw())
                .find((h) => h.instalacionId === instalacionId && h.fecha === fecha && h.hora === hora);
            if (!hueco) throw new Error("Ya no quedan pistas libres en ese turno.");
            const tarifas = tarifasSubastas(instalacionId);
            const subasta = {
                id: nuevoId(), tipo: "automatica", reservaId: null, pista: hueco.pistasLibres[0],
                instalacionId, titulo: hueco.titulo, deporte: hueco.deporte, fecha, hora,
                descripcion: "Subasta automática de última hora: pista libre a mitad de precio.",
                precioSalida: hueco.precioSalida, incremento: 1, fin: hueco.fin,
                vendedorId: null, pujas: [], cancelada: false, cerrada: false, creada: ahoraMs,
                comisionPct: tarifas.comisionSubastas, ipsiPct: tarifas.ipsi,
            };
            const subastas = getSubastasRaw();
            subastas.push(subasta);
            guardar(KEYS.subastas, subastas);
            try {
                await pujar(subasta.id, cantidad);
            } catch (error) {
                // la puja no es válida: la subasta no llega a crearse
                guardar(KEYS.subastas, getSubastasRaw().filter((s) => s.id !== subasta.id));
                avisar("datos-cambiados");
                throw error;
            }
            return subasta.id;
        }

        // Adjudica las subastas terminadas (crea la reserva o se la pasa al
        // ganador, cobra y paga) y cede pistas solidarias
        async function cerrarSubastas() {
            const subastas = getSubastasRaw();
            const reservas = todasLasReservas();
            let n = 0;
            for (const raw of subastas) {
                if (!subastaAbierta(raw) || ahora() < raw.fin) continue;
                const mejor = enriquecer(raw, ahora(), getUsuario).mejorPuja;
                raw.cerrada = true;
                n++;
                if (!mejor) continue;
                if (raw.tipo === "automatica") {
                    const nueva = { facility: raw.instalacionId, court: raw.pista, date: raw.fecha, time: raw.hora, duracion: 60 };
                    if (!reservas.some((r) => solapan(r, nueva))) {
                        const id = nuevoId();
                        reservas.push({ ...nueva, id, userId: mejor.usuarioId, importe: mejor.cantidad, tipo: "normal",
                            publica: false, plazas: 4, nota: "", mostrarNombre: false, creada: ahora() });
                        moverSaldo(mejor.usuarioId, -mejor.cantidad, "subasta", `Subasta de última hora ganada · ${raw.titulo} · ${raw.pista}`, id);
                    }
                } else if (raw.tipo === "reventa") {
                    const reserva = reservas.find((r) => r.id === raw.reservaId && r.userId === raw.vendedorId);
                    if (reserva) {
                        Object.assign(reserva, { userId: mejor.usuarioId, publica: false, mostrarNombre: false });
                        guardar(KEYS.participantes, leer(KEYS.participantes, []).filter((x) => x.reservaId !== reserva.id));
                        const r = reparto(mejor.cantidad, raw.comisionPct ?? FACTURACION_DEFECTO.comisionSubastas, raw.ipsiPct ?? FACTURACION_DEFECTO.ipsi);
                        moverSaldo(mejor.usuarioId, -mejor.cantidad, "subasta", `Reventa ganada · ${raw.titulo} · ${raw.pista}`, reserva.id);
                        moverSaldo(raw.vendedorId, r.neto, "venta", `Reventa vendida · ${raw.titulo} (comisión ${raw.comisionPct} % + IPSI)`, reserva.id);
                    }
                }
            }
            const cedidas = cederPistasSolidarias(reservas);
            if (n || cedidas) {
                guardar(KEYS.subastas, subastas);
                guardar(KEYS.reservas, reservas);
                avisar("datos-cambiados");
            }
            return n;
        }

        // Pista solidaria: si una pista de última hora se queda sin pujas (la
        // subasta cierra 15 min antes), se cede a una entidad que la ha pedido
        function cederPistasSolidarias(reservas) {
            const peticiones = leer(KEYS.peticiones, []);
            const hoy = textoMadrid(ahora()).slice(0, 10);
            let cambios = 0;
            for (const pet of peticiones) {
                if (pet.estado === "pendiente" && pet.fecha < hoy) { pet.estado = "caducada"; cambios++; continue; }
                if (pet.estado !== "pendiente" || pet.fecha !== hoy) continue;
                const hora = aHora((Number(textoMadrid(ahora()).slice(11, 13)) + 1) * 60);
                if (msMadrid(hoy, hora) - ahora() > 15 * MINUTO) continue;
                if (aMinutos(hora) < aMinutos(pet.desde) || aMinutos(hora) + 60 > aMinutos(pet.hasta)) continue;
                const candidatas = INSTALACIONES.filter((i) => tieneSubastaAutomatica(i) && i.deporte === pet.deporte &&
                    (!pet.instalacionId || i.id === Number(pet.instalacionId)));
                for (const inst of candidatas) {
                    const { apertura, cierre } = horarioDe(inst);
                    if (aMinutos(hora) < apertura || aMinutos(hora) + 60 > cierre) continue;
                    const pista = inst.pistas.find((c) => !reservas.some((r) =>
                        solapan(r, { facility: inst.id, court: c, date: hoy, time: hora, duracion: 60 })));
                    if (!pista) continue;
                    const id = nuevoId();
                    reservas.push({ id, userId: pet.entidadId, facility: inst.id, court: pista, date: hoy, time: hora,
                        duracion: 60, importe: 0, tipo: "solidaria", publica: false, plazas: 4,
                        nota: "Pista solidaria cedida por CeutaPlay", mostrarNombre: false, creada: ahora() });
                    Object.assign(pet, { estado: "cumplida", reservaId: id });
                    cambios++;
                    break;
                }
            }
            if (cambios) guardar(KEYS.peticiones, peticiones);
            return cambios;
        }

        // ---------- reservas ----------

        const todasLasReservas = () => leer(KEYS.reservas, []);

        function misReservas() {
            const usuario = usuarioActual();
            return usuario ? todasLasReservas().filter((r) => r.userId === usuario.id) : [];
        }

        const pistaOcupada = (facility, court, date, time, duracion = 60) =>
            todasLasReservas().some((r) => solapan(r, { facility, court, date, time, duracion }));

        async function reservar(datosReserva) {
            const usuario = exigirActivo();
            const v = validarReserva(datosReserva, ahora());
            if (pistaOcupada(v.facility, v.court, v.date, v.time, v.duracion)) {
                throw new Error("Esa pista ya está reservada en parte de ese horario.");
            }
            if (getSubastasRaw().some((s) => s.tipo === "automatica" && subastaAbierta(s) &&
                solapan({ facility: Number(s.instalacionId), court: s.pista, date: s.fecha, time: s.hora, duracion: 60 }, v))) {
                throw new Error("Parte de ese horario está en subasta de última hora: puja por él en la sección de subastas.");
            }
            if (saldoDe(usuario.id) < v.importe) throw new Error(`No tienes saldo suficiente (necesitas ${formatoCC(v.importe)}).`);
            const publica = Boolean(datosReserva.publica ?? datosReserva.mostrarNombre);
            const reserva = {
                id: nuevoId(), userId: usuario.id, facility: v.facility, court: v.court, date: v.date, time: v.time,
                duracion: v.duracion, importe: v.importe, tipo: "normal", publica, mostrarNombre: publica,
                plazas: Math.max(1, Math.min(22, Number(datosReserva.plazas) || 4)),
                nota: String(datosReserva.nota || "").slice(0, 140), creada: ahora(),
            };
            const reservas = todasLasReservas();
            reservas.push(reserva);
            guardar(KEYS.reservas, reservas);
            moverSaldo(usuario.id, -v.importe, "reserva",
                `${v.instalacion.nombre} · ${v.court} · ${v.date.split("-").reverse().slice(0, 2).join("/")} ${v.time}`, reserva.id);
            avisar("datos-cambiados");
            return reserva.id;
        }

        function comprobarReservaSinSubasta(id) {
            if (getSubastasRaw().some((s) => s.reservaId === id && subastaAbierta(s))) {
                throw new Error("Esta reserva está en subasta. Cancela antes la subasta (solo si aún no tiene pujas).");
            }
        }

        // Con más de 24 h de antelación se devuelve todo (el administrador, siempre)
        function quitarReserva(id, porAdmin) {
            const reserva = todasLasReservas().find((r) => r.id === id);
            if (!reserva) throw new Error("La reserva no existe.");
            comprobarReservaSinSubasta(id);
            const antelacion = msMadrid(reserva.date, reserva.time) - ahora();
            const devuelve = porAdmin || antelacion > MONEDERO.reembolsoHorasAntes * 60 * MINUTO ? (reserva.importe || 0) : 0;
            guardar(KEYS.reservas, todasLasReservas().filter((r) => r.id !== id));
            guardar(KEYS.participantes, leer(KEYS.participantes, []).filter((x) => x.reservaId !== id));
            if (devuelve > 0) moverSaldo(reserva.userId, devuelve, "reembolso", "Reembolso por cancelación", id);
            avisar("datos-cambiados");
            return devuelve;
        }

        async function cancelarReserva(id) {
            const usuario = exigirSesion();
            const reserva = todasLasReservas().find((r) => r.id === id);
            if (!reserva || reserva.userId !== usuario.id) throw new Error("Solo puedes cancelar tus propias reservas.");
            return quitarReserva(id, false);
        }

        async function configurarReserva(id, { publica, plazas, nota }) {
            const usuario = exigirActivo();
            const reservas = todasLasReservas();
            const reserva = reservas.find((r) => r.id === id && r.userId === usuario.id);
            if (!reserva) throw new Error("Solo puedes cambiar tus propias reservas.");
            Object.assign(reserva, {
                publica: Boolean(publica), mostrarNombre: Boolean(publica),
                plazas: Math.max(1, Math.min(22, Number(plazas) || 4)), nota: String(nota || "").slice(0, 140),
            });
            guardar(KEYS.reservas, reservas);
            avisar("datos-cambiados");
        }

        // ---------- comunidad ----------

        const todosParticipantes = () => leer(KEYS.participantes, []);

        async function solicitarUnirse(reservaId, mensaje = "") {
            const usuario = exigirActivo();
            const reserva = todasLasReservas().find((r) => r.id === reservaId);
            if (!reserva || !reserva.publica) throw new Error("Esta reserva no está abierta a más jugadores.");
            if (reserva.userId === usuario.id) throw new Error("Es tu propia reserva.");
            if (msMadrid(reserva.date, reserva.time) <= ahora()) throw new Error("Esta reserva ya ha empezado.");
            const lista = todosParticipantes();
            const aceptados = lista.filter((x) => x.reservaId === reservaId && x.estado === "aceptado").length;
            if (aceptados + 1 >= (reserva.plazas || 4)) throw new Error("La reserva ya está completa.");
            const previa = lista.find((x) => x.reservaId === reservaId && x.usuarioId === usuario.id);
            if (previa && previa.estado !== "rechazado") return;
            const fila = { reservaId, usuarioId: usuario.id, estado: "pendiente", mensaje: String(mensaje).slice(0, 140), creado: ahora() };
            guardar(KEYS.participantes, [...lista.filter((x) => x !== previa), fila]);
            avisar("datos-cambiados");
        }

        async function responderSolicitud(reservaId, usuarioId, aceptar) {
            const usuario = exigirActivo();
            const reserva = todasLasReservas().find((r) => r.id === reservaId);
            if (!reserva || reserva.userId !== usuario.id) throw new Error("Solo el dueño de la reserva puede responder.");
            const lista = todosParticipantes();
            const fila = lista.find((x) => x.reservaId === reservaId && x.usuarioId === usuarioId);
            if (!fila) throw new Error("No existe esa solicitud.");
            if (aceptar && lista.filter((x) => x.reservaId === reservaId && x.estado === "aceptado").length + 1 >= (reserva.plazas || 4)) {
                throw new Error("La reserva ya está completa.");
            }
            fila.estado = aceptar ? "aceptado" : "rechazado";
            guardar(KEYS.participantes, lista);
            avisar("datos-cambiados");
        }

        async function salirDeReserva(reservaId) {
            const usuario = exigirSesion();
            guardar(KEYS.participantes, todosParticipantes().filter((x) => !(x.reservaId === reservaId && x.usuarioId === usuario.id)));
            avisar("datos-cambiados");
        }

        async function actualizarPerfil({ nombre, bio, deporteFavorito }) {
            const usuario = exigirActivo();
            cambiarUsuario(usuario.id, {
                nombre: validarNombre(nombre, getProhibidos()),
                bio: String(bio || "").trim().slice(0, 280),
                deporteFavorito: String(deporteFavorito || "").trim().slice(0, 40),
            });
            avisar("sesion-cambiada");
        }

        async function listarOpinionesDe(usuarioId) {
            return leer(KEYS.opiniones, []).filter((o) => o.usuarioId === usuarioId);
        }

        // ---------- monedero ----------

        async function recargarSaldo(importe) {
            const usuario = exigirActivo();
            importe = Number(importe);
            if (!(importe >= 1 && importe <= 100000)) throw new Error("Recarga entre 1 y 100.000 CC.");
            moverSaldo(usuario.id, importe, "recarga", "Recarga de CeutaCoins (simulada)");
            avisar("datos-cambiados");
        }

        // ---------- gestores de instalaciones ----------

        const gestoresDe = () => leer(KEYS.gestores, {}); // { usuarioId: [instalacionId…] }
        const esGestorDe = (usuarioId, instalacionId) => (gestoresDe()[usuarioId] || []).includes(Number(instalacionId));

        async function gestorBloquear({ facility, court, date, time, duracion, nota }) {
            const usuario = exigirSesion();
            if (!esGestorDe(usuario.id, facility) && !usuario.admin) throw new Error("Solo los gestores de esta instalación pueden bloquear turnos.");
            const instalacion = INSTALACIONES.find((i) => i.id === Number(facility));
            if (!instalacion || !instalacion.pistas.includes(court)) throw new Error("Elige una pista.");
            const nuevo = { facility: instalacion.id, court, date, time, duracion: Number(duracion) || 60 };
            if (pistaOcupada(nuevo.facility, court, date, time, nuevo.duracion)) throw new Error("Esa pista ya está reservada en parte de ese horario.");
            const reservas = todasLasReservas();
            reservas.push({ ...nuevo, id: nuevoId(), userId: usuario.id, importe: 0, tipo: "bloqueo", publica: false,
                plazas: 1, nota: String(nota || "Bloqueado por la instalación").slice(0, 140), mostrarNombre: false, creada: ahora() });
            guardar(KEYS.reservas, reservas);
            avisar("datos-cambiados");
        }

        async function gestorDesbloquear(id) {
            const usuario = exigirSesion();
            const reserva = todasLasReservas().find((r) => r.id === id && r.tipo === "bloqueo");
            if (!reserva || (!esGestorDe(usuario.id, reserva.facility) && !usuario.admin)) throw new Error("No se ha podido desbloquear.");
            guardar(KEYS.reservas, todasLasReservas().filter((r) => r.id !== id));
            avisar("datos-cambiados");
        }

        // ---------- pista solidaria ----------

        async function solicitarEntidad(nombre, descripcion) {
            const usuario = exigirActivo();
            nombre = String(nombre || "").trim();
            if (nombre.length < 3) throw new Error("Escribe el nombre de la entidad.");
            const entidades = leer(KEYS.entidades, {});
            entidades[usuario.id] = { ...(entidades[usuario.id] || { acreditada: false }), nombre, descripcion: String(descripcion || "").slice(0, 280) };
            guardar(KEYS.entidades, entidades);
            avisar("datos-cambiados");
        }

        async function crearPeticionSolidaria({ deporte, instalacionId, fecha, desde, hasta }) {
            const usuario = exigirActivo();
            if (!leer(KEYS.entidades, {})[usuario.id]?.acreditada) throw new Error("Solo las entidades acreditadas pueden pedir pista solidaria.");
            if (!fecha || fecha < textoMadrid(ahora()).slice(0, 10) || aMinutos(hasta) <= aMinutos(desde)) throw new Error("Revisa la fecha y la franja horaria.");
            const lista = leer(KEYS.peticiones, []);
            lista.push({ id: nuevoId(), entidadId: usuario.id, deporte, instalacionId: instalacionId ? Number(instalacionId) : null,
                fecha, desde, hasta, estado: "pendiente", reservaId: null, creada: ahora() });
            guardar(KEYS.peticiones, lista);
            avisar("datos-cambiados");
        }

        async function cancelarPeticionSolidaria(id) {
            const usuario = exigirSesion();
            const lista = leer(KEYS.peticiones, []);
            const pet = lista.find((x) => x.id === id && x.entidadId === usuario.id && x.estado === "pendiente");
            if (pet) pet.estado = "cancelada";
            guardar(KEYS.peticiones, lista);
            avisar("datos-cambiados");
        }

        async function listarOpiniones(instalacionId) {
            exigirSesion();
            return leer(KEYS.opiniones, []).filter((o) => o.instalacionId === instalacionId)
                .map((o) => ({ ...o, nombre: getUsuario(o.usuarioId)?.nombre }));
        }

        async function guardarOpinion(datosOpinion) {
            const usuario = exigirActivo();
            const opinion = validarOpinion(datosOpinion);
            const opiniones = leer(KEYS.opiniones, []).filter((o) =>
                o.instalacionId !== opinion.instalacionId || o.usuarioId !== usuario.id);
            opiniones.push({ ...opinion, usuarioId: usuario.id, creada: Date.now() });
            guardar(KEYS.opiniones, opiniones);
        }

        // ---------- datos de ejemplo ----------

        async function crearDatosDemo() {
            if (localStorage.getItem(KEYS.usuarios) && localStorage.getItem(KEYS.version) === VERSION_DEMO) return;
            // datos de una versión anterior: se empieza de cero
            Object.values(KEYS).forEach((k) => localStorage.removeItem(k));

            const t = Date.now();
            const dia = (n) => textoMadrid(t + n * 24 * 60 * MINUTO).slice(0, 10);
            const movimientos = [];
            const mover = (usuarioId, importe, tipo, concepto, creado, referencia = null) =>
                movimientos.push({ id: nuevoId(), usuarioId, importe: redondear(importe), tipo, concepto, referencia, creado });

            // usuarios (con su saldo inicial), gestores y entidad solidaria
            const usuarios = [];
            const gestores = {};
            const entidades = {};
            for (const [n, demo] of USUARIOS_DEMO.entries()) {
                const sal = nuevoId();
                const u = {
                    id: nuevoId(), nombre: demo.nombre, email: normalizarEmail(demo.email), sal,
                    hash: await hashPassword(demo.password, sal), creado: t - (60 - n * 3) * 24 * 60 * MINUTO,
                    admin: Boolean(demo.admin), bio: demo.bio || "", deporteFavorito: demo.deporte || "",
                };
                usuarios.push(u);
                mover(u.id, MONEDERO.saldoInicial, "bienvenida", "Saldo inicial de CeutaCoins", u.creado);
                if (demo.gestiona) gestores[u.id] = demo.gestiona;
                if (demo.entidad) entidades[u.id] = { ...demo.entidad };
            }
            const id = (claveOEmail) => usuarios[USUARIOS_DEMO.findIndex((d) => d.clave === claveOEmail || d.email === claveOEmail)].id;

            // reservas (cobradas) y quién se ha unido
            const reservas = [];
            const participantes = [];
            for (const demo of RESERVAS_DEMO) {
                const instalacion = INSTALACIONES.find((i) => i.id === demo.instalacionId);
                const fecha = dia(demo.dias);
                const importe = precioTurno(instalacion, fecha, demo.hora, demo.duracion);
                const creada = t + (demo.dias - 3) * 24 * 60 * MINUTO;
                const r = {
                    id: nuevoId(), userId: id(demo.usuario), facility: demo.instalacionId, court: demo.pista,
                    date: fecha, time: demo.hora, duracion: demo.duracion, importe, tipo: "normal",
                    publica: Boolean(demo.publica), mostrarNombre: Boolean(demo.publica), plazas: demo.plazas || 4,
                    nota: demo.nota || "", creada,
                };
                reservas.push(r);
                mover(r.userId, -importe, "reserva", `${instalacion.nombre} · ${r.court} · ${fecha.split("-").reverse().slice(0, 2).join("/")} ${r.time}`, creada, r.id);
                for (const x of demo.participantes || []) {
                    participantes.push({ reservaId: r.id, usuarioId: id(x.usuario), estado: x.estado, mensaje: x.mensaje || "", creado: creada + 3600000 });
                }
            }

            // un bloqueo del gestor (mantenimiento)
            reservas.push({
                id: nuevoId(), userId: id("gestor"), facility: 1, court: "Pista 3", date: dia(2), time: "09:00", duracion: 120,
                importe: 0, tipo: "bloqueo", publica: false, mostrarNombre: false, plazas: 1, nota: "Mantenimiento del césped", creada: t,
            });

            // reseñas
            const opiniones = OPINIONES_DEMO.map((o) => ({
                instalacionId: o.instalacionId, usuarioId: id(o.usuario), puntuacion: o.puntuacion,
                comentario: o.comentario, creada: t + o.dias * 24 * 60 * MINUTO,
            }));

            // subastas de reventa (cada una sobre una reserva del vendedor)
            const subastas = SUBASTAS_DEMO.map((demo) => {
                const instalacion = INSTALACIONES.find((i) => i.id === demo.instalacionId);
                const partido = new Date(t + demo.partidoEnHoras * 60 * MINUTO);
                partido.setMinutes(0, 0, 0);
                if (partido.getHours() < 9) partido.setHours(9);
                else if (partido.getHours() > 20) { partido.setDate(partido.getDate() + 1); partido.setHours(10); }
                const fecha = fechaISO(partido);
                const hora = partido.toTimeString().slice(0, 5);
                const reserva = {
                    id: nuevoId(), userId: id(demo.vendedor), facility: instalacion.id, court: instalacion.pistas[0],
                    date: fecha, time: hora, duracion: 60, importe: precioTurno(instalacion, fecha, hora, 60), tipo: "normal",
                    publica: false, mostrarNombre: false, plazas: 4, nota: "", creada: t - 24 * 60 * MINUTO,
                };
                if (!reservas.some((r) => solapan(r, reserva))) {
                    reservas.push(reserva);
                    mover(reserva.userId, -reserva.importe, "reserva", `${instalacion.nombre} · ${reserva.court}`, reserva.creada, reserva.id);
                }
                return {
                    id: nuevoId(), tipo: "reventa", reservaId: reserva.id, pista: reserva.court,
                    comisionPct: FACTURACION_DEFECTO.comisionSubastas, ipsiPct: FACTURACION_DEFECTO.ipsi, cerrada: false,
                    instalacionId: instalacion.id, titulo: instalacion.nombre, deporte: instalacion.deporte,
                    fecha, hora, descripcion: demo.descripcion, precioSalida: demo.precioSalida, incremento: demo.incremento,
                    fin: t + demo.terminaEnMin * MINUTO, vendedorId: id(demo.vendedor),
                    pujas: demo.pujas.map((x, k) => ({ id: nuevoId(), usuarioId: id(x.email), cantidad: x.cantidad, fecha: t - (demo.pujas.length - k) * 5 * MINUTO })),
                    cancelada: false, creada: t - 60 * MINUTO,
                };
            });

            // una petición solidaria pendiente para hoy
            const peticiones = [{
                id: nuevoId(), entidadId: id("entidad"), deporte: "Pádel", instalacionId: null, fecha: dia(0),
                desde: "16:00", hasta: "20:00", estado: "pendiente", reservaId: null, creada: t,
            }];

            guardar(KEYS.usuarios, usuarios);
            guardar(KEYS.reservas, reservas);
            guardar(KEYS.participantes, participantes);
            guardar(KEYS.opiniones, opiniones);
            guardar(KEYS.subastas, subastas);
            guardar(KEYS.movimientos, movimientos);
            guardar(KEYS.gestores, gestores);
            guardar(KEYS.entidades, entidades);
            guardar(KEYS.peticiones, peticiones);
            localStorage.setItem(KEYS.version, VERSION_DEMO);
        }

        async function inicializar() {
            await crearDatosDemo();
            // Cambios hechos en otra pestaña del mismo navegador
            window.addEventListener("storage", (event) => {
                if (event.key === KEYS.sesion) avisar("sesion-cambiada");
                else if (event.key === null) { avisar("sesion-cambiada"); avisar("datos-cambiados"); }
                else if (Object.values(KEYS).includes(event.key)) avisar("datos-cambiados");
            });
        }

        // Borra todo y vuelve a crear los datos de ejemplo
        async function reiniciarDemo() {
            Object.values(KEYS).forEach((k) => localStorage.removeItem(k));
            cerrarSesion();
            await crearDatosDemo();
            avisar("datos-cambiados");
        }

        // ---------- administración ----------
        // En modo local no hay cuenta de administrador por defecto: se puede
        // marcar una cuenta poniendo "admin": true en su usuario de localStorage.

        function exigirAdmin() {
            const usuario = exigirSesion();
            if (!usuario.admin) throw new Error("Solo un administrador puede hacer esto.");
            return usuario;
        }

        async function adminListarUsuarios() {
            exigirAdmin();
            const subastas = getSubastasRaw();
            const reservas = todasLasReservas();
            return getUsuarios().map((u) => ({
                id: u.id, nombre: u.nombre, email: u.email, creado: u.creado, admin: Boolean(u.admin),
                bloqueado: Boolean(u.bloqueado), motivoBloqueo: u.motivoBloqueo || "",
                nombreRechazado: u.nombreRechazado || "",
                saldo: saldoDe(u.id), gestiona: gestoresDe()[u.id] || [],
                entidad: leer(KEYS.entidades, {})[u.id]?.nombre || "", entidadAcreditada: Boolean(leer(KEYS.entidades, {})[u.id]?.acreditada),
                reservas: reservas.filter((r) => r.userId === u.id && (r.tipo || "normal") === "normal").length,
                subastas: subastas.filter((s) => s.vendedorId === u.id).length,
                pujas: subastas.reduce((n, s) => n + s.pujas.filter((p) => p.usuarioId === u.id).length, 0),
            })).sort((a, b) => b.creado - a.creado);
        }

        async function adminCancelarSubasta(subastaId) {
            exigirAdmin();
            const subastas = getSubastasRaw();
            const raw = subastas.find((s) => s.id === subastaId);
            if (!raw) throw new Error("La subasta no existe.");
            raw.cancelada = true;
            guardar(KEYS.subastas, subastas);
            avisar("datos-cambiados");
        }

        async function adminBorrarReserva(id) {
            exigirAdmin();
            return quitarReserva(id, true);
        }

        async function adminBonificar(usuarioId, importe, concepto) {
            exigirAdmin();
            importe = Number(importe);
            if (!importe || Math.abs(importe) > 1e9) throw new Error("Importe no válido.");
            moverSaldo(usuarioId, importe, "bonificacion", String(concepto || "").trim() || "Bonificación de CeutaPlay");
            avisar("datos-cambiados");
        }

        async function adminFijarSaldo(usuarioId, nuevoSaldo, concepto) {
            exigirAdmin();
            nuevoSaldo = Number(nuevoSaldo);
            if (!(nuevoSaldo >= 0 && nuevoSaldo <= 1e9)) throw new Error("El saldo tiene que estar entre 0 y 1.000.000.000 CC.");
            const diferencia = redondear(nuevoSaldo - saldoDe(usuarioId));
            if (diferencia) moverSaldo(usuarioId, diferencia, "ajuste", String(concepto || "").trim() || "Ajuste de saldo por el administrador");
            avisar("datos-cambiados");
        }

        async function adminAsignarGestor(usuarioId, instalacionId, asignar) {
            exigirAdmin();
            const mapa = gestoresDe();
            const lista = new Set(mapa[usuarioId] || []);
            if (asignar) lista.add(Number(instalacionId)); else lista.delete(Number(instalacionId));
            mapa[usuarioId] = [...lista].sort((a, b) => a - b);
            guardar(KEYS.gestores, mapa);
            avisar("datos-cambiados");
        }

        async function adminAcreditarEntidad(usuarioId, acreditar) {
            exigirAdmin();
            const entidades = leer(KEYS.entidades, {});
            if (!entidades[usuarioId]) throw new Error("Ese usuario no ha solicitado ser entidad solidaria.");
            entidades[usuarioId].acreditada = Boolean(acreditar);
            guardar(KEYS.entidades, entidades);
            avisar("datos-cambiados");
        }

        async function adminListarPeticionesSolidarias() {
            exigirAdmin();
            const entidades = leer(KEYS.entidades, {});
            return leer(KEYS.peticiones, []).map((x) => ({ ...x, entidad: entidades[x.entidadId]?.nombre || "—" }))
                .sort((a, b) => b.fecha.localeCompare(a.fecha));
        }

        function cambiarUsuario(usuarioId, cambios) {
            const usuarios = getUsuarios();
            const usuario = usuarios.find((u) => u.id === usuarioId);
            if (!usuario) throw new Error("El usuario no existe.");
            Object.assign(usuario, cambios);
            guardar(KEYS.usuarios, usuarios);
            avisar("datos-cambiados");
        }

        async function adminBloquearUsuario(usuarioId, bloquear, motivo = "") {
            const admin = exigirAdmin();
            if (usuarioId === admin.id) throw new Error("No puedes suspender tu propia cuenta.");
            if (getUsuario(usuarioId)?.admin) throw new Error("No se puede suspender a otro administrador.");
            cambiarUsuario(usuarioId, {
                bloqueado: Boolean(bloquear),
                motivoBloqueo: bloquear ? String(motivo).trim().slice(0, 200) : "",
            });
        }

        async function adminRenombrarUsuario(usuarioId, nombre) {
            exigirAdmin();
            nombre = validarNombre(nombre, getProhibidos());
            cambiarUsuario(usuarioId, { nombre, nombreRechazado: "" });
        }

        // En modo local las pujas antiguas no tienen id: se identifican por fecha y usuario
        const idPuja = (p) => p.id || `${p.fecha}-${p.usuarioId}`;

        async function adminBorrarPuja(pujaId) {
            exigirAdmin();
            const subastas = getSubastasRaw();
            const subasta = subastas.find((s) => s.pujas.some((p) => idPuja(p) === pujaId));
            if (!subasta) throw new Error("La puja no existe.");
            if (enriquecer(subasta, ahora(), getUsuario).estado !== "activa") {
                throw new Error("Solo se pueden anular pujas de subastas en curso.");
            }
            subasta.pujas = subasta.pujas.filter((p) => idPuja(p) !== pujaId);
            guardar(KEYS.subastas, subastas);
            avisar("datos-cambiados");
        }

        async function adminListarOpiniones() {
            exigirAdmin();
            return leer(KEYS.opiniones, []).map((o) => ({
                ...o, nombre: getUsuario(o.usuarioId)?.nombre, creada: o.creada || null,
            }));
        }

        async function adminBorrarOpinion(instalacionId, usuarioId) {
            exigirAdmin();
            guardar(KEYS.opiniones, leer(KEYS.opiniones, []).filter((o) =>
                !(o.instalacionId === instalacionId && o.usuarioId === usuarioId)));
            avisar("datos-cambiados");
        }

        async function adminListarNombresProhibidos() {
            exigirAdmin();
            return [...getProhibidos()].sort((a, b) => a.termino.localeCompare(b.termino));
        }

        async function adminAnadirNombreProhibido(termino, modo) {
            exigirAdmin();
            const fila = validarTermino(termino, modo);
            guardar(KEYS.prohibidos, [...getProhibidos().filter((e) => e.termino !== fila.termino), fila]);
            return adminListarNombresProhibidos();
        }

        async function adminQuitarNombreProhibido(termino) {
            exigirAdmin();
            guardar(KEYS.prohibidos, getProhibidos().filter((e) => e.termino !== termino));
            return adminListarNombresProhibidos();
        }

        async function adminLeerAjustesFacturacion() {
            exigirAdmin();
            return { ...FACTURACION_DEFECTO, ...leer(KEYS.ajustes, {}) };
        }

        async function adminGuardarAjustesFacturacion(ajustes) {
            exigirAdmin();
            const valor = validarAjustes(ajustes);
            guardar(KEYS.ajustes, valor);
            return valor;
        }

        return {
            inicializar, reiniciarDemo, ahora, registrar, login, cerrarSesion, usuarioActual, getUsuario,
            listarSubastas, getSubasta, crearSubasta, pujar, cancelarSubasta,
            misReservas, pistaOcupada, reservar, cancelarReserva,
            reservasParaAgenda: () => usuarioActual() ? todasLasReservas() : [],
            todasLasReservas,
            turnosOcupados: todasLasReservas,
            configurarReserva, solicitarUnirse, responderSolicitud, salirDeReserva, actualizarPerfil, listarOpinionesDe,
            participantes: () => {
                const u = usuarioActual();
                if (!u) return [];
                const mias = new Set(todasLasReservas().filter((r) => r.userId === u.id).map((r) => r.id));
                const publicas = new Set(todasLasReservas().filter((r) => r.publica).map((r) => r.id));
                return todosParticipantes().filter((x) => x.usuarioId === u.id || mias.has(x.reservaId) ||
                    (x.estado === "aceptado" && publicas.has(x.reservaId)));
            },
            movimientos: () => {
                const u = usuarioActual();
                return u ? todosMovimientos().filter((m) => m.usuarioId === u.id).sort((a, b) => b.creado - a.creado) : [];
            },
            saldo: () => (usuarioActual() ? saldoDe(usuarioActual().id) : 0),
            recargarSaldo,
            gestiona: () => (usuarioActual() ? gestoresDe()[usuarioActual().id] || [] : []),
            gestorBloquear, gestorDesbloquear,
            entidad: () => (usuarioActual() ? leer(KEYS.entidades, {})[usuarioActual().id] || null : null),
            peticionesSolidarias: () => {
                const u = usuarioActual();
                return u ? leer(KEYS.peticiones, []).filter((x) => x.entidadId === u.id).sort((a, b) => b.fecha.localeCompare(a.fecha)) : [];
            },
            solicitarEntidad, crearPeticionSolidaria, cancelarPeticionSolidaria,
            adminBonificar, adminFijarSaldo, adminAsignarGestor, adminAcreditarEntidad, adminListarPeticionesSolidarias,
            crearSubastaReventa, pujarHueco, cerrarSubastas,
            tarifasSubastas: () => tarifasSubastas(),
            permiteMostrarNombre: () => true,
            listarOpiniones, guardarOpinion,
            motivoNombre: (nombre) => motivoNombre(nombre, getProhibidos()),
            textoProhibido: (texto) => textoConTerminoProhibido(texto, getProhibidos()),
            adminListarUsuarios, adminCancelarSubasta, adminBorrarReserva,
            adminBloquearUsuario, adminRenombrarUsuario, adminBorrarPuja,
            adminListarOpiniones, adminBorrarOpinion,
            adminListarNombresProhibidos, adminAnadirNombreProhibido, adminQuitarNombreProhibido,
            adminLeerAjustesFacturacion, adminGuardarAjustesFacturacion,
        };
    }


    // =====================================================================

    const backend = modo === "remoto" ? crearBackendRemoto() : crearBackendLocal();

    // ---------- capa común de subastas (igual en los dos modos) ----------

    // Turnos libres que ahora mismo están en subasta automática (sin pujas aún)
    function listarHuecosAutomaticos() {
        const t = backend.ahora();
        return calcularHuecos(t, backend.turnosOcupados(), backend.listarSubastas())
            .map((h) => enriquecer(h, t, backend.getUsuario));
    }

    const esHueco = (id) => String(id).startsWith("auto|");

    function getSubasta(id) {
        return esHueco(id) ? listarHuecosAutomaticos().find((h) => h.id === id) || null : backend.getSubasta(id);
    }

    // Pujar en un turno libre crea la subasta automática; devuelve la subasta real
    async function pujar(id, cantidad) {
        if (!esHueco(id)) return backend.pujar(id, cantidad);
        const [, instalacionId, fecha, hora] = String(id).split("|");
        const nuevoId = await backend.pujarHueco(Number(instalacionId), fecha, hora, cantidad);
        return backend.getSubasta(nuevoId);
    }

    // Pistas en subasta automática abierta: en la agenda aparecen ocupadas
    function turnosEnSubasta() {
        return backend.listarSubastas()
            .filter((s) => s.tipo === "automatica" && !s.cancelada && !s.cerrada)
            .map((s) => ({
                id: `subasta-${s.id}`, subastaId: s.id, userId: null, enSubasta: true,
                facility: Number(s.instalacionId), court: s.pista, date: s.fecha, time: s.hora, duracion: 60,
            }));
    }

    function reservasParaAgenda() {
        const reservas = backend.reservasParaAgenda();
        return backend.usuarioActual() ? [...reservas, ...turnosEnSubasta()] : reservas;
    }

    const pistaOcupada = (facility, court, date, time, duracion = 60) => backend.pistaOcupada(facility, court, date, time, duracion) ||
        turnosEnSubasta().some((r) => solapan(r, { facility, court, date, time, duracion }));

    // ---------- comunidad: puntos a partir de la actividad visible ----------
    function puntosDe(usuarioId) {
        const ahoraMs = backend.ahora();
        const jugadas = backend.todasLasReservas().filter((r) => r.userId === usuarioId && (r.tipo || "normal") === "normal" &&
            msMadrid(r.date, r.time) < ahoraMs).length;
        const unidas = backend.participantes().filter((x) => x.usuarioId === usuarioId && x.estado === "aceptado").length;
        const subastas = backend.listarSubastas();
        const pujas = subastas.reduce((n, s) => n + s.pujas.filter((x) => x.usuarioId === usuarioId).length, 0);
        const ganadas = subastas.filter((s) => s.ganador && s.ganador.id === usuarioId).length;
        const vendidas = subastas.filter((s) => s.vendedorId === usuarioId && s.ganador).length;
        const puntos = jugadas * 10 + unidas * 6 + pujas * 1 + ganadas * 8 + vendidas * 4;
        return { ...nivelDe(puntos), detalle: { jugadas, unidas, pujas, ganadas, vendidas } };
    }

    // Reservas abiertas (públicas) futuras a las que se puede pedir unirse
    function reservasAbiertas() {
        const ahoraMs = backend.ahora();
        const participantes = backend.participantes();
        return backend.todasLasReservas()
            .filter((r) => r.publica && (r.tipo || "normal") === "normal" && msMadrid(r.date, r.time) > ahoraMs)
            .map((r) => {
                const aceptados = participantes.filter((x) => x.reservaId === r.id && x.estado === "aceptado");
                return { ...r, aceptados, libres: Math.max(0, (r.plazas || 4) - 1 - aceptados.length) };
            })
            .sort((a, b) => `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`));
    }

    // Adjudicar las subastas terminadas (una llamada a la vez)
    let cerrando = null;
    function cerrarSubastas() {
        cerrando = cerrando || backend.cerrarSubastas().catch(() => 0).finally(() => (cerrando = null));
        return cerrando;
    }
    const hayPorCerrar = () => backend.listarSubastas().some((s) => s.estado === "finalizada" && !s.cerrada);

    // inicializar() se puede llamar varias veces: solo se ejecuta una
    let arranque = null;
    const inicializar = () => (arranque = arranque || backend.inicializar().then(async () => {
        if (hayPorCerrar()) await cerrarSubastas();
        setInterval(() => {
            if (hayPorCerrar()) cerrarSubastas();
        }, 20000);
    }));

    return {
        ...backend, modo, inicializar,
        listarHuecosAutomaticos, getSubasta, pujar, reservasParaAgenda, pistaOcupada, cerrarSubastas,
        msMadrid, textoMadrid, solapan, puntosDe, nivelDe, NIVELES, reservasAbiertas,
    };
})();
