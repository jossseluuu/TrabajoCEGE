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

    function validarRegistro({ nombre, email, password }, lista) {
        nombre = validarNombre(nombre, lista);
        email = normalizarEmail(email);
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("El correo no es válido.");
        if (String(password || "").length < 6) throw new Error("La contraseña debe tener al menos 6 caracteres.");
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
        if (!datos.reservaId) throw new Error("Elige la reserva que quieres subastar.");
        if (!(precioSalida >= 1)) throw new Error("El precio de salida debe ser de al menos 1 €.");
        if (!(incremento >= 1)) throw new Error("El incremento mínimo debe ser de al menos 1 €.");
        if (!(duracionMin >= 1)) throw new Error("Elige la duración de la subasta.");
        return {
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

    const tieneSubastaAutomatica = (i) => Boolean(i.pistas && i.pistas.length) && i.subastable !== false &&
        (i.subastaAutomatica ?? SUBASTA_AUTOMATICA.deportes.includes(i.deporte));

    const precioSalidaAutomatica = (i) =>
        Math.max(1, Math.ceil((i.precioPrueba || 0) * SUBASTA_AUTOMATICA.descuentoSalida));

    const claveTurno = (instalacionId, pista, fecha, hora) => `${instalacionId}|${pista}|${fecha}|${hora}`;

    function calcularHuecos(ahora, ocupados, subastas) {
        const ventana = SUBASTA_AUTOMATICA.horasAntes * 60 * MINUTO;
        const cierre = SUBASTA_AUTOMATICA.cierreMinAntes * MINUTO;
        const ocupado = new Set(ocupados.map((r) => claveTurno(r.facility, r.court, r.date, r.time)));
        for (const sub of subastas) {
            if (sub.tipo === "automatica" && !sub.cancelada) ocupado.add(claveTurno(sub.instalacionId, sub.pista, sub.fecha, sub.hora));
        }
        const dias = [textoMadrid(ahora).slice(0, 10), textoMadrid(ahora + 24 * 60 * MINUTO).slice(0, 10)];
        const huecos = [];
        for (const inst of INSTALACIONES.filter(tieneSubastaAutomatica)) {
            for (const fecha of dias) {
                for (const hora of inst.horario || HORARIO_DEFECTO) {
                    const inicio = msMadrid(fecha, hora);
                    const fin = inicio - cierre;
                    if (ahora < inicio - ventana || ahora >= fin) continue;
                    const libres = inst.pistas.filter((p) => !ocupado.has(claveTurno(inst.id, p, fecha, hora)));
                    if (!libres.length) continue;
                    huecos.push({
                        id: `auto|${inst.id}|${fecha}|${hora}`, virtual: true, tipo: "automatica",
                        instalacionId: inst.id, titulo: inst.nombre, deporte: inst.deporte, fecha, hora,
                        pista: null, pistasLibres: libres, descripcion: "",
                        precioSalida: precioSalidaAutomatica(inst), incremento: 1,
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
        // turnos ocupados (sin datos personales) para quien no ha iniciado sesión
        let ocupadosPublicos = [];
        const datos = { perfiles: new Map(), subastas: [], pujas: [], reservas: [] };

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
                const filas = comprobar(await client.from("perfiles").select("id, nombre"));
                datos.perfiles = new Map(filas.map((p) => [p.id, { id: p.id, nombre: p.nombre }]));
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
                if (!sesion) {
                    datos.reservas = [];
                    const r = await client.rpc("turnos_ocupados");
                    ocupadosPublicos = r.error ? [] : r.data.map((t) => ({
                        facility: t.instalacion_id, court: t.pista, date: t.fecha, time: t.hora,
                    }));
                    return;
                }
                const campos = "id, usuario_id, instalacion_id, pista, fecha, hora, creada";
                let resultado = await client.from("reservas").select(`${campos}, mostrar_nombre`);
                if (resultado.error?.code === "42703" || resultado.error?.code === "PGRST204") {
                    nombresEnAgenda = false;
                    resultado = await client.from("reservas").select(campos);
                } else if (!resultado.error) {
                    nombresEnAgenda = true;
                }
                const filas = comprobar(resultado);
                datos.reservas = filas.map((r) => ({
                    id: r.id,
                    userId: r.usuario_id,
                    facility: r.instalacion_id,
                    court: r.pista,
                    date: r.fecha,
                    time: r.hora,
                    creada: Date.parse(r.creada) || null,
                    mostrarNombre: r.mostrar_nombre === true,
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
                     datos.reservas.some((r) => r.mostrarNombre && desconocido(r.userId)))) {
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
                        recargar("reservas");
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
            await recargar("perfiles", "reservas");
            return sesion;
        }

        async function login(email, password, recordar) {
            sessionStorage.setItem(RECORDAR, recordar ? "1" : "0");
            comprobar(await client.auth.signInWithPassword({ email: normalizarEmail(email), password }));
            await leerSesion();
            await recargar("perfiles", "reservas");
            return sesion;
        }

        async function cerrarSesion() {
            sesion = null;
            datos.reservas = [];
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
            if (!Number.isInteger(cantidad)) throw new Error("La puja tiene que ser un número entero de euros.");
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
            new Error("Falta actualizar el servidor: ejecuta supabase/subastas.sql en el SQL Editor de Supabase.");

        async function crearSubastaReventa(datosReventa) {
            exigirActivo();
            const v = validarReventa(datosReventa);
            const resultado = await client.rpc("crear_subasta_reventa", {
                p_reserva: v.reservaId, p_precio_salida: v.precioSalida, p_incremento: v.incremento,
                p_duracion_min: v.duracionMin, p_descripcion: v.descripcion,
            });
            if (noExiste(resultado.error)) throw faltaSubastasSql();
            const id = comprobar(resultado);
            await recargar("subastas");
            return getSubasta(id);
        }

        async function pujarHueco(instalacionId, fecha, hora, cantidad) {
            exigirActivo();
            cantidad = Number(cantidad);
            if (!Number.isInteger(cantidad)) throw new Error("La puja tiene que ser un número entero de euros.");
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
            if (resultado.data > 0) await recargar("subastas", "reservas");
            return resultado.data;
        }

        // ---------- reservas ----------

        const misReservas = () => (sesion ? datos.reservas.filter((r) => r.userId === sesion.id) : []);

        const pistaOcupada = (facility, court, date, time) => datos.reservas.some((r) =>
            r.facility === facility && r.court === court && r.date === date && r.time === time);

        async function reservar({ facility, court, date, time, mostrarNombre = false }) {
            exigirActivo();
            comprobar(await client.from("reservas").insert({
                instalacion_id: facility, pista: court, fecha: date, hora: time,
                ...(mostrarNombre && nombresEnAgenda ? { mostrar_nombre: true } : {}),
            }));
            await recargar("reservas");
        }

        async function cancelarReserva(id) {
            exigirSesion();
            comprobar(await client.from("reservas").delete().eq("id", id));
            await recargar("reservas");
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
            const filas = comprobar(await client.from("reservas").delete().eq("id", id).select("id"));
            if (!filas.length) throw new Error("No se ha podido borrar (¿has ejecutado supabase/admin.sql?).");
            await recargar("reservas");
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
            reservasParaAgenda: () => sesion ? datos.reservas : [],
            todasLasReservas: () => datos.reservas,
            turnosOcupados: () => (sesion ? datos.reservas : ocupadosPublicos),
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
        };

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
            };
        }

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
                throw new Error(`La puja mínima es de ${subasta.pujaMinima} €.`);
            }

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
            if (!reserva || reserva.userId !== usuario.id) throw new Error("Solo puedes subastar tus propias reservas.");
            const instalacion = INSTALACIONES.find((i) => i.id === reserva.facility);
            if (instalacion && instalacion.subastable === false) {
                throw new Error("Las reservas de esta instalación no se pueden subastar.");
            }
            const fin = Date.now() + v.duracionMin * MINUTO;
            if (msMadrid(reserva.date, reserva.time) <= fin) {
                throw new Error("La subasta tiene que terminar antes de que empiece el partido.");
            }
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

        // Adjudica las subastas terminadas: crea la reserva (automáticas) o
        // se la pasa al ganador (reventa)
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
                    const ocupada = reservas.some((r) => r.facility === raw.instalacionId && r.court === raw.pista &&
                        r.date === raw.fecha && r.time === raw.hora);
                    if (!ocupada) {
                        reservas.push({
                            id: nuevoId(), userId: mejor.usuarioId, facility: raw.instalacionId, court: raw.pista,
                            date: raw.fecha, time: raw.hora, mostrarNombre: false, creada: ahora(),
                        });
                    }
                } else if (raw.tipo === "reventa") {
                    const reserva = reservas.find((r) => r.id === raw.reservaId && r.userId === raw.vendedorId);
                    if (reserva) Object.assign(reserva, { userId: mejor.usuarioId, mostrarNombre: false });
                }
            }
            if (n) {
                guardar(KEYS.subastas, subastas);
                guardar(KEYS.reservas, reservas);
                avisar("datos-cambiados");
            }
            return n;
        }

        // ---------- reservas ----------

        const todasLasReservas = () => leer(KEYS.reservas, []);

        function misReservas() {
            const usuario = usuarioActual();
            return usuario ? todasLasReservas().filter((r) => r.userId === usuario.id) : [];
        }

        const pistaOcupada = (facility, court, date, time) => todasLasReservas().some((r) =>
            r.facility === facility && r.court === court && r.date === date && r.time === time);

        async function reservar({ facility, court, date, time, mostrarNombre = false }) {
            const usuario = exigirActivo();
            if (pistaOcupada(facility, court, date, time)) {
                throw new Error("Esa pista ya está reservada por otro usuario en ese turno.");
            }
            if (getSubastasRaw().some((s) => s.tipo === "automatica" && subastaAbierta(s) &&
                s.instalacionId === facility && s.pista === court && s.fecha === date && s.hora === time)) {
                throw new Error("Esa pista está en subasta de última hora: puja por ella en la sección de subastas.");
            }
            const reservas = todasLasReservas();
            reservas.push({ id: nuevoId(), userId: usuario.id, facility, court, date, time, mostrarNombre, creada: Date.now() });
            guardar(KEYS.reservas, reservas);
            avisar("datos-cambiados");
        }

        function comprobarReservaSinSubasta(id) {
            if (getSubastasRaw().some((s) => s.reservaId === id && subastaAbierta(s))) {
                throw new Error("Esta reserva está en subasta. Cancela antes la subasta (solo si aún no tiene pujas).");
            }
        }

        async function cancelarReserva(id) {
            const usuario = exigirSesion();
            comprobarReservaSinSubasta(id);
            guardar(KEYS.reservas, todasLasReservas().filter((r) => !(r.id === id && r.userId === usuario.id)));
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
            if (localStorage.getItem(KEYS.usuarios)) return;

            const usuarios = [];
            for (const demo of USUARIOS_DEMO) {
                const sal = nuevoId();
                usuarios.push({
                    id: nuevoId(),
                    nombre: demo.nombre,
                    email: normalizarEmail(demo.email),
                    sal,
                    hash: await hashPassword(demo.password, sal),
                    creado: Date.now(),
                    admin: Boolean(demo.admin),
                });
            }
            guardar(KEYS.usuarios, usuarios);

            const idPorEmail = (email) => usuarios.find((u) => u.email === normalizarEmail(email)).id;
            const t = Date.now();

            const reservasSubastadas = [];
            const subastas = SUBASTAS_DEMO.map((demo) => {
                const instalacion = INSTALACIONES.find((i) => i.id === demo.instalacionId);
                // Hora del partido redondeada y dentro del horario de las pistas (9:00–22:00)
                const partido = new Date(t + demo.partidoEnHoras * 60 * MINUTO);
                partido.setMinutes(0, 0, 0);
                if (partido.getHours() < 9) {
                    partido.setHours(9);
                } else if (partido.getHours() > 22) {
                    partido.setDate(partido.getDate() + 1);
                    partido.setHours(9);
                }
                const reserva = {
                    id: nuevoId(), userId: idPorEmail(demo.vendedor), facility: instalacion.id,
                    court: instalacion.pistas[0], date: fechaISO(partido), time: partido.toTimeString().slice(0, 5),
                    mostrarNombre: false, creada: t - 24 * 60 * MINUTO,
                };
                reservasSubastadas.push(reserva);
                return {
                    id: nuevoId(),
                    tipo: "reventa",
                    reservaId: reserva.id,
                    pista: reserva.court,
                    comisionPct: FACTURACION_DEFECTO.comisionSubastas,
                    ipsiPct: FACTURACION_DEFECTO.ipsi,
                    cerrada: false,
                    instalacionId: instalacion.id,
                    titulo: instalacion.nombre,
                    deporte: instalacion.deporte,
                    fecha: fechaISO(partido),
                    hora: partido.toTimeString().slice(0, 5),
                    descripcion: demo.descripcion,
                    precioSalida: demo.precioSalida,
                    incremento: demo.incremento,
                    fin: t + demo.terminaEnMin * MINUTO,
                    vendedorId: idPorEmail(demo.vendedor),
                    pujas: demo.pujas.map((p, i) => ({
                        id: nuevoId(),
                        usuarioId: idPorEmail(p.email),
                        cantidad: p.cantidad,
                        fecha: t - (demo.pujas.length - i) * 5 * MINUTO,
                    })),
                    cancelada: false,
                    creada: t,
                };
            });
            guardar(KEYS.subastas, subastas);

            guardar(KEYS.reservas, [...reservasSubastadas, ...RESERVAS_DEMO.map((demo) => {
                const dia = new Date(t + demo.diasDesdeHoy * 24 * 60 * MINUTO);
                return {
                    id: nuevoId(), userId: idPorEmail(demo.email), facility: demo.instalacionId,
                    court: demo.pista, date: fechaISO(dia), time: demo.hora, mostrarNombre: false,
                    creada: dia.getTime() - 2 * 24 * 60 * MINUTO,
                };
            })]);
        }

        // Navegadores con datos de antes de existir la cuenta de administrador de prueba
        async function asegurarAdminDemo() {
            const usuarios = getUsuarios();
            const demo = USUARIOS_DEMO.find((u) => u.admin);
            if (!demo || usuarios.some((u) => u.email === demo.email)) return;
            const sal = nuevoId();
            usuarios.push({
                id: nuevoId(), nombre: demo.nombre, email: demo.email, sal,
                hash: await hashPassword(demo.password, sal), creado: Date.now(), admin: true,
            });
            guardar(KEYS.usuarios, usuarios);
        }

        async function inicializar() {
            await crearDatosDemo();
            await asegurarAdminDemo();
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
                reservas: reservas.filter((r) => r.userId === u.id).length,
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
            comprobarReservaSinSubasta(id);
            guardar(KEYS.reservas, todasLasReservas().filter((r) => r.id !== id));
            avisar("datos-cambiados");
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
                facility: Number(s.instalacionId), court: s.pista, date: s.fecha, time: s.hora,
            }));
    }

    function reservasParaAgenda() {
        const reservas = backend.reservasParaAgenda();
        return backend.usuarioActual() ? [...reservas, ...turnosEnSubasta()] : reservas;
    }

    const pistaOcupada = (facility, court, date, time) => backend.pistaOcupada(facility, court, date, time) ||
        turnosEnSubasta().some((r) => r.facility === facility && r.court === court && r.date === date && r.time === time);

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
        msMadrid,
    };
})();
