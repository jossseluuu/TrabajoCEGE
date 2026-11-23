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

    function validarRegistro({ nombre, email, password }) {
        nombre = String(nombre || "").trim();
        email = normalizarEmail(email);
        if (nombre.length < 2) throw new Error("El nombre debe tener al menos 2 caracteres.");
        if (nombre.length > 40) throw new Error("El nombre no puede tener más de 40 caracteres.");
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

    // Añade a una subasta los campos calculados (estado, puja actual, ganador…)
    function enriquecer(subasta, ahora, getUsuario) {
        const pujas = [...subasta.pujas].sort((a, b) => b.cantidad - a.cantidad || a.fecha - b.fecha);
        const mejor = pujas[0] || null;

        let estado = "activa";
        if (subasta.cancelada) estado = "cancelada";
        else if (ahora >= subasta.fin) estado = "finalizada";

        return {
            ...subasta,
            pujas,
            estado,
            precioActual: mejor ? mejor.cantidad : subasta.precioSalida,
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
                }));
            },
            async pujas() {
                const filas = comprobar(await client.from("pujas").select("subasta_id, usuario_id, cantidad, fecha"));
                datos.pujas = filas.map((p) => ({
                    subastaId: p.subasta_id,
                    usuarioId: p.usuario_id,
                    cantidad: p.cantidad,
                    fecha: Date.parse(p.fecha),
                }));
            },
            async reservas() {
                if (!sesion) {
                    datos.reservas = [];
                    return;
                }
                const filas = comprobar(await client.from("reservas").select("*"));
                datos.reservas = filas.map((r) => ({
                    id: r.id,
                    userId: r.usuario_id,
                    facility: r.instalacion_id,
                    court: r.pista,
                    date: r.fecha,
                    time: r.hora,
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
                     datos.subastas.some((s) => desconocido(s.vendedorId)))) {
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
            const perfil = await client.from("perfiles").select("nombre").eq("id", usuario.id).maybeSingle();
            if (perfil.data) nombre = perfil.data.nombre;
            sesion = { id: usuario.id, email: usuario.email, nombre: nombre || usuario.email.split("@")[0] };
        }

        async function inicializar() {
            const [hora] = await Promise.all([
                client.rpc("hora_servidor").then((r) => r, () => ({})),
                leerSesion().catch(() => (sesion = null)),
            ]);
            if (hora && hora.data) desfase = Date.parse(hora.data) - Date.now();

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
            const { nombre, email, password } = validarRegistro(datosRegistro);
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

        async function crearSubasta(datosSubasta) {
            exigirSesion();
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
            exigirSesion();
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

        // ---------- reservas ----------

        const misReservas = () => (sesion ? datos.reservas.filter((r) => r.userId === sesion.id) : []);

        const pistaOcupada = (facility, court, date, time) => datos.reservas.some((r) =>
            r.facility === facility && r.court === court && r.date === date && r.time === time);

        async function reservar({ facility, court, date, time }) {
            exigirSesion();
            comprobar(await client.from("reservas").insert({
                instalacion_id: facility, pista: court, fecha: date, hora: time,
            }));
            await recargar("reservas");
        }

        async function cancelarReserva(id) {
            exigirSesion();
            comprobar(await client.from("reservas").delete().eq("id", id));
            await recargar("reservas");
        }

        return {
            inicializar, ahora, registrar, login, cerrarSesion, usuarioActual, getUsuario,
            listarSubastas, getSubasta, crearSubasta, pujar, cancelarSubasta,
            misReservas, pistaOcupada, reservar, cancelarReserva,
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
            return { id: usuario.id, nombre: usuario.nombre, email: usuario.email };
        }

        // ---------- cuentas ----------

        const getUsuarios = () => leer(KEYS.usuarios, []);
        const getUsuario = (id) => usuarioPublico(getUsuarios().find((u) => u.id === id));

        async function registrar(datosRegistro) {
            const { nombre, email, password } = validarRegistro(datosRegistro);
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

        // ---------- subastas ----------

        const getSubastasRaw = () => leer(KEYS.subastas, []);
        const listarSubastas = () => getSubastasRaw().map((s) => enriquecer(s, ahora(), getUsuario));

        function getSubasta(id) {
            const subasta = getSubastasRaw().find((s) => s.id === id);
            return subasta ? enriquecer(subasta, ahora(), getUsuario) : null;
        }

        async function crearSubasta(datosSubasta) {
            const usuario = exigirSesion();
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
            const usuario = exigirSesion();
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

            raw.pujas.push({ usuarioId: usuario.id, cantidad, fecha: Date.now() });
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

        // ---------- reservas ----------

        const todasLasReservas = () => leer(KEYS.reservas, []);

        function misReservas() {
            const usuario = usuarioActual();
            return usuario ? todasLasReservas().filter((r) => r.userId === usuario.id) : [];
        }

        const pistaOcupada = (facility, court, date, time) => todasLasReservas().some((r) =>
            r.facility === facility && r.court === court && r.date === date && r.time === time);

        async function reservar({ facility, court, date, time }) {
            const usuario = exigirSesion();
            if (pistaOcupada(facility, court, date, time)) {
                throw new Error("Esa pista ya está reservada por otro usuario en ese turno.");
            }
            const reservas = todasLasReservas();
            reservas.push({ id: nuevoId(), userId: usuario.id, facility, court, date, time });
            guardar(KEYS.reservas, reservas);
            avisar("datos-cambiados");
        }

        async function cancelarReserva(id) {
            const usuario = exigirSesion();
            guardar(KEYS.reservas, todasLasReservas().filter((r) => !(r.id === id && r.userId === usuario.id)));
            avisar("datos-cambiados");
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
                });
            }
            guardar(KEYS.usuarios, usuarios);

            const idPorEmail = (email) => usuarios.find((u) => u.email === normalizarEmail(email)).id;
            const t = Date.now();

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
                return {
                    id: nuevoId(),
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
                        usuarioId: idPorEmail(p.email),
                        cantidad: p.cantidad,
                        fecha: t - (demo.pujas.length - i) * 5 * MINUTO,
                    })),
                    cancelada: false,
                    creada: t,
                };
            });
            guardar(KEYS.subastas, subastas);
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

        return {
            inicializar, reiniciarDemo, ahora, registrar, login, cerrarSesion, usuarioActual, getUsuario,
            listarSubastas, getSubasta, crearSubasta, pujar, cancelarSubasta,
            misReservas, pistaOcupada, reservar, cancelarReserva,
        };
    }


    // =====================================================================

    const backend = modo === "remoto" ? crearBackendRemoto() : crearBackendLocal();

    // inicializar() se puede llamar varias veces: solo se ejecuta una
    let arranque = null;
    const inicializar = () => (arranque = arranque || backend.inicializar());

    return { ...backend, modo, inicializar };
})();
